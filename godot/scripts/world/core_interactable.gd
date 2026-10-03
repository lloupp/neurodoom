class_name NeuroCore
extends StaticBody3D

func get_interaction_prompt() -> String:
	if GameState.completed:
		return "SHIVA link established"
	return "E  Connect to SHIVA core"

func interact(_player: Node) -> void:
	if not GameState.door_open:
		return
	GameState.complete_slice()
