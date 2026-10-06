class_name NeuroPlayer
extends CharacterBody3D

const Weapons = preload("res://data/weapon_catalog.gd")
const ViewModel = preload("res://scripts/player/weapon_view_model.gd")
const Projectile = preload("res://scripts/systems/projectile.gd")
const INTERACT_DISTANCE := 3.2
var health := 100
var max_health := 100
var weapon := "pistol"
var weapon_tuning: Dictionary = {}
var magazines := Weapons.magazines()
var reserves := Weapons.reserves()
var unlocked: Array = ["pistol", "shotgun", "pulse_rifle", "rocket_launcher"]
var ammo: int:
	get: return int(magazines[weapon])
	set(value): magazines[weapon] = value
var reserve_ammo: int:
	get: return int(reserves[weapon])
	set(value): reserves[weapon] = value
var inventory: Array = []
var keycards: Array = []
var credits := 0
var fire_cooldown := 0.0
var reload_time := 0.0
var pitch := 0.0
var recoil := 0.0
var bob_phase := 0.0
var footstep_time := 0.0
var damage_flash := 0.0
var checkpoint := Vector3(0, 1, 8)
var camera: Camera3D
var view_model: WeaponViewModel
var last_prompt := ""
var firing := false

func _ready() -> void:
	add_to_group("player")
	GameState.player = self
	checkpoint = position
	var collision := CollisionShape3D.new()
	var shape := CapsuleShape3D.new()
	shape.radius = 0.35
	shape.height = 1.8
	collision.shape = shape
	collision.position.y = 0.9
	add_child(collision)
	camera = Camera3D.new()
	camera.position = Vector3(0,1.55,0)
	camera.current = true
	add_child(camera)
	view_model = ViewModel.new()
	add_child(view_model)
	view_model.select(weapon)
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	refresh_hud()

func refresh_hud() -> void:
	EventBus.player_damaged.emit(health,max_health)
	EventBus.ammo_changed.emit(ammo,reserve_ammo)

func _unhandled_input(event: InputEvent) -> void:
	if health <= 0 or GameState.completed or get_tree().paused: return
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		rotate_y(-event.relative.x * Settings.values.sensitivity)
		pitch = clampf(pitch - event.relative.y * Settings.values.sensitivity,-1.3,1.3)
		view_model.sway = Vector2(-event.relative.x,event.relative.y).limit_length(14)
	elif event.is_action("fire"):
		firing = event.is_pressed()
		if firing and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED: _fire()
	elif event.is_echo() or not event.is_pressed(): return
	elif event.is_action("interact"): _interact()
	elif event.is_action("reload"): reload_weapon()
	elif event.is_action("quick_save"): GameState.save_game()
	elif event.is_action("quick_load"): GameState.load_game()
	elif event.is_action("inventory"): EventBus.message.emit("KEYS %s // CREDITS %d // LOGS %s" % [str(keycards),credits,str(inventory)])
	else:
		for i in Weapons.ORDER.size():
			if event.is_action("weapon_%d" % (i + 1)): select_weapon(Weapons.ORDER[i])

func _physics_process(delta: float) -> void:
	if health <= 0 or GameState.completed: return
	fire_cooldown = maxf(0,fire_cooldown-delta)
	damage_flash = maxf(0,damage_flash-delta)
	recoil = move_toward(recoil,0,delta*0.35)
	if reload_time > 0:
		reload_time = maxf(0,reload_time-delta)
		if reload_time <= 0:
			var moved := mini(int(_weapon_data().capacity)-ammo,reserve_ammo)
			ammo += moved
			reserve_ammo -= moved
			view_model.animate("idle")
			refresh_hud()
	if firing and Input.is_action_pressed("fire") and bool(_weapon_data().automatic) and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED: _fire()
	var input := Input.get_vector("move_left","move_right","move_forward","move_back")
	var move_dir := global_transform.basis * Vector3(input.x,0,input.y)
	var move_speed := 7.5 if Input.is_action_pressed("sprint") else 5.0
	velocity.x = move_toward(velocity.x,move_dir.x*move_speed,delta*25)
	velocity.z = move_toward(velocity.z,move_dir.z*move_speed,delta*25)
	velocity.y = -0.1 if is_on_floor() else velocity.y - 20*delta
	move_and_slide()
	var moving := Vector2(velocity.x,velocity.z).length() > 0.4
	bob_phase += delta*10
	view_model.movement = 1 if moving else 0
	view_model.motion_enabled = bool(Settings.values.motion)
	camera.fov = Settings.values.fov
	camera.position.y = 1.55 + (sin(bob_phase)*0.025 if moving and Settings.values.motion else 0.0)
	camera.rotation.x = pitch - recoil
	if Settings.values.shake and damage_flash > 0:
		camera.rotation.z = sin(bob_phase * 8) * damage_flash * 0.04
	else: camera.rotation.z = 0
	footstep_time -= delta
	if moving and is_on_floor() and footstep_time <= 0:
		footstep_time = 0.35
		AudioDirector.play("footstep")
		EventBus.log_event("footstep",{"x":position.x,"z":position.z})
	_update_interaction_prompt()

