extends Node3D

const PlayerScript = preload("res://scripts/player/player.gd")
const EnemyScript = preload("res://scripts/enemies/enemy.gd")
const HUDScript = preload("res://scripts/ui/hud.gd")

@export_enum("enemy", "weapon") var mode := "enemy"

func _ready() -> void:
	GameState.reset_run()
	GameState.set_objective("LAB // test movement, weapon feel and enemy response.")
	_build_environment()
	_build_arena()
	_spawn_player()
	_spawn_hud()
	_spawn_targets()

func _build_environment() -> void:
	var world_env := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#05070b")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#26313b")
	env.ambient_light_energy = 0.8
	env.fog_enabled = true
	env.fog_density = 0.012
	world_env.environment = env
	add_child(world_env)

	var key := OmniLight3D.new()
	key.position = Vector3(0, 4, -2)
	key.light_color = Color("#32d6e8") if mode == "weapon" else Color("#ed2d74")
	key.light_energy = 4.0
	key.omni_range = 14.0
	key.shadow_enabled = true
	add_child(key)

func _build_arena() -> void:
	_box(Vector3(0, -0.25, 0), Vector3(18, 0.5, 20), Color("#333840"))
	_box(Vector3(-9, 2, 0), Vector3(0.5, 4, 20), Color("#20252c"))
	_box(Vector3(9, 2, 0), Vector3(0.5, 4, 20), Color("#20252c"))
	_box(Vector3(0, 2, -10), Vector3(18, 4, 0.5), Color("#20252c"))
	_box(Vector3(0, 2, 10), Vector3(18, 4, 0.5), Color("#20252c"))
	for z in [-4.0, 0.0, 4.0]:
		_box(Vector3(-4.8, 0.6, z), Vector3(1.7, 1.2, 1.7), Color("#2b3038"))
		_box(Vector3(4.8, 0.6, z), Vector3(1.7, 1.2, 1.7), Color("#2b3038"))

func _spawn_player() -> void:
	var player := CharacterBody3D.new()
	player.name = "Player"
	player.set_script(PlayerScript)
	player.position = Vector3(0, 1, 7)
	add_child(player)

func _spawn_hud() -> void:
	var hud := CanvasLayer.new()
	hud.set_script(HUDScript)
	add_child(hud)

func _spawn_targets() -> void:
	var positions := [Vector3(0, 0.1, -2), Vector3(-4, 0.1, -5), Vector3(4, 0.1, -6)]
	if mode == "weapon":
		positions = [Vector3(0, 0.1, -4)]
	for pos in positions:
		var enemy := CharacterBody3D.new()
		enemy.set_script(EnemyScript)
		enemy.position = pos
		add_child(enemy)

func _box(pos: Vector3, size: Vector3, color: Color) -> void:
	var body := StaticBody3D.new()
	body.position = pos
	var mesh_i := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	mesh_i.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 0.8
	mesh_i.material_override = mat
	body.add_child(mesh_i)
	var col := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	col.shape = shape
	body.add_child(col)
	add_child(body)
