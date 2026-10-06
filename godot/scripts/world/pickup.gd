class_name NeuroPickup
extends StaticBody3D

@export var pickup_type := "medkit"
@export var amount := 35
@export var item_id := ""
@export_multiline var log_text := ""
var collected := false

func _ready() -> void:
	collision_layer = 4
	collision_mask = 0
	add_to_group("persistent")

func add_sprite() -> void:
	var sprite := Sprite3D.new()
	var index := 0 if pickup_type == "medkit" else (1 if pickup_type == "keycard" else (3 if pickup_type in ["data_log","audio_log"] else 2))
	sprite.texture = NeuroSpriteCache.region("res://art/runtime/pickups.svg",Vector2i(index,0),Vector2i(256,256))
	sprite.pixel_size = 0.003
	sprite.position.y = 0.5
	sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	add_child(sprite)

func get_interaction_prompt() -> String:
	if pickup_type == "weapon": return Settings.prompt("interact","RECOVER " + str(NeuroWeapons.DATA[item_id].name) if NeuroWeapons.DATA.has(item_id) else "WEAPON CACHE")
	return Settings.prompt("interact", pickup_type.replace("_"," ").to_upper() + (" +%d" % amount if pickup_type not in ["keycard","audio_log","weapon"] else ""))

func interact(player: Node) -> void:
	if collected: return
	match pickup_type:
		"medkit":
			if player.health >= player.max_health:
				EventBus.message.emit("Health full // medkit retained")
				return
			player.heal(amount)
		"ammo", "shotgun_shells": player.add_ammo(amount,"shotgun")
		"pistol_ammo": player.add_ammo(amount,"pistol")
		"energy_cell": player.add_ammo(amount,"pulse_rifle")
		"rocket": player.add_ammo(amount,"rocket_launcher")
		"keycard":
			if not player.keycards.has(item_id): player.keycards.append(item_id)
		"weapon":
			if not NeuroWeapons.ORDER.has(item_id): return
			if not player.unlocked.has(item_id): player.unlocked.append(item_id)
			player.select_weapon(item_id)
		"credits": player.credits += amount
		"data_log", "audio_log":
			if not player.inventory.has(item_id): player.inventory.append(item_id)
		_: return
	collected = true
	var message := "RECOVERED // " + pickup_type.replace("_"," ")
	if not log_text.is_empty(): EventBus.narrative.emit(log_text)
	GameState.refresh_objective()
	EventBus.message.emit(message)
	AudioDirector.play("pickup","UI")
	EventBus.log_event("pickup",{"type":pickup_type,"id":str(name),"amount":amount})
	GameState.world[str(name)] = save_snapshot()
	queue_free()

func save_snapshot() -> Dictionary:
	return {"kind":"pickup","collected":collected}

func apply_snapshot(data: Dictionary) -> void:
	collected = bool(data.collected)
	if collected:
		hide()
		collision_layer = 0
		collision_mask = 0
		queue_free()
