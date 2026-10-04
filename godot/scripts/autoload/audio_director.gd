extends Node

# Authored synthesized placeholders, generated locally; no third-party recordings.
var streams: Dictionary = {}
var pool: Array[AudioStreamPlayer] = []

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
	for id in ["ambient", "music"]:
		var player := AudioStreamPlayer.new()
		player.playback_type = AudioServer.PLAYBACK_TYPE_STREAM
		player.stream = streams[id]
		player.bus = "Music" if id == "music" else "Ambient"
		player.volume_db = -24
		add_child(player)
		player.stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
		player.stream.loop_end = player.stream.data.size() / 2
		if DisplayServer.get_name() != "headless": player.play()

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
		if player is AudioStreamPlayer:
			player.stop()
			player.stream = null
	streams.clear()

func shutdown() -> void:
	for player in get_children():
		if player is AudioStreamPlayer:
			player.stop()
			player.stream = null
