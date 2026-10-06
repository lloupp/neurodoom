extends Node

const Save = preload("res://scripts/systems/save_system.gd")
const Campaign = preload("res://data/campaign.gd")
const Cache = preload("res://scripts/systems/sprite_cache.gd")
const Sprite = preload("res://scripts/enemies/enemy_sprite_controller.gd")
const Forge = preload("res://addons/neurodoom_tools/scripts/sprite_forge.gd")
var failures: Array[String] = []
var checks := 0

func check(condition: bool,title: String) -> void:
	checks += 1
	if not condition:
		failures.append(title)
		printerr("TEST FAIL: ",title)

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	call_deferred("_run")

func settle(frames := 4) -> void:
	for i in frames: await get_tree().physics_frame
	await get_tree().process_frame

func _run() -> void:
	# Keep the runner across actual scene transitions. Test user data isolated by shell.
	get_tree().current_scene = null
	await settle()
	_catalogs()
	_maps()
	GameState.new_game()
	await settle()
	check(get_tree().current_scene.name == "Campaign","New Game opens campaign")
	var player = GameState.player
	check(player.health == 100,"new run health")
	var full: Dictionary = GameState.snapshot()
	check(Save.validate(full),"schema accepts runtime snapshot")
	check(Save.write_save(full,"user://test_slot.json"),"write test save")
	check(Save.read_save("user://test_slot.json") == JSON.parse_string(JSON.stringify(full,"",true,true)),"serialization roundtrip")
	for mutation in [{"version":99},{"level":-1},{"player":{}},{"world":{"bad":{"kind":"enemy","hp":"invalid"}}},{"stats":{}}]:
		var bad := full.duplicate(true)
		bad.merge(mutation,true)
		check(not Save.validate(bad),"reject corrupt payload %s" % str(mutation))
		check(not Save.write_save(bad,"user://test_slot.json"),"invalid write refused")
		check(Save.read_save("user://test_slot.json") == JSON.parse_string(JSON.stringify(full,"",true,true)),"invalid write preserves slot")
	var legacy := {"version":1,"player":{"position":[0,1,8],"health":100,"ammo":4,"reserve_ammo":20,"yaw":0,"pitch":0},"power_restored":true,"door_open":false,"completed":false,"objective":"legacy"}
	check(Save.validate(Save.migrate(legacy)),"explicit v1 migration")
	player.apply_damage(20)
	check(player.health == 80,"damage")
	player.heal(50)
	check(player.health == 100,"heal capped")
	var pickup := NeuroPickup.new()
	pickup.name = "test_card"
	pickup.pickup_type = "keycard"
	pickup.item_id = "test_card"
	get_tree().current_scene.add_child(pickup)
	pickup.interact(player)
	check(player.keycards.has("test_card"),"inventory keycard")
	check(GameState.world.test_card.collected,"pickup persistence tombstone")
	_sprites()
	await _combat()
	# Restore deterministic start for progression and save/load checks.
	GameState.restore_run(full)
	await settle()
	for index in Campaign.LEVELS.size():
		check(GameState.level == index,"campaign stage order %d" % index)
		check(not GameState.can_exit(),"exit locked before objectives %d" % index)
		var stage_player = GameState.player
		# Structural traversal uses debug objective fulfillment; NOT normal gameplay evidence.
		for node in get_tree().get_nodes_in_group("persistent"):
			if node is NeuroPickup and node.pickup_type == "keycard": node.interact(stage_player)
		for enemy in get_tree().get_nodes_in_group("enemies"):
			enemy.apply_damage(10000)
		GameState.restore_power()
		await settle()
		check(GameState.can_exit(),"stage objectives unlock exit %d" % index)
		var saved: Dictionary = GameState.snapshot()
		check(Save.validate(saved),"stage snapshot %d: %s" % [index,Save.last_error])

		GameState.restore_run(saved)
		await settle()
		check(GameState.can_exit(),"restored access %d" % index)
		check(get_tree().get_nodes_in_group("enemies").all(func(e): return e.health == 0),"defeated enemies stay dead %d" % index)
		check(not get_tree().get_nodes_in_group("persistent").any(func(n): return n is NeuroPickup and n.pickup_type == "keycard"),"collected card stays removed %d" % index)
		GameState.advance()
		await settle()
	check(GameState.completed,"final interaction ends run")
	GameState.return_to_menu()
	await settle()
	check(get_tree().current_scene.name == "MainMenu","ending returns to menu")
	check(GameState.load_game(),"Continue loads valid save")
	await settle()
	check(GameState.completed and GameState.level == 4,"Continue restores ending")
	GameState.new_game()
	await settle()
	check(GameState.level == 0 and not GameState.completed and GameState.player.keycards.is_empty(),"New Game resets run")
	# Real input pause test, including simulation freeze.
	var pause_input := InputEventKey.new()
	pause_input.keycode = KEY_ESCAPE
	pause_input.pressed = true
	Input.parse_input_event(pause_input)
	await get_tree().process_frame
	check(get_tree().paused,"ESC pauses scene tree")
	var health_before: int = GameState.player.health
	var time_before: float = GameState.stats.time
	await settle(10)
	check(GameState.player.health == health_before and GameState.stats.time == time_before,"paused combat and timer frozen")
	Input.parse_input_event(pause_input)
	await get_tree().process_frame
	check(not get_tree().paused,"ESC resumes")
	GameState.player.apply_damage(1000)
	check(GameState.player.health == 0,"lethal damage")
	GameState.respawn()
	await settle()
	check(GameState.player.health > 0 and GameState.stats.deaths == 1,"checkpoint restores live player and counts death")
	print("PRODUCTION TESTS: %d checks; %d failures" % [checks,failures.size()])
	GameState.return_to_menu()
	await settle()
	get_tree().quit(0 if failures.is_empty() else 1)

