extends Node2D
# Raft slice — drift / land / gather / repair-or-risk.
# Everything is drawn in code (no art assets), so this runs the moment the
# project opens. Tuning mirrors the HTML feel-prototype in prototype/.
#
# Controls: LEFT/RIGHT or A/D turn the leg toward or past land? No —
#   drift is automatic; your choice is DOCK (space) or let it pass.
#   On land: WASD/arrows walk, collect by stepping on a tile,
#   R = repair raft (2 materials -> +30 integrity), E = set sail.

const W := 640.0
const H := 360.0
const HORIZON := 0.60
const MAX_ISLANDS := 3

var rng := RandomNumberGenerator.new()

var scene := "drift"
var food := 100.0
var water := 100.0
var materials := 0
var integrity := 100.0
var dockings := 0
var passed := 0
var powerups := 0
var speed_bonus := 0.0
var scrollx := 0.0
var drift_time := 0.0
var island_at := 4.0
var island_kind := "small"
var msg := "open water"
var ended := false
var won := false

# drift island: {x: float, kind: String}
var island := {}
var has_island := false

# island scene
var grid := {}          # {w, h, tile, map: Array[Array[int]], spawn: Vector2i}
var player := Vector2.ZERO
var player_t := Vector2.ZERO
var pickups := []       # [{x:int, y:int, k:String, taken:bool}]

func _ready() -> void:
	rng.seed = 20260928

func _unhandled_input(event: InputEvent) -> void:
	if not (event is InputEventKey) or not event.pressed or event.echo:
		return
	var k: int = event.keycode
	if scene == "drift" and k == KEY_SPACE:
		try_dock()
	elif scene == "island":
		if k == KEY_R:
			repair_raft()
		elif k == KEY_E:
			set_sail()
	elif ended and k == KEY_ENTER:
		reset_game()

func reset_game() -> void:
	food = 100.0
	water = 100.0
	materials = 0
	integrity = 100.0
	dockings = 0
	passed = 0
	powerups = 0
	speed_bonus = 0.0
	scrollx = 0.0
	drift_time = 0.0
	island_at = 4.0
	has_island = false
	ended = false
	won = false
	scene = "drift"
	msg = "open water"

# ---------------------------------------------------------------- drift
func next_kind() -> String:
	return "big" if dockings >= MAX_ISLANDS else "small"

func wear_leg(amount: float) -> void:
	integrity = clampf(integrity - amount, 0.0, 100.0)
	if integrity <= 0.0:
		ended = true
		scene = "over"
		msg = "the raft came apart"

func storm_on_depart() -> void:
	var chance := (100.0 - integrity) / 100.0 * 0.55
	if rng.randf() < chance:
		integrity = clampf(integrity - 38.0, 0.0, 100.0)
		var lost: int = int(materials * 0.6)
		materials -= lost
		if integrity <= 0.0:
			ended = true
			scene = "over"
			msg = "storm + a broken raft. lost %d materials, then the sea." % lost
			return
		msg = "storm hit. lost %d materials." % lost

func tick_drift(delta: float) -> void:
	if ended:
		return
	var speed := 90.0 + speed_bonus
	scrollx += speed * delta
	food = maxf(0.0, food - 2.6 * delta)
	water = maxf(0.0, water - 2.0 * delta)
	if food <= 0.0 or water <= 0.0:
		ended = true
		scene = "over"
		msg = "out of supplies on the open sea"
		return
	drift_time += delta
	if not has_island and drift_time >= island_at:
		island = {"x": 760.0, "kind": next_kind()}
		has_island = true
	if has_island:
		island["x"] -= speed * delta
		if island["x"] <= -70.0:
			var kind: String = island["kind"]
			has_island = false
			drift_time = 0.0
			island_at = 3.5 + rng.randf() * 2.5
			food = maxf(0.0, food - 6.0)
			water = maxf(0.0, water - 5.0)
			if kind == "big":
				ended = true
				scene = "over"
				msg = "you drifted straight past the big land"
				return
			passed += 1
			msg = "drifted on, another leg costs supplies"
			wear_leg(6.0)

func try_dock() -> void:
	if not has_island:
		return
	if island["x"] > 230.0:
		msg = "too far to reach the shore yet"
		return
	island_kind = island["kind"]
	build_island(island_kind)
	player = Vector2(grid["spawn"])
	player_t = player
	has_island = false
	drift_time = 0.0
	scene = "island"
	msg = "the big land. gather what you can." if island_kind == "big" else "go ashore"

