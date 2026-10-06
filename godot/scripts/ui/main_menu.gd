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
	Factory.button(box,"NEW GAME",_new_game).grab_focus()
	var slot := Save.latest_save()
	var resume := Factory.button(box,"CONTINUE",GameState.load_game)
	resume.disabled = slot.is_empty()
	Factory.button(box,"LOAD / RECOVER",_slots)
	Factory.button(box,"HOW TO PLAY",_help)
	Factory.button(box,"OPTIONS",_options)
	Factory.button(box,"QUIT",_quit)
	var label := Label.new()
	label.text = "FIRST PERSON // MERIDIAN → GARDEN → SPIRE → LAB → SHIVA"
	if not slot.is_empty(): label.text += "\nCONTINUE // " + (str(NeuroCampaign.LEVELS[int(slot.level)].title) if slot.campaign else "Legacy slice")
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

func _new_game() -> void:
	if Save.available_slots().is_empty(): GameState.new_game(); return
	_clear()
	Factory.confirm(self,"NEW CAMPAIGN","Autosave will restart. Manual save stays available; the previous autosave can be recovered from LOAD / RECOVER.",GameState.new_game,_menu)

func _slots() -> void:
	_clear()
	Factory.save_slots(self,_menu)

func _help() -> void:
	_clear()
	var box := Factory.panel(self,"HOW TO PLAY")
	var text := Label.new()
	text.text = "Explore the facility. Use terminals, find access cards and collect supplies.\nAim with the mouse; fire with LMB. Reload before engaging.\nEach weapon has a different role. Search maintenance caches for new equipment.\nThe objective lists only the requirements still missing.\n\nMOVE [%s/%s/%s/%s]  INTERACT [%s]  RELOAD [%s]\nINVENTORY [%s]  SAVE [%s]  LOAD [%s]  PAUSE [Esc]\n\nHACKING: decode a hint by moving each letter back one place (NPW → MOV).\nSelect a missing cell, then choose the matching token. Wrong answers cost traces.\nGuided mode lets you read the rules before starting the clock. Esc aborts safely.\n\nDifficulty affects incoming damage and hacking. Options include motion, shake,\nsubtitles, text size, controls and guided hacking. Notifications always remain visible." % [Settings.key_label("move_forward"),Settings.key_label("move_left"),Settings.key_label("move_back"),Settings.key_label("move_right"),Settings.key_label("interact"),Settings.key_label("reload"),Settings.key_label("inventory"),Settings.key_label("quick_save"),Settings.key_label("quick_load")]
	text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(text)
	Factory.button(box,"BACK",_menu).grab_focus()
