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
	get_tree().current_scene._clear()
	NeuroMenuFactory.controls(get_tree().current_scene,func(): pass)
	await _capture("controls")
	GameState.new_game()
	await _capture("level1")
	GameState.player.unlocked.append("shotgun")
	GameState.player.select_weapon("shotgun")
	await _capture("shotgun")
	GameState.player._fire()
	await _capture("shotgun_recoil")
	var inventory: NeuroInventoryPanel = GameState.player.find_children("*","NeuroInventoryPanel",true,false)[0]
	inventory.open()
	await _capture("inventory")
	inventory.close()
	var hack := NeuroHackPanel.new()
	get_tree().root.add_child(hack)
	await _capture("hacking_intro")
	hack.started = true
	hack._draw_panel()
	await _capture("hacking")
	hack._close(false,true)
	GameState.return_to_menu()
	await _capture("return_menu")
	get_tree().change_scene_to_file("res://scenes/labs/enemy_lab.tscn")
	for i in 10: await get_tree().process_frame
	get_tree().current_scene.sample_art = true
	get_tree().current_scene._reset_enemy()
	await _capture("enemy_art_study")
	print("VISUAL SMOKE COMPLETE (render capture, not human playtest)")
	AudioDirector.shutdown()
	await get_tree().create_timer(0.2).timeout
	get_tree().quit()
