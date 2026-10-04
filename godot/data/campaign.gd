class_name NeuroCampaign
extends RefCounted

# Hand-authored compact room graphs. Cells are 2 metres; # is solid, . walkable.
# Shared letters: P entry, T objective terminal, K card, D gate, X exit,
# M medkit, A shells, E cells, R rockets, C credits, L log, B boss.
const LEVELS := [
	{"id":"sublevel_3","title":"01 // MERIDIAN BLACKSITE","color":"#26333e","objective":"Restore power, collect the red card, open A3.","log":"SUBJECT 14 // You woke during the transfer. SHIVA still knows your name.","voice":"SHIVA // The doors were never meant to keep you out.","required_clear":false,"map":[
	"###################",
	"#.....#.....#.....#",
	"#..K..#..h..D..X..#",
	"#.....#.....#.....#",
	"###.###.....###.###",
	"#.....#.....#.....#",
	"#..T.....d.....A..#",
	"#.....#.....#.....#",
	"###.#####.#####.###",
	"#..M..Q..P..Q..L..#",
	"###################"]},
	{"id":"sector_9","title":"02 // GARDEN","color":"#283d30","objective":"Find the bio-wing card and sever the root relay.","log":"DR. VALE // Where data flows, the mycelium follows. The servers are compost now.","voice":"SHIVA // Every root remembers. Every memory grows.","required_clear":false,"map":[
	"###################",
	"#..E...#....#...X.#",
	"#...w...#..T.D....#",
	"#.......#....#....#",
	"###.#####.#########",
	"#...g.............#",
	"#......###.....s..#",
	"#..L...#K#.....A..#",
	"#......#.#........#",
	"#..P...M.....C....#",
	"###################"]},
	{"id":"the_spire","title":"03 // THE SPIRE","color":"#343040","objective":"Clear containment, acquire access and route the lift.","log":"ENGINEERING // The lifts are jammed. Spitters colonized the shafts. Atlas guards the lower deck.","voice":"SHIVA // You climb. I am already above you.","required_clear":true,"map":[
	"###################",
	"#....#.......#...X#",
	"#..T.D...b...#....#",
	"#....#.......#....#",
	"###.#####.#####.###",
	"#....t..#..s......#",
	"#.......#.........#",
	"#...R.Q.#....E.Q..#",
	"###.#####.#####.###",
	"#..L...P...M...K..#",
	"###################"]},
	{"id":"underground_lab","title":"04 // UNDERGROUND LAB","color":"#392d37","objective":"Recover the core card and authorize the final descent.","log":"VASQUEZ // A neural mapping tool. That was the promise. The guardians are failed military drones.","voice":"SHIVA // Subject fourteen. Come home.","required_clear":false,"map":[
	"###################",
	"#....K..#....#...X#",
	"#....s..#..T.D....#",
	"#.......#....#....#",
	"###.#####.#########",
	"#....h....g.......#",
	"#......###....b...#",
	"#..L.Q.#.#....R.Q.#",
	"#......#.#........#",
	"#..P...M...E.k.A..#",
	"###################"]},
	{"id":"shiva_core","title":"05 // SHIVA CORE","color":"#341126","objective":"Confront the Warden. Dodge volleys; retreat from shockwaves.","log":"SUBJECT 14 // The voice is a copy. My memories are mine. Sever the link.","voice":"SHIVA // There is no outside.","required_clear":true,"map":[
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
