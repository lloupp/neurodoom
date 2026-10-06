class_name NeuroImpact
extends RefCounted

# fx.svg is 1024x256 with five effects at irregular centers; regions are explicit, not a grid.
const FX_PATH := "res://art/runtime/fx.svg"
const REGIONS := {
	"spark": Rect2(0, 48, 160, 160),
	"bolt": Rect2(180, 96, 190, 64),
	"toxic": Rect2(400, 58, 140, 140),
	"energy": Rect2(570, 40, 220, 176),
	"explosion": Rect2(815, 48, 160, 160),
}
static var textures: Dictionary = {}

static func texture(kind: String) -> AtlasTexture:
	if not textures.has(kind):
		var atlas := AtlasTexture.new()
		atlas.atlas = load(FX_PATH)
		atlas.region = REGIONS[kind]
		atlas.filter_clip = true
		textures[kind] = atlas
	return textures[kind]

static func spawn(parent: Node, point: Vector3, kind := "spark") -> void:
	var explosion := kind == "explosion"
	var visual := Sprite3D.new()
	visual.texture = texture(kind)
	visual.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	visual.shaded = false
	visual.transparent = true
	visual.no_depth_test = false
	visual.pixel_size = 0.016 if explosion else 0.004
	parent.add_child(visual)
	visual.global_position = point
	var duration := 0.45 if explosion else 0.16
	var tween := visual.create_tween().set_parallel()
	tween.tween_property(visual, "scale", Vector3.ONE * (1.8 if explosion else 1.4), duration)
	tween.tween_property(visual, "modulate:a", 0.0, duration)
	if explosion:
		# Short unshadowed flash; no shadow cost.
		var light := OmniLight3D.new()
		light.light_color = Color("#ff9f2f")
		light.light_energy = 4.0
		light.omni_range = 6.0
		visual.add_child(light)
		tween.tween_property(light, "light_energy", 0.0, duration)
	tween.chain().tween_callback(visual.queue_free)

# Scorch decals reuse the spark art, darkened. Image texture (not AtlasTexture) because
# decals are packed into the renderer's own atlas. Fixed pool: oldest mark is recycled.
const MAX_SCORCH := 32
static var scorch_texture: ImageTexture
static var scorches: Array[Decal] = []

static func scorch(parent: Node, point: Vector3, normal: Vector3, size := 0.35) -> Decal:
	if scorch_texture == null:
		scorch_texture = ImageTexture.create_from_image(load(FX_PATH).get_image().get_region(Rect2i(REGIONS.spark)))
	scorches = scorches.filter(func(d): return is_instance_valid(d))
	var decal: Decal
	if scorches.size() >= MAX_SCORCH:
		decal = scorches.pop_front()
		decal.reparent(parent, false)
	else:
		decal = Decal.new()
		decal.texture_albedo = scorch_texture
		decal.modulate = Color(0.08, 0.07, 0.07, 0.85)
		decal.cull_mask = 1
		parent.add_child(decal)
	scorches.append(decal)
	decal.size = Vector3(size, 0.2, size)
	# Decal projects along local -Y: point Y away from the surface.
	var up := normal.normalized()
	var side := up.cross(Vector3.FORWARD if absf(up.dot(Vector3.FORWARD)) < 0.9 else Vector3.RIGHT).normalized()
	decal.global_transform = Transform3D(Basis(side, up, side.cross(up)), point)
	return decal
