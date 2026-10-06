extends Node3D

const PlayerScript = preload("res://scripts/player/player.gd")
const EnemyScript = preload("res://scripts/enemies/enemy.gd")
const HUDScript = preload("res://scripts/ui/hud.gd")
const TerminalScript = preload("res://scripts/world/terminal_interactable.gd")
const DoorScript = preload("res://scripts/world/door_interactable.gd")
const CoreScript = preload("res://scripts/world/core_interactable.gd")
const PickupScript = preload("res://scripts/world/pickup.gd")

var metal := Color("#242831")
var concrete := Color("#34343a")
var cyan := Color("#32d6e8")
var magenta := Color("#ed2d74")
var amber := Color("#d98a32")

func _ready() -> void:
	if GameState.pending.is_empty():
		GameState.campaign_mode = false
		GameState.reset_run()
	_build_environment()
	_build_level()
	_spawn_player()
	_spawn_hud()
	_spawn_enemies()
	GameState.apply_pending()
	EventBus.log_event("vertical_slice_ready")

func _build_environment() -> void:
	var world_env := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#05070b")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#18212b")
	env.ambient_light_energy = 0.55
	env.fog_enabled = true
	env.fog_light_color = Color("#101722")
	env.fog_density = 0.022
	world_env.environment = env
	add_child(world_env)

	_make_light(Vector3(-6, 3.0, 3.0), cyan, 3.2, 8.0)
	_make_light(Vector3(0, 4.0, -9.0), magenta, 5.0, 11.0)
	_make_light(Vector3(7, 2.5, -2.0), amber, 2.0, 7.0)

func _build_level() -> void:
	_make_box("Floor", Vector3(0, -0.25, 0), Vector3(24, 0.5, 26), concrete)
	_make_box("Ceiling", Vector3(0, 4.4, 0), Vector3(24, 0.3, 26), Color("#15181e"))
	_make_box("WallLeft", Vector3(-12, 2.0, 0), Vector3(0.5, 4.0, 26), metal)
	_make_box("WallRight", Vector3(12, 2.0, 0), Vector3(0.5, 4.0, 26), metal)
	_make_box("WallBack", Vector3(0, 2.0, -13), Vector3(24, 4.0, 0.5), metal)
	_make_box("WallEntry", Vector3(0, 2.0, 13), Vector3(24, 4.0, 0.5), metal)

	_make_box("PartitionL", Vector3(-7.0, 2.0, -5.3), Vector3(10.0, 4.0, 0.55), metal)
	_make_box("PartitionR", Vector3(7.0, 2.0, -5.3), Vector3(10.0, 4.0, 0.55), metal)
	_make_box("PartitionTop", Vector3(0, 3.65, -5.3), Vector3(4.0, 0.7, 0.55), metal)

	var terminal := StaticBody3D.new()
	terminal.name = "NeuralAccessTerminal"
	terminal.set_script(TerminalScript)
	terminal.position = Vector3(-7.2, 0.85, 3.0)
	add_child(terminal)
	_add_box_visual(terminal, Vector3.ZERO, Vector3(1.7, 1.7, 0.8), Color("#10242a"), cyan, true)

	var door := StaticBody3D.new()
	door.name = "A3SecurityDoor"
	door.set_script(DoorScript)
	door.position = Vector3(0, 1.7, -5.3)
	add_child(door)
	_add_box_visual(door, Vector3.ZERO, Vector3(3.8, 3.4, 0.5), Color("#2c2427"), magenta, true)

	var core_column := MeshInstance3D.new()
	var cylinder := CylinderMesh.new()
	cylinder.top_radius = 2.0
	cylinder.bottom_radius = 2.0
	cylinder.height = 4.7
	core_column.mesh = cylinder
	core_column.position = Vector3(0, 2.2, -10.0)
	var core_mat := StandardMaterial3D.new()
	core_mat.albedo_color = Color("#24101d")
	core_mat.emission_enabled = true
	core_mat.emission = magenta * 2.6
	core_mat.metallic = 0.25
	core_mat.roughness = 0.35
	core_column.material_override = core_mat
	add_child(core_column)

	var core := StaticBody3D.new()
	core.name = "SHIVACoreInterface"
	core.set_script(CoreScript)
	core.position = Vector3(0, 1.0, -7.6)
	add_child(core)
	_add_box_visual(core, Vector3.ZERO, Vector3(1.6, 1.5, 0.8), Color("#101418"), magenta, true)

	_make_pickup(Vector3(-4.2, 0.35, 0.4), "medkit", 40, Color("#d92b45"))
	_make_pickup(Vector3(4.8, 0.35, -1.5), "ammo", 12, amber)

	for item in [
		[Vector3(-3.8, 0.7, 1.0), Vector3(2.3, 1.4, 1.6)],
		[Vector3(4.0, 0.7, 1.8), Vector3(2.0, 1.4, 1.4)],
		[Vector3(-5.0, 0.7, -2.4), Vector3(1.6, 1.4, 1.6)],
		[Vector3(5.2, 0.7, -3.0), Vector3(1.8, 1.4, 1.8)]
	]:
		_make_box("Cover", item[0], item[1], Color("#292e35"))

