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
	check(Campaign.validate_levels(Campaign.current_levels()).is_empty(),"authored campaign maps pass reachability validation")
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
	Settings.values.difficulty = 2
	player.apply_damage(20)
	check(player.health == 70,"hard difficulty scales damage taken")
	player.heal(100)
	Settings.values.difficulty = 1
	player.apply_damage(20)
	check(player.health == 80,"damage")
	await get_tree().process_frame
	var hud := get_tree().current_scene.find_children("*","NeuroHUD",true,false)
	check(not hud.is_empty() and float(hud[0].vignette.material.get_shader_parameter("intensity")) > 0.5,"damage vignette shows on hit")
	player.heal(50)
	check(player.health == 100,"heal capped")
	var start_position: Vector3 = player.position
	Input.action_press("sprint")
	Input.action_press("move_forward")
	player._physics_process(1.0)
	check(is_equal_approx(player.stamina,100.0-35.0),"sprint drains stamina")
	player.stamina = 0.5
	player._physics_process(0.1)
	check(player.stamina > 0.5,"exhausted sprint does not drain, it regenerates")
	Input.action_release("sprint")
	Input.action_release("move_forward")
	player._physics_process(1.0)
	check(player.stamina >= 30.0,"stamina regenerates")
	player.stamina = player.max_stamina
	player.position = start_position
	player.velocity = Vector3.ZERO
	var pickup := NeuroPickup.new()
	pickup.name = "test_card"
	pickup.pickup_type = "keycard"
	pickup.item_id = "test_card"
	get_tree().current_scene.add_child(pickup)
	pickup.interact(player)
	check(player.keycards.has("test_card"),"inventory keycard")
	player.inventory.append("sector_9_test")
	var panel: NeuroInventoryPanel = player.find_children("*","NeuroInventoryPanel",true,false)[0]
	panel.open()
	check(get_tree().paused and panel.root.visible,"inventory pauses and shows")
	check(NeuroInventoryPanel.log_text("sector_9_test").begins_with("DR. VALE"),"log readable from inventory")
	panel.close()
	check(not get_tree().paused and not panel.root.visible,"inventory closes and resumes")
	player.inventory.erase("sector_9_test")
	check(GameState.world.test_card.collected,"pickup persistence tombstone")
	await _product_flows()
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
	var decal_root := Node3D.new()
	get_tree().root.add_child(decal_root)
	var first := NeuroImpact.scorch(decal_root,Vector3.ZERO,Vector3.BACK)
	check(first.global_transform.basis.y.is_equal_approx(Vector3.BACK),"scorch faces surface normal")
	for i in NeuroImpact.MAX_SCORCH + 5: NeuroImpact.scorch(decal_root,Vector3(i,0,0),Vector3.UP)
	check(decal_root.get_child_count() == NeuroImpact.MAX_SCORCH,"scorch decal pool bounded")
	var streak := NeuroImpact.tracer(decal_root,Vector3.ZERO,Vector3(0,0,-10),Vector3(0,2,-5))
	check(streak.global_transform.basis.x.normalized().is_equal_approx(Vector3.FORWARD) and absf(streak.global_transform.basis.x.length() * streak.pixel_size * NeuroImpact.REGIONS.bolt.size.x - 10.0) < 0.01,"tracer spans the shot")
	check(NeuroImpact.tracer(decal_root,Vector3.ZERO,Vector3(0,0,-0.1),Vector3.UP) == null,"no tracer for point-blank")
	decal_root.free()
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
	check(NeuroHacking.caesar("MOV",1) == "NPW" and NeuroHacking.caesar("NPW",-1) == "MOV" and NeuroHacking.caesar("ZAP",1) == "ABQ","hack caesar shift")
	for difficulty in 3:
		var hack := NeuroHacking.generate(7,difficulty)
		check(hack.program.size() == 3*NeuroHacking.LINE_WIDTH[difficulty] and hack.missing.size() == NeuroHacking.MISSING[difficulty],"hack layout %d" % difficulty)
		var solvable := true
		for i in hack.missing:
			solvable = solvable and hack.bank.has(hack.solution[i]) and NeuroHacking.caesar(hack.program[i].hint,-1) == hack.solution[i]
		check(solvable,"hack hints decode to banked answers %d" % difficulty)
	var run := NeuroHacking.generate(3,1)
	var wrong := "NOP" if run.solution[run.missing[0]] != "NOP" else "MOV"
	check(not NeuroHacking.submit(run,run.missing[0],wrong) and run.traces == 2,"wrong opcode costs a trace")
	for i in run.missing: NeuroHacking.submit(run,i,run.solution[i])
	check(run.status == "won","correct opcodes win")
	var slow := NeuroHacking.generate(3,1)
	NeuroHacking.tick(slow,1000.0)
	check(slow.status == "lost","timeout loses")
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
	player.unlocked = NeuroWeapons.ORDER.duplicate()
	player.unlocked = NeuroWeapons.ORDER.duplicate()
	var enemy := NeuroEnemy.new()
	enemy.name = "test_enemy"
	enemy.enemy_kind = "drone"
	enemy.position = player.position + Vector3(0,0,-4)
	get_tree().current_scene.add_child(enemy)
	await settle()
	enemy.target = player
	check(enemy.sees_player(),"enemy perception sees unobstructed player")
	var lamp := OmniLight3D.new()
	lamp.omni_range = 6.0
	lamp.add_to_group("quality_lights")
	get_tree().current_scene.add_child(lamp)
	var far := Vector3(5000,0,5000)
	lamp.global_position = far
	var lit := NeuroPlayer.light_at(get_tree(),far)
	lamp.global_position = far + Vector3(100,0,0)
	var dark := NeuroPlayer.light_at(get_tree(),far)
	check(lit > dark and is_equal_approx(dark,0.35),"light level falls with distance from lights")
	lamp.free()
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
	enemy.state = NeuroEnemy.State.CHASE
	check(AudioDirector.awareness(enemy) == 1.0,"chasing enemy is full threat")
	AudioDirector._process(10.0)
	check(AudioDirector.threat > 0.9 and AudioDirector.beds.music.volume_db > -14.0,"threat raises music")
	enemy.state = NeuroEnemy.State.IDLE
	check(AudioDirector.awareness(enemy) == 0.0,"idle enemy is no threat")
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


