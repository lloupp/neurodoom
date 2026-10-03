@tool
class_name NeuroEncounterTrigger
extends Area3D

const EnemyScript = preload("res://scripts/enemies/enemy.gd")

@export var encounter_id := "encounter"
@export var trigger_size := Vector3(4.0, 2.5, 4.0)
@export var enemy_kind := "heavy"
@export var spawn_offsets: Array[Vector3] = [
	Vector3(-2, 0, -3),
	Vector3(2, 0, -3)
]
@export var one_shot := true

var fired := false

func _ready() -> void:
	_ensure_shape()
	if not Engine.is_editor_hint():
		body_entered.connect(_on_body_entered)

func _ensure_shape() -> void:
	var collision := get_node_or_null("Collision") as CollisionShape3D
	if collision == null:
		collision = CollisionShape3D.new()
		collision.name = "Collision"
		add_child(collision)
		if Engine.is_editor_hint():
			collision.owner = get_tree().edited_scene_root
	var shape := BoxShape3D.new()
	shape.size = trigger_size
	collision.shape = shape

func _on_body_entered(body: Node3D) -> void:
	if not body.is_in_group("player"):
		return
	if fired and one_shot:
		return
	fired = true
	for offset in spawn_offsets:
		var enemy := CharacterBody3D.new()
		enemy.name = "EncounterEnemy_" + enemy_kind
		enemy.set_script(EnemyScript)
		enemy.position = global_position + offset
		get_tree().current_scene.add_child(enemy)
	EventBus.log_event("encounter_triggered", {
		"id": encounter_id,
		"enemy_kind": enemy_kind,
		"count": spawn_offsets.size()
	})