# ---------------------------------------------------------------- island
func build_island(kind: String) -> void:
	var w := 20
	var h := 11
	var radius := 6.6 if kind == "big" else 4.6
	var a := rng.randf() * 9.0
	var b := rng.randf() * 9.0
	var rows := []
	for y in range(h):
		var row := []
		for x in range(w):
			var dx := x - (w / 2.0 - 0.5)
			var dy := (y - (h / 2.0 - 0.5)) * 1.35
			var d := sqrt(dx * dx + dy * dy)
			var n := sin(x * 0.8 + a) * cos(y * 1.1 + b) * 1.1 + (rng.randf() - 0.5) * 0.8
			row.append(1 if d < radius + n else 0)
		rows.append(row)
	if rows[int(h / 2.0)][int(w / 2.0)] == 0:
		rows[int(h / 2.0)][int(w / 2.0)] = 1
	var spawn := Vector2i(int(w / 2.0), int(h / 2.0))
	for y in range(h - 1, -1, -1):
		if rows[y][int(w / 2.0)] == 1:
			spawn = Vector2i(int(w / 2.0), y)
			break
	grid = {"w": w, "h": h, "tile": 32, "map": rows, "spawn": spawn}
	place_pickups(kind)

func place_pickups(kind: String) -> void:
	pickups = []
	var counts := {"food": 6, "water": 6, "mat": 9, "power": 1}
	if kind != "big":
		counts = {"food": 2, "water": 2, "mat": 3, "power": 1}
	var cells := []
	for y in range(grid["h"]):
		for x in range(grid["w"]):
			if grid["map"][y][x] == 1:
				cells.append(Vector2i(x, y))
	var order := ["food", "water", "mat", "power"]
	for pk in order:
		for i in range(counts[pk]):
			if cells.is_empty():
				break
			var idx := rng.randi_range(0, cells.size() - 1)
			var c: Vector2i = cells.pop_at(idx)
			var k: String = pk
			if pk == "mat":
				k = "wood" if rng.randf() < 0.5 else "rope"
			pickups.append({"x": c.x, "y": c.y, "k": k, "taken": false})

func move_player(delta: float) -> void:
	var sp := 5.2
	var dir := Vector2.ZERO
	if Input.is_key_pressed(KEY_LEFT) or Input.is_key_pressed(KEY_A):
		dir.x -= 1.0
	if Input.is_key_pressed(KEY_RIGHT) or Input.is_key_pressed(KEY_D):
		dir.x += 1.0
	if Input.is_key_pressed(KEY_UP) or Input.is_key_pressed(KEY_W):
		dir.y -= 1.0
	if Input.is_key_pressed(KEY_DOWN) or Input.is_key_pressed(KEY_S):
		dir.y += 1.0
	if dir == Vector2.ZERO:
		return
	var nx := player_t.x + dir.x * sp * delta
	var ny := player_t.y + dir.y * sp * delta
	if nx >= 0.0 and nx < grid["w"]:
		player_t.x = nx
	if ny >= 0.0 and ny < grid["h"]:
		player_t.y = ny
	var cx := int(round(player_t.x))
	var cy := int(round(player_t.y))
	if grid["map"][cy][cx] == 1:
		player = player_t
		gather_at(player)
	else:
		player_t = player

func gather_at(pos: Vector2) -> void:
	var cx := int(round(pos.x))
	var cy := int(round(pos.y))
	for p in pickups:
		if p["taken"] or p["x"] != cx or p["y"] != cy:
			continue
		p["taken"] = true
		match p["k"]:
			"food":
				food = minf(140.0, food + 9.0)
				msg = "+food"
			"water":
				water = minf(140.0, water + 9.0)
				msg = "+water"
			"power":
				powerups += 1
				speed_bonus += 18.0
				msg = "+power: sail and oar, faster legs"
			_:
				materials += 2 if p["k"] == "wood" else 1
				msg = "+materials"

func repair_raft() -> void:
	if materials < 2:
		msg = "not enough materials to repair (need 2)"
		return
	materials -= 2
	integrity = clampf(integrity + 30.0, 0.0, 100.0)
	msg = "patched the raft. integrity %d" % int(integrity)

func set_sail() -> void:
	if island_kind == "big":
		ended = true
		won = true
		scene = "over"
		msg = "you reached the big land"
		return
	dockings += 1
	storm_on_depart()
	if ended:
		return
	scene = "drift"
	drift_time = 0.0
	island_at = 3.5 + rng.randf() * 2.5
	scrollx = 0.0
	wear_leg(4.0)

# ---------------------------------------------------------------- update
func _process(delta: float) -> void:
	delta = minf(delta, 0.05)
	if scene == "drift":
		tick_drift(delta)
	elif scene == "island":
		move_player(delta)
	queue_redraw()

