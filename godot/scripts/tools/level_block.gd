@tool
class_name NeuroLevelBlock
extends StaticBody3D

@export var block_size := Vector3(2.0, 2.0, 2.0)
@export var surface_color := Color("#2a3038")
@export var metallic := 0.15
@export var roughness := 0.75
@export var emissive := false
@export var emission_color := Color("#32d6e8")
@export var emission_energy := 1.5

var _last_signature := ""

func _ready() -> void:
	_rebuild()
	set_process(Engine.is_editor_hint())

func _process(_delta: float) -> void:
	if not Engine.is_editor_hint():
		return
	var signature := "%s|%s|%s|%s|%s|%s|%s" % [
		block_size, surface_color, metallic, roughness, emissive, emission_color, emission_energy
	]
	if signature != _last_signature:
		_rebuild()

func _rebuild() -> void:
	_last_signature = "%s|%s|%s|%s|%s|%s|%s" % [
		block_size, surface_color, metallic, roughness, emissive, emission_color, emission_energy
	]

	var visual := get_node_or_null("Visual") as MeshInstance3D
	if visual == null:
		visual = MeshInstance3D.new()
		visual.name = "Visual"
		add_child(visual)
		if Engine.is_editor_hint():
			visual.owner = get_tree().edited_scene_root

	var mesh := BoxMesh.new()
	mesh.size = block_size
	visual.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = surface_color
	mat.metallic = metallic
	mat.roughness = roughness
	if emissive:
		mat.emission_enabled = true
		mat.emission = emission_color * emission_energy
	visual.material_override = mat

	var collision := get_node_or_null("Collision") as CollisionShape3D
	if collision == null:
		collision = CollisionShape3D.new()
		collision.name = "Collision"
		add_child(collision)
		if Engine.is_editor_hint():
			collision.owner = get_tree().edited_scene_root
	var shape := BoxShape3D.new()
	shape.size = block_size
	collision.shape = shape
