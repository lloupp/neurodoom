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
	Factory.button(box,"SAVE MANUAL",_save)
	Factory.button(box,"LOAD / RECOVER",_slots)
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
	Factory.button(box,"RETRY CHECKPOINT",_retry).grab_focus()
	Factory.button(box,"LOAD SAVED RUN",GameState.load_game)
	Factory.button(box,"RETURN TO MAIN MENU",GameState.return_to_menu)

func _retry() -> void:
	# Campaign retry reloads the scene; the legacy slice respawns in place and must unpause here.
	dead = false
	resume()
	GameState.respawn()

func _save() -> void:
	var success := GameState.save_game()
	var box := root.find_children("*","VBoxContainer",true,false)
	if not box.is_empty():
		var status := box[0].get_node_or_null("SaveStatus") as Label
		if status == null:
			status = Label.new()
			status.name = "SaveStatus"
			status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			box[0].add_child(status)
		status.text = "MANUAL SAVE COMPLETE" if success else NeuroSaveSystem.last_error

func _slots() -> void:
	_clear()
	Factory.save_slots(root,_menu)
