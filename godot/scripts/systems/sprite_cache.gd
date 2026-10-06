class_name NeuroSpriteCache
extends RefCounted

static var regions: Dictionary = {}

static func region(path: String, cell: Vector2i, frame: Vector2i) -> AtlasTexture:
	var key := "%s:%s:%s" % [path, cell, frame]
	if not regions.has(key):
		var texture := AtlasTexture.new()
		texture.atlas = load(path)
		texture.region = Rect2(Vector2(cell * frame), Vector2(frame))
		texture.filter_clip = true
		regions[key] = texture
	return regions[key]
