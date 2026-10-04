extends Node

const PATH := "user://neurodoom_settings.cfg"
var values := {"master":0.8,"music":0.6,"sfx":0.8,"sensitivity":0.0022,"fov":78.0,"fullscreen":false,"resolution":0,"quality":1,"motion":true,"shake":true,"subtitles":true}

func _ready() -> void:
	var config := ConfigFile.new()
	if config.load(PATH) == OK:
		for key in values:
			var value = config.get_value("settings", key, values[key])
			if typeof(value) == typeof(values[key]): values[key] = value
	values.sensitivity = clampf(values.sensitivity, 0.0005, 0.006)
	values.fov = clampf(values.fov, 60, 110)
	apply()

func apply() -> void:
	for pair in [["Master","master"],["Music","music"],["SFX","sfx"]]:
		var index := AudioServer.get_bus_index(pair[0])
		if index >= 0: AudioServer.set_bus_volume_db(index, linear_to_db(clampf(values[pair[1]], 0.001, 1)))
	if DisplayServer.get_name() != "headless":
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN if values.fullscreen else DisplayServer.WINDOW_MODE_WINDOWED)
		if not values.fullscreen:
			DisplayServer.window_set_size([Vector2i(1280,720),Vector2i(1600,900),Vector2i(1920,1080)][clampi(values.resolution,0,2)])
	for light in get_tree().get_nodes_in_group("quality_lights"):
		light.shadow_enabled = int(values.quality) >= 2
	var config := ConfigFile.new()
	for key in values: config.set_value("settings", key, values[key])
	config.save(PATH)
