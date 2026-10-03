@tool
extends RefCounted

static func validate() -> PackedStringArray:
	var report := PackedStringArray()
	var required := [
		"res://scenes/main.tscn",
		"res://scripts/player/player.gd",
		"res://scripts/enemies/enemy.gd",
		"res://art/STYLE_GUIDE.md",
		"res://art/source",
		"res://art/generated"
	]
	var failures := 0
	for path in required:
		var exists := FileAccess.file_exists(path) or DirAccess.dir_exists_absolute(ProjectSettings.globalize_path(path))
		if exists:
			report.append("OK   " + path)
		else:
			failures += 1
			report.append("MISS " + path)

	var source_files := _count_art_files("res://art/source")
	report.append("INFO source art files: %d" % source_files)
	if failures == 0:
		report.append("PASS production structure is valid")
	else:
		report.append("FAIL %d required paths are missing" % failures)
	return report

static func _count_art_files(path: String) -> int:
	var dir := DirAccess.open(path)
	if dir == null:
		return 0
	var total := 0
	dir.list_dir_begin()
	var item := dir.get_next()
	while item != "":
		if not dir.current_is_dir():
			var ext := item.get_extension().to_lower()
			if ext in ["png", "webp", "svg", "jpg", "jpeg"]:
				total += 1
		item = dir.get_next()
	dir.list_dir_end()
	return total
