class_name KeyCapture
extends Button

# Click, then press a key to rebind. Esc cancels. Works while the tree is paused.
var action := ""
var listening := false

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	pressed.connect(func(): listening = true; text = "PRESS A KEY…")
	_label()

func _label() -> void:
	var physical := Settings.key_for(action)
	var local := KEY_NONE if DisplayServer.get_name() == "headless" else DisplayServer.keyboard_get_keycode_from_physical(physical)
	text = OS.get_keycode_string(local if local != KEY_NONE else physical)

func _input(event: InputEvent) -> void:
	if not listening or not event is InputEventKey or not event.pressed or event.echo: return
	get_viewport().set_input_as_handled()
	listening = false
	if event.physical_keycode != KEY_ESCAPE:
		Settings.rebind(action, event.physical_keycode)
	# Swaps can change other rows too.
	for row in get_tree().get_nodes_in_group("key_capture"): row._label()

func _enter_tree() -> void:
	add_to_group("key_capture")