func get_tree_safe_root() -> Node:
	return Engine.get_main_loop().root

func _catalogs() -> void:
	check(NeuroWeapons.DATA.size() == 4,"four weapons")
	check(NeuroEnemies.DATA.size() == 9,"nine enemy kinds")
	check(NeuroWeapons.DATA.shotgun.pellets == 8,"shotgun pellets")
	check(NeuroWeapons.DATA.pulse_rifle.automatic,"pulse automatic")
	check(NeuroWeapons.DATA.rocket_launcher.splash > 0,"rocket blast")
	var manifest = JSON.parse_string(FileAccess.get_file_as_string("res://art/runtime/runtime_manifest.json"))
	check(manifest.enemies.size() == 9 and manifest.weapons.size() == 4,"runtime manifest catalog")
	for id in manifest.enemies:
		var texture: Texture2D = load("res://art/runtime/enemies/%s_sheet.svg" % id)
		check(texture.get_size() == Vector2(2048,1600),"enemy dimensions " + id)
		var pixels := texture.get_image()
		for row in 5:
			for column in 8:
				var used := pixels.get_region(Rect2i(column*256,row*320,256,320)).get_used_rect()
				check(used.size.x > 20 and used.size.y > 20,"nonempty enemy cell %s %d/%d" % [id,column,row])
	for id in manifest.weapons:
		var texture: Texture2D = load("res://art/runtime/weapons/%s_sheet.svg" % id)
		check(texture.get_size() == Vector2(3840,460),"weapon dimensions " + id)
		var pixels := texture.get_image()
		for column in 5:
			check(pixels.get_region(Rect2i(column*768,0,768,460)).get_used_rect().size.x > 100,"nonempty weapon cell %s %d" % [id,column])
	var fx: Texture2D = load(NeuroImpact.FX_PATH)
	check(fx.get_size() == Vector2(1024,256),"fx dimensions")
	var fx_pixels := fx.get_image()
	for kind in NeuroImpact.REGIONS:
		var region: Rect2 = NeuroImpact.REGIONS[kind]
		var listed: Array = manifest.fx_regions[kind]
		check(region == Rect2(listed[0],listed[1],listed[2],listed[3]),"fx region matches manifest " + kind)
		var used := fx_pixels.get_region(Rect2i(region)).get_used_rect()
		check(used.size.x > 20 and used.size.y > 20,"nonempty fx region " + kind)
		# Effect is not cut by its region: a transparent margin remains on every side.
		check(used.position.x > 0 and used.position.y > 0 and used.end.x < int(region.size.x) and used.end.y < int(region.size.y),"fx region not clipped " + kind)
		check(NeuroImpact.texture(kind) == NeuroImpact.texture(kind),"fx texture cached " + kind)
	for action in Settings.BINDINGS.keys() + ["fire"]:
		check(InputMap.has_action(action) and not InputMap.action_get_events(action).is_empty(),"input action bound " + action)
	var w := InputEventKey.new()
	w.physical_keycode = KEY_W
	check(w.is_action("move_forward"),"physical W moves forward")
	Settings.rebind("move_forward",KEY_E)
	check(Settings.key_for("move_forward") == KEY_E and Settings.key_for("interact") == KEY_W,"rebind swaps conflicting key")
	var saved := ConfigFile.new()
	saved.load(Settings.PATH)
	check(saved.get_value("bindings","move_forward") == KEY_E,"bindings persisted")
	var capture_root := Control.new()
	get_tree().root.add_child(capture_root)
	NeuroMenuFactory.controls(capture_root,func(): pass)
	check(get_tree().get_nodes_in_group("key_capture").size() == Settings.BINDINGS.size(),"controls screen lists every action")
	capture_root.free()
	Settings.reset_bindings()
	check(Settings.key_for("move_forward") == KEY_W and Settings.key_for("interact") == KEY_E,"reset bindings")
	check(Forge._parse_stem("walk_front_left_003").frame == 3,"forge naming")
	check(Forge._parse_stem("invalid").is_empty(),"forge rejects missing frame")

