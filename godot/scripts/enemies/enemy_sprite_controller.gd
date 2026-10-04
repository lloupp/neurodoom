class_name EnemySpriteController
extends Sprite3D

const Cache = preload("res://scripts/systems/sprite_cache.gd")
const STATES := ["idle", "walk", "attack", "hit", "death"]
# The baseline has one pose per direction/state, NOT eight temporal frames.
# Optional numbered sheets add temporal frames without changing that contract.
var fps := {"idle":4.0, "walk":8.0, "attack":8.0, "hit":10.0, "death":6.0}
var frame_counts := {"idle":1, "walk":1, "attack":1, "hit":1, "death":1}
var sheets: Dictionary = {}
var kind := "heavy"
var state := "idle"
var elapsed := 0.0
var facing := Vector3.FORWARD
var base_y := 1.0
var flash := 0.0
var transient := 0.0
var opacity := 1.0
var death_finished := false

func configure(enemy_kind: String, scale_factor := 1.0) -> void:
	kind = enemy_kind
	pixel_size = 0.006 * scale_factor
	base_y = 0.96 * scale_factor
	position.y = base_y
	billboard = BaseMaterial3D.BILLBOARD_ENABLED
	alpha_cut = SpriteBase3D.ALPHA_CUT_DISABLED
	transparent = true
	shaded = true
	var baseline := "res://art/runtime/enemies/%s_sheet.svg" % kind
	for animation in STATES:
		sheets[animation] = [baseline]
		# Optional temporal sheets each retain 8 columns x 5 rows.
		var i := 1
		while ResourceLoader.exists("res://art/runtime/enemies/%s_sheet_%03d.png" % [kind, i]):
			sheets[animation].append("res://art/runtime/enemies/%s_sheet_%03d.png" % [kind, i])
			i += 1
		frame_counts[animation] = sheets[animation].size()
		for path in sheets[animation]:
			for angle in 8:
				Cache.region(path, Vector2i(angle, STATES.find(animation)), Vector2i(256, 320))
	texture = Cache.region(baseline, Vector2i.ZERO, Vector2i(256, 320))

static func direction_index(forward: Vector3, to_viewer: Vector3) -> int:
	var angle := atan2(forward.cross(to_viewer).y, forward.dot(to_viewer))
	return posmod(roundi(angle / (TAU / 8.0)), 8)

func set_state(next: String) -> void:
	if state == "death" or (transient > 0.0 and next not in ["hit", "death"]):
		return
	if next != state:
		state = next
		elapsed = 0.0
	if next == "hit":
		transient = 0.18
		flash = 0.1
	elif next == "death":
		transient = 0.0

func _process(delta: float) -> void:
	elapsed += delta
	transient = maxf(0.0, transient - delta)
	flash = maxf(0.0, flash - delta)
	var viewer := get_viewport().get_camera_3d()
	var direction := 0
	if viewer:
		var offset := viewer.global_position - global_position
		offset.y = 0
		direction = direction_index(facing.normalized(), offset.normalized())
	var frame := mini(int(elapsed * fps[state]), int(frame_counts[state]) - 1) if state in ["hit", "death"] else int(elapsed * fps[state]) % int(frame_counts[state])
	texture = Cache.region(sheets[state][frame], Vector2i(direction, STATES.find(state)), Vector2i(256, 320))
	# Small temporal motion for the single-pose baseline, explicitly not painted frames.
	position.y = base_y + (sin(elapsed * 10.0) * 0.025 if state == "walk" else 0.0)
	modulate = Color(1.8, 0.65, 0.65, opacity) if flash > 0 else Color(1, 1, 1, opacity)
	if state == "death":
		position.y = lerpf(base_y, base_y * 0.4, minf(elapsed / 0.6, 1.0))
		death_finished = elapsed >= maxf(0.7, float(frame_counts[state]) / fps[state])
