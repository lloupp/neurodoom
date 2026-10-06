class_name NeuroEnemy
extends CharacterBody3D

const SpriteController = preload("res://scripts/enemies/enemy_sprite_controller.gd")
const Projectile = preload("res://scripts/systems/projectile.gd")
const Catalog = preload("res://data/enemy_catalog.gd")
enum State { IDLE, PATROL, ALERT, CHASE, ATTACK, RETREAT, DEAD }
@export var enemy_kind := "heavy"
@export var max_health := 0
@export var speed := -1.0
@export var contact_damage := 0
@export var detection_range := 20.0
@export var attack_range := 0.0
@export var patrol_points: Array[Vector3] = []
var health := 0
var attack_cooldown := 0.0
var target: Node3D
var sprite: EnemySpriteController
var state := State.IDLE
var last_known := Vector3.ZERO
var memory := 0.0
var patrol_index := 0
var telegraph := 0.0
var attack_pending := false
var aim := Vector3.ZERO
var clock := 0.0
var hit_reveal := 0.0
var attacks := 0
var stats: Dictionary

func _ready() -> void:
	stats = Catalog.DATA.get(enemy_kind, Catalog.DATA.heavy)
	if max_health <= 0: max_health = int(stats.hp)
	if speed < 0: speed = float(stats.speed)
	if contact_damage <= 0: contact_damage = int(stats.damage)
	if attack_range <= 0: attack_range = float(stats.range)
	health = max_health
	add_to_group("enemies")
	add_to_group("persistent")
	var collision := CollisionShape3D.new()
	var shape := CapsuleShape3D.new()
	shape.radius = 0.42
	shape.height = 1.8
	collision.shape = shape
	collision.position.y = 0.9
	add_child(collision)
	sprite = SpriteController.new()
	sprite.configure(enemy_kind, 1.4 if enemy_kind in ["boss", "brute"] else 1.0)
	add_child(sprite)
	EventBus.playtest_event.connect(_hear)

func _hear(kind: String, payload: Dictionary) -> void:
	if state == State.DEAD or kind not in ["shot_fired", "footstep"] or not payload.has("x"):
		return
	var point := Vector3(float(payload.x), global_position.y, float(payload.z))
	if global_position.distance_to(point) < (24.0 if kind == "shot_fired" else 5.0):
		last_known = point
		memory = 4.0
		state = State.ALERT

func sees_player() -> bool:
	if not is_instance_valid(target): return false
	var origin := global_position + Vector3(0, 1.0, 0)
	var query := PhysicsRayQueryParameters3D.create(origin, target.global_position + Vector3(0, 1.0, 0))
	query.exclude = [get_rid()]
	query.collision_mask = 1
	var hit := get_world_3d().direct_space_state.intersect_ray(query)
	return not hit.is_empty() and hit.collider == target

func _physics_process(delta: float) -> void:
	if state == State.DEAD:
		if sprite.death_finished: queue_free()
		return
	if GameState.completed: return
	clock += delta
	hit_reveal = maxf(0, hit_reveal - delta)
	attack_cooldown = maxf(0, attack_cooldown - delta)
	target = get_tree().get_first_node_in_group("player") as Node3D
	if not is_instance_valid(target) or target.health <= 0: return
	var offset := target.global_position - global_position
	offset.y = 0
	var distance := offset.length()
	# Shadows shorten unalerted sight to half; once alerted, contact is kept at full range.
	var sight := detection_range if memory > 0 else detection_range * lerpf(0.5,1.0,(float(target.light_level)-0.25)/0.75)
	var visible := distance < sight and sees_player()
	if visible and enemy_kind == "stalker" and distance < 6.0:
		hit_reveal = 1.0
	if visible:
		last_known = target.global_position
		memory = 4.0
	else:
		memory = maxf(0, memory - delta)
	if attack_pending:
		telegraph -= delta
		sprite.set_state("attack")
		if telegraph <= 0:
			attack_pending = false
			if visible:
				_attack(distance)
			attack_cooldown = float(stats.cooldown) * (0.65 if enemy_kind == "boss" and health < max_health / 2 else 1.0)
	elif visible and distance <= attack_range and attack_cooldown <= 0:
		state = State.ATTACK
		attack_pending = true
		aim = target.global_position + Vector3.UP
		telegraph = 0.9 if enemy_kind == "boss" else (0.5 if enemy_kind == "brute" else 0.25)
		AudioDirector.play("alert", "Enemies")
		if enemy_kind == "boss":
			EventBus.message.emit("WARDEN // " + ("SHOCKWAVE: BACK AWAY" if attacks % 2 == 1 else "VOLLEY: MOVE SIDEWAYS"))
	var goal := last_known
	var move_speed := speed
	if attack_pending:
		move_speed = 0
	elif visible:
		state = State.CHASE
		if enemy_kind in ["spitter", "wisp"] and distance < 6.0:
			state = State.RETREAT
			goal = global_position - offset
		elif enemy_kind in ["turret", "boss"] and distance <= attack_range:
			move_speed = 0
		elif distance < attack_range:
			move_speed = 0
	elif memory > 0:
		state = State.ALERT
		if global_position.distance_to(last_known) < 1.0: move_speed = 0
	elif not patrol_points.is_empty():
		state = State.PATROL
		goal = patrol_points[patrol_index]
		move_speed *= 0.55
		if global_position.distance_to(goal) < 0.9:
			patrol_index = (patrol_index + 1) % patrol_points.size()
	else:
		state = State.IDLE
		move_speed = 0
	var direction := (goal - global_position)
	direction.y = 0
	direction = direction.normalized()
	if enemy_kind in ["ghost", "wisp"] and visible:
		direction = (direction + Vector3(direction.z, 0, -direction.x) * sin(clock * 2.0) * 0.7).normalized()
	if move_speed > 0:
		sprite.facing = direction
		# Collision and steering around local obstacles. No wall phasing.
		var query := PhysicsRayQueryParameters3D.create(global_position + Vector3.UP, global_position + Vector3.UP + direction * 1.2)
		query.exclude = [get_rid()]
		if not get_world_3d().direct_space_state.intersect_ray(query).is_empty():
			direction = Vector3(direction.z, 0, -direction.x) * (1.0 if int(clock) % 6 < 3 else -1.0)
	if move_speed > 0:
		direction = (direction + _separation()).normalized()
	velocity.x = direction.x * move_speed
	velocity.z = direction.z * move_speed
	velocity.y = -0.1 if is_on_floor() else velocity.y - 20.0 * delta
	move_and_slide()
	sprite.opacity = 0.48 if enemy_kind == "ghost" else (0.18 if enemy_kind == "stalker" and state not in [State.ATTACK] and hit_reveal <= 0 else 1.0)
	if enemy_kind == "wisp": sprite.base_y = 1.35 + sin(clock * 2) * 0.18
	if not attack_pending: sprite.set_state("walk" if move_speed > 0 else "idle")

