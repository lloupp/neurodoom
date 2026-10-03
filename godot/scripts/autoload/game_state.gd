extends Node

const SaveSystem = preload("res://scripts/systems/save_system.gd")

var power_restored := false
var door_open := false
var completed := false
var current_objective := "Restore power at the neural access terminal."
var player: Node = null

func reset_run() -> void:
	power_restored = false
	door_open = false
	completed = false
	current_objective = "Restore power at the neural access terminal."
	EventBus.objective_changed.emit(current_objective)
	EventBus.log_event("run_started")

func set_objective(text: String) -> void:
	current_objective = text
	EventBus.objective_changed.emit(text)
	EventBus.log_event("objective_changed", {"text": text})

func restore_power() -> void:
	if power_restored:
		return
	power_restored = true
	EventBus.power_restored.emit()
	set_objective("Open the A3 security door and reach the SHIVA core.")
	EventBus.log_event("power_restored")
	save_game()

func mark_door_open() -> void:
	if door_open:
		return
	door_open = true
	EventBus.door_unlocked.emit()
	set_objective("Reach the SHIVA core interface.")
	EventBus.log_event("door_open")
	save_game()

func complete_slice() -> void:
	if completed:
		return
	completed = true
	set_objective("VERTICAL SLICE COMPLETE — SHIVA link established.")
	EventBus.game_completed.emit()
	EventBus.log_event("slice_completed")
	save_game()

func save_game() -> void:
	var data := {
		"version": 1,
		"power_restored": power_restored,
		"door_open": door_open,
		"completed": completed,
		"objective": current_objective
	}
	if is_instance_valid(player) and player.has_method("save_snapshot"):
		data["player"] = player.save_snapshot()
	SaveSystem.write_save(data)
	EventBus.log_event("save_written")

func load_game() -> bool:
	var data := SaveSystem.read_save()
	if data.is_empty() or int(data.get("version", 0)) != 1:
		return false
	power_restored = bool(data.get("power_restored", false))
	door_open = bool(data.get("door_open", false))
	completed = bool(data.get("completed", false))
	current_objective = str(data.get("objective", current_objective))
	if is_instance_valid(player) and player.has_method("apply_snapshot") and data.has("player"):
		player.apply_snapshot(data["player"])
	EventBus.objective_changed.emit(current_objective)
	if power_restored:
		EventBus.power_restored.emit()
	if door_open:
		EventBus.door_unlocked.emit()
	if completed:
		EventBus.game_completed.emit()
	EventBus.log_event("save_loaded")
	return true
