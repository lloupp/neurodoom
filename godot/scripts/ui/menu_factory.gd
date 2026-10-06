class_name NeuroMenuFactory
extends RefCounted

static func panel(parent: Node, title: String) -> VBoxContainer:
	var background := ColorRect.new()
	background.color = Color(0.015,0.025,0.045,0.96)
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	parent.add_child(background)
	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	for side in ["left","right","top","bottom"]: margin.add_theme_constant_override("margin_"+side,24)
	background.add_child(margin)
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.follow_focus = true
	margin.add_child(scroll)
	var box := VBoxContainer.new()
	box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	box.add_theme_constant_override("separation",10)
	var theme := Theme.new()
	theme.default_font_size = roundi(18 * Settings.values.text_scale)
	box.theme = theme
	box.add_to_group("menu_panels")
	scroll.add_child(box)
	var label := Label.new()
	label.text = title
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.add_theme_font_size_override("font_size",roundi(36*Settings.values.text_scale))
	label.add_to_group("menu_titles")
	label.add_theme_color_override("font_color",Color("#32d6e8"))
	box.add_child(label)
	return box

static func button(parent: Node,text: String,action: Callable) -> Button:
	var item := Button.new()
	item.text = text
	item.custom_minimum_size.y = 40
	parent.add_child(item)
	item.pressed.connect(action)
	return item

static func options(parent: Node,back: Callable) -> void:
	var box := panel(parent,"OPTIONS")
	for key in ["master","music","sfx","sensitivity","fov","text_scale"]:
		var row := HBoxContainer.new()
		box.add_child(row)
		var label := Label.new()
		label.text = key.to_upper()
		label.custom_minimum_size.x = 160
		row.add_child(label)
		var slider := HSlider.new()
		slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		slider.min_value = 1.0 if key == "text_scale" else (60 if key == "fov" else (0.0005 if key == "sensitivity" else 0))
		slider.max_value = 1.4 if key == "text_scale" else (110 if key == "fov" else (0.006 if key == "sensitivity" else 1))
		slider.step = 1 if key == "fov" else (0.0001 if key == "sensitivity" else 0.01)
		slider.value = Settings.values[key]
		slider.value_changed.connect(func(value: float): Settings.values[key] = value; Settings.apply())
		row.add_child(slider)
	for key in ["fullscreen","motion","shake","subtitles","guided_hacking"]:
		var check := CheckButton.new()
		check.text = key.to_upper()
		check.button_pressed = Settings.values[key]
		check.toggled.connect(func(value: bool): Settings.values[key] = value; Settings.apply())
		box.add_child(check)
	for pair in [["resolution",["1280 × 720","1600 × 900","1920 × 1080"]],["quality",["Low","Medium","High (shadows)"]],["difficulty",["Easy","Normal","Hard"]]]:
		var select_row := HBoxContainer.new()
		box.add_child(select_row)
		var select_label := Label.new()
		select_label.text = str(pair[0]).to_upper()
		select_label.custom_minimum_size.x = 160
		select_row.add_child(select_label)
		var select := OptionButton.new()
		for title in pair[1]: select.add_item(title)
		select.selected = clampi(Settings.values[pair[0]],0,2)
		select.item_selected.connect(func(value: int): Settings.values[pair[0]] = value; Settings.apply())
		select.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		select_row.add_child(select)
	button(box,"CONTROLS",func(): _reset(parent); controls(parent,func(): _reset(parent); options(parent,back)))
	button(box,"BACK",back)

static func _reset(parent: Node) -> void:
	for child in parent.get_children():
		parent.remove_child(child)
		child.queue_free()

static func controls(parent: Node,back: Callable) -> void:
	var box := panel(parent,"CONTROLS")
	for action in Settings.BINDINGS:
		var row := HBoxContainer.new()
		box.add_child(row)
		var label := Label.new()
		label.text = action.replace("_"," ").to_upper()
		label.custom_minimum_size.x = 200
		row.add_child(label)
		var key := KeyCapture.new()
		key.action = action
		key.custom_minimum_size = Vector2(200,32)
		row.add_child(key)
	button(box,"RESET DEFAULTS",func(): Settings.reset_bindings(); _reset(parent); controls(parent,back))
	button(box,"BACK",back)


static func save_slots(parent: Node,back: Callable) -> void:
	var box := panel(parent,"LOAD / RECOVER PROGRESS")
	var slots := NeuroSaveSystem.available_slots()
	if slots.is_empty():
		var empty := Label.new()
		empty.text = "No valid saves found. Invalid files are preserved."
		box.add_child(empty)
	for slot in slots:
		var data: Dictionary = slot.data
		var sector := "Legacy slice" if not data.campaign else str(NeuroCampaign.LEVELS[int(data.level)].title)
		var date := Time.get_datetime_string_from_unix_time(int(slot.time)).replace("T"," ")
		button(box,"%s // %s // %s UTC%s" % [slot.label,sector,date," // COMPLETED" if data.completed else ""],func(): GameState.load_game(str(slot.path)))
	button(box,"BACK",back).grab_focus()

static func confirm(parent: Node,title: String,text: String,accept: Callable,cancel: Callable) -> void:
	var box := panel(parent,title)
	var label := Label.new()
	label.text = text
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(label)
	button(box,"CANCEL",cancel).grab_focus()
	button(box,"START NEW CAMPAIGN",accept)