# ---------------------------------------------------------------- draw
func _draw() -> void:
	if scene == "drift":
		draw_drift()
	elif scene == "island":
		draw_island_scene()
	else:
		draw_over()

func rect(x: float, y: float, w: float, h: float, c: Color) -> void:
	draw_rect(Rect2(x, y, w, h), c, true)

func bar(x: float, y: float, w: float, v: float, c: Color, label: String) -> void:
	rect(x - 1, y - 1, w + 2, 8, Color(0.04, 0.06, 0.11))
	rect(x, y, w, 6, Color(0.11, 0.15, 0.25))
	rect(x, y, round(w * clampf(v, 0.0, 1.0)), 6, c)
	draw_string(ThemeDB.fallback_font, Vector2(x, y - 4), label, HORIZONTAL_ALIGNMENT_LEFT, -1, 8, Color(0.62, 0.69, 0.84))

func draw_hud() -> void:
	bar(12, 20, 110, food / 140.0, Color(0.44, 0.81, 0.44), "FOOD %d" % int(food))
	bar(12, 40, 110, water / 140.0, Color(0.37, 0.66, 1.0), "WATER %d" % int(water))
	bar(12, 60, 110, integrity / 100.0, Color(0.88, 0.44, 0.35), "RAFT %d" % int(integrity))
	var head := "MATERIALS %d" % materials
	if powerups > 0:
		head += "   POWER x%d" % powerups
	draw_string(ThemeDB.fallback_font, Vector2(12, 84), head, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color(0.78, 0.8, 0.88))
	draw_string(ThemeDB.fallback_font, Vector2(W - 110, 20), "LEG %d / %d" % [dockings + 1, MAX_ISLANDS + 1], HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color(0.78, 0.8, 0.88))
	draw_string(ThemeDB.fallback_font, Vector2(12, H - 10), msg, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color(0.56, 0.63, 0.78))

func draw_drift() -> void:
	# sky gradient in bands
	var bands := [Color("#0a1024"), Color("#121430"), Color("#241c3c"), Color("#3a2c4a"), Color("#4a3350")]
	for i in range(bands.size()):
		rect(0, H * HORIZON * i / float(bands.size()), W, H * HORIZON / float(bands.size()) + 1, bands[i])
	rect(W * 0.62, H * 0.44, 60, 6, Color("#7a4a6a"))
	# sea
	var hor := H * HORIZON
	var sea_bands := [Color("#0c1730"), Color("#102242"), Color("#0d1c38"), Color("#12284a"), Color("#0a1528")]
	for i in range(9):
		var y := hor + i * ((H - hor) / 9.0)
		rect(0, y, W, (H - hor) / 9.0, sea_bands[i % sea_bands.size()])
		var off := fmod(scrollx * 0.5 + i * 13.0, 80.0)
		var x := -80.0
		while x < W + 80.0:
			rect(x - off + (i % 2) * 30, y + 3, 14, 2, Color("#1d3a63"))
			x += 80.0
	# fog band
	rect(0, hor - 18, W, 40, Color(0.59, 0.67, 0.82, 0.16))
	var i2 := 0
	while i2 < 5:
		var fx := W - fmod(scrollx * 0.15 + i2 * 180.0, W + 300.0)
		rect(fx, hor - 16 + (i2 % 2) * 10, 220, 26, Color(0.75, 0.8, 0.92, 0.05 + (i2 % 3) * 0.02))
		i2 += 1
	# island silhouette
	if has_island:
		draw_silhouette(hor)
	draw_raft(hor)
	if not has_island:
		rect(W - 92, hor + 18, 60, 12, Color(0.86, 0.9, 0.96, 0.5 + 0.4 * sin(drift_time * 3.0)))
	draw_hud()

func draw_silhouette(hor: float) -> void:
	var x: float = island["x"]
	var t: float = clampf(1.0 - (x - 90.0) / (W - 90.0), 0.15, 1.0)
	var big: bool = island["kind"] == "big"
	var w: float = (300.0 if big else 190.0) * (0.35 + 0.65 * t)
	var h: float = (90.0 if big else 54.0) * (0.35 + 0.65 * t)
	var col := Color("#05070f")
	var pts := PackedVector2Array([
		Vector2(x - w / 2.0, hor + 6),
		Vector2(x - w * 0.30, hor + 6 - h * 0.55),
		Vector2(x - w * 0.12, hor + 6 - h),
		Vector2(x + w * 0.06, hor + 6 - h * 0.6),
		Vector2(x + w * 0.26, hor + 6 - h * 0.82),
		Vector2(x + w / 2.0, hor + 6),
	])
	draw_colored_polygon(pts, col)
	rect(x - w / 2.0, hor + 4, w, 5, col)
	if big:
		rect(x + w * 0.28, hor + 6 - h * 0.95, 4, 16, Color("#d8b96a"))
		rect(x + w * 0.27 - 1, hor + 6 - h * 0.95 - 3, 7, 3, Color("#ffe9a8"))

