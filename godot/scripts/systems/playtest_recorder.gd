extends Node

var started_at_ms := 0
var events: Array[Dictionary] = []
var objective_started := 0
var objective_times: Array[Dictionary] = []

func _ready() -> void:
	started_at_ms = Time.get_ticks_msec()
	EventBus.playtest_event.connect(_on_event)
	EventBus.game_completed.connect(flush)

func _on_event(kind: String,payload: Dictionary) -> void:
	if kind == "run_started":
		started_at_ms = Time.get_ticks_msec()
		events.clear()
		objective_times.clear()
		objective_started = 0
	if kind == "footstep": return # Sampled gameplay positions below, avoid unbounded footstep logs.
	var time := Time.get_ticks_msec()-started_at_ms
	if kind == "objective_changed":
		objective_times.append({"duration_ms":time-objective_started,"next":payload.get("text","")})
		objective_started = time
	events.append({"t_ms":time,"level":GameState.level,"kind":kind,"payload":payload.duplicate(true)})
	if events.size() >= 10000:
		flush()
		events.clear()

func flush() -> void:
	if events.is_empty(): return
	var stamp := str(Time.get_unix_time_from_system()).replace(".","-")
	var path := "user://playtest_%s.json" % stamp
	var file := FileAccess.open(path,FileAccess.WRITE)
	if not file:
		push_error("Cannot write local playtest telemetry")
		return
	file.store_string(JSON.stringify({"duration_ms":Time.get_ticks_msec()-started_at_ms,"stats":GameState.stats,"accuracy":float(GameState.stats.hits)/maxf(1,GameState.stats.shots),"completed":GameState.completed,"level":GameState.level,"objectives":objective_times,"events":events},"\t"))
	print("NEURODOOM local playtest log: ",path)
