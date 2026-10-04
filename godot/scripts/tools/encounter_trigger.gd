@tool
class_name NeuroEncounterTrigger
extends Area3D

const EnemyScript = preload("res://scripts/enemies/enemy.gd")
@export var encounter_id := "encounter"
@export var trigger_size := Vector3(4,2.5,4)
@export_enum("drone","heavy","ghost","turret","boss","spitter","brute","wisp","stalker") var enemy_kind := "heavy"
@export var enemy_types: Array[String] = []
@export_range(1,32) var enemy_count := 2
@export var spawn_offsets: Array[Vector3] = [Vector3(-2,0,-3),Vector3(2,0,-3)]
@export var one_shot := true
@export var completion_flag := ""
@export var associated_door: NodePath
var fired := false
var cleared := false
var spawned: Array[String] = []

func _ready() -> void:
	_ensure_shape()
	set_physics_process(not Engine.is_editor_hint())
	if not Engine.is_editor_hint():
		add_to_group("persistent")
		body_entered.connect(_on_body_entered)

func _ensure_shape() -> void:
	var collision := get_node_or_null("Collision") as CollisionShape3D
	if not collision:
		collision = CollisionShape3D.new()
		collision.name = "Collision"
		add_child(collision)
		if Engine.is_editor_hint(): collision.owner = get_tree().edited_scene_root
	var shape := BoxShape3D.new()
	shape.size = trigger_size
	collision.shape = shape

func _on_body_entered(body: Node3D) -> void:
	if not body.is_in_group("player") or (fired and one_shot): return
	fired = true
	cleared = false
	_spawn()
	EventBus.log_event("encounter_triggered",{"id":encounter_id,"count":spawned.size()})

func _spawn() -> void:
	if spawn_offsets.is_empty():
		push_error("Encounter %s has no safe spawn offsets" % encounter_id)
		return
	spawned.clear()
	for i in enemy_count:
		var kind := enemy_kind if enemy_types.is_empty() else enemy_types[i % enemy_types.size()]
		if not NeuroEnemies.DATA.has(kind):
			push_error("Encounter has unknown enemy kind: " + kind)
			continue
		var enemy := EnemyScript.new()
		enemy.name = encounter_id + "_" + str(i)
		enemy.enemy_kind = kind
		get_tree().current_scene.add_child(enemy)
		enemy.global_position = to_global(spawn_offsets[i % spawn_offsets.size()])
		spawned.append(str(enemy.name))
		if GameState.world.has(str(enemy.name)): enemy.apply_snapshot(GameState.world[str(enemy.name)])

func _physics_process(_delta: float) -> void:
	if not fired or cleared or spawned.is_empty(): return
	for enemy in get_tree().get_nodes_in_group("enemies"):
		if spawned.has(str(enemy.name)) and enemy.health > 0: return
	cleared = true
	if not completion_flag.is_empty(): GameState.flags[completion_flag] = true
	var door := get_node_or_null(associated_door)
	if door:
		if door.has_method("_open_visual"): door._open_visual()
		elif door.has_method("_open"): door._open()
	EventBus.log_event("encounter_cleared",{"id":encounter_id})

func save_snapshot() -> Dictionary:
	return {"kind":"encounter","fired":fired,"cleared":cleared,"spawned":spawned.duplicate()}

func apply_snapshot(data: Dictionary) -> void:
	fired = bool(data.fired)
	cleared = bool(data.cleared)
	spawned.assign(data.spawned)
	if fired and not cleared: _spawn()