func draw_raft(hor: float) -> void:
	var bob := sin(scrollx * 0.05) * 2.0
	var rx := 84.0
	var ry := hor + 44.0 + bob
	rect(rx, ry, 46, 4, Color("#6b4a2a"))
	rect(rx + 2, ry + 4, 42, 3, Color("#4f371f"))
	rect(rx + 6, ry - 2, 4, 2, Color("#8a6238"))
	rect(rx + 22, ry - 30, 3, 30, Color("#3a2a18"))
	draw_colored_polygon(PackedVector2Array([
		Vector2(rx + 25, ry - 30), Vector2(rx + 25, ry - 6), Vector2(rx + 41, ry - 10)
	]), Color("#c9b48a"))
	rect(rx + 16, ry - 12, 6, 8, Color("#d7d9e6"))
	rect(rx + 17, ry - 15, 4, 4, Color("#2a2a38"))

func tile_color(t: int, x: int, y: int) -> Color:
	if t == 0:
		var a := (x * 7 + y * 13) % 3
		if a == 0:
			return Color("#10314f")
		elif a == 1:
			return Color("#123a5a")
		return Color("#0f2c48")
	return Color("#2c6238") if (x + y) % 2 == 0 else Color("#316a3c")

func draw_island_scene() -> void:
	rect(0, 0, W, H, Color("#0a1526"))
	var ts: int = grid["tile"]
	for y in range(grid["h"]):
		for x in range(grid["w"]):
			if grid["map"][y][x] == 1:
				rect(x * ts, y * ts, ts, ts, tile_color(1, x, y))
				var edge := (x > 0 and grid["map"][y][x - 1] == 0) \
					or (x < grid["w"] - 1 and grid["map"][y][x + 1] == 0) \
					or (y > 0 and grid["map"][y - 1][x] == 0) \
					or (y < grid["h"] - 1 and grid["map"][y + 1][x] == 0)
				if edge:
					rect(x * ts, y * ts, ts, 4, Color("#c2a86b"))
			else:
				rect(x * ts, y * ts, ts, ts, tile_color(0, x, y))
	for p in pickups:
		if p["taken"]:
			continue
		var cxp: float = p["x"] * ts
		var cyp: float = p["y"] * ts
		match p["k"]:
			"food":
				rect(cxp + 11, cyp + 12, 10, 9, Color("#6fcf6f"))
				rect(cxp + 14, cyp + 8, 4, 4, Color("#3f8f3f"))
			"water":
				rect(cxp + 11, cyp + 11, 10, 11, Color("#5fa8ff"))
				rect(cxp + 13, cyp + 9, 6, 3, Color("#a9d4ff"))
			"power":
				rect(cxp + 13, cyp + 9, 6, 14, Color("#ffd34d"))
				rect(cxp + 9, cyp + 13, 14, 6, Color("#ffd34d"))
			_:
				rect(cxp + 10, cyp + 13, 12, 7, Color("#b07a3a") if p["k"] == "wood" else Color("#8a7a5a"))
	var pxp: float = player.x * ts
	var pyp: float = player.y * ts
	rect(pxp + 11, pyp + 8, 10, 14, Color("#e8e8f0"))
	rect(pxp + 12, pyp + 4, 8, 6, Color("#2a2a38"))
	if island_kind == "big":
		draw_string(ThemeDB.fallback_font, Vector2(W - 108, 54), "THE BIG LAND", HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color("#ffe9a8"))
	draw_hud()

func draw_over() -> void:
	rect(0, 0, W, H, Color("#05070d"))
	draw_string(ThemeDB.fallback_font, Vector2(190, 140), "YOU MADE LAND" if won else "THE SEA WON", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color("#8fe38f") if won else Color("#e0705a"))
	draw_string(ThemeDB.fallback_font, Vector2(120, 168), msg, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color("#c8cbe0"))
	draw_string(ThemeDB.fallback_font, Vector2(110, 190), "islands docked: %d   passed: %d   materials left: %d" % [dockings, passed, materials], HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color("#c8cbe0"))
	draw_string(ThemeDB.fallback_font, Vector2(210, 220), "press ENTER to sail again", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color("#8fa0c8"))
