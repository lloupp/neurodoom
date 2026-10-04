extends Node

# Non-human simulation: normal damage, collision, ammo/reloads, ray interactions.
# No teleport, HP override, forced kills, objective flags or resource grants.
const Campaign = preload("res://data/campaign.gd")
var active := false
var frames := 0
var last_level := -1
var goal: Node3D
var path: Array[Vector2i] = []
var last_path_frame := 0
var reached: Array[int] = []
var key_states: Dictionary = {}
var kills_at_start := 0

func _ready() -> void:
	seed(14)
	call_deferred("_start")

func _start() -> void:
	get_tree().current_scene = null
	GameState.new_game()
	for i in 8: await get_tree().physics_frame
	active = true

func key(code: int, pressed: bool) -> void:
	if key_states.get(code,false) == pressed: return
	key_states[code] = pressed
	var event := InputEventKey.new()
	event.keycode = code
	event.pressed = pressed
	Input.parse_input_event(event)

func _physics_process(_delta: float) -> void:
	if not active or not is_instance_valid(GameState.player): return
	frames += 1
	if frames % 300 == 0:
		print("SIM progress frames=",frames," level=",GameState.level," position=",GameState.player.position," goal=",str(goal.name) if is_instance_valid(goal) else "none"," hp=",GameState.player.health," path=",path.size())
	var player = GameState.player
	if GameState.level != last_level:
		last_level = GameState.level
		reached.append(last_level)
		path.clear()
		goal = null
		print("SIMULATION ENTERED LEVEL ",last_level)
	if player.health <= 0:
		_finish(false,"Player died in level %d" % last_level)
		return
	if frames > 18000:
		_finish(false,"Simulation timeout")
		return
	if GameState.completed:
		_finish(true,"Campaign completed through gameplay mechanics")
		return
	key(KEY_A,false)
	key(KEY_D,false)
	var threat: NeuroEnemy
	var closest := 24.0
	for enemy in get_tree().get_nodes_in_group("enemies"):
		if enemy.health <= 0: continue
		var distance: float = enemy.global_position.distance_to(player.global_position)
		enemy.target = player
		if distance < closest and enemy.sees_player():
			closest = distance
			threat = enemy
	if is_instance_valid(threat):
		key(KEY_W,false)
		_aim(player,threat.global_position+Vector3(0,1.1,0))
		var weapon := "shotgun" if closest < 8 else "pistol"
		if threat.enemy_kind in ["brute","boss","heavy","turret"]: weapon = "pulse_rifle"
		if player.reserves[weapon] <= 0 and player.magazines[weapon] <= 0: weapon = "pistol"
		player.select_weapon(weapon)
		player._fire()
		if threat.enemy_kind == "boss":
			key(KEY_A,frames % 180 < 90)
			key(KEY_D,frames % 180 >= 90)
		return
	if not is_instance_valid(goal):
		goal = _choose_goal(player)
		path.clear()
	if not is_instance_valid(goal):
		_finish(false,"No reachable gameplay goal")
		return
	var distance: float = Vector2(goal.position.x-player.position.x,goal.position.z-player.position.z).length()
	if distance < 2.0:
		key(KEY_W,false)
		_aim(player,goal.global_position)
		player._interact()
		if is_instance_valid(goal) and goal.has_method("get_interaction_prompt") and not goal is NeuroPickup:
			goal = null
		return
	if path.is_empty() or frames-last_path_frame > 120:
		path = _path(player.global_position,goal.global_position)
		last_path_frame = frames
	if path.is_empty():
		_finish(false,"No map path to target")
		return
	var point := Vector3(path[0].x*2,player.global_position.y,path[0].y*2)
	if Vector2(point.x-player.position.x,point.z-player.position.z).length() < 0.35:
		path.pop_front()
		return
	_aim(player,point+Vector3(0,1.55,0))
	player.pitch = 0
	player.camera.rotation.x = 0
	key(KEY_W,true)

func _choose_goal(player: NeuroPlayer) -> Node3D:
	var best: Node3D
	var closest := INF
	# Pick accessible resources on route, then key/terminal, then exit.
	for node in get_tree().get_nodes_in_group("persistent"):
		if node is NeuroPickup:
			if node.pickup_type == "medkit" and player.health >= 90: continue
			if node.pickup_type in ["audio_log","credits"]: continue
			var distance: float = node.global_position.distance_to(player.global_position)
			if distance < closest and (node.pickup_type == "keycard" or distance < 5):
				best = node
				closest = distance
	if is_instance_valid(best): return best
	for node in get_tree().current_scene.get_children():
		if node.get("role") == "T" and not GameState.power_restored: return node
		if node.get("role") == "D" and GameState.can_exit() and not node.opened: return node
	# Find any remaining containment enemy if exit still gated.
	if not GameState.can_exit():
		for enemy in get_tree().get_nodes_in_group("enemies"):
			if enemy.health > 0: return enemy
	for node in get_tree().current_scene.get_children():
		if node.get("role") == "X": return node
	return null

func _aim(player: NeuroPlayer,point: Vector3) -> void:
	var offset := point-player.camera.global_position
	player.rotation.y = atan2(-offset.x,-offset.z)
	player.pitch = atan2(offset.y,Vector2(offset.x,offset.z).length())
	player.camera.rotation.x = player.pitch

func _path(from: Vector3,to: Vector3) -> Array[Vector2i]:
	var grid: Array = Campaign.LEVELS[GameState.level].map
	var start := Vector2i(roundi(from.x/2),roundi(from.z/2))
	var end := Vector2i(roundi(to.x/2),roundi(to.z/2))
	var queue: Array[Vector2i] = [start]
	var parents := {start:start}
	while not queue.is_empty():
		var cell: Vector2i = queue.pop_front()
		if cell == end: break
		for delta in [Vector2i.LEFT,Vector2i.RIGHT,Vector2i.UP,Vector2i.DOWN]:
			var neighbor: Vector2i = cell+delta
			if neighbor.x < 0 or neighbor.y < 0 or neighbor.y >= grid.size() or neighbor.x >= grid[neighbor.y].length(): continue
			var symbol: String = grid[neighbor.y][neighbor.x]
			if symbol in ["#","Q"] or (symbol == "D" and not GameState.door_open and neighbor != end) or parents.has(neighbor): continue
			parents[neighbor] = cell
			queue.append(neighbor)
	var result: Array[Vector2i] = []
	if not parents.has(end): return result
	var current := end
	while current != start:
		result.push_front(current)
		current = parents[current]
	return result

func _finish(success: bool,reason: String) -> void:
	active = false
	for code in [KEY_W,KEY_A,KEY_D]: key(code,false)
	print("GAMEPLAY SIMULATION: %s // %s // levels=%s // stats=%s" % ["PASS" if success else "FAIL",reason,reached,GameState.stats])
	PlaytestRecorder.flush()
	get_tree().quit(0 if success else 1)
