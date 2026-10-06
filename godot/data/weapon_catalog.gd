class_name NeuroWeapons
extends RefCounted

const ORDER := ["pistol", "shotgun", "pulse_rifle", "rocket_launcher"]
# Values start from the web reference; reloads/magazines are native Godot mechanics.
const DATA := {
	"pistol": {"name":"VanBrck-7", "damage":18, "interval":0.25, "spread":0.012, "pellets":1, "range":44.0, "recoil":0.04, "capacity":12, "reload":0.9, "automatic":false},
	"shotgun": {"name":"HX Disruptor", "damage":9, "interval":0.714, "spread":0.18, "pellets":8, "range":24.0, "recoil":0.08, "capacity":6, "reload":1.6, "automatic":false},
	"pulse_rifle": {"name":"SHIVA Pulse", "damage":24, "interval":0.143, "spread":0.02, "pellets":1, "range":56.0, "recoil":0.05, "capacity":30, "reload":1.4, "automatic":true},
	"rocket_launcher": {"name":"M-90 Fragline", "damage":65, "interval":1.11, "spread":0.015, "pellets":1, "range":70.0, "recoil":0.14, "capacity":4, "reload":2.0, "automatic":false, "projectile_speed":18.0, "splash":4.4}
}

static func magazines() -> Dictionary:
	return {"pistol":12, "shotgun":6, "pulse_rifle":30, "rocket_launcher":4}

static func reserves() -> Dictionary:
	return {"pistol":48, "shotgun":18, "pulse_rifle":90, "rocket_launcher":4}
