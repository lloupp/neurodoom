extends Node3D

var swatches := [
	{"name":"Concrete", "color":Color("#36383d"), "metal":0.0, "rough":0.92},
	{"name":"PaintedMetal", "color":Color("#29313a"), "metal":0.55, "rough":0.48},
	{"name":"Oxidized", "color":Color("#56372d"), "metal":0.35, "rough":0.86},
	{"name":"SHIVA", "color":Color("#2b1021"), "metal":0.15, "rough":0.44, "emission":Color("#ed2d74")},
	{"name":"Access", "color":Color("#10262a"), "metal":0.1, "rough":0.5, "emission":Color("#32d6e8")}
]

func _ready() -> void:
	var env_node := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#06080c")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#222936")
	env.ambient_light_energy = 0.75
	env_node.environment = env
	add_child(env_node)

	var floor := MeshInstance3D.new()
	var floor_mesh := PlaneMesh.new()
	floor_mesh.size = Vector2(18, 12)
	floor.mesh = floor_mesh
	var floor_mat := StandardMaterial3D.new()
	floor_mat.albedo_color = Color("#1e2126")
	floor_mat.roughness = 0.95
	floor.material_override = floor_mat
	add_child(floor)

	for i in swatches.size():
		var data: Dictionary = swatches[i]
		var mesh_i := MeshInstance3D.new()
		var mesh := BoxMesh.new()
		mesh.size = Vector3(2.2, 2.2, 2.2)
		mesh_i.mesh = mesh
		mesh_i.position = Vector3(-6 + i * 3.0, 1.1, -1)
		var mat := StandardMaterial3D.new()
		mat.albedo_color = data["color"]
		mat.metallic = float(data["metal"])
		mat.roughness = float(data["rough"])
		if data.has("emission"):
			mat.emission_enabled = true
			mat.emission = data["emission"] * 2.5
		mesh_i.material_override = mat
		add_child(mesh_i)

	var light := OmniLight3D.new()
	light.position = Vector3(0, 5, 3)
	light.light_color = Color("#f2e3c6")
	light.light_energy = 5.0
	light.omni_range = 15.0
	light.shadow_enabled = true
	add_child(light)

	var camera := Camera3D.new()
	camera.position = Vector3(0, 4.5, 9.5)
	camera.look_at_from_position(camera.position, Vector3(0, 1, -1))
	camera.current = true
	add_child(camera)
