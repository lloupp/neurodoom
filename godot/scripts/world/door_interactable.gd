class_name NeuroDoor
extends StaticBody3D

var opened := false

func _ready() -> void:
	EventBus.door_unlocked.connect(_open_visual)
	if GameState.door_open:
		call_deferred("_open_visual")

func get_interaction_prompt() -> String:
	if opened:
		return ""
	if not GameState.power_restored:
		return "A3 SECURITY — requires power"
	return "E  Open A3 security door"

func interact(_player: Node) -> void:
	if opened or not GameState.power_restored:
		return
	GameState.mark_door_open()

func _open_visual() -> void:
	if opened:
		return
	opened = true
	collision_layer = 0
	collision_mask = 0
	var tween := create_tween()
	tween.set_trans(Tween.TRANS_QUAD)
	tween.set_ease(Tween.EASE_IN_OUT)
	tween.tween_property(self, "position:y", position.y + 3.2, 0.75)
