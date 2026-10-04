class_name NeuroEnemies
extends RefCounted

const DATA := {
	"drone": {"hp":30, "speed":3.4, "armor":1.0, "damage":5, "range":1.6, "cooldown":0.6, "behavior":"melee"},
	"heavy": {"hp":70, "speed":2.0, "armor":0.75, "damage":14, "range":1.8, "cooldown":1.1, "behavior":"melee"},
	"ghost": {"hp":18, "speed":4.2, "armor":1.3, "damage":4, "range":1.6, "cooldown":0.4, "behavior":"phase"},
	"turret": {"hp":90, "speed":0.0, "armor":0.6, "damage":9, "range":22.0, "cooldown":1.3, "behavior":"ranged"},
	"boss": {"hp":320, "speed":1.6, "armor":0.8, "damage":18, "range":26.0, "cooldown":2.8, "behavior":"boss"},
	"spitter": {"hp":35, "speed":2.2, "armor":0.9, "damage":7, "range":18.0, "cooldown":1.6, "behavior":"ranged"},
	"brute": {"hp":150, "speed":1.3, "armor":0.5, "damage":24, "range":2.6, "cooldown":1.8, "behavior":"melee"},
	"wisp": {"hp":22, "speed":3.2, "armor":1.4, "damage":5, "range":14.0, "cooldown":1.8, "behavior":"ranged"},
	"stalker": {"hp":35, "speed":3.0, "armor":0.8, "damage":12, "range":1.6, "cooldown":1.2, "behavior":"ambush"}
}
