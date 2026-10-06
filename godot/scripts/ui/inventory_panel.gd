class_name NeuroInventoryPanel
extends CanvasLayer

# TAB toggles; pauses the tree like the pause menu. Esc also closes.
const Factory = preload("res://scripts/ui/menu_factory.gd")
const Campaign = preload("res://data/campaign.gd")
var root: Control
var player: Node

func _ready() -> void:
	layer = 25
	process_mode = Node.PROCESS_MODE_ALWAYS
	root = Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(root)
	root.hide()

func _input(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed or event.echo: return
	if root.visible and (event.is_action("inventory") or event.keycode == KEY_ESCAPE):
		close()
		get_viewport().set_input_as_handled()
	elif not root.visible and event.is_action("inventory") and not get_tree().paused and player.health > 0 and not GameState.completed:
		open()
		get_viewport().set_input_as_handled()

static func log_text(item_id: String) -> String:
	for level in Campaign.LEVELS:
		if item_id.begins_with(str(level.id) + "_"): return str(level.log)
	return ""

func open() -> void:
	player.firing = false
	get_tree().paused = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	root.show()
	_list()

func close() -> void:
	root.hide()
	get_tree().paused = false
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _clear() -> void:
	for child in root.get_children():
		root.remove_child(child)
		child.queue_free()

func _line(box: Node, text: String) -> void:
	var label := Label.new()
	label.text = text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(label)

func _list() -> void:
	_clear()
	var box := Factory.panel(root,"INVENTORY")
	_line(box,"HP %d / %d    CREDITS %d" % [player.health,player.max_health,player.credits])
	_line(box,"ACCESS CARDS // " + (", ".join(player.keycards).to_upper() if not player.keycards.is_empty() else "none"))
	for id in NeuroWeapons.ORDER:
		if player.unlocked.has(id):
			_line(box,"%s    %d | %d" % [NeuroWeapons.DATA[id].name,player.magazines[id],player.reserves[id]])
	_line(box,"LOGS")
	if player.inventory.is_empty(): _line(box,"  none recovered")
	for item_id in player.inventory:
		Factory.button(box,str(item_id).replace("_"," ").to_upper(),_read.bind(str(item_id)))
	Factory.button(box,"CLOSE [TAB]",close)

func _read(item_id: String) -> void:
	_clear()
	var box := Factory.panel(root,item_id.replace("_"," ").to_upper())
	var text := log_text(item_id)
	_line(box,text if not text.is_empty() else "[corrupted record]")
	Factory.button(box,"BACK",_list).grab_focus()