func _trace(distance: float, spread := 0.0, interaction := false) -> Dictionary:
	var origin := camera.global_position
	var direction := -camera.global_transform.basis.z
	if spread > 0:
		direction = (direction + camera.global_transform.basis.x * randf_range(-spread,spread) + camera.global_transform.basis.y * randf_range(-spread,spread)).normalized()
	var query := PhysicsRayQueryParameters3D.create(origin,origin+direction*distance)
	query.exclude = [get_rid()]
	query.collision_mask = 5 if interaction else 1
	query.collide_with_areas = true
	return get_world_3d().direct_space_state.intersect_ray(query)

func _update_interaction_prompt() -> void:
	var hit := _trace(INTERACT_DISTANCE,0.0,true)
	var prompt := ""
	if not hit.is_empty() and hit.collider.has_method("get_interaction_prompt"):
		prompt = str(hit.collider.get_interaction_prompt())
	if prompt != last_prompt:
		last_prompt = prompt
		EventBus.interaction_prompt_changed.emit(prompt)

func _interact() -> void:
	var hit := _trace(INTERACT_DISTANCE,0.0,true)
	if not hit.is_empty() and hit.collider.has_method("interact"): hit.collider.interact(self)

func select_weapon(id: String) -> void:
	if not unlocked.has(id) or reload_time > 0: return
	weapon = id
	view_model.select(id)
	firing = false
	refresh_hud()

func reload_weapon() -> void:
	if reload_time > 0 or reserve_ammo <= 0 or ammo >= int(_weapon_data().capacity): return
	reload_time = float(_weapon_data().reload)
	view_model.animate("reload")
	AudioDirector.play("reload","Weapons")
	EventBus.log_event("reload",{"weapon":weapon})

func _fire() -> void:
	if fire_cooldown > 0 or reload_time > 0 or health <= 0 or GameState.completed: return
	if ammo <= 0:
		view_model.animate("empty")
		reload_weapon()
		return
	var data: Dictionary = _weapon_data()
	fire_cooldown = data.interval
	ammo -= 1
	recoil = minf(0.2,recoil + float(data.recoil))
	view_model.animate("fire")
	AudioDirector.play(weapon,"Weapons")
	refresh_hud()
	EventBus.log_event("shot_fired",{"weapon":weapon,"x":position.x,"z":position.z,"ammo_used":1})
	if weapon == "rocket_launcher":
		var projectile := Projectile.new()
		projectile.direction = -camera.global_transform.basis.z
		projectile.speed = float(data.projectile_speed)
		projectile.damage = int(data.damage)
		projectile.splash = float(data.splash)
		projectile.shooter = self
		get_tree().current_scene.add_child(projectile)
		projectile.global_position = camera.global_position
	else:
		var shot_hit := false
		for i in int(data.pellets):
			var hit := _trace(float(data.range),float(data.spread))
			if hit.is_empty(): continue
			var hostile: bool = hit.collider.is_in_group("enemies")
			NeuroImpact.spawn(get_tree().current_scene,hit.position,"energy" if hostile else "spark")
			if not hostile: NeuroImpact.scorch(get_tree().current_scene,hit.position,hit.normal)
			if hit.collider.has_method("apply_damage"):
				hit.collider.apply_damage(int(data.damage),hit.position)
				shot_hit = true
		if shot_hit:
			EventBus.hit_confirmed.emit()
			EventBus.log_event("shot_hit",{"weapon":weapon})

func apply_damage(amount: int) -> void:
	if health <= 0 or amount <= 0 or GameState.completed: return
	health = maxi(0,health-amount)
	damage_flash = 0.3
	refresh_hud()
	EventBus.log_event("player_damaged",{"amount":amount,"hp":health})
	if health <= 0:
		firing = false
		EventBus.log_event("player_died",{"x":position.x,"y":position.y,"z":position.z})
		EventBus.player_died.emit()

func heal(amount: int) -> void:
	health = mini(max_health,health+maxi(0,amount))
	refresh_hud()

func add_ammo(amount: int, id := "shotgun") -> void:
	reserves[id] = mini(999,int(reserves[id])+maxi(0,amount))
	refresh_hud()

func save_snapshot() -> Dictionary:
	return {"position":[position.x,position.y,position.z],"health":health,"weapon":weapon,"magazines":magazines.duplicate(),"reserves":reserves.duplicate(),"inventory":inventory.duplicate(),"keycards":keycards.duplicate(),"credits":credits,"unlocked":unlocked.duplicate(),"yaw":rotation.y,"pitch":pitch}

func apply_snapshot(data: Dictionary) -> void:
	var p: Array = data.position
	position = Vector3(float(p[0]),float(p[1]),float(p[2]))
	velocity = Vector3.ZERO
	health = int(data.health)
	weapon = str(data.weapon)
	magazines = data.magazines.duplicate()
	reserves = data.reserves.duplicate()
	inventory = data.inventory.duplicate()
	keycards = data.keycards.duplicate()
	credits = int(data.credits)
	unlocked = data.unlocked.duplicate()
	rotation.y = float(data.yaw)
	pitch = float(data.pitch)
	reload_time = 0
	fire_cooldown = 0
	firing = false
	view_model.select(weapon)
	refresh_hud()

func _weapon_data() -> Dictionary:
	return weapon_tuning.get(weapon,Weapons.DATA[weapon])
