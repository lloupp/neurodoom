extends Node

const PATH := "user://neurodoom_settings.cfg"
var values := {"master":0.8,"music":0.6,"sfx":0.8,"sensitivity":0.0022,"fov":78.0,"fullscreen":false,"resolution":0,"quality":1,"motion":true,"shake":true,"subtitles":true}

# Physical keys keep the WASD layout on AZERTY/QWERTZ keyboards.
const BINDINGS := {"move_forward":KEY_W,"move_back":KEY_S,"move_left":KEY_A,"move_right":KEY_D,"sprint":KEY_SHIFT,"interact":KEY_E,"reload":KEY_R,"weapon_1":KEY_1,"weapon_2":KEY_2,"weapon_3":KEY_3,"weapon_4":KEY_4,"inventory":KEY_TAB,"quick_save":KEY_F5,"quick_load":KEY_F9}

func _ready() -> void:
	for action in BINDINGS:
		if InputMap.has_action(action): continue
		InputMap.add_action(action)
		var event := InputEventKey.new()
		event.physical_keycode = BINDINGS[action]
		InputMap.action_add_event(action, event)
	if not InputMap.has_action("fire"):
		InputMap.add_action("fire")
		var click := InputEventMouseButton.new()
		click.button_index = MOUSE_BUTTON_LEFT
		InputMap.action_add_event("fire", click)
	var config := ConfigFile.new()
	if config.load(PATH) == OK:
		for key in values:
			var value = config.get_value("settings", key, values[key])
			if typeof(value) == typeof(values[key]): values[key] = value
		for action in BINDINGS:
			var code = config.get_value("bindings", action, BINDINGS[action])
			if typeof(code) == TYPE_INT and code > 0: _bind(action, code)
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
	for action in BINDINGS: config.set_value("bindings", action, key_for(action))
	config.save(PATH)

func key_for(action: String) -> int:
	for event in InputMap.action_get_events(action):
		if event is InputEventKey: return event.physical_keycode
	return 0

func _bind(action: String, code: int) -> void:
	for event in InputMap.action_get_events(action):
		if event is InputEventKey: InputMap.action_erase_event(action, event)
	var event := InputEventKey.new()
	event.physical_keycode = code
	InputMap.action_add_event(action, event)

# Assign a key; an action already using it receives the old key (swap), so nothing is left unbound.
func rebind(action: String, code: int) -> void:
	var previous := key_for(action)
	for other in BINDINGS:
		if other != action and key_for(other) == code: _bind(other, previous)
	_bind(action, code)
	apply()

func reset_bindings() -> void:
	for action in BINDINGS: _bind(action, BINDINGS[action])
	apply()
