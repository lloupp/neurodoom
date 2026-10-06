class_name NeuroMenuFactory
extends RefCounted

static func panel(parent: Node, title: String) -> VBoxContainer:
	var background := ColorRect.new()
	background.color = Color(0.015,0.025,0.045,0.96)
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	parent.add_child(background)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	background.add_child(center)
	var box := VBoxContainer.new()
	box.custom_minimum_size.x = 560
	box.add_theme_constant_override("separation",10)
	center.add_child(box)
	var label := Label.new()
	label.text = title
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.add_theme_font_size_override("font_size",36)
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
	for key in ["master","music","sfx","sensitivity","fov"]:
		var row := HBoxContainer.new()
		box.add_child(row)
		var label := Label.new()
		label.text = key.to_upper()
		label.custom_minimum_size.x = 220
		row.add_child(label)
		var slider := HSlider.new()
		slider.custom_minimum_size.x = 300
		slider.min_value = 60 if key == "fov" else (0.0005 if key == "sensitivity" else 0)
		slider.max_value = 110 if key == "fov" else (0.006 if key == "sensitivity" else 1)
		slider.step = 1 if key == "fov" else (0.0001 if key == "sensitivity" else 0.01)
		slider.value = Settings.values[key]
		slider.value_changed.connect(func(value: float): Settings.values[key] = value; Settings.apply())
		row.add_child(slider)
	for key in ["fullscreen","motion","shake","subtitles"]:
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
		select_label.custom_minimum_size.x = 220
		select_row.add_child(select_label)
		var select := OptionButton.new()
		for title in pair[1]: select.add_item(title)
		select.selected = clampi(Settings.values[pair[0]],0,2)
		select.item_selected.connect(func(value: int): Settings.values[pair[0]] = value; Settings.apply())
		select.custom_minimum_size.x = 300
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
		label.custom_minimum_size.x = 260
		row.add_child(label)
		var key := KeyCapture.new()
		key.action = action
		key.custom_minimum_size = Vector2(200,32)
		row.add_child(key)
	button(box,"RESET DEFAULTS",func(): Settings.reset_bindings(); _reset(parent); controls(parent,back))
	button(box,"BACK",back)

