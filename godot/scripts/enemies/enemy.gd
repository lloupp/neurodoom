class_name NeuroEnemy
extends CharacterBody3D

@export var enemy_kind := "heavy"
@export var max_health := 80
@export var speed := 2.1
@export var contact_damage := 14
@export var detection_range := 18.0
@export var attack_range := 1.5

const ENEMY_SHEETS := {
	"drone": "res://art/runtime/enemies/drone_sheet.svg",
	"heavy": "res://art/runtime/enemies/heavy_sheet.svg",
	"ghost": "res://art/runtime/enemies/ghost_sheet.svg",
	"turret": "res://art/runtime/enemies/turret_sheet.svg",
	"boss": "res://art/runtime/enemies/boss_sheet.svg",
	"spitter": "res://art/runtime/enemies/spitter_sheet.svg",
	"brute": "res://art/runtime/enemies/brute_sheet.svg",
	"wisp": "res://art/runtime/enemies/wisp_sheet.svg",
	"stalker": "res://art/runtime/enemies/stalker_sheet.svg"
}
const FRAME_SIZE := Vector2(256, 320)

var health := 80
var attack_cooldown := 0.0
var target: Node3D
var sprite: Sprite3D

func _ready() -> void:
	health = max_health
	add_to_group("enemies")
	_build_collision()
	_build_sprite()
	target = get_tree().get_first_node_in_group("player") as Node3D

func _build_collision() -> void:
	var collision := CollisionShape3D.new()
	var shape := CapsuleShape3D.new()
	shape.radius = 0.42
	shape.height = 1.75
	collision.shape = shape
	collision.position.y = 0.9
	add_child(collision)

func _build_sprite() -> void:
	sprite = Sprite3D.new()
	var sheet_path := str(ENEMY_SHEETS.get(enemy_kind, ENEMY_SHEETS["heavy"]))
	var atlas := AtlasTexture.new()
	atlas.atlas = load(sheet_path)
	atlas.region = Rect2(Vector2.ZERO, FRAME_SIZE)
	sprite.texture = atlas
	sprite.position.y = 1.15
	sprite.pixel_size = 0.0042
	if enemy_kind == "boss":
		sprite.pixel_size = 0.0056
	elif enemy_kind in ["drone", "wisp"]:
		sprite.pixel_size = 0.0037
	sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	sprite.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
	sprite.shaded = true
	add_child(sprite)

func _physics_process(delta: float) -> void:
	attack_cooldown = maxf(0.0, attack_cooldown - delta)
	if not is_instance_valid(target):
		target = get_tree().get_first_node_in_group("player") as Node3D
		return
	var delta_to_player := target.global_position - global_position
	var distance := delta_to_player.length()
	if distance > detection_range:
		velocity.x = 0
		velocity.z = 0
	elif distance > attack_range:
		var dir := delta_to_player.normalized()
		velocity.x = dir.x * speed
		velocity.z = dir.z * speed
	else:
		velocity.x = 0
		velocity.z = 0
		if attack_cooldown <= 0.0 and target.has_method("apply_damage"):
			attack_cooldown = 1.0
			target.apply_damage(contact_damage)
	if not is_on_floor():
		velocity.y -= 20.0 * delta
	else:
		velocity.y = -0.1
	move_and_slide()

func apply_damage(amount: int, _hit_position: Vector3 = Vector3.ZERO) -> void:
	if health <= 0:
		return
	health -= amount
	sprite.modulate = Color(2.0, 0.7, 0.7, 1.0)
	create_tween().tween_property(sprite, "modulate", Color.WHITE, 0.1)
	if health <= 0:
		_die()

func _die() -> void:
	EventBus.enemy_killed.emit(enemy_kind)
	EventBus.log_event("enemy_killed", {"kind": enemy_kind, "x": position.x, "z": position.z})
	collision_layer = 0
	collision_mask = 0
	var tween := create_tween()
	tween.tween_property(sprite, "modulate:a", 0.0, 0.35)
	tween.tween_callback(queue_free)
