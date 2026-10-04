class_name NeuroImpact
extends RefCounted

static func spawn(parent: Node, point: Vector3, tint: Color, explosion := false) -> void:
	var visual := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.12 if not explosion else 0.8
	sphere.height = sphere.radius * 2
	visual.mesh = sphere
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.albedo_color = tint
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	visual.material_override = material
	parent.add_child(visual)
	visual.global_position = point
	var tween := visual.create_tween()
	tween.tween_property(visual, "scale", Vector3.ONE * 0.05, 0.18 if not explosion else 0.4)
	tween.tween_callback(visual.queue_free)
