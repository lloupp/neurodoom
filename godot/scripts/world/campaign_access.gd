extends StaticBody3D

var role := "T"
var opened := false
var original_position := Vector3.ZERO

func _ready() -> void:
	original_position = position
	if role == "D":
		EventBus.door_unlocked.connect(_open)
		if GameState.door_open: call_deferred("_open")

func get_interaction_prompt() -> String:
	if role == "T": return "E  Neural relay // authorize sector power"
	if role == "X": return "E  Exit sector" if GameState.can_exit() else "EXIT LOCKED // terminal, card, containment"
	if opened: return ""
	return "E  Open security gate" if GameState.can_exit() else "SECURITY // requires power, sector card and containment clearance"

func interact(_player: Node) -> void:
	if role == "T":
		EventBus.message.emit(NeuroCampaign.LEVELS[GameState.level].voice)
		GameState.restore_power()
	elif role == "X": GameState.advance()
	elif GameState.can_exit(): GameState.mark_door_open()

func _open() -> void:
	if opened: return
	opened = true
	collision_layer = 0
	collision_mask = 0
	create_tween().tween_property(self,"position:y",original_position.y+4,0.65)