func _product_flows() -> void:
	var route := NeuroGridNavigation.path(["#####","#.#.#","#...#","#####"],Vector2i(1,1),Vector2i(3,1))
	check(route.size() == 4 and route.has(Vector2i(2,2)),"navigation routes around wall")
	check(NeuroGridNavigation.path(["#####","#...#","#####"],Vector2i(1,1),Vector2i(3,1),[Vector2i(2,1)]).is_empty(),"closed gate prevents enemy path")
	check(AudioDirector.spatial_pool.size() == 16,"spatial audio pool bounded")
	var player = GameState.player
	var original := GameState.snapshot()
	check(player.unlocked == ["pistol"],"campaign starts with only pistol")
	var reward := NeuroPickup.new()
	reward.pickup_type = "weapon"
	reward.item_id = "shotgun"
	get_tree().current_scene.add_child(reward)
	reward.interact(player)
	check(player.unlocked.has("shotgun"),"weapon cache unlocks equipment")
	var station := NeuroSupplyStation.new()
	get_tree().current_scene.add_child(station)
	check(station.collision_layer == 4 and station.collision_mask == 0,"supplies interact without blocking navigation")
	player.credits = 12
	check(not station.purchase("medkit") and player.credits == 12,"full health never charged")
	player.apply_damage(20)
	check(station.purchase("medkit") and player.health == 100 and player.credits == 6,"supply purchase heals and charges once")
	check(not station.purchase("invalid") and player.credits == 6,"invalid purchase retains credits")
	station.queue_free()
	Settings.rebind("interact",KEY_F)
	var pickup := NeuroPickup.new()
	pickup.pickup_type = "keycard"
	check(pickup.get_interaction_prompt().begins_with("[F]"),"pickup prompt follows remap")
	pickup.free()
	Settings.reset_bindings()
	GameState.flags.power = true
	player.keycards.append("card_0")
	check(GameState.missing_requirements().is_empty(),"objective removes fulfilled requirements")
	GameState.refresh_objective()
	check(GameState.current_objective.contains("Open the security gate"),"objective identifies next action")
	player.keycards.erase("card_0")
	GameState.flags.clear()
	var hud: NeuroHUD = get_tree().current_scene.find_children("*","NeuroHUD",true,false)[0]
	Settings.values.subtitles = false
	EventBus.message.emit("SAVED")
	EventBus.narrative.emit("SHIVA")
	hud._process(0.01)
	check(hud.message_label.visible and not hud.narrative_label.visible,"notifications survive subtitles disabled")
	Settings.values.subtitles = true
	Settings.values.text_scale = 1.4
	Settings.apply()
	check(hud.hp_label.get_theme_font_size("font_size") == 28,"text scale applies to active HUD")
	Settings.values.text_scale = 1.0
	Settings.apply()
	check(GameState.save_game(),"manual save succeeds")
	var manual := Save.read_save()
	player.credits += 5
	check(GameState.save_game(true),"autosave succeeds")
	check(Save.read_save().player.credits == manual.player.credits,"autosave leaves manual unchanged")
	check(Save.read_save(Save.AUTO_PATH).player.credits == player.credits,"autosave stores latest state")
	check(Save.preserve_previous(),"previous campaign preservation succeeds")
	check(Save.read_save(Save.PREVIOUS_PATH).player.credits == player.credits,"previous campaign restorable")
	check(GameState.save_game(),"second manual save succeeds")
	var corrupt := FileAccess.open(Save.SAVE_PATH,FileAccess.WRITE)
	corrupt.store_string("invalid")
	corrupt.close()
	check(Save.read_save().is_empty(),"corrupt primary rejected")
	check(Save.available_slots().any(func(slot): return slot.path == Save.SAVE_PATH+".bak"),"valid backup offered for recovery")
	check(Save.write_save(manual),"manual restored after test")
	Settings.values.guided_hacking = true
	var hack := NeuroHackPanel.new()
	get_tree().root.add_child(hack)
	var before: float = hack.state.time_left
	hack._process(10)
	check(hack.state.time_left == before and get_tree().paused,"guided hacking gives time to read")
	hack.started = true
	hack._process(0.5)
	check(hack.state.time_left < before,"hacking clock starts explicitly")
	hack._close(false,true)
	await settle()
	GameState.restore_run(original)
	await settle()
