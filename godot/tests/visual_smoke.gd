extends Node

func _ready() -> void:
	call_deferred("_run")

func _capture(name_value: String) -> void:
	for i in 20: await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var directory := OS.get_environment("NEURO_CAPTURE_DIR")
	DirAccess.make_dir_recursive_absolute(directory)
	var picture := get_viewport().get_texture().get_image()
	picture.save_png(directory.path_join(name_value + ".png"))

func _run() -> void:
	get_tree().current_scene = null
	get_tree().change_scene_to_file("res://scenes/menu.tscn")
	await _capture("menu")
	get_tree().current_scene._options()
	await _capture("options")
	GameState.new_game()
	await _capture("level1")
	GameState.player.select_weapon("shotgun")
	await _capture("shotgun")
	GameState.player._fire()
	await _capture("shotgun_recoil")
	GameState.return_to_menu()
	await _capture("return_menu")
	print("VISUAL SMOKE COMPLETE (render capture, not human playtest)")
	AudioDirector.shutdown()
	await get_tree().create_timer(0.2).timeout
	get_tree().quit()
