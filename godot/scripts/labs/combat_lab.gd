extends Node3D

const PlayerScript = preload("res://scripts/player/player.gd")
const EnemyScript = preload("res://scripts/enemies/enemy.gd")
const HUDScript = preload("res://scripts/ui/hud.gd")

@export_enum("enemy", "weapon") var mode := "enemy"

func _ready() -> void:
	GameState.campaign_mode = false
	GameState.reset_run()
	GameState.set_objective("LAB // test movement, weapon feel and enemy response.")
	_build_environment()
	_build_arena()
	_spawn_player()
	_spawn_hud()
	_spawn_targets()
	_build_inspector()

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

var lab_kind := "heavy"
var lab_values := {"hp":70.0,"speed":2.0,"detection":20.0,"damage":14.0}
var inspector: Control
var lab_animation := "auto"

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_F2:
		inspector.visible = not inspector.visible
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if inspector.visible else Input.MOUSE_MODE_CAPTURED
		for enemy in get_tree().get_nodes_in_group("enemies"):
			enemy.set_physics_process(not inspector.visible)

func _slider(box: Node,key: String,start: float,maximum: float,callback: Callable) -> void:
	var row := HBoxContainer.new()
	box.add_child(row)
	var label := Label.new()
	label.text = key
	label.custom_minimum_size.x = 100
	row.add_child(label)
	var slider := HSlider.new()
	slider.min_value = 0
	slider.max_value = maximum
	slider.step = 0.01 if maximum < 10 else 1
	slider.value = start
	slider.custom_minimum_size.x = 180
	slider.value_changed.connect(callback)
	row.add_child(slider)

func _build_inspector() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 20
	add_child(layer)
	inspector = PanelContainer.new()
	inspector.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	inspector.position = Vector2(-340,80)
	layer.add_child(inspector)
	var box := VBoxContainer.new()
	inspector.add_child(box)
	var hint := Label.new()
	hint.text = "F2: release mouse / edit lab"
	box.add_child(hint)
	var select := OptionButton.new()
	var choices: Array = NeuroEnemies.DATA.keys() if mode == "enemy" else NeuroWeapons.ORDER.duplicate()
	for choice in choices: select.add_item(choice)
	box.add_child(select)
	select.item_selected.connect(func(index: int):
		if mode == "enemy": lab_kind = choices[index]
		else: GameState.player.select_weapon(choices[index]))
	if mode == "enemy":
		for key in lab_values:
			_slider(box,key,lab_values[key],300 if key == "hp" else (30 if key != "speed" else 8),func(value: float): lab_values[key] = value)
		var animation := OptionButton.new()
		for state_name in ["auto","idle","walk","attack","hit","death"]: animation.add_item(state_name)
		animation.item_selected.connect(func(index: int): lab_animation = ["auto","idle","walk","attack","hit","death"][index])
		box.add_child(animation)
		var reset := Button.new()
		reset.text = "SPAWN / RESET"
		reset.pressed.connect(_reset_enemy)
		box.add_child(reset)
	else:
		var player = GameState.player
		for id in NeuroWeapons.ORDER: player.weapon_tuning[id] = NeuroWeapons.DATA[id].duplicate()
		for key in ["damage","interval","recoil","spread","pellets","reload"]:
			_slider(box,key,float(player._weapon_data()[key]),100 if key == "damage" else (16 if key == "pellets" else 3),func(value: float):
				player.weapon_tuning[player.weapon][key] = maxi(1,int(value)) if key in ["damage","pellets"] else maxf(0.01,value))
		var refill := Button.new()
		refill.text = "REFILL AMMO"
		refill.pressed.connect(func(): player.magazines = NeuroWeapons.magazines(); player.reserves = NeuroWeapons.reserves(); player.refresh_hud())
		box.add_child(refill)
	inspector.hide()

func _reset_enemy() -> void:
	for enemy in get_tree().get_nodes_in_group("enemies"): enemy.queue_free()
	var enemy := NeuroEnemy.new()
	enemy.name = "LabEnemy"
	enemy.enemy_kind = lab_kind
	enemy.max_health = int(lab_values.hp)
	enemy.speed = lab_values.speed
	enemy.detection_range = lab_values.detection
	enemy.contact_damage = int(lab_values.damage)
	enemy.position = Vector3(0,0.1,-4)
	add_child(enemy)
	if lab_animation != "auto":
		enemy.set_physics_process(false)
		enemy.sprite.set_state(lab_animation)
	else: enemy.set_physics_process(not inspector.visible)
