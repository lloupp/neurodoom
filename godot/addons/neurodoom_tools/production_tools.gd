@tool
extends EditorPlugin

const Validator = preload("res://addons/neurodoom_tools/scripts/asset_validator.gd")
const SpriteForge = preload("res://addons/neurodoom_tools/scripts/sprite_forge.gd")

func _enter_tree() -> void:
	add_tool_menu_item("NEURODOOM: Run Vertical Slice", _run_slice)
	add_tool_menu_item("NEURODOOM: Run Enemy Lab", _run_enemy_lab)
	add_tool_menu_item("NEURODOOM: Run Weapon Lab", _run_weapon_lab)
	add_tool_menu_item("NEURODOOM: Run Material / Lighting Lab", _run_material_lab)
	add_tool_menu_item("NEURODOOM: Validate Production Assets", _validate_assets)
	add_tool_menu_item("NEURODOOM: Build Sprite Manifest", _build_sprite_manifest)

func _exit_tree() -> void:
	remove_tool_menu_item("NEURODOOM: Run Vertical Slice")
	remove_tool_menu_item("NEURODOOM: Run Enemy Lab")
	remove_tool_menu_item("NEURODOOM: Run Weapon Lab")
	remove_tool_menu_item("NEURODOOM: Run Material / Lighting Lab")
	remove_tool_menu_item("NEURODOOM: Validate Production Assets")
	remove_tool_menu_item("NEURODOOM: Build Sprite Manifest")

func _run_slice() -> void:
	get_editor_interface().play_main_scene()

func _run_enemy_lab() -> void:
	get_editor_interface().play_custom_scene("res://scenes/labs/enemy_lab.tscn")

func _run_weapon_lab() -> void:
	get_editor_interface().play_custom_scene("res://scenes/labs/weapon_lab.tscn")

func _run_material_lab() -> void:
	get_editor_interface().play_custom_scene("res://scenes/labs/material_lab.tscn")

func _validate_assets() -> void:
	var report := Validator.validate()
	print("\n=== NEURODOOM ASSET VALIDATION ===")
	for line in report:
		print(line)

func _build_sprite_manifest() -> void:
	var result := SpriteForge.build_manifest("res://art/source", "res://art/generated/sprite_manifest.json")
	print("NEURODOOM Sprite Forge: ", result)
