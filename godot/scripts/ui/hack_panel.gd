class_name NeuroHackPanel
extends CanvasLayer

# Terminal hacking overlay. Pauses the world; Esc aborts without penalty.
signal finished(won: bool)
const Factory = preload("res://scripts/ui/menu_factory.gd")
var state: Dictionary
var selected := -1
var root: Control
var status_label: Label

func _ready() -> void:
	layer = 28
	process_mode = Node.PROCESS_MODE_ALWAYS
	root = Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(root)
	state = NeuroHacking.generate(randi(), int(Settings.values.difficulty))
	selected = state.missing[0]
	GameState.player.firing = false
	get_tree().paused = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_draw_panel()

func _process(delta: float) -> void:
	NeuroHacking.tick(state, delta)
	if is_instance_valid(status_label):
		status_label.text = "TIME %.1f    TRACES %d" % [state.time_left, state.traces]
	if state.status != "running": _close(state.status == "won")

func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_ESCAPE:
		get_viewport().set_input_as_handled()
		_close(false, true)

func pick(token: String) -> void:
	if selected < 0: return
	if NeuroHacking.submit(state, selected, token):
		var open: Array = state.missing.filter(func(i): return state.input.get(i, "") != state.solution[i])
		selected = open[0] if not open.is_empty() else -1
	else:
		AudioDirector.play("alert", "UI")
	if state.status == "running": _draw_panel()

func _draw_panel() -> void:
	for child in root.get_children():
		root.remove_child(child)
		child.queue_free()
	var box := Factory.panel(root, "NEURAL RELAY // BREACH")
	var help := Label.new()
	help.text = "Hint = real opcode shifted +1 letter (NPW → MOV). Select a hole, pick its opcode."
	help.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(help)
	for line in NeuroHacking.LINES:
		var row := HBoxContainer.new()
		box.add_child(row)
		for column in state.width:
			var i: int = line * state.width + column
			var node: Dictionary = state.program[i]
			var cell := Button.new()
			cell.custom_minimum_size = Vector2(120, 36)
			if state.missing.has(i):
				var filled: String = state.input.get(i, "")
				cell.text = (filled if filled == state.solution[i] else "[%s]" % node.hint)
				cell.disabled = filled == state.solution[i]
				if i == selected: cell.text = "> " + cell.text
				cell.pressed.connect(func(): selected = i; _draw_panel())
			else:
				cell.text = node.text
				cell.disabled = true
			row.add_child(cell)
	var bank := HFlowContainer.new()
	box.add_child(bank)
	for token in state.bank:
		var choice := Button.new()
		choice.text = token
		choice.custom_minimum_size = Vector2(80, 32)
		choice.pressed.connect(pick.bind(token))
		bank.add_child(choice)
	status_label = Label.new()
	box.add_child(status_label)
	Factory.button(box, "ABORT [ESC]", func(): _close(false, true))

func _close(won: bool, aborted := false) -> void:
	if not is_inside_tree(): return
	get_tree().paused = false
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	if not aborted: finished.emit(won)
	queue_free()
