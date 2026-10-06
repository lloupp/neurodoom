extends "res://scripts/world/vertical_slice.gd"

const Campaign = preload("res://data/campaign.gd")
const Block = preload("res://scripts/tools/level_block.gd")
const Access = preload("res://scripts/world/campaign_access.gd")
var definition: Dictionary
var spawn := Vector3.ZERO
var spawn_list: Array[Dictionary] = []
var spawn_index := 0

func _ready() -> void:
	GameState.campaign_mode = true
	definition = Campaign.LEVELS[GameState.level].duplicate(true)
	definition.map = Campaign.map_for(GameState.level)
	concrete = Color(definition.color)
	_build_environment()
	_build_level()
	_dress_sector()
	_spawn_player()
	_spawn_hud()
	_spawn_enemies()
	GameState.set_objective(definition.title + " // " + definition.objective)
	GameState.apply_pending()
	Settings.apply()
	if not GameState.completed: GameState.save_game(true)
	GameState.refresh_objective()
	EventBus.narrative.emit(definition.voice)
	EventBus.message.emit("MOVE [%s/%s/%s/%s] // mouse aim // LMB fire // USE [%s] // RELOAD [%s] // INVENTORY [%s]" % [Settings.key_label("move_forward"),Settings.key_label("move_left"),Settings.key_label("move_back"),Settings.key_label("move_right"),Settings.key_label("interact"),Settings.key_label("reload"),Settings.key_label("inventory")])
	EventBus.log_event("level_started",{"level":GameState.level,"id":definition.id})

func _build_level() -> void:
	var grid: Array = definition.map
	var width: int = grid[0].length()
	var height: int = grid.size()
	_make_box("Floor",Vector3(width-1,-0.25,height-1),Vector3(width*2,0.5,height*2),concrete)
	_make_box("Ceiling",Vector3(width-1,4.4,height-1),Vector3(width*2,0.3,height*2),metal)
	for z in height:
		for x in width:
			var symbol: String = grid[z][x]
			var point := Vector3(x*2,0,z*2)
			var id := "cell_%d_%d" % [x,z]
			if symbol == "#":
				_make_box(id,point+Vector3(0,2,0),Vector3(2,4,2),metal)
			elif symbol == "P": spawn = point+Vector3(0,0.2,0)
			elif Campaign.ENEMY_SYMBOLS.has(symbol):
				spawn_list.append({"kind":Campaign.ENEMY_SYMBOLS[symbol],"point":point,"id":id})
			elif symbol in ["T","D","X","Z"]:
				var access := Access.new()
				access.name = id
				access.role = symbol
				access.position = point+Vector3(0,1.0 if symbol != "D" else 1.8,0)
				add_child(access)
				_add_box_visual(access,Vector3.ZERO,Vector3(1.0,1.8,0.6) if symbol != "D" else Vector3(1.9,3.6,1.9),Color("#18212b"),cyan if symbol == "X" else magenta,true)
				_label(access,"SECTOR EXIT" if symbol == "X" else ("NEURAL RELAY" if symbol == "T" else "SECURITY GATE"))
			elif symbol == "Y":
				var station := NeuroSupplyStation.new()
				station.name = id
				station.position = point+Vector3.UP
				add_child(station)
				_add_box_visual(station,Vector3.ZERO,Vector3(0.8,1.5,0.6),Color("#233030"),amber,true)
				_label(station,"MAINTENANCE SUPPLIES")
			elif symbol in ["M","A","E","R","K","C","L","U"]:
				var types := {"M":"medkit","A":"shotgun_shells","E":"energy_cell","R":"rocket","K":"keycard","C":"credits","L":"audio_log","U":"weapon"}
				var pickup := NeuroPickup.new()
				pickup.name = id
				pickup.pickup_type = types[symbol]
				pickup.amount = 40 if symbol == "M" else (4 if symbol == "R" else (60 if symbol == "E" else 12))
				pickup.item_id = "card_"+str(GameState.level) if symbol == "K" else definition.id+"_"+id
				if symbol == "U": pickup.item_id = str(definition.reward)
				pickup.log_text = definition.log if symbol == "L" else ""
				pickup.position = point+Vector3(0,0.45,0)
				add_child(pickup)
				_add_box_visual(pickup,Vector3.ZERO,Vector3(0.5,0.6,0.5),Color("#101a20"),amber,true)
				pickup.add_sprite()
			elif symbol == "Q":
				# Low cover leaves both side routes walkable.
				_make_box(id,point+Vector3(0,0.55,0),Vector3(1.1,1.1,1.1),concrete.lightened(0.12))
	for pos in [spawn+Vector3(0,3,-4),Vector3(width,3,height),Vector3(width,3,3)]:
		_make_light(pos,cyan if GameState.level == 0 else (Color("#71bc70") if GameState.level == 1 else magenta),3.0,14.0)

