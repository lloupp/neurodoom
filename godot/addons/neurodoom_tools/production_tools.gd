@tool
extends EditorPlugin

const Validator = preload("res://addons/neurodoom_tools/scripts/asset_validator.gd")
const SpriteForge = preload("res://addons/neurodoom_tools/scripts/sprite_forge.gd")

func _enter_tree() -> void:
	add_tool_menu_item("NEURODOOM: Run Vertical Slice", _run_slice)
	add_tool_menu_item("NEURODOOM: Validate Production Assets", _validate_assets)
	add_tool_menu_item("NEURODOOM: Build Sprite Manifest", _build_sprite_manifest)

func _exit_tree() -> void:
	remove_tool_menu_item("NEURODOOM: Run Vertical Slice")
	remove_tool_menu_item("NEURODOOM: Validate Production Assets")
	remove_tool_menu_item("NEURODOOM: Build Sprite Manifest")

func _run_slice() -> void:
	get_editor_interface().play_main_scene()

func _validate_assets() -> void:
	var report := Validator.validate()
	print("\n=== NEURODOOM ASSET VALIDATION ===")
	for line in report:
		print(line)

func _build_sprite_manifest() -> void:
	var result := SpriteForge.build_manifest("res://art/source", "res://art/generated/sprite_manifest.json")
	print("NEURODOOM Sprite Forge: ", result)
