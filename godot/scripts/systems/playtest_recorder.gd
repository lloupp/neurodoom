extends Node

var started_at_ms := 0
var events: Array[Dictionary] = []

func _ready() -> void:
	started_at_ms = Time.get_ticks_msec()
	EventBus.playtest_event.connect(_on_event)
	EventBus.game_completed.connect(_flush)

func _on_event(kind: String, payload: Dictionary) -> void:
	events.append({
		"t_ms": Time.get_ticks_msec() - started_at_ms,
		"kind": kind,
		"payload": payload
	})

func _flush() -> void:
	var stamp := Time.get_datetime_string_from_system().replace(":", "-")
	var path := "user://playtest_%s.json" % stamp
	var file := FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		return
	file.store_string(JSON.stringify({
		"duration_ms": Time.get_ticks_msec() - started_at_ms,
		"events": events
	}, "\t"))
	print("NEURODOOM playtest log: ", path)
