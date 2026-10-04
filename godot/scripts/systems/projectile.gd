class_name NeuroProjectile
extends Node3D

var direction := Vector3.FORWARD
var speed := 18.0
var damage := 65
var splash := 0.0
var shooter: CollisionObject3D
var hostile := false
var lifetime := 5.0
var tint := Color("#ff9f32")

func _ready() -> void:
	var mesh := MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.14
	sphere.height = 0.28
	mesh.mesh = sphere
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.albedo_color = tint
	mesh.material_override = material
	add_child(mesh)

func _physics_process(delta: float) -> void:
	if GameState.completed:
		queue_free()
		return
	lifetime -= delta
	var end := global_position + direction * speed * delta
	var query := PhysicsRayQueryParameters3D.create(global_position, end)
	if is_instance_valid(shooter):
		query.exclude = [shooter.get_rid()]
	query.collision_mask = 1
	var hit := get_world_3d().direct_space_state.intersect_ray(query)
	if not hit.is_empty():
		global_position = hit.position
		detonate(hit.collider)
	elif lifetime <= 0:
		detonate(null)
	else:
		global_position = end

func detonate(collider: Object) -> void:
	if splash <= 0:
		if collider and collider.has_method("apply_damage"):
			if hostile and collider.is_in_group("player"):
				collider.apply_damage(damage)
			elif not hostile and collider.is_in_group("enemies"):
				collider.apply_damage(damage, global_position)
	else:
		# Occlusion prevents blast damage through walls. Player rockets can hurt player.
		for body in get_tree().get_nodes_in_group("enemies") + get_tree().get_nodes_in_group("player"):
			var offset: Vector3 = body.global_position + Vector3.UP - global_position
			if offset.length() > splash:
				continue
			var query := PhysicsRayQueryParameters3D.create(global_position - direction * 0.05, body.global_position + Vector3.UP)
			if is_instance_valid(shooter):
				query.exclude = [shooter.get_rid()] if body != shooter else []
			query.collision_mask = 1
			var obstruction := get_world_3d().direct_space_state.intersect_ray(query)
			if not obstruction.is_empty() and obstruction.collider != body:
				continue
			var amount := maxi(1, int(damage * (1.0 - offset.length() / splash)))
			if body.is_in_group("player"):
				body.apply_damage(amount)
			else:
				body.apply_damage(amount, global_position)
		EventBus.log_event("explosion", {"x":global_position.x,"z":global_position.z})
		AudioDirector.play("explosion", "Weapons")
	NeuroImpact.spawn(get_tree().current_scene, global_position, tint, splash > 0)
	queue_free()
