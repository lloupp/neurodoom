@tool
extends VBoxContainer

const MapResource = preload("res://data/sector_map.gd")
var editor_plugin: EditorPlugin
var selected := 0
var brush := "."
var rows: Array = []
var grid: GridContainer
var report: Label
var picker: OptionButton
var dirty := false
var drafts: Dictionary = {}
var dirty_levels: Dictionary = {}

func _ready() -> void:
	custom_minimum_size.x = 360
	var title := Label.new()
	title.text = "NEURODOOM // SECTOR AUTHORING"
	add_child(title)
	picker = OptionButton.new()
	for level in NeuroCampaign.LEVELS: picker.add_item(str(level.title))
	picker.item_selected.connect(_request_select)
	add_child(picker)
	var palette := OptionButton.new()
	for symbol in [".","#","P","T","K","D","X","M","A","E","R","C","L","Q","d","h","g","t","s","b","w","k","B","U","Y","Z"]:
		palette.add_item(symbol)
	palette.item_selected.connect(func(index: int): brush = palette.get_item_text(index))
	add_child(palette)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size.y = 300
	add_child(scroll)
	grid = GridContainer.new()
	scroll.add_child(grid)
	var save := Button.new()
	save.text = "VALIDATE & SAVE MAP"
	save.pressed.connect(_save)
	add_child(save)
	var reset := Button.new()
	reset.text = "DISCARD UNSAVED CHANGES"
	reset.pressed.connect(func(): drafts.erase(selected); dirty_levels.erase(selected); _select(selected))
	add_child(reset)
	report = Label.new()
	report.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	add_child(report)
	_select(0)

func _request_select(index: int) -> void:
	if dirty:
		picker.select(selected)
		report.text = "Save or discard your current changes before switching sectors."
		return
	_select(index)

func _select(index: int) -> void:
	selected = index
	if not drafts.has(index): drafts[index] = NeuroCampaign.map_for(index).duplicate()
	rows = drafts[index]
	dirty = bool(dirty_levels.get(index,false))
	_draw()
	report.text = "Click cells to paint. P spawn / T relay / K card / D gate / X exit. U weapon cache / Y supplies / Z auxiliary bridge. Ctrl+Z undoes paint."

func _draw() -> void:
	for child in grid.get_children():
		grid.remove_child(child)
		child.queue_free()
	grid.columns = str(rows[0]).length()
	for z in rows.size():
		for x in str(rows[z]).length():
			var button := Button.new()
			button.text = str(rows[z])[x]
			button.custom_minimum_size = Vector2(26,26)
			button.tooltip_text = "Cell %d,%d" % [x,z]
			button.pressed.connect(_paint.bind(x,z))
			grid.add_child(button)

func _set_cell(index: int,x: int,z: int,symbol: String) -> void:
	if not drafts.has(index): drafts[index] = NeuroCampaign.map_for(index).duplicate()
	var draft: Array = drafts[index]
	draft[z] = str(draft[z]).substr(0,x)+symbol+str(draft[z]).substr(x+1)
	dirty_levels[index] = true
	if index == selected:
		rows = draft
		dirty = true
		_draw()
	else: report.text = "Undo changed another sector draft. Select that sector to review and save it."

func _paint(x: int,z: int) -> void:
	if str(rows[z])[x] == brush: return
	var undo := editor_plugin.get_undo_redo()
	undo.create_action("Paint NEURODOOM sector",UndoRedo.MERGE_DISABLE,self)
	undo.add_do_method(self,"_set_cell",selected,x,z,brush)
	undo.add_undo_method(self,"_set_cell",selected,x,z,str(rows[z])[x])
	undo.commit_action()

func _save() -> void:
	var levels := NeuroCampaign.current_levels()
	levels[selected].map = rows.duplicate()
	var issues := NeuroCampaign.validate_levels(levels)
	if not issues.is_empty():
		report.text = "SAVE BLOCKED: "+" / ".join(issues)
		return
	var resource := MapResource.new()
	resource.level_id = str(levels[selected].id)
	resource.rows = PackedStringArray(rows)
	var path := "res://data/maps/%s.tres" % resource.level_id
	if DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(path.get_base_dir())) != OK:
		report.text = "SAVE BLOCKED: could not create maps directory"
		return
	# Keep a recoverable copy before replacing an authored resource.
	if FileAccess.file_exists(path):
		if DirAccess.copy_absolute(ProjectSettings.globalize_path(path),ProjectSettings.globalize_path(path+".bak")) != OK:
			report.text = "SAVE BLOCKED: could not create map backup"
			return
	var temporary := path.get_basename()+".tmp.tres"
	var code := ResourceSaver.save(resource,temporary)
	if code == OK: code = DirAccess.rename_absolute(ProjectSettings.globalize_path(temporary),ProjectSettings.globalize_path(path))
	if code != OK:
		report.text = "SAVE FAILED: "+str(code)
		return
	dirty = false
	dirty_levels[selected] = false
	report.text = "Map saved. Run the campaign to test routes, sightlines and resource balance."
	editor_plugin.get_editor_interface().get_resource_filesystem().scan()
