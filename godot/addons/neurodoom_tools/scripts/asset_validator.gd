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
	report.append_array(validate_runtime())
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

static func validate_runtime() -> PackedStringArray:
	var report := PackedStringArray()
	var path := "res://art/runtime/runtime_manifest.json"
	var manifest = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not manifest is Dictionary or manifest.get("schema") != 1:
		return PackedStringArray(["FAIL runtime manifest schema"])
	var failures := 0
	for family in ["enemies","weapons"]:
		var size := Vector2(2048,1600) if family == "enemies" else Vector2(3840,460)
		for id in manifest.get(family,[]):
			var sheet := "res://art/runtime/%s/%s_sheet.svg" % [family,id]
			if not ResourceLoader.exists(sheet):
				failures += 1
				report.append("FAIL missing " + sheet)
				continue
			var texture: Texture2D = load(sheet)
			if texture.get_size() != size:
				failures += 1
				report.append("FAIL dimensions " + sheet)
			else: report.append("OK sheet " + id)
	report.append("INFO baseline: one temporal pose per state/direction; authored multi-frame motion and directional silhouette refinement still needed")
	report.append("PASS runtime contract" if failures == 0 else "FAIL %d runtime sheets" % failures)
	return report
