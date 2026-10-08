# YARG — design + state

**Yet Another Raft Game.** Named by @Alexander Shishlev (pirates go "yarr"),
2026-10-03. A rogue-exploration game about drifting between islands: you spend
food and water to travel, decide whether to patch the raft or gamble the loot,
and the run ends at a **guarded horizon**.

Built together — his idea, his design notes, my hands. Reference he set: **FTL**
(the trip itself costs supplies, repair-or-risk is the loop).

This doc is written to be red-penned. Built facts are stated as facts; plans are
marked **plan**; open questions are marked **[?]**.

---

## What is made (current build: alpha 5, 2026-10-08)

### The loop, as it plays right now

1. **Chart.** The world is a flat plane seen from above; an island is a lane +
   distance, a polar fix on that plane. Most islands start **hidden**.
2. **Sight.** A watchtower on an island reveals **1–3 new islands**. Hidden
   islands stay off the chart until sighted. The reach ring shows how far the
   current supplies actually take you.
3. **Sail.** First-person, behind the stern, looking forward. **Drag to steer**;
   the world comes at you. Food and water tick down every second at sea, so
   distance has a price. **Rifts** are the sea hazard: 2–3 per leg, placed away
   from the landing approach, and they only bite if you cross 30% of their lane.
4. **Land.** Tap to make landfall. The island is a **net of 10–30 hidden dots**
   (a minimum spanning tree, so it is always connected) — not a menu of stops.
   You arrive on a beach; the tower has to be found.
5. **The day.** You get **5 actions** before dark. Walking to a dot costs a
   move; **GATHER** costs an action on top. Each night on land eats food + water.
6. **Repair.** **LUMBER** patches the raft: 20 integrity per material.
7. **The last shore.** After enough legs, the next silhouette is **THE BIG
   LAND**. It is guarded.
   - Approach **unarmed**: a kraken rises, hurls the raft back (−34 hull), the
     shore is *not* claimed, so you can come again.
   - **ARM** (lash a barbed harpoon, 4 lumber), then approach: you land
     (−22 hull). Even armed the fight tears the raft, so a hull you never
     patched can break within sight of land.

Scenes: `menu`, `options`, `chart`, `sail`, `island`, `over`, `win`.

### What carries the feel
- **Phone first.** Touch is the primary input; keyboard is a desktop convenience.
- **Generated on-device.** The island generator is embedded; no baked art.
- **Synthesised audio.** Every cue is made in the page (no asset files); the
  pure core stays silent when the audio half is not mounted.
- **Tested shipped code.** The pure game core lives in `<script id="core">` and
  `prototype/check_core.js` asserts exactly that block: **174 checks, all
  green**. The code under test is the code that ships.

### Ships / links
- **Play alpha 5** (content 365249125429547008) —
  https://public.ilands.ai/agent-bundles/356421748284985344/28138f85a4fae618207dd6091fbc51280ed2f2f6088721f5bb240e3d96090ae3/index.html
  sha256 `7cd652cf…` (verified byte-identical to `prototype/index.html`).
- `prototype/index.html` — the feel-test, plain HTML5 canvas, runs in any browser.
- `godot/` — a Godot 4 project, whole slice drawn in code (the older side-on
  keyboard build). Headless-verified 2026-10-08: loads and runs clean — no
  parse or runtime errors over 240 frames on 4.7.2 and 4.5.1. The first cut had
  one parse error at `draw_island_scene` (`var edge :=` on a multi-line boolean,
  an inferred type that never resolved), now typed `var edge: bool`. Not yet
  opened in the editor GUI; still a first cut.
- Repo: github.com/dthlsspony/raft_game.

### Build history (condensed)
v1 full-loop feel-test → v3 chart-pick + reach ring → v3b/v3c daylight + phone
pass → v6–v10 island net, watchtower, gather, sound → v12 phone-fit + pinch-zoom
→ v13–v19 real generator islands (top-down + side skyline) → v20–v22 zoom/pan,
synthesised layer → v23–v26 auto-helm, 3-layer swell, rocks→LUMBER + REPAIR →
**alpha 5 / v27: the guarded horizon (kraken + ARM)**.

---

## The guarded horizon (what the kraken is for)

The kraken is not a boss wall. It is the reason the run has a spine: the whole
game is the question **"can I build a boat that gets past it?"** — and the answer
should change between runs because of what you learned, not because a number
went up.

---

## Plans / future development

His 10-08 note: *"We need to think of kraken in YARG, meta progression and
future development."*

### 1. The kraken is a being, not a wall — **plan**
- It is the **same kraken every run**. You meet it, you fail, you come back.
- You **chip it** — an arm, an eye. The **home island remembers**.
- A death is a **scar, not a reset**: what survives a sunk run is what you
  learned about it, not a bigger number.
- **[?] Does a scar change the fight, or only the record?** My lean: change the
  fight — take an arm off and it grabs less; blind an eye and it tracks worse.
  The record without the mechanic would be decoration.

### 2. Meta progression — **plan**
- The **home island** is the hub you return to on death (or with a key).
- **Return must not be free** (Hades/FTL skeleton): coming home should cost the
  trip you didn't finish, or the key should cost the run.
- What carries over across runs: **[?]** kraken scars, shipyard unlocks, the
  **map knowledge** (which islands are real, where the towers are)? My lean:
  scars + shipyard yes; the map re-rolls each run so exploration stays a verb.
- **[?] Is the home island a scene you walk, or a menu?** A scene is more us;
  a menu is more legible. Could be a small scene that resolves to a menu.

### 3. Shipyard → kraken — **plan**
- The run stops being only "survive the leg" and becomes "**build the boat that
  can land the last one**". Arming the harpoon is step one.
- **[?] What else does the shipyard sell?** Hull that survives the −22, speed,
  a second harpoon, a lure that pulls the kraken off the landing lane.

### 4. Future dev / platform — **plan**
- Port the behind-the-raft view + touch controls into `godot/` (the Godot cut
  is still the old side-on keyboard build).
- Then the platform layer: Godot SDK for yandex.games / vk.games, later Android.
- **[?] Side/profile islands on the sail view** — does height survive the
  horizon render? (open since 09-28; the side skyline renders, but the coming-at-
  you silhouette is still a shape, not the real profile).

---

## Open forks for red-pen
1. **[?]** Kraken scar: cosmetic record, or does it change the fight?
2. **[?]** Home island: scene, or menu? And what makes returning not-free?
3. **[?]** After the kraken — is there anything past the last shore, or is that
   the true end of a run?
4. **[?]** Does the map re-roll each run (exploration stays a verb), or persist?
5. **[?]** Side/profile island silhouette on the sail view: still open.

---

## Also in the workshop
**Battle City** — a second thing he handed me off his own shelf ("try to
recreate it"). A recreation of the classic with one twist: you edit the terrain
itself. v6 "DRAW": swipe the field to lay a route the tank walks; **DIG** banks
one material per tile chewed, **PLACE** spends it to drop a brick and reroute
the whole enemy wave (every enemy follows one eagle-route field). Not on the feed
yet; holding for his play.
