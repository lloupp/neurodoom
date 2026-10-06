extends Node

# Authored synthesized placeholders, generated locally; no third-party recordings.
var streams: Dictionary = {}
var pool: Array[AudioStreamPlayer] = []
var spatial_pool: Array[AudioStreamPlayer3D] = []
var beds: Dictionary = {}
# World threat 0..1 (web reference world.threat): highest awareness among living enemies.
var threat := 0.0

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for bus in ["Music", "SFX", "Weapons", "Enemies", "UI", "Ambient"]:
		if AudioServer.get_bus_index(bus) < 0:
			AudioServer.add_bus()
			var index := AudioServer.bus_count - 1
			AudioServer.set_bus_name(index, bus)
			AudioServer.set_bus_send(index, "SFX" if bus in ["Weapons", "Enemies", "Ambient"] else "Master")
	for id in ["pistol", "shotgun", "pulse_rifle", "rocket_launcher", "reload", "impact", "footstep", "pickup", "door", "terminal", "alert", "explosion", "ambient", "music"]:
		streams[id] = load("res://audio/placeholder/%s.wav" % id)
	for i in 16:
		var player := AudioStreamPlayer.new()
		player.playback_type = AudioServer.PLAYBACK_TYPE_STREAM
		add_child(player)
		pool.append(player)
	for i in 16:
		var spatial := AudioStreamPlayer3D.new()
		spatial.max_distance = 32.0
		spatial.unit_size = 4.0
		add_child(spatial)
		spatial_pool.append(spatial)
	for id in ["ambient", "music"]:
		var player := AudioStreamPlayer.new()
		player.playback_type = AudioServer.PLAYBACK_TYPE_STREAM
		player.stream = streams[id]
		player.bus = "Music" if id == "music" else "Ambient"
		player.volume_db = -24
		beds[id] = player
		add_child(player)
		player.stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
		player.stream.loop_end = player.stream.data.size() / 2
		if DisplayServer.get_name() != "headless": player.play()

static func awareness(enemy: Node) -> float:
	if enemy.health <= 0: return 0.0
	match enemy.state:
		NeuroEnemy.State.CHASE, NeuroEnemy.State.ATTACK, NeuroEnemy.State.RETREAT: return 1.0
		NeuroEnemy.State.ALERT: return 0.6
	return 0.0

func _process(delta: float) -> void:
	var target := 0.0
	if not get_tree().paused:
		for enemy in get_tree().get_nodes_in_group("enemies"):
			target = maxf(target, awareness(enemy))
	# Rise fast, decay slowly, so music does not flicker when contact is briefly lost.
	threat = move_toward(threat, target, delta * (1.5 if target > threat else 0.25))
	if beds.has("music"): beds.music.volume_db = lerpf(-32.0, -12.0, threat)
	if beds.has("ambient"): beds.ambient.volume_db = lerpf(-20.0, -28.0, threat)

func play(id: String, bus := "SFX") -> void:
	if DisplayServer.get_name() == "headless" or not streams.has(id): return
	for player in pool:
		if not player.playing:
			player.stream = streams[id]
			player.bus = bus
			player.volume_db = -10
			if DisplayServer.get_name() != "headless": player.play()
			return

func _exit_tree() -> void:
	for player in get_children():
		if player is AudioStreamPlayer or player is AudioStreamPlayer3D:
			player.stop()
			player.stream = null
	streams.clear()

func shutdown() -> void:
	for player in get_children():
		if player is AudioStreamPlayer or player is AudioStreamPlayer3D:
			player.stop()
			player.stream = null

func play_at(id: String, point: Vector3, bus := "SFX") -> void:
	if DisplayServer.get_name() == "headless" or not streams.has(id): return
	for player in spatial_pool:
		if not player.playing:
			player.stream = streams[id]
			player.bus = bus
			player.position = point
			player.volume_db = -8
			player.play()
			return
