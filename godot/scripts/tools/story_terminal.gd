@tool
class_name NeuroStoryTerminal
extends StaticBody3D

@export var terminal_id := "terminal"
@export var display_name := "NEURAL ACCESS TERMINAL"
@export_multiline var log_text := "No archived transmission."
@export_multiline var objective_after := ""
@export var restores_power := false
@export var one_shot := true

var used := false

func get_interaction_prompt() -> String:
	if used and one_shot:
		return display_name + " — accessed"
	return "E  " + display_name

func interact(_player: Node) -> void:
	if used and one_shot:
		return
	used = true
	EventBus.message.emit(display_name + "\n" + log_text)
	AudioDirector.play("terminal", "UI")
	EventBus.log_event("story_terminal", {
		"id": terminal_id,
		"title": display_name,
		"text": log_text
	})
	if restores_power:
		GameState.restore_power()
	if not objective_after.strip_edges().is_empty():
		GameState.set_objective(objective_after)
