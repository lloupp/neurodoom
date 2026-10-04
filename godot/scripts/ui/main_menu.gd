extends Control

const Factory = preload("res://scripts/ui/menu_factory.gd")
const Save = preload("res://scripts/systems/save_system.gd")

func _ready() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_menu()

func _clear() -> void:
	for child in get_children():
		remove_child(child)
		child.queue_free()

func _menu() -> void:
	_clear()
	var box := Factory.panel(self,"NEURODOOM\nSUBJECT 14")
	Factory.button(box,"NEW GAME",GameState.new_game).grab_focus()
	var slot := Save.read_save()
	var resume := Factory.button(box,"CONTINUE",GameState.load_game)
	resume.disabled = slot.is_empty()
	Factory.button(box,"OPTIONS",_options)
	Factory.button(box,"QUIT",_quit)
	var label := Label.new()
	label.text = "FIRST PERSON // MERIDIAN → GARDEN → SPIRE → LAB → SHIVA"
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(label)
	if not Save.last_error.is_empty():
		var error := Label.new()
		error.text = Save.last_error
		box.add_child(error)

func _options() -> void:
	_clear()
	Factory.options(self,_menu)

func _quit() -> void:
	AudioDirector.shutdown()
	await get_tree().create_timer(0.2).timeout
	get_tree().quit()
