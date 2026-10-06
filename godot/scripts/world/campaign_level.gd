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
	definition = Campaign.LEVELS[GameState.level]
	concrete = Color(definition.color)
	_build_environment()
	_build_level()
	_spawn_player()
	_spawn_hud()
	_spawn_enemies()
	GameState.set_objective(definition.title + " // " + definition.objective)
	GameState.apply_pending()
	Settings.apply()
	if not GameState.completed: GameState.save_game()
	EventBus.message.emit(definition.voice + "\nWASD move // mouse aim // LMB fire // E use // R reload // 1–4 weapons // ESC pause")
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
			elif symbol in ["T","D","X"]:
				var access := Access.new()
				access.name = id
				access.role = symbol
				access.position = point+Vector3(0,1.0 if symbol != "D" else 1.8,0)
				add_child(access)
				_add_box_visual(access,Vector3.ZERO,Vector3(1.0,1.8,0.6) if symbol != "D" else Vector3(1.9,3.6,1.9),Color("#18212b"),cyan if symbol == "X" else magenta,true)
				_label(access,"SECTOR EXIT" if symbol == "X" else ("NEURAL RELAY" if symbol == "T" else "SECURITY GATE"))
			elif symbol in ["M","A","E","R","K","C","L"]:
				var types := {"M":"medkit","A":"shotgun_shells","E":"energy_cell","R":"rocket","K":"keycard","C":"credits","L":"audio_log"}
				var pickup := NeuroPickup.new()
				pickup.name = id
				pickup.pickup_type = types[symbol]
				pickup.amount = 40 if symbol == "M" else (4 if symbol == "R" else (60 if symbol == "E" else 12))
				pickup.item_id = "card_"+str(GameState.level) if symbol == "K" else definition.id+"_"+id
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
