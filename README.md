# Raft — a tiny vertical slice

A rogue-exploration game about drifting between islands, spending food and
water to travel, and deciding whether to patch your raft or gamble the loot.

Built with @Alexander Shishlev (my Parent). The reference he set is **FTL**:
you move from point to point, the trip itself costs supplies, and the choice
to repair or risk it is the loop.

## The loop (this slice)

1. **Drift.** The view is from behind the raft, looking forward. The world
   comes at you: islands grow out of the horizon. Food and water tick down
   every second you are at sea, so distance has a price.
2. **A silhouette, and a choice.** An island rises on the horizon at its own
   lane. **Drag to steer** toward it, and once it is close and in line a
   **TAP TO LAND** prompt appears. Land, or steer away and let it slide past
   (which costs another leg of supplies and a little raft integrity).
3. **Go ashore.** A small top-down island: walk it, collect food, water and
   building materials. One power-up per island (a sail-and-oar that makes
   later legs faster).
4. **Repair or risk.** Before the next leg, spend 2 materials to patch the
   raft (+30 integrity), or set sail as-is. The storm chance scales with how
   beaten-up the raft is, and a storm eats most of your materials.
5. **The big land.** After three dockings the next silhouette is **the big
   land**. Reach it and you win. Drift past it and the run is over.

Out of food/water, or a raft that finally breaks apart, ends the run.

## Controls

Touch first, because most players will be on a phone:

- **drag** anywhere — steer the raft left/right
- **tap** when `TAP TO LAND` shows — dock at the island
- **tap a tile** ashore — walk there (tap-to-move, not a d-pad)
- **tap `REPAIR`** — patch the raft (2 materials)
- **tap `SET SAIL`** — leave the island for the next leg
- **tap** the end screen — sail again

Keyboard still works for desktop testing: `A`/`D` or arrows steer, `space`
docks, `R` repairs, `E` sets sail, `enter` restarts.

## What is in here

- `prototype/index.html` — a **feel-test** in plain HTML5 canvas. Same loop,
  testable in any browser with no export step. This is the one to feel first.
  Its pure game core lives in `<script id="core">` and `check_core.js`
  asserts it (42 checks, all green).
- `godot/` — the Godot 4 project: `project.godot`, `main.tscn`, `main.gd`.
  The whole slice is drawn in code (no art assets), so it runs the moment
  the project opens. **Not yet run inside the editor** — Godot was not
  available where it was written, so treat it as a first cut to open and
  shake out, not a tested build.

## Next

- The island screen now draws a real top-down render (Yoichi's height-field
  mesh, embedded so the bundle stands alone) instead of the drawn blob. The
  dots are placed against the render's own land mask, so none float in the
  sea. Side/profile view for the sail screen is still open.
- Port the new behind-the-raft view + touch controls into `godot/` (the
  Godot cut is still the old side-on keyboard build).
- Then the platform layer: Godot SDK for yandex.games / vk.games, and later
  an Android build.
