class_name NeuroPlayer
extends CharacterBody3D

const WALK_SPEED := 5.0
const SPRINT_SPEED := 7.5
const GRAVITY := 20.0
const LOOK_SENSITIVITY := 0.0022
const INTERACT_DISTANCE := 3.2
const FIRE_DISTANCE := 35.0

var health := 100
var max_health := 100
var ammo := 6
var reserve_ammo := 24
var damage := 34
var fire_interval := 0.33
var fire_cooldown := 0.0
var pitch := 0.0

var camera: Camera3D
var weapon_layer: CanvasLayer
var weapon_rect: TextureRect
var muzzle_flash: ColorRect
var last_prompt := ""

func _ready() -> void:
	add_to_group("player")
	GameState.player = self
	_build_body()
	_build_camera()
	_build_weapon_view()
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	EventBus.player_damaged.emit(health, max_health)
	EventBus.ammo_changed.emit(ammo, reserve_ammo)
	EventBus.log_event("player_spawned", {"x": position.x, "y": position.y, "z": position.z})

func _build_body() -> void:
	var collision := CollisionShape3D.new()
	var shape := CapsuleShape3D.new()
	shape.radius = 0.35
	shape.height = 1.8
	collision.shape = shape
	collision.position.y = 0.9
	add_child(collision)

func _build_camera() -> void:
	camera = Camera3D.new()
	camera.name = "Camera"
	camera.position = Vector3(0, 1.55, 0)
	camera.current = true
	camera.fov = 72.0
	add_child(camera)

func _build_weapon_view() -> void:
	weapon_layer = CanvasLayer.new()
	weapon_layer.layer = 6
	add_child(weapon_layer)

	weapon_rect = TextureRect.new()
	var weapon_atlas := AtlasTexture.new()
	weapon_atlas.atlas = load("res://art/runtime/weapons/shotgun_sheet.svg")
	weapon_atlas.region = Rect2(Vector2.ZERO, Vector2(768, 460))
	weapon_rect.texture = weapon_atlas
	weapon_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	weapon_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	weapon_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	weapon_rect.anchor_left = 0.45
	weapon_rect.anchor_top = 0.48
	weapon_rect.anchor_right = 1.0
	weapon_rect.anchor_bottom = 1.0
	weapon_rect.offset_bottom = 70
	weapon_layer.add_child(weapon_rect)

	muzzle_flash = ColorRect.new()
	muzzle_flash.color = Color(1.0, 0.55, 0.18, 0.0)
	muzzle_flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	muzzle_flash.anchor_left = 0.72
	muzzle_flash.anchor_top = 0.54
	muzzle_flash.anchor_right = 0.84
	muzzle_flash.anchor_bottom = 0.72
	weapon_layer.add_child(muzzle_flash)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		rotate_y(-event.relative.x * LOOK_SENSITIVITY)
		pitch = clamp(pitch - event.relative.y * LOOK_SENSITIVITY, -1.2, 1.2)
		camera.rotation.x = pitch
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		_fire()
	elif event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_E:
				_interact()
			KEY_ESCAPE:
				Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED else Input.MOUSE_MODE_CAPTURED
			KEY_F5:
				GameState.save_game()
			KEY_F9:
				GameState.load_game()

func _physics_process(delta: float) -> void:
	fire_cooldown = maxf(0.0, fire_cooldown - delta)
	var input_x := float(Input.is_key_pressed(KEY_D)) - float(Input.is_key_pressed(KEY_A))
	var input_z := float(Input.is_key_pressed(KEY_S)) - float(Input.is_key_pressed(KEY_W))
	var input_vec := Vector2(input_x, input_z)
	if input_vec.length() > 1.0:
		input_vec = input_vec.normalized()

	var forward := -global_transform.basis.z
	var right := global_transform.basis.x
	forward.y = 0
	right.y = 0
	forward = forward.normalized()
	right = right.normalized()

	var target_speed := SPRINT_SPEED if Input.is_key_pressed(KEY_SHIFT) else WALK_SPEED
	var move_dir := (right * input_vec.x) + (forward * -input_vec.y)
	velocity.x = move_dir.x * target_speed
	velocity.z = move_dir.z * target_speed
	if not is_on_floor():
		velocity.y -= GRAVITY * delta
	else:
		velocity.y = -0.1
	move_and_slide()
	_update_interaction_prompt()