# Light push away from nearby living enemies so groups do not stack on one point.
func _separation() -> Vector3:
	var push := Vector3.ZERO
	for other in get_tree().get_nodes_in_group("enemies"):
		if other == self or other.state == State.DEAD: continue
		var away: Vector3 = global_position - other.global_position
		away.y = 0
		var d := away.length()
		if d > 0.01 and d < 1.4: push += away / d * (1.4 - d)
	return push

func _attack(distance: float) -> void:
	attacks += 1
	if enemy_kind == "boss" and attacks % 2 == 0:
		# Deliberately short-range shockwave; cover also blocks it via LOS above.
		if distance < 6.0: target.apply_damage(contact_damage)
		NeuroImpact.spawn(get_tree().current_scene, global_position + Vector3.UP, "explosion")
	elif str(stats.behavior) in ["ranged", "boss"]:
		var count := 3 if enemy_kind in ["wisp", "boss"] else 1
		for i in count:
			var projectile := Projectile.new()
			projectile.shooter = self
			projectile.hostile = true
			projectile.damage = contact_damage
			projectile.speed = 10.0 if enemy_kind == "spitter" else 14.0
			projectile.tint = Color("#87e842") if enemy_kind == "spitter" else Color("#ed2d74")
			projectile.direction = (aim - (global_position + Vector3.UP)).normalized().rotated(Vector3.UP, (i - (count - 1) * 0.5) * 0.12)
			get_tree().current_scene.add_child(projectile)
			projectile.global_position = global_position + Vector3.UP + projectile.direction * 0.65
	elif distance <= attack_range:
		target.apply_damage(contact_damage)

func apply_damage(amount: int, _hit_position: Vector3 = Vector3.ZERO) -> void:
	if state == State.DEAD or amount <= 0: return
	health = maxi(0, health - maxi(1, int(amount * float(stats.armor))))
	hit_reveal = 2.0
	# Being shot always reveals the shooter, even beyond hearing/detection range.
	var shooter := get_tree().get_first_node_in_group("player") as Node3D
	if is_instance_valid(shooter):
		last_known = shooter.global_position
		memory = 4.0
		if state in [State.IDLE, State.PATROL]: state = State.ALERT
	sprite.set_state("hit")
	AudioDirector.play("impact", "Enemies")
	if health <= 0: _die()

func _die() -> void:
	state = State.DEAD
	velocity = Vector3.ZERO
	attack_pending = false
	collision_layer = 0
	collision_mask = 0
	sprite.opacity = 1.0
	sprite.set_state("death")
	GameState.defeated[str(name)] = true
	EventBus.enemy_killed.emit(enemy_kind)
	EventBus.log_event("enemy_killed", {"kind":enemy_kind,"id":str(name),"x":position.x,"z":position.z})

func save_snapshot() -> Dictionary:
	return {"kind":"enemy", "hp":health, "position":[position.x,position.y,position.z], "dead":state == State.DEAD}

func apply_snapshot(data: Dictionary) -> void:
	health = int(data.hp)
	var point: Array = data.position
	position = Vector3(float(point[0]),float(point[1]),float(point[2]))
	if bool(data.dead):
		state = State.DEAD
		collision_layer = 0
		collision_mask = 0
		sprite.set_state("death")
