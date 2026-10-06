extends Node

var session_id := ""
var chunk := 0
var sample_time := 0.0
var frame_samples: Array[float] = []
var started_at_ms := 0
var events: Array[Dictionary] = []
var objective_started := 0
var objective_times: Array[Dictionary] = []

func _ready() -> void:
	session_id = str(Time.get_unix_time_from_system()).replace(".","-")
	started_at_ms = Time.get_ticks_msec()
	EventBus.playtest_event.connect(_on_event)
	EventBus.game_completed.connect(flush)

func _on_event(kind: String,payload: Dictionary) -> void:
	if kind in ["run_started","run_loaded"]:
		flush()
		session_id = str(Time.get_unix_time_from_system()).replace(".","-")
		chunk = 0
		frame_samples.clear()
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
	var path := "user://playtest_%s_%03d_%s.json" % [session_id,chunk,stamp]
	var file := FileAccess.open(path,FileAccess.WRITE)
	if not file:
		push_error("Cannot write local playtest telemetry")
		return
	file.store_string(JSON.stringify({"duration_ms":Time.get_ticks_msec()-started_at_ms,"stats":GameState.stats,"accuracy":float(GameState.stats.hits)/maxf(1,GameState.stats.shots),"completed":GameState.completed,"level":GameState.level,"objectives":objective_times,"session":session_id,"chunk":chunk,"headless":DisplayServer.get_name() == "headless","performance":performance_summary(),"events":events},"\t"))
	print("NEURODOOM local playtest log: ",path)
	chunk += 1
	events.clear()

func _process(delta: float) -> void:
	if not is_instance_valid(GameState.player) or get_tree().paused or GameState.completed: return
	if DisplayServer.get_name() != "headless":
		frame_samples.append(delta*1000.0)
		if frame_samples.size() > 3600: frame_samples.pop_front()
	sample_time += delta
	if sample_time >= 1.0:
		sample_time = 0.0
		var player = GameState.player
		_on_event("position_sample",{"x":player.position.x,"z":player.position.z,"hp":player.health})

func performance_summary() -> Dictionary:
	if frame_samples.is_empty(): return {"available":false,"reason":"No graphical frame samples"}
	var sorted := frame_samples.duplicate()
	sorted.sort()
	var total := 0.0
	for sample in sorted: total += sample
	return {"available":true,"samples":sorted.size(),"mean_ms":total/sorted.size(),"p95_ms":sorted[mini(sorted.size()-1,int(sorted.size()*0.95))],"renderer":ProjectSettings.get_setting("rendering/renderer/rendering_method"),"resolution":[get_viewport().get_visible_rect().size.x,get_viewport().get_visible_rect().size.y]}

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST: flush()
