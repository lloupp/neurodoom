@tool
extends RefCounted

const DIRECTIONS := [
	"front_left",
	"back_left",
	"back_right",
	"front_right",
	"front",
	"left",
	"back",
	"right"
]

static func build_manifest(source_dir: String, output_path: String) -> String:
	var files: Array[String] = []
	_collect(source_dir, files)
	files.sort()
	var animations: Dictionary = {}

	for path in files:
		var ext := path.get_extension().to_lower()
		if ext not in ["png", "webp", "svg"]:
			continue
		var stem := path.get_file().get_basename()
		var parsed := _parse_stem(stem)
		if parsed.is_empty():
			continue
		var key := str(parsed["animation"]) + "/" + str(parsed["direction"])
		if not animations.has(key):
			animations[key] = []
		animations[key].append({
			"frame": parsed["frame"],
			"path": path
		})

	for key in animations:
		animations[key].sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return int(a["frame"]) < int(b["frame"]))

	var manifest := {
		"schema": 1,
		"generated_by": "NEURODOOM Sprite Forge",
		"source": source_dir,
		"animations": animations
	}
	var dir_path := output_path.get_base_dir()
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir_path))
	var file := FileAccess.open(output_path, FileAccess.WRITE)
	if file == null:
		return "FAILED: could not write " + output_path
	file.store_string(JSON.stringify(manifest, "\t"))
	return "OK: %d sprite files -> %s" % [files.size(), output_path]

static func _parse_stem(stem: String) -> Dictionary:
	var frame_separator := stem.rfind("_")
	if frame_separator <= 0:
		return {}
	var frame_token := stem.substr(frame_separator + 1)
	if not frame_token.is_valid_int():
		return {}
	var prefix := stem.substr(0, frame_separator)

	for direction in DIRECTIONS:
		var suffix := "_" + direction
		if prefix.ends_with(suffix):
			var animation := prefix.left(prefix.length() - suffix.length())
			if animation.is_empty():
				return {}
			return {
				"animation": animation,
				"direction": direction,
				"frame": int(frame_token)
			}
	return {}

static func _collect(path: String, out: Array[String]) -> void:
	var dir := DirAccess.open(path)
	if dir == null:
		return
	dir.list_dir_begin()
	var item := dir.get_next()
	while item != "":
		if item.begins_with("."):
			item = dir.get_next()
			continue
		var child := path.path_join(item)
		if dir.current_is_dir():
			_collect(child, out)
		else:
			out.append(child)
		item = dir.get_next()
	dir.list_dir_end()
