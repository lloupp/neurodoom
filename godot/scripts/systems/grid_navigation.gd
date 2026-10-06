class_name NeuroGridNavigation
extends RefCounted

# Deterministic four-neighbour paths. Doors are supplied dynamically by the scene.
static func cell(point: Vector3) -> Vector2i:
	return Vector2i(roundi(point.x/2.0),roundi(point.z/2.0))

static func path(grid: Array, start: Vector2i, goal: Vector2i, blocked: Array[Vector2i] = []) -> Array[Vector2i]:
	var result: Array[Vector2i] = []
	if grid.is_empty(): return result
	var queue: Array[Vector2i] = [start]
	var previous := {start:start}
	var cursor := 0
	while cursor < queue.size():
		var at := queue[cursor]
		cursor += 1
		if at == goal: break
		for step in [Vector2i.UP,Vector2i.RIGHT,Vector2i.DOWN,Vector2i.LEFT]:
			var next: Vector2i = at+step
			if next.y < 0 or next.y >= grid.size() or next.x < 0 or next.x >= str(grid[next.y]).length(): continue
			if str(grid[next.y])[next.x] in ["#","Q"] or blocked.has(next) or previous.has(next): continue
			previous[next] = at
			queue.append(next)
	if not previous.has(goal): return result
	var at := goal
	while at != start:
		result.push_front(at)
		at = previous[at]
	return result