func _maps() -> void:
	for stage in Campaign.LEVELS:
		var grid: Array = stage.map
		var entry := Vector2i.ZERO
		var goals: Array[Vector2i] = []
		for z in grid.size():
			check(grid[z].length() == grid[0].length(),"rectangular " + stage.id + " row " + str(z))
			for x in grid[z].length():
				if grid[z][x] == "P": entry = Vector2i(x,z)
				if grid[z][x] in ["K","T","X","B"]: goals.append(Vector2i(x,z))
		var visited := {entry:true}
		var queue: Array[Vector2i] = [entry]
		while not queue.is_empty():
			var cell := queue.pop_front() as Vector2i
			for delta in [Vector2i.LEFT,Vector2i.RIGHT,Vector2i.UP,Vector2i.DOWN]:
				var neighbor: Vector2i = cell + delta
				if neighbor.y < 0 or neighbor.y >= grid.size() or neighbor.x < 0 or neighbor.x >= grid[neighbor.y].length(): continue
				if grid[neighbor.y][neighbor.x] in ["#","Q"] or visited.has(neighbor): continue
				visited[neighbor] = true
				queue.append(neighbor)
		for goal in goals: check(visited.has(goal),"reachable objective %s %s" % [stage.id,goal])

func _sprites() -> void:
	for i in 8:
		var angle := float(i)*TAU/8.0
		var direction := Vector3.FORWARD.rotated(Vector3.UP,angle)
		# Convention matches ordered front -> left -> back -> right columns.
		check(Sprite.direction_index(Vector3.FORWARD,direction) == i,"direction %d" % i)
	var path := "res://art/runtime/enemies/heavy_sheet.svg"
	var a := Cache.region(path,Vector2i.ZERO,Vector2i(256,320))
	check(a == Cache.region(path,Vector2i.ZERO,Vector2i(256,320)),"cached atlas identity")
	check(a.region.size == Vector2(256,320),"single frame region")

func _combat() -> void:
	for original in get_tree().get_nodes_in_group("enemies"): original.queue_free()
	await settle()
	var player = GameState.player
	var enemy := NeuroEnemy.new()
	enemy.name = "test_enemy"
	enemy.enemy_kind = "drone"
	enemy.position = player.position + Vector3(0,0,-4)
	get_tree().current_scene.add_child(enemy)
	await settle()
	enemy.target = player
	check(enemy.sees_player(),"enemy perception sees unobstructed player")
	var wall := NeuroLevelBlock.new()
	wall.position = player.position+Vector3(0,1,-2)
	wall.block_size = Vector3(2,3,0.4)
	get_tree().current_scene.add_child(wall)
	await settle()
	check(not enemy.sees_player(),"wall blocks attacks/perception")
	wall.queue_free()
	await settle()
	enemy.position = player.position+Vector3(0,0,-4)
	enemy.speed = 0
	enemy.attack_range = 0.1
	player.select_weapon("pistol")
	var before: int = player.ammo
	player._fire()
	check(player.ammo == before-1,"shot consumes correct magazine")
	# Aim at collider torso; actual ray requires physics synchronization.
	player.camera.look_at(enemy.global_position+Vector3.UP)
	player.fire_cooldown = 0
	player._fire()
	check(enemy.health < enemy.max_health,"hitscan damages enemy")
	var old_reserve: int = player.reserve_ammo
	player.reload_weapon()
	player._physics_process(2)
	check(player.ammo == 12 and player.reserve_ammo < old_reserve,"timed reload transfers reserve")
	enemy.health = enemy.max_health
	enemy.state = NeuroEnemy.State.IDLE
	enemy.memory = 0.0
	enemy.apply_damage(1)
	check(enemy.state == NeuroEnemy.State.ALERT and enemy.memory > 0.0 and enemy.last_known.distance_to(player.global_position) < 0.01,"damage alerts enemy to shooter")
	var twin := NeuroEnemy.new()
	twin.enemy_kind = "drone"
	get_tree().current_scene.add_child(twin)
	twin.global_position = enemy.global_position + Vector3(0.3,0,0)
	check(enemy._separation().x < 0.0,"nearby enemies push apart")
	twin.queue_free()
	enemy.apply_damage(10000)
	check(enemy.state == NeuroEnemy.State.DEAD and is_instance_valid(enemy),"death holds visual")
	await settle(60)
	check(not is_instance_valid(enemy),"death frees after animation")
	var rocket_target := NeuroEnemy.new()
	rocket_target.name = "RocketTarget"
	rocket_target.enemy_kind = "heavy"
	rocket_target.speed = 0
	rocket_target.attack_range = 0.1
	rocket_target.position = player.position+Vector3(0,0,-8)
	get_tree().current_scene.add_child(rocket_target)
	await settle()
	player.camera.look_at(rocket_target.global_position+Vector3.UP)
	player.select_weapon("rocket_launcher")
	player.fire_cooldown = 0
	player._fire()
	check(player.ammo == 3,"rocket consumes limited ammo")
	await settle(45)
	check(rocket_target.health < rocket_target.max_health,"physical projectile and splash damage")
	check(player.health == 100,"distant rocket leaves shooter safe")
	rocket_target.queue_free()

