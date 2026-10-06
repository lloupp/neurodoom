class_name NeuroSupplyStation
extends StaticBody3D

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	collision_layer = 4
	collision_mask = 0

var panel: CanvasLayer
var status := ""
const Factory = preload("res://scripts/ui/menu_factory.gd")

func get_interaction_prompt() -> String:
	return Settings.prompt("interact","Maintenance supplies // spend credits")

func interact(_player: Node) -> void:
	if get_tree().paused: return
	GameState.player.firing = false
	panel = CanvasLayer.new()
	panel.layer = 28
	panel.process_mode = Node.PROCESS_MODE_ALWAYS
	get_tree().root.add_child(panel)
	get_tree().paused = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_draw()

# Validate before charging; full health/ammo never consumes credits.
func purchase(kind: String) -> bool:
	var player = GameState.player
	var cost := 6
	if not kind in ["medkit","ammo"]: return false
	if player.credits < cost:
		status = "Insufficient credits // need 6"
		return false
	if kind == "medkit" and player.health >= player.max_health:
		status = "Health full // credits retained"
		return false
	if kind == "ammo" and player.reserves[player.weapon] >= 999:
		status = "Ammo full // credits retained"
		return false
	player.credits -= cost
	if kind == "medkit": player.heal(40)
	else: player.add_ammo(4 if player.weapon == "rocket_launcher" else 18,player.weapon)
	status = "Supply delivered // 6 credits spent"
	EventBus.log_event("supply_purchase",{"kind":kind,"weapon":player.weapon,"cost":cost})
	GameState.save_game(true)
	return true

func _draw() -> void:
	for child in panel.get_children():
		panel.remove_child(child)
		child.queue_free()
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	panel.add_child(root)
	var box := Factory.panel(root,"MAINTENANCE // %d CREDITS" % GameState.player.credits)
	var label := Label.new()
	label.text = status if not status.is_empty() else "Exchange recovered credits for supplies. Full resources are not charged."
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(label)
	Factory.button(box,"MEDKIT +40 HP // 6 CREDITS",func(): purchase("medkit"); _draw())
	Factory.button(box,"AMMO FOR CURRENT WEAPON // 6 CREDITS",func(): purchase("ammo"); _draw())
	Factory.button(box,"CLOSE",_close).grab_focus()

func _input(event: InputEvent) -> void:
	if is_instance_valid(panel) and event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE:
		get_viewport().set_input_as_handled()
		_close()

func _close() -> void:
	get_tree().paused = false
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	if is_instance_valid(panel): panel.queue_free()
