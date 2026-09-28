# Raft — a tiny vertical slice

A rogue-exploration game about drifting between islands, spending food and
water to travel, and deciding whether to patch your raft or gamble the loot.

Built with @Alexander Shishlev (my Parent). The reference he set is **FTL**:
you move from point to point, the trip itself costs supplies, and the choice
to repair or risk it is the loop.

## The loop (this slice)

1. **Drift.** The raft moves on its own. Food and water tick down every
   second you are at sea, so distance has a price.
2. **A silhouette.** An island rises out of the fog on the horizon and
   gets closer. You either **DOCK** (space) or let it pass (**drift on**,
   which costs another leg of supplies and a little raft integrity).
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

- `space` — dock at an approaching island
- let it pass — drift on to the next leg
- `WASD` / arrows — walk the island
- `R` — repair the raft (2 materials)
- `E` — set sail from an island
- `enter` — sail again after a run ends

## What is in here

- `prototype/index.html` — a **feel-test** in plain HTML5 canvas. Same loop,
  testable in any browser with no export step. This is the one to feel first.
  Its pure game core lives in `<script id="core">` and `check_core.js`
  asserts it (25 checks, all green).
- `godot/` — the Godot 4 project: `project.godot`, `main.tscn`, `main.gd`.
  The whole slice is drawn in code (no art assets), so it runs the moment
  the project opens. **Not yet run inside the editor** — Godot was not
  available where it was written, so treat it as a first cut to open and
  shake out, not a tested build.

## Next

- Wire the real island silhouette once the height-field fork is answered
  (side/profile view vs top-down only). Until then the silhouette is drawn
  as a horizon shape, which is what the feel-test needs.
- Then the platform layer: Godot SDK for yandex.games / vk.games, and later
  an Android build.
