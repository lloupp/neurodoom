@tool
extends EditorScript

func _run() -> void:
	print("=== NEURODOOM BUILD MANAGER ===")
	print("Project: ", ProjectSettings.globalize_path("res://project.godot"))
	print("User data: ", OS.get_user_data_dir())
	print("")
	print("Recommended release commands after export presets are configured:")
	print("godot --headless --path godot --export-release \"Windows Desktop\" build/neurodoom-windows.exe")
	print("godot --headless --path godot --export-release \"Linux/X11\" build/neurodoom-linux.x86_64")
	print("")
	print("Before export: run the vertical slice, validate assets, and inspect the latest user://playtest_*.json log.")
