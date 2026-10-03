class_name NeuroPickup
extends StaticBody3D

@export var pickup_type := "medkit"
@export var amount := 35

func get_interaction_prompt() -> String:
	if pickup_type == "ammo":
		return "E  Pick up shells +%d" % amount
	return "E  Pick up medkit +%d HP" % amount

func interact(player: Node) -> void:
	if pickup_type == "ammo" and player.has_method("add_ammo"):
		player.add_ammo(amount)
	elif pickup_type == "medkit" and player.has_method("heal"):
		player.heal(amount)
	EventBus.log_event("pickup", {"type": pickup_type, "amount": amount})
	queue_free()
