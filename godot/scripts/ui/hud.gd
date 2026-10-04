class_name NeuroHUD
extends CanvasLayer

const Factory = preload("res://scripts/ui/menu_factory.gd")
var root: Control
var objective_label: Label
var hp_label: Label
var ammo_label: Label
var prompt_label: Label
var message_label: Label
var hit_label: Label
var boss_label: Label
var boss_bar: ProgressBar
var vignette: ColorRect
var message_time := 0.0
var hit_time := 0.0
var previous_hp := 100

func label(text: String,pos: Vector2,size_value := Vector2(800,40),font_size := 20) -> Label:
	var item := Label.new()
	item.text = text
	item.position = pos
	item.size = size_value
	item.add_theme_font_size_override("font_size",font_size)
	item.add_theme_color_override("font_color",Color("#bce2e8"))
	item.add_theme_color_override("font_shadow_color",Color.BLACK)
	item.add_theme_constant_override("shadow_offset_x",2)
	item.add_theme_constant_override("shadow_offset_y",2)
	item.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(item)
	return item

func _ready() -> void:
	layer = 10
	root = Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	vignette = ColorRect.new()
	vignette.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	vignette.mouse_filter = Control.MOUSE_FILTER_IGNORE
	vignette.color = Color(0.6,0.02,0.06,0)
	root.add_child(vignette)
	objective_label = label(GameState.current_objective,Vector2(24,22),Vector2(1000,65),18)
	objective_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hp_label = label("",Vector2(24,0))
	hp_label.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	hp_label.position = Vector2(24,-50)
	ammo_label = label("",Vector2.ZERO,Vector2(330,40))
	ammo_label.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	ammo_label.position = Vector2(-345,-50)
	prompt_label = label("",Vector2.ZERO,Vector2(620,60),18)
	prompt_label.set_anchors_preset(Control.PRESET_CENTER)
	prompt_label.position = Vector2(-310,120)
	prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var crosshair := label("+",Vector2.ZERO,Vector2(24,32),26)
	crosshair.set_anchors_preset(Control.PRESET_CENTER)
	crosshair.position = Vector2(-10,-18)
	hit_label = label("×",Vector2.ZERO,Vector2(30,30),32)
	hit_label.set_anchors_preset(Control.PRESET_CENTER)
	hit_label.position = Vector2(-12,-20)
	hit_label.hide()
	message_label = label("",Vector2(24,95),Vector2(900,140),18)
	message_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	boss_label = label("",Vector2.ZERO,Vector2(700,40))
	boss_label.set_anchors_preset(Control.PRESET_CENTER_TOP)
	boss_label.position = Vector2(-350,165)
	boss_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	boss_bar = ProgressBar.new()
	boss_bar.set_anchors_preset(Control.PRESET_CENTER_TOP)
	boss_bar.position = Vector2(-210, 208)
	boss_bar.size = Vector2(420, 14)
	boss_bar.show_percentage = false
	boss_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var fill := StyleBoxFlat.new()
	fill.bg_color = Color("#ed2d74")
	boss_bar.add_theme_stylebox_override("fill", fill)
	root.add_child(boss_bar)
	EventBus.objective_changed.connect(func(text: String): objective_label.text = "OBJECTIVE // " + text)
	EventBus.player_damaged.connect(_health)
	EventBus.ammo_changed.connect(_ammo)
	EventBus.interaction_prompt_changed.connect(func(text: String): prompt_label.text = text)
	EventBus.message.connect(_message)
	EventBus.hit_confirmed.connect(func(): hit_time = 0.15)
	EventBus.game_completed.connect(_completed)
	if is_instance_valid(GameState.player): GameState.player.refresh_hud()

func _health(current: int,maximum: int) -> void:
	hp_label.text = "HP %03d / %03d" % [current,maximum]
	if current < previous_hp: vignette.color.a = 0.25
	previous_hp = current

func _ammo(current: int,reserve: int) -> void:
	var id: String = GameState.player.weapon if is_instance_valid(GameState.player) else "pistol"
	ammo_label.text = "%s // %02d | %02d" % [NeuroWeapons.DATA[id].name,current,reserve]

func _message(text: String) -> void:
	message_label.text = text
	message_time = 8.0

func _process(delta: float) -> void:
	message_time = maxf(0,message_time-delta)
	message_label.visible = message_time > 0 and Settings.values.subtitles
	hit_time = maxf(0,hit_time-delta)
	hit_label.visible = hit_time > 0
	vignette.color.a = move_toward(vignette.color.a,0,delta)
	boss_label.text = ""
	boss_bar.hide()
	for enemy in get_tree().get_nodes_in_group("enemies"):
		if enemy.enemy_kind == "boss" and enemy.health > 0:
			boss_bar.show()
			boss_bar.value = 100.0 * enemy.health / enemy.max_health
			boss_label.text = "SHIVA WARDEN // %d / %d // %s" % [enemy.health,enemy.max_health,"OVERRIDE" if enemy.health < enemy.max_health/2 else "CONTAINMENT"]

func _completed() -> void:
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	if is_instance_valid(GameState.player): GameState.player.firing = false
	var box := Factory.panel(root,"SHIVA LINK SEVERED" if GameState.campaign_mode else "SLICE COMPLETE")
	var end := Label.new()
	end.text = "Subject fourteen walks into the silence.\nThe voice has stopped. Your memories are yours.\n\nTIME %02d:%02d // DEATHS %d // KILLS %d\nSHOTS %d // ACCURACY %.0f%%\n\nNEURODOOM // End of campaign\nDesign & original vector baseline: NEURODOOM project\nAudio: original synthesized placeholders" % [int(GameState.stats.time)/60,int(GameState.stats.time)%60,GameState.stats.deaths,GameState.stats.kills,GameState.stats.shots,100.0*GameState.stats.hits/maxf(1,GameState.stats.shots)]
	end.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(end)
	Factory.button(box,"RETURN TO MAIN MENU",GameState.return_to_menu).grab_focus()