func _spawn_player() -> void:
	var player := CharacterBody3D.new()
	player.name = "Player"
	player.set_script(PlayerScript)
	player.position = Vector3(0, 1.0, 8.0)
	add_child(player)

func _spawn_hud() -> void:
	var hud := CanvasLayer.new()
	hud.name = "HUD"
	hud.set_script(HUDScript)
	add_child(hud)
	var pause_menu := CanvasLayer.new()
	pause_menu.set_script(preload("res://scripts/ui/pause_menu.gd"))
	add_child(pause_menu)

func _spawn_enemies() -> void:
	for pos in [Vector3(0, 0.1, 0.5), Vector3(5.8, 0.1, -1.4), Vector3(-4.8, 0.1, -3.1)]:
		var enemy := CharacterBody3D.new()
		enemy.name = "HeavySecurity"
		enemy.set_script(EnemyScript)
		enemy.position = pos
		add_child(enemy)

func _make_light(pos: Vector3, color: Color, energy: float, range_value: float) -> void:
	var light := OmniLight3D.new()
	light.position = pos
	light.light_color = color
	light.light_energy = energy
	light.omni_range = range_value
	light.shadow_enabled = true
	add_child(light)

func _make_box(name_value: String, pos: Vector3, size: Vector3, color: Color) -> StaticBody3D:
	var body := StaticBody3D.new()
	body.name = name_value
	body.position = pos
	add_child(body)
	_add_box_visual(body, Vector3.ZERO, size, color)
	return body

func _add_box_visual(parent: Node3D, local_pos: Vector3, size: Vector3, color: Color, emission: Color = Color.BLACK, emissive := false) -> void:
	var mesh_instance := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh_instance.mesh = mesh
	mesh_instance.position = local_pos
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.metallic = 0.18
	mat.roughness = 0.72
	if emissive:
		mat.emission_enabled = true
		mat.emission = emission * 2.0
	mesh_instance.material_override = mat
	parent.add_child(mesh_instance)

	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collision.shape = shape
	collision.position = local_pos
	parent.add_child(collision)

func _make_pickup(pos: Vector3, type_value: String, amount_value: int, color: Color) -> void:
	var pickup := StaticBody3D.new()
	pickup.name = "Pickup_" + type_value
	pickup.set_script(PickupScript)
	pickup.set("pickup_type", type_value)
	pickup.set("amount", amount_value)
	pickup.position = pos
	add_child(pickup)
	_add_box_visual(pickup, Vector3.ZERO, Vector3(0.55, 0.55, 0.55), Color("#111418"), color, true)
