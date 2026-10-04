class_name NeuroSaveSystem
extends RefCounted

const SAVE_PATH := "user://neurodoom_production_save.json"
const VERSION := 2
const Weapons = preload("res://data/weapon_catalog.gd")
const Enemies = preload("res://data/enemy_catalog.gd")
static var last_error := ""

static func number(value: Variant, low: float, high: float) -> bool:
	return typeof(value) in [TYPE_INT,TYPE_FLOAT] and is_finite(float(value)) and float(value) >= low and float(value) <= high

static func point(value: Variant) -> bool:
	if not value is Array or value.size() != 3: return false
	for item in value:
		if not number(item,-10000,10000): return false
	return true

static func string_array(value: Variant) -> bool:
	if not value is Array or value.size() > 512: return false
	for item in value:
		if not item is String or item.length() > 2048: return false
	return true

static func validate(data: Dictionary) -> bool:
	if data.get("version") != VERSION: last_error = "Unsupported save schema"; return false
	if not number(data.get("level"),0,4) or not data.get("campaign") is bool: last_error = "Invalid campaign or level"; return false
	for key in ["flags","defeated","world","stats"]:
		if not data.get(key) is Dictionary: last_error = "Missing save sections"; return false
	for key in ["power_restored","door_open","completed"]:
		if not data.get(key) is bool: last_error = "Invalid progress flags"; return false
	if not data.get("objective") is String: last_error = "Invalid objective"; return false
	for key in data.flags:
		if typeof(key) not in [TYPE_STRING, TYPE_STRING_NAME] or not data.flags[key] is bool: last_error = "Invalid world flags"; return false
	for key in data.defeated:
		if typeof(key) not in [TYPE_STRING, TYPE_STRING_NAME] or not data.defeated[key] is bool: last_error = "Invalid defeated enemy IDs"; return false
	for key in ["time","deaths","kills","shots","hits","damage","pickups"]:
		if not number(data.stats.get(key),0,100000000): last_error = "Invalid run statistics"; return false
	var p = data.get("player")
	if not p is Dictionary or not point(p.get("position")) or not number(p.get("health"),1,100): last_error = "Invalid player health or position"; return false
	if not Weapons.ORDER.has(p.get("weapon")): last_error = "Unknown weapon"; return false
	for key in ["inventory","keycards","unlocked"]:
		if not string_array(p.get(key)): last_error = "Invalid inventory"; return false
	if not p.unlocked.has(p.weapon): last_error = "Active weapon is not unlocked"; return false
	for id in p.unlocked:
		if not Weapons.ORDER.has(id): last_error = "Unknown unlocked weapon"; return false
	if not number(p.get("credits"),0,10000000) or not number(p.get("yaw"),-100000,100000) or not number(p.get("pitch"),-1.3,1.3): last_error = "Invalid player orientation or credits"; return false
	for key in ["magazines","reserves"]:
		if not p.get(key) is Dictionary: last_error = "Missing ammunition data"; return false
		for id in Weapons.ORDER:
			if not number(p[key].get(id),0,int(Weapons.DATA[id].capacity) if key == "magazines" else 999): last_error = "Invalid ammunition count"; return false
	for id in data.world:
		var record = data.world[id]
		if not id is String or not record is Dictionary: last_error = "Invalid world record"; return false
		match record.get("kind"):
			"enemy":
				if not point(record.get("position")) or not number(record.get("hp"),0,10000) or not record.get("dead") is bool: last_error = "Invalid enemy state"; return false
			"pickup":
				if not record.get("collected") is bool: last_error = "Invalid pickup state"; return false
			"encounter":
				if not record.get("fired") is bool or not record.get("cleared") is bool or not string_array(record.get("spawned")): return false
			_:
				return false
	return true

static func migrate(data: Dictionary) -> Dictionary:
	if data.get("version") != 1: return data
	# Explicit native slice migration. Original file is preserved on disk until next successful save.
	var old = data.get("player")
	if not old is Dictionary or not point(old.get("position")) or not number(old.get("health"),1,100):
		last_error = "Legacy save has invalid player data. Original retained."
		return {}
	var p := {"position":old.position,"health":old.health,"weapon":"shotgun","magazines":Weapons.magazines(),"reserves":Weapons.reserves(),"inventory":[],"keycards":[],"credits":0,"unlocked":Weapons.ORDER.duplicate(),"yaw":old.get("yaw",0.0),"pitch":old.get("pitch",0.0)}
	p.magazines.shotgun = old.get("ammo",6)
	p.reserves.shotgun = old.get("reserve_ammo",24)
	return {"version":VERSION,"level":0,"campaign":false,"flags":{},"defeated":{},"world":{},"stats":{"time":0,"deaths":0,"kills":0,"shots":0,"hits":0,"damage":0,"pickups":0},"player":p,"power_restored":data.get("power_restored",false),"door_open":data.get("door_open",false),"completed":data.get("completed",false),"objective":data.get("objective","")}

static func write_save(data: Dictionary, path := SAVE_PATH) -> bool:
	last_error = ""
	if not validate(data):
		last_error = "Save validation failed; previous slot retained."
		return false
	var file := FileAccess.open(path + ".tmp",FileAccess.WRITE)
	if not file:
		last_error = "Cannot write temporary save."
		return false
	file.store_string(JSON.stringify(data,"\t",true,true))
	file.flush()
	file.close()
	# Preserve old bytes, including legacy/unknown versions, before replacement.
	if FileAccess.file_exists(path):
		var result := DirAccess.copy_absolute(ProjectSettings.globalize_path(path),ProjectSettings.globalize_path(path+".bak"))
		if result != OK:
			last_error = "Cannot preserve save backup."
			return false
	if DirAccess.rename_absolute(ProjectSettings.globalize_path(path+".tmp"),ProjectSettings.globalize_path(path)) != OK:
		last_error = "Cannot commit save. Previous slot retained."
		return false
	return true

static func read_save(path := SAVE_PATH) -> Dictionary:
	last_error = ""
	if not FileAccess.file_exists(path): return {}
	var file := FileAccess.open(path,FileAccess.READ)
	if not file or file.get_length() > 4000000:
		last_error = "Save unreadable or too large."
		return {}
	var parsed = JSON.parse_string(file.get_as_text())
	if not parsed is Dictionary:
		last_error = "Malformed save; file retained."
		return {}
	var data := migrate(parsed)
	if not validate(data):
		last_error = "Invalid or unsupported save schema; file retained."
		return {}
	return data

static func clear_save() -> void:
	if FileAccess.file_exists(SAVE_PATH): DirAccess.remove_absolute(ProjectSettings.globalize_path(SAVE_PATH))
