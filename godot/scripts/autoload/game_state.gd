extends Node

const SaveSystem = preload("res://scripts/systems/save_system.gd")
const Campaign = preload("res://data/campaign.gd")
var campaign_mode := false
var level := 0
var power_restored := false
var door_open := false
var completed := false
var current_objective := "Restore power at the neural access terminal."
var player: Node = null
var flags: Dictionary = {}
var defeated: Dictionary = {}
var pending: Dictionary = {}
var checkpoint: Dictionary = {}
var world: Dictionary = {}
var stats := {"time":0.0,"deaths":0,"kills":0,"shots":0,"hits":0,"damage":0,"pickups":0}

func _ready() -> void:
	EventBus.playtest_event.connect(_record)

func _process(delta: float) -> void:
	if is_instance_valid(player) and player.health > 0 and not completed:
		stats.time += delta

func _record(kind: String, payload: Dictionary) -> void:
	match kind:
		"enemy_killed":
			stats.kills += 1
			if payload.kind == "boss": flags.warden_defeated = true
		"shot_fired": stats.shots += 1
		"shot_hit": stats.hits += 1
		"player_died": stats.deaths += 1
		"player_damaged": stats.damage += int(payload.amount)
		"pickup": stats.pickups += 1

func reset_run() -> void:
	level = 0
	power_restored = false
	door_open = false
	completed = false
	flags.clear()
	defeated.clear()
	world.clear()
	pending.clear()
	checkpoint.clear()
	stats = {"time":0.0,"deaths":0,"kills":0,"shots":0,"hits":0,"damage":0,"pickups":0}
	current_objective = "Restore power at the neural access terminal."
	EventBus.objective_changed.emit(current_objective)
	EventBus.log_event("run_started")

func new_game() -> void:
	reset_run()
	campaign_mode = true
	get_tree().paused = false
	get_tree().change_scene_to_file("res://scenes/campaign.tscn")

func set_objective(text: String) -> void:
	current_objective = text
	EventBus.objective_changed.emit(text)
	EventBus.log_event("objective_changed",{"text":text,"level":level})

func restore_power() -> void:
	if power_restored: return
	power_restored = true
	flags.power = true
	EventBus.power_restored.emit()
	AudioDirector.play("terminal","UI")
	set_objective("Find access and open the security gate." if campaign_mode else "Open the A3 security door and reach the SHIVA core.")
	save_game()

func mark_door_open() -> void:
	if door_open: return
	door_open = true
	EventBus.door_unlocked.emit()
	AudioDirector.play("door")
	set_objective("Reach the sector exit." if campaign_mode else "Reach the SHIVA core interface.")
	save_game()

func complete_slice() -> void:
	if completed: return
	completed = true
	set_objective("SHIVA link severed. Subject 14 is free." if campaign_mode else "VERTICAL SLICE COMPLETE — SHIVA link established.")
	EventBus.log_event("campaign_completed" if campaign_mode else "slice_completed",{"level":level})
	EventBus.game_completed.emit()
	save_game()

func living_kinds() -> Array:
	var result: Array = []
	for enemy in get_tree().get_nodes_in_group("enemies"):
		if enemy.health > 0: result.append(enemy.enemy_kind)
	return result

func can_exit() -> bool:
	if not is_instance_valid(player): return false
	return Campaign.can_exit(level,flags,player.keycards,living_kinds())

func advance() -> void:
	if not can_exit():
		EventBus.message.emit("ACCESS DENIED // check terminal, card and containment objective")
		return
	if level == Campaign.LEVELS.size()-1:
		complete_slice()
		return
	var carried: Dictionary = player.save_snapshot()
	level += 1
	power_restored = false
	door_open = false
	flags = {}
	defeated = {}
	world = {}
	carried.position = [0.0,1.0,0.0] # Replaced by next level spawn during build.
	carried.health = maxi(40,carried.health)
	pending = {"carry":carried}
	player = null
	get_tree().change_scene_to_file("res://scenes/campaign.tscn")

func snapshot() -> Dictionary:
	var records := world.duplicate(true)
	for node in get_tree().get_nodes_in_group("persistent"):
		records[str(node.name)] = node.save_snapshot()
	for id in defeated:
		if not records.has(id): records[id] = {"kind":"enemy","hp":0,"dead":true,"position":[0,0,0]}
	return {"version":SaveSystem.VERSION,"campaign":campaign_mode,"level":level,"power_restored":power_restored,"door_open":door_open,"completed":completed,"objective":current_objective,"flags":flags.duplicate(),"defeated":defeated.duplicate(),"world":records,"stats":stats.duplicate(),"player":player.save_snapshot()}

func save_game() -> bool:
	if not is_instance_valid(player) or player.health <= 0: return false
	var success := SaveSystem.write_save(snapshot())
	EventBus.message.emit("SAVED" if success else SaveSystem.last_error)
	if success: EventBus.log_event("save_written",{"level":level})
	return success

func load_game() -> bool:
	var data := SaveSystem.read_save()
	if data.is_empty():
		EventBus.message.emit(SaveSystem.last_error if not SaveSystem.last_error.is_empty() else "No saved run")
		return false
	restore_run(data)
	return true

func restore_run(data: Dictionary) -> void:
	campaign_mode = bool(data.campaign)
	level = int(data.level)
	power_restored = bool(data.power_restored)
	door_open = bool(data.door_open)
	completed = bool(data.completed)
	current_objective = str(data.objective)
	flags = data.flags.duplicate()
	defeated = data.defeated.duplicate()
	stats = data.stats.duplicate()
	world = data.world.duplicate(true)
	pending = data.duplicate(true)
	player = null
	get_tree().paused = false
	get_tree().change_scene_to_file("res://scenes/campaign.tscn" if campaign_mode else "res://scenes/main.tscn")

func apply_pending() -> void:
	if pending.has("carry"):
		var carry: Dictionary = pending.carry
		carry.position = [player.position.x,player.position.y,player.position.z]
		player.apply_snapshot(carry)
	elif pending.has("player"):
		player.apply_snapshot(pending.player)
		for node in get_tree().get_nodes_in_group("persistent"):
			if world.has(str(node.name)): node.apply_snapshot(world[str(node.name)])
	pending = {}
	checkpoint = snapshot().duplicate(true)
	EventBus.objective_changed.emit(current_objective)
	if completed: EventBus.game_completed.emit()

func respawn() -> void:
	if checkpoint.is_empty():
		# Labs/legacy slice fallback.
		get_tree().paused = false
		player.health = 100
		player.position = player.checkpoint
		player.refresh_hud()
		return
	var retained_stats := stats.duplicate()
	restore_run(checkpoint)
	stats = retained_stats

func return_to_menu() -> void:
	PlaytestRecorder.flush()
	player = null
	get_tree().paused = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	get_tree().change_scene_to_file("res://scenes/menu.tscn")
