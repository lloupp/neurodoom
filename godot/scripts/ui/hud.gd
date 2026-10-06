class_name NeuroHUD
extends CanvasLayer

const Factory = preload("res://scripts/ui/menu_factory.gd")
var root: Control
var objective_label: Label
var crosshair: Label
var hp_label: Label
var ammo_label: Label
var prompt_label: Label
var message_label: Label
var hit_label: Label
var boss_label: Label
var boss_bar: ProgressBar
var stamina_bar: ProgressBar
var shadow_label: Label
var vignette: ColorRect
var narrative_label: Label
var narrative_time := 0.0
var message_time := 0.0
var hit_time := 0.0
var previous_hp := 100
var damage_pulse := 0.0
# Edge-only damage vignette: the center of the screen stays readable.
const VIGNETTE_CODE := """
shader_type canvas_item;
uniform float intensity = 0.0;
void fragment() {
	float edge = smoothstep(0.35, 0.95, length(UV - vec2(0.5)) * 1.414);
	COLOR = vec4(COLOR.rgb, edge * intensity);
}
"""
static var vignette_shader: Shader

func label(text: String,pos: Vector2,size_value := Vector2(800,40),font_size := 20) -> Label:
	var item := Label.new()
	item.text = text
	item.position = pos
	item.size = size_value
	item.add_theme_font_size_override("font_size",roundi(font_size * Settings.values.text_scale))
	item.set_meta("base_font_size",font_size)
	item.add_to_group("scaled_hud_labels")
	item.add_theme_color_override("font_color",Color("#bce2e8"))
	item.add_theme_color_override("font_shadow_color",Color.BLACK)
	item.add_theme_constant_override("shadow_offset_x",2)
	item.add_theme_constant_override("shadow_offset_y",2)
	item.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(item)
	return item

func anchored(item: Control, preset: int, origin: Vector2) -> void:
	item.set_anchors_preset(preset)
	var dimensions := item.size
	item.offset_left = origin.x
	item.offset_top = origin.y
	item.offset_right = origin.x + dimensions.x
	item.offset_bottom = origin.y + dimensions.y

func _ready() -> void:
	layer = 10
	root = Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	vignette = ColorRect.new()
	vignette.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	vignette.mouse_filter = Control.MOUSE_FILTER_IGNORE
	vignette.color = Color(0.6,0.02,0.06,1)
	var vignette_material := ShaderMaterial.new()
	if vignette_shader == null:
		vignette_shader = Shader.new()
		vignette_shader.code = VIGNETTE_CODE
	vignette_material.shader = vignette_shader
	vignette.material = vignette_material
	root.add_child(vignette)
	objective_label = label(GameState.current_objective,Vector2(24,22),Vector2(1000,65),18)
	objective_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	hp_label = label("",Vector2(24,0))
	anchored(hp_label,Control.PRESET_BOTTOM_LEFT,Vector2(24,-50))
	stamina_bar = ProgressBar.new()
	stamina_bar.size = Vector2(180,6)
	stamina_bar.show_percentage = false
	stamina_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var stamina_fill := StyleBoxFlat.new()
	stamina_fill.bg_color = Color("#32d6e8")
	stamina_bar.add_theme_stylebox_override("fill",stamina_fill)
	root.add_child(stamina_bar)
	anchored(stamina_bar,Control.PRESET_BOTTOM_LEFT,Vector2(24,-14))
	shadow_label = label("IN SHADOW",Vector2.ZERO,Vector2(200,24),14)
	anchored(shadow_label,Control.PRESET_BOTTOM_LEFT,Vector2(24,-76))
	shadow_label.add_theme_color_override("font_color",Color("#7d8fa0"))
	shadow_label.hide()
	ammo_label = label("",Vector2.ZERO,Vector2(330,40))
	anchored(ammo_label,Control.PRESET_BOTTOM_RIGHT,Vector2(-345,-50))
	prompt_label = label("",Vector2.ZERO,Vector2(620,60),18)
	anchored(prompt_label,Control.PRESET_CENTER,Vector2(-310,120))
	prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	crosshair = label("+",Vector2.ZERO,Vector2(24,32),26)
	anchored(crosshair,Control.PRESET_CENTER,Vector2(-10,-18))
	hit_label = label("×",Vector2.ZERO,Vector2(30,30),32)
	anchored(hit_label,Control.PRESET_CENTER,Vector2(-12,-20))
	hit_label.hide()
	message_label = label("",Vector2(24,95),Vector2(900,140),18)
	message_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	narrative_label = label("",Vector2(24,245),Vector2(900,120),18)
	narrative_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	EventBus.narrative.connect(func(text: String): narrative_label.text = text; narrative_time = 12.0)
	boss_label = label("",Vector2.ZERO,Vector2(700,40))
	anchored(boss_label,Control.PRESET_CENTER_TOP,Vector2(-350,165))
	boss_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	boss_bar = ProgressBar.new()
	boss_bar.size = Vector2(420, 14)
	boss_bar.show_percentage = false
	boss_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var fill := StyleBoxFlat.new()
	fill.bg_color = Color("#ed2d74")
	boss_bar.add_theme_stylebox_override("fill", fill)
	root.add_child(boss_bar)
	anchored(boss_bar,Control.PRESET_CENTER_TOP,Vector2(-210,208))
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
	if current < previous_hp: damage_pulse = 0.85
	previous_hp = current

func _ammo(current: int,reserve: int) -> void:
	var id: String = GameState.player.weapon if is_instance_valid(GameState.player) else "pistol"
	ammo_label.text = "%s // %02d | %02d" % [NeuroWeapons.DATA[id].name,current,reserve]

func _message(text: String) -> void:
	message_label.text = text
	message_time = 8.0

func _process(delta: float) -> void:
	message_time = maxf(0,message_time-delta)
	message_label.visible = message_time > 0
	narrative_time = maxf(0,narrative_time-delta)
	narrative_label.visible = narrative_time > 0 and Settings.values.subtitles
	hit_time = maxf(0,hit_time-delta)
	hit_label.visible = hit_time > 0
	damage_pulse = move_toward(damage_pulse,0,delta*1.6)
	# Low health keeps a slow pulse so the danger stays readable without the HP number.
	var low := 0.0
	if previous_hp > 0 and previous_hp <= 30: low = 0.35 + 0.15 * sin(Time.get_ticks_msec() * 0.006)
	vignette.material.set_shader_parameter("intensity",maxf(damage_pulse,low))
	if is_instance_valid(GameState.player):
		shadow_label.visible = GameState.player.light_level < 0.5
		stamina_bar.value = 100.0 * GameState.player.stamina / GameState.player.max_stamina
		# Hidden when full to keep the HUD clean.
		stamina_bar.visible = stamina_bar.value < 99.5
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
