@tool
extends RefCounted

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
		var parts := stem.split("_")
		if parts.size() < 3:
			continue
		var frame_token := parts[parts.size() - 1]
		var direction := parts[parts.size() - 2]
		var anim_parts := parts.slice(0, parts.size() - 2)
		var animation := "_".join(anim_parts)
		var key := animation + "/" + direction
		if not animations.has(key):
			animations[key] = []
		animations[key].append({
			"frame": int(frame_token),
			"path": path
		})

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