func _trace(distance: float) -> Dictionary:
	var origin := camera.global_position
	var end := origin + (-camera.global_transform.basis.z * distance)
	var query := PhysicsRayQueryParameters3D.create(origin, end)
	query.exclude = [get_rid()]
	query.collide_with_areas = true
	return get_world_3d().direct_space_state.intersect_ray(query)

func _update_interaction_prompt() -> void:
	var hit := _trace(INTERACT_DISTANCE)
	var prompt := ""
	if not hit.is_empty():
		var collider = hit.get("collider")
		if collider and collider.has_method("get_interaction_prompt"):
			prompt = str(collider.get_interaction_prompt())
	if prompt != last_prompt:
		last_prompt = prompt
		EventBus.interaction_prompt_changed.emit(prompt)

func _interact() -> void:
	var hit := _trace(INTERACT_DISTANCE)
	if hit.is_empty():
		return
	var collider = hit.get("collider")
	if collider and collider.has_method("interact"):
		collider.interact(self)

func _fire() -> void:
	if fire_cooldown > 0.0 or GameState.completed:
		return
	if ammo <= 0:
		if reserve_ammo > 0:
			var moved := mini(6, reserve_ammo)
			ammo = moved
			reserve_ammo -= moved
			EventBus.ammo_changed.emit(ammo, reserve_ammo)
			EventBus.log_event("reload", {"ammo": ammo, "reserve": reserve_ammo})
		return

	fire_cooldown = fire_interval
	ammo -= 1
	EventBus.ammo_changed.emit(ammo, reserve_ammo)
	EventBus.log_event("shot_fired", {"ammo": ammo})

	var old_modulate := weapon_rect.modulate
	weapon_rect.modulate = Color(1.35, 1.15, 1.05, 1)
	create_tween().tween_property(weapon_rect, "modulate", old_modulate, 0.09)
	muzzle_flash.color.a = 0.42
	create_tween().tween_property(muzzle_flash, "color:a", 0.0, 0.08)

	var hit := _trace(FIRE_DISTANCE)
	if hit.is_empty():
		return
	var collider = hit.get("collider")
	if collider and collider.has_method("apply_damage"):
		collider.apply_damage(damage, hit.get("position", Vector3.ZERO))
		EventBus.log_event("shot_hit", {"target": str(collider.name)})

func apply_damage(amount: int) -> void:
	if health <= 0:
		return
	health = maxi(0, health - amount)
	EventBus.player_damaged.emit(health, max_health)
	EventBus.log_event("player_damaged", {"amount": amount, "hp": health})
	if health <= 0:
		_respawn()

func heal(amount: int) -> void:
	health = mini(max_health, health + amount)
	EventBus.player_damaged.emit(health, max_health)

func add_ammo(amount: int) -> void:
	reserve_ammo += amount
	EventBus.ammo_changed.emit(ammo, reserve_ammo)

func _respawn() -> void:
	health = max_health
	position = Vector3(0, 1.0, 8)
	velocity = Vector3.ZERO
	EventBus.player_damaged.emit(health, max_health)
	EventBus.log_event("player_respawned")

func save_snapshot() -> Dictionary:
	return {
		"position": [position.x, position.y, position.z],
		"health": health,
		"ammo": ammo,
		"reserve_ammo": reserve_ammo,
		"yaw": rotation.y,
		"pitch": pitch
	}

func apply_snapshot(data: Dictionary) -> void:
	var p = data.get("position", [0.0, 1.0, 8.0])
	if p is Array and p.size() >= 3:
		position = Vector3(float(p[0]), float(p[1]), float(p[2]))
	health = int(data.get("health", max_health))
	ammo = int(data.get("ammo", 6))
	reserve_ammo = int(data.get("reserve_ammo", 24))
	rotation.y = float(data.get("yaw", 0.0))
	pitch = float(data.get("pitch", 0.0))
	if is_instance_valid(camera):
		camera.rotation.x = pitch
	EventBus.player_damaged.emit(health, max_health)
	EventBus.ammo_changed.emit(ammo, reserve_ammo)
