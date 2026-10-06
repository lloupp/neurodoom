extends Node

signal objective_changed(text: String)
signal interaction_prompt_changed(text: String)
signal power_restored
signal door_unlocked
signal game_completed
signal player_damaged(current_hp: int, max_hp: int)
signal ammo_changed(current_ammo: int, reserve_ammo: int)
signal enemy_killed(kind: String)
signal playtest_event(kind: String, payload: Dictionary)

func log_event(kind: String, payload: Dictionary = {}) -> void:
	playtest_event.emit(kind, payload)

signal message(text: String)
signal hit_confirmed
signal player_died

signal narrative(text: String)