func _label(parent: Node3D, text: String) -> void:
	var label := Label3D.new()
	label.text = text
	label.position.y = 1.3
	label.pixel_size = 0.003
	label.font_size = 30
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	parent.add_child(label)

func _spawn_player() -> void:
	var body := NeuroPlayer.new()
	body.name = "Player"
	if GameState.pending.is_empty(): body.unlocked = ["pistol"]
	elif GameState.pending.has("carry"): body.unlocked = GameState.pending.carry.unlocked.duplicate()
	body.position = spawn
	add_child(body)

func _spawn_enemies() -> void:
	for entry in spawn_list:
		var enemy := NeuroEnemy.new()
		enemy.name = entry.id
		enemy.enemy_kind = entry.kind
		enemy.position = entry.point+Vector3(0,0.1,0)
		enemy.patrol_points = [entry.point,entry.point+Vector3(0,0,1)]
		add_child(enemy)

func _make_box(name_value: String,pos: Vector3,size: Vector3,color: Color) -> StaticBody3D:
	var block := Block.new()
	block.name = name_value
	block.position = pos
	block.block_size = size
	block.surface_color = color
	block.material_family = "concrete" if name_value in ["Floor","Ceiling"] else ("neural" if str(definition.theme) == "organic" else "painted_metal")
	add_child(block)
	return block

func _make_light(pos: Vector3,color: Color,energy: float,range_value: float) -> void:
	var light := OmniLight3D.new()
	light.position = pos
	light.light_color = color
	light.light_energy = energy
	light.omni_range = range_value
	light.add_to_group("quality_lights")
	light.shadow_enabled = false
	add_child(light)

func navigation_path(from: Vector3,to: Vector3) -> Array[Vector2i]:
	var blocked: Array[Vector2i] = []
	for child in get_children():
		if child.get_script() == Access and child.role == "D" and not child.opened:
			blocked.append(NeuroGridNavigation.cell(child.position))
	return NeuroGridNavigation.path(definition.map,NeuroGridNavigation.cell(from),NeuroGridNavigation.cell(to),blocked)

func _dress_sector() -> void:
	# Visual dressing has no collisions and cannot obstruct authored routes.
	var accent := Color("#8b9e53") if definition.theme == "organic" else cyan
	for z in range(2,definition.map.size()-1,3):
		var pipe := MeshInstance3D.new()
		var mesh := CylinderMesh.new()
		mesh.top_radius = 0.12
		mesh.bottom_radius = 0.12
		mesh.height = 30.0
		pipe.mesh = mesh
		pipe.position = Vector3(18,3.9,z*2)
		pipe.rotation.z = PI/2
		var mat := StandardMaterial3D.new()
		mat.albedo_color = accent.darkened(0.65)
		mat.roughness = 0.85
		pipe.material_override = mat
		add_child(pipe)
	var sign := Label3D.new()
	sign.text = str(definition.title)+"\n"+str(definition.theme).to_upper()+" // AUTHORIZED PERSONNEL"
	sign.position = spawn+Vector3(0,2.8,-1)
	sign.font_size = 34
	sign.pixel_size = 0.004
	sign.modulate = accent
	add_child(sign)
