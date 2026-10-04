extends CanvasLayer

const Factory = preload("res://scripts/ui/menu_factory.gd")
var root: Control
var dead := false

func _ready() -> void:
	layer = 30
	process_mode = Node.PROCESS_MODE_ALWAYS
	root = Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(root)
	root.hide()
	EventBus.player_died.connect(_death)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_ESCAPE and not GameState.completed:
		if get_tree().paused and not dead: resume()
		elif not get_tree().paused: _pause()
		get_viewport().set_input_as_handled()

func _clear() -> void:
	for child in root.get_children():
		root.remove_child(child)
		child.queue_free()

func _pause() -> void:
	GameState.player.firing = false
	get_tree().paused = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	root.show()
	_menu()

func _menu() -> void:
	_clear()
	var box := Factory.panel(root,"PAUSED")
	Factory.button(box,"RESUME",resume).grab_focus()
	Factory.button(box,"SAVE",GameState.save_game)
	Factory.button(box,"LOAD",GameState.load_game)
	Factory.button(box,"OPTIONS",_options)
	Factory.button(box,"RETURN TO MAIN MENU",GameState.return_to_menu)

func _options() -> void:
	_clear()
	Factory.options(root,_menu)

func resume() -> void:
	root.hide()
	get_tree().paused = false
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _death() -> void:
	dead = true
	_pause()
	_clear()
	var box := Factory.panel(root,"SIGNAL LOST")
	Factory.button(box,"RETRY CHECKPOINT",GameState.respawn).grab_focus()
	Factory.button(box,"LOAD SAVED RUN",GameState.load_game)
	Factory.button(box,"RETURN TO MAIN MENU",GameState.return_to_menu)
