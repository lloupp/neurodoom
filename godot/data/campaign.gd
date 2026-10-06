class_name NeuroCampaign
extends RefCounted

# Hand-authored compact room graphs. Cells are 2 metres; # is solid, . walkable.
# Shared letters: P entry, T objective terminal, K card, D gate, X exit,
# M medkit, A shells, E cells, R rockets, C credits, L log, B boss.
const LEVELS := [
	{"relay":"breach","reward":"shotgun","theme":"industrial","id":"sublevel_3","title":"01 // MERIDIAN BLACKSITE","color":"#26333e","objective":"Restore power, collect the red card, open A3.","log":"SUBJECT 14 // You woke during the transfer. SHIVA still knows your name.","voice":"SHIVA // The doors were never meant to keep you out.","required_clear":false,"map":[
	"###################",
	"#..C..#.....#.....#",
	"#..K..#..h..D..X..#",
	"#.....#.....#.....#",
	"###.###.....###.###",
	"#.....#.....#.....#",
	"#..T.....d.....A..#",
	"#.....#.....#.....#",
	"###.#####.#####.###",
	"#..M.UQ..P.YQ..L..#",
	"###################"]},
	{"relay":"valve","reward":"pulse_rifle","theme":"organic","id":"sector_9","title":"02 // GARDEN","color":"#283d30","objective":"Find the bio-wing card and close the root isolation valve.","log":"DR. VALE // Where data flows, the mycelium follows. The servers are compost now.","voice":"SHIVA // Every root remembers. Every memory grows.","required_clear":false,"map":[
	"###################",
	"#..E...#....#...X.#",
	"#...w...#..T.D....#",
	"#.......#....#....#",
	"###.#####.#########",
	"#...g.............#",
	"#......###.....s..#",
	"#..L...#K#.....A..#",
	"#......#.#........#",
	"#..P.U.M..Y..C....#",
	"###################"]},
	{"relay":"containment","reward":"rocket_launcher","theme":"spire","id":"the_spire","title":"03 // THE SPIRE","color":"#343040","objective":"Neutralize Atlas containment, acquire access and route the lift.","log":"ENGINEERING // The lifts are jammed. Spitters colonized the shafts. Atlas guards the lower deck.","voice":"SHIVA // You climb. I am already above you.","required_clear":true,"map":[
	"###################",
	"#....#.......#...X#",
	"#..T.D...b...#....#",
	"#....#............#",
	"###.#####.#####.###",
	"#....t..#..s......#",
	"#.......#.........#",
	"#...R.Q.#....E.Q..#",
	"###.#####.#####.###",
	"#..L.U.P...M.Y.K..#",
	"###################"]},
	{"relay":"breach","reward":"","theme":"lab","id":"underground_lab","title":"04 // UNDERGROUND LAB","color":"#392d37","objective":"Recover the core card and authorize the final descent.","log":"VASQUEZ // A neural mapping tool. That was the promise. The guardians are failed military drones.","voice":"SHIVA // Subject fourteen. Come home.","required_clear":false,"map":[
	"###################",
	"#....K..#....#...X#",
	"#....s..#..T.D....#",
	"#.......#....#....#",
	"###.#####.#########",
	"#....h....g.......#",
	"#......###....b...#",
	"#..L.Q.#.#....R.Q.#",
	"#...Z..#.#........#",
	"#..P...M.Y.E.k.A..#",
	"###################"]},
	{"relay":"core","reward":"","theme":"core","id":"shiva_core","title":"05 // SHIVA CORE","color":"#341126","objective":"Confront the Warden. Dodge volleys; retreat from shockwaves.","log":"SUBJECT 14 // The voice is a copy. My memories are mine. Sever the link.","voice":"SHIVA // There is no outside.","required_clear":true,"map":[
	"###################",
	"#........X........#",
	"#........B........#",
	"#..##.........##..#",
	"#.................#",
	"#......#...#......#",
	"#..R...........E..#",
	"#.................#",
	"#..##.........##..#",
	"#..M..Q..P..Q..L..#",
	"###################"]}
]
const ENEMY_SYMBOLS := {"d":"drone","h":"heavy","g":"ghost","t":"turret","s":"spitter","b":"brute","w":"wisp","k":"stalker","B":"boss"}

static func can_exit(index: int, flags: Dictionary, keys: Array, living: Array) -> bool:
	if index == LEVELS.size()-1: return not living.has("boss") and flags.get("warden_defeated",false)
	if not flags.get("power",false) or not keys.has("card_" + str(index)): return false
	if LEVELS[index].required_clear and living.has("brute"): return false
	return true

static func validate_levels(levels: Array = LEVELS) -> Array[String]:
	var issues: Array[String] = []
	var ids: Array[String] = []
	var symbols := "#.PTKDXMAERCLBQd hgt sbwkUYZ".replace(" ","")
	for index in levels.size():
		var level: Dictionary = levels[index]
		if ids.has(str(level.id)): issues.append("Duplicate level id: "+str(level.id))
		ids.append(str(level.id))
		var grid: Array = level.map
		if grid.is_empty(): issues.append("Empty map: "+str(level.id)); continue
		var width := str(grid[0]).length()
		for edge in [str(grid[0]),str(grid[-1])]:
			if edge.replace("#","") != "": issues.append("Open map boundary in "+str(level.id))
		var doors: Array[Vector2i] = []
		var counts := {}
		var points := {}
		for z in grid.size():
			if str(grid[z]).length() != width: issues.append("Unequal row width in "+str(level.id))
			for x in str(grid[z]).length():
				var symbol: String = str(grid[z])[x]
				if symbol == "D": doors.append(Vector2i(x,z))
				if x in [0,str(grid[z]).length()-1] and symbol != "#": issues.append("Open side boundary in "+str(level.id))
				if not symbols.contains(symbol): issues.append("Unknown symbol %s in %s" % [symbol,level.id])
				counts[symbol] = int(counts.get(symbol,0))+1
				if symbol in ["P","K","T","X","U","Y"]: points[symbol] = Vector2i(x,z)
		for required in (["P","X"] if index == levels.size()-1 else ["P","K","T","X"]):
			if counts.get(required,0) != 1: issues.append("Expected one %s in %s" % [required,level.id])
		if counts.get("U",0) > 0 and str(level.get("reward","")) == "": issues.append("Weapon cache has no reward in "+str(level.id))
		if points.has("P"):
			for symbol in points:
				if symbol != "P" and NeuroGridNavigation.path(grid,points.P,points[symbol]).is_empty(): issues.append("Unreachable %s in %s" % [symbol,level.id])
			for symbol in ["K","T"]:
				if points.has(symbol) and NeuroGridNavigation.path(grid,points.P,points[symbol],doors).is_empty(): issues.append("Gate deadlock: %s in %s" % [symbol,level.id])
	return issues

static func map_for(index: int) -> Array:
	var level: Dictionary = LEVELS[index]
	var path := "res://data/maps/%s.tres" % level.id
	if ResourceLoader.exists(path):
		var resource = ResourceLoader.load(path,"",ResourceLoader.CACHE_MODE_IGNORE)
		if resource is NeuroSectorMap and resource.level_id == str(level.id) and not resource.rows.is_empty(): return Array(resource.rows)
	return level.map.duplicate()

static func current_levels() -> Array:
	var levels := LEVELS.duplicate(true)
	for index in levels.size(): levels[index].map = map_for(index)
	return levels
