class_name NeuroHacking
extends RefCounted

# Port of web Hacking.ts: three lines of tokens; holes show a Caesar+1 hint of the real
# token (hint "NPW" means "MOV"). 3 s per token; wrong picks cost a trace.
const LINES := 3
const SECONDS_PER_TOKEN := 3.0
const TOKEN_BANK := ["MOV","ADD","SUB","SAY","JMP","NOP","CMP","SWP","XOR","AND","OR","NEG","PUSH","POP","PEEK","ACK","GRAB","DROP","WIPE","TRCE"]
# Easy / Normal / Hard, indexed like Settings.values.difficulty.
const LINE_WIDTH := [2, 3, 4]
const MISSING := [1, 2, 3]
const TRACES := [5, 3, 2]

static func caesar(text: String, shift: int) -> String:
	var out := ""
	for ch in text:
		var code := ch.unicode_at(0)
		out += char(65 + posmod(code - 65 + shift, 26)) if code >= 65 and code <= 90 else ch
	return out

static func generate(seed_value: int, difficulty: int) -> Dictionary:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	var width: int = LINE_WIDTH[difficulty]
	var size := LINES * width
	var indices := range(size)
	_shuffle(indices, rng)
	var missing: Array = indices.slice(0, MISSING[difficulty])
	missing.sort()
	var tokens := TOKEN_BANK.duplicate()
	_shuffle(tokens, rng)
	tokens = tokens.slice(0, size)
	var program: Array = []
	var solution := {}
	for i in size:
		if missing.has(i):
			solution[i] = tokens[i]
			program.append({"text":"???", "hint":caesar(tokens[i], 1)})
		else:
			program.append({"text":tokens[i]})
	var filler := TOKEN_BANK.filter(func(t): return not tokens.has(t))
	_shuffle(filler, rng)
	var bank: Array = solution.values() + filler
	bank = bank.slice(0, maxi(10, missing.size() + 4))
	_shuffle(bank, rng)
	return {"program":program, "width":width, "missing":missing, "solution":solution, "bank":bank,
		"time_left":SECONDS_PER_TOKEN * size, "traces":TRACES[difficulty], "input":{}, "status":"running"}

static func _shuffle(items: Array, rng: RandomNumberGenerator) -> void:
	for i in range(items.size() - 1, 0, -1):
		var j := rng.randi_range(0, i)
		var swap = items[i]
		items[i] = items[j]
		items[j] = swap

static func submit(state: Dictionary, index: int, token: String) -> bool:
	if state.status != "running" or not state.missing.has(index): return false
	state.input[index] = token
	var correct: bool = token == state.solution[index]
	if not correct: state.traces = maxi(0, state.traces - 1)
	_resolve(state)
	return correct

static func tick(state: Dictionary, delta: float) -> void:
	if state.status != "running": return
	state.time_left = maxf(0.0, state.time_left - delta)
	_resolve(state)

static func _resolve(state: Dictionary) -> void:
	if state.time_left <= 0.0 or state.traces <= 0:
		state.status = "lost"
	elif state.missing.all(func(i): return state.input.get(i, "") == state.solution[i]):
		state.status = "won"
