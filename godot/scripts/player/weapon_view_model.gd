class_name WeaponViewModel
extends CanvasLayer

const Cache = preload("res://scripts/systems/sprite_cache.gd")
const STATES := ["idle", "fire", "recoil", "reload", "empty"]
var weapon := "pistol"
var state := "idle"
var elapsed := 0.0
var kick := 0.0
var movement := 0.0
var sway := Vector2.ZERO
var motion_enabled := true
var rect: TextureRect
var flash: TextureRect

func _ready() -> void:
	layer = 6
	rect = TextureRect.new()
	rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	rect.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	rect.position = Vector2(-620, -380)
	rect.size = Vector2(620, 380)
	add_child(rect)
	flash = TextureRect.new()
	flash.texture = Cache.region("res://art/runtime/fx.svg", Vector2i.ZERO, Vector2i(160, 256))
	flash.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	flash.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	flash.modulate = Color(1, 1, 1, 0)
	flash.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	flash.position = Vector2(-162, -302)
	flash.size = Vector2(96, 96)
	add_child(flash)
	for id in NeuroWeapons.ORDER:
		for i in STATES.size():
			Cache.region("res://art/runtime/weapons/%s_sheet.svg" % id, Vector2i(i, 0), Vector2i(768, 460))

func select(id: String) -> void:
	weapon = id
	state = "idle"
	elapsed = 0
	kick = 0

func animate(next: String) -> void:
	state = next
	elapsed = 0
	if next == "fire":
		kick = 26.0 if weapon == "shotgun" else 12.0

func _process(delta: float) -> void:
	elapsed += delta
	if state == "fire" and elapsed > 0.055:
		state = "recoil"
	elif state == "recoil" and elapsed > 0.22:
		state = "idle"
	rect.texture = Cache.region("res://art/runtime/weapons/%s_sheet.svg" % weapon, Vector2i(STATES.find(state), 0), Vector2i(768, 460))
	kick = move_toward(kick, 0, delta * 95)
	sway = sway.lerp(Vector2.ZERO, minf(1, delta * 10))
	var bob := sin(Time.get_ticks_msec() * 0.009) * 5.0 * movement if motion_enabled else 0.0
	rect.position = Vector2(-620, -380 + kick + bob) + (sway if motion_enabled else Vector2.ZERO)
	flash.modulate.a = 0.9 if state == "fire" else 0
