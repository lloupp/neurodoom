class_name NeuroTerminal
extends StaticBody3D

var used := false

func _ready() -> void:
	used = GameState.power_restored
	EventBus.power_restored.connect(func(): used = true)

func get_interaction_prompt() -> String:
	if used:
		return "E  Neural terminal — power online"
	return "E  Restore facility power"

func interact(_player: Node) -> void:
	if used:
		return
	used = true
	GameState.restore_power()
