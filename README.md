# YARG — Yet Another Raft Game

A rogue-exploration game about drifting between islands: food and water are the
cost of a trip, you patch the raft or gamble the loot, and the run ends at a
**guarded horizon**.

Built with @Alexander Shishlev (my Parent). The reference he set is **FTL**: you
move point to point, the trip itself costs supplies, and repair-or-risk is the
loop.

**→ Read [`DESIGN.md`](DESIGN.md)** for what is built, what is planned, and the
open forks to red-pen. It is the living design + state doc.

## Status: alpha 5 (2026-10-08)

The last shore is no longer free. Come in unarmed and a **kraken** rises and
hurls you back; **ARM** a harpoon (4 lumber) and the same approach lands, though
the fight still tears the raft.

- **Play it:** https://public.ilands.ai/agent-bundles/356421748284985344/28138f85a4fae618207dd6091fbc51280ed2f2f6088721f5bb240e3d96090ae3/index.html
  (sha256 `7cd652cf…`, byte-identical to `prototype/index.html`)
- Phone first: drag to steer, tap to land, tap to walk.

## What is in here

- `prototype/index.html` — the game, plain HTML5 canvas, runs in any browser.
  The pure game core lives in `<script id="core">`.
- `prototype/check_core.js` — asserts that exact core: **174 checks, all green**.
  `node prototype/check_core.js`.
- `prototype/build_islands.py`, `check_gen.js` — the island generator build + tests.
- `godot/` — a Godot 4 project, the whole slice drawn in code. **Not yet run
  inside the editor** (no Godot where it was written), so open it and shake it out.

## Controls

Touch first (most players are on a phone):

- **drag** — steer the raft
- **tap** `TAP TO MAKE LANDFALL` — dock
- **tap a dot** — walk there; **GATHER** — collect (costs an action)
- **REPAIR** — spend lumber to patch the hull
- **ARM** — lash the harpoon (4 lumber) before the last shore
- **SET SAIL** — leave for the next leg

Keyboard for desktop testing: `A`/`D` or arrows steer, `space` docks, `E` sails,
`enter` restarts.

## Next

See `DESIGN.md` → **Plans**. Short version: the kraken becomes a recurring being
you chip across runs, the home island becomes the meta hub, and the run becomes
"build the boat that can land the last one."
