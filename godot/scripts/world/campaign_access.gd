extends StaticBody3D

var role := "T"
var opened := false
var original_position := Vector3.ZERO

func _ready() -> void:
	original_position = position
	if role == "D":
		EventBus.door_unlocked.connect(_open)
		if GameState.door_open: call_deferred("_open")

func get_interaction_prompt() -> String:
	if role == "Z": return Settings.prompt("interact","Bridge auxiliary power using sector card") if not GameState.power_restored else "AUXILIARY POWER ONLINE"
	if role == "T" and GameState.campaign_mode and not GameState.power_restored:
		var mechanism: String = NeuroCampaign.LEVELS[GameState.level].relay
		if mechanism == "valve": return Settings.prompt("interact","Close root isolation valve")
		if mechanism == "containment": return "LIFT LOCKED // neutralize Atlas" if GameState.living_kinds().has("brute") else Settings.prompt("interact","Route containment lift")
	if role == "T": return "Neural relay // power online" if GameState.power_restored else Settings.prompt("interact","Breach neural relay // authorize sector power")
	if role == "X": return Settings.prompt("interact","Exit sector") if GameState.can_exit() else "EXIT LOCKED // " + GameState.missing_requirements()
	if opened: return ""
	return Settings.prompt("interact","Open security gate") if GameState.can_exit() else "SECURITY // " + GameState.missing_requirements()

func interact(_player: Node) -> void:
	if role == "Z":
		if _player.keycards.has("card_"+str(GameState.level)):
			GameState.restore_power()
			EventBus.narrative.emit("SHIVA // You have found a circuit I did not authorize.")
		else: EventBus.message.emit("Auxiliary bridge needs the sector access card")
	elif role == "T":
		if GameState.power_restored or get_tree().paused: return
		var mechanism: String = NeuroCampaign.LEVELS[GameState.level].relay
		if mechanism == "containment" and GameState.living_kinds().has("brute"):
			EventBus.message.emit("Lift routing denied // neutralize Atlas containment first")
			return
		if mechanism in ["valve","containment"]:
			GameState.restore_power()
			EventBus.narrative.emit(NeuroCampaign.LEVELS[GameState.level].voice)
			return
		var hack := NeuroHackPanel.new()
		hack.finished.connect(_hack_finished)
		get_tree().root.add_child(hack)
	elif role == "X": GameState.advance()
	elif GameState.can_exit(): GameState.mark_door_open()

func _hack_finished(won: bool) -> void:
	if won:
		EventBus.narrative.emit(NeuroCampaign.LEVELS[GameState.level].voice)
		GameState.restore_power()
		return
	# Trace consequence (web: alarm + enemies converge). The relay can be retried.
	EventBus.message.emit("TRACE DETECTED // hostiles converging on relay")
	AudioDirector.play("alert", "UI")
	EventBus.log_event("hack_failed", {"level":GameState.level})
	for enemy in get_tree().get_nodes_in_group("enemies"):
		if enemy.health > 0 and enemy.global_position.distance_to(global_position) < 30.0:
			enemy.last_known = global_position
			enemy.memory = 6.0
			if enemy.state in [NeuroEnemy.State.IDLE, NeuroEnemy.State.PATROL]: enemy.state = NeuroEnemy.State.ALERT

func _open() -> void:
	if opened: return
	opened = true
	collision_layer = 0
	collision_mask = 0
	create_tween().tween_property(self,"position:y",original_position.y+4,0.65)
