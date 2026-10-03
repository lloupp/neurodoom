class_name NeuroHUD
extends CanvasLayer

var objective_label: Label
var hp_label: Label
var ammo_label: Label
var prompt_label: Label
var completion_panel: ColorRect

func _ready() -> void:
	layer = 10
	_build()
	EventBus.objective_changed.connect(_on_objective)
	EventBus.player_damaged.connect(_on_health)
	EventBus.ammo_changed.connect(_on_ammo)
	EventBus.interaction_prompt_changed.connect(_on_prompt)
	EventBus.game_completed.connect(_on_completed)
	_on_objective(GameState.current_objective)

func _make_label(size: int = 20) -> Label:
	var label := Label.new()
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", Color(0.86, 0.95, 1.0))
	label.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.95))
	label.add_theme_constant_override("shadow_offset_x", 2)
	label.add_theme_constant_override("shadow_offset_y", 2)
	return label

func _build() -> void:
	objective_label = _make_label(18)
	objective_label.position = Vector2(28, 24)
	objective_label.size = Vector2(760, 70)
	objective_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	add_child(objective_label)

	hp_label = _make_label(23)
	hp_label.position = Vector2(28, 650)
	hp_label.add_theme_color_override("font_color", Color(1.0, 0.25, 0.42))
	add_child(hp_label)

	ammo_label = _make_label(23)
	ammo_label.anchor_left = 1.0
	ammo_label.anchor_right = 1.0
	ammo_label.position = Vector2(-190, 650)
	add_child(ammo_label)

	prompt_label = _make_label(19)
	prompt_label.anchor_left = 0.5
	prompt_label.anchor_right = 0.5
	prompt_label.anchor_top = 0.78
	prompt_label.position = Vector2(-210, 0)
	prompt_label.size = Vector2(420, 40)
	prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(prompt_label)

	var crosshair := _make_label(26)
	crosshair.text = "+"
	crosshair.anchor_left = 0.5
	crosshair.anchor_right = 0.5
	crosshair.anchor_top = 0.5
	crosshair.anchor_bottom = 0.5
	crosshair.position = Vector2(-8, -18)
	add_child(crosshair)

	completion_panel = ColorRect.new()
	completion_panel.color = Color(0.02, 0.02, 0.04, 0.88)
	completion_panel.anchor_left = 0.22
	completion_panel.anchor_top = 0.31
	completion_panel.anchor_right = 0.78
	completion_panel.anchor_bottom = 0.66
	completion_panel.visible = false
	add_child(completion_panel)

	var end_label := _make_label(34)
	end_label.text = "SHIVA LINK ESTABLISHED\n\nVERTICAL SLICE COMPLETE"
	end_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	end_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	end_label.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	completion_panel.add_child(end_label)

func _on_objective(text: String) -> void:
	objective_label.text = "OBJECTIVE  //  " + text

func _on_health(current: int, maximum: int) -> void:
	hp_label.text = "HP  %03d / %03d" % [current, maximum]

func _on_ammo(current: int, reserve: int) -> void:
	ammo_label.text = "M7  %02d | %02d" % [current, reserve]

func _on_prompt(text: String) -> void:
	prompt_label.text = text

func _on_completed() -> void:
	completion_panel.visible = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
