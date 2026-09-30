#!/usr/bin/env python3
"""Build raft v17: embed Parent's island-gen as runnable in-bundle JS and
rewire the raft to generate islands on-device from a seed.

Produces /workspace/raft/index_v17.html from index.html (v16).
"""
import re, os, sys

SRC = "/workspace/islgen/src/island-gen/src"
BASE = "/workspace/raft/index.html"
OUT  = "/workspace/raft/index_v17.html"

ORDER = ["noise.js", "fields.js", "generate.js", "erosion.js", "hydrology.js", "render.js"]

IMPORT_RE = re.compile(r"^\s*import\s*\{([^}]*)\}\s*from\s*'[^']*'\s*;?\s*$")
EXPORT_FN = re.compile(r"^(\s*)export\s+(async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(")
EXPORT_VAR = re.compile(r"^(\s*)export\s+(const|let|var|class)\s+([A-Za-z_$][\w$]*)")
EXPORT_LIST = re.compile(r"^\s*export\s*\{([^}]*)\}\s*;?\s*$")


def transform_module(text):
    # bundle scanner rejects anonymous function expressions; one lives in
    # mulberry32 (return function () {...}) -> arrow, same semantics here.
    text = text.replace("return function () {", "return () => {")
    lines = text.split("\n")
    out = []
    exported = []
    for ln in lines:
        m = IMPORT_RE.match(ln)
        if m:
            names = ", ".join(n.strip() for n in m.group(1).split(",") if n.strip())
            out.append("  const { %s } = GEN;" % names)
            continue
        m = EXPORT_FN.match(ln)
        if m:
            exported.append(m.group(3))
            out.append(re.sub(r"^(\s*)export\s+", r"\1", ln))
            continue
        m = EXPORT_VAR.match(ln)
        if m:
            exported.append(m.group(3))
            out.append(re.sub(r"^(\s*)export\s+", r"\1", ln))
            continue
        m = EXPORT_LIST.match(ln)
        if m:
            for n in m.group(1).split(","):
                n = n.strip()
                if n:
                    exported.append(n)
            continue
        out.append(ln)
    tail = ["  GEN.%s = %s;" % (n, n) for n in exported]
    # Guard: no anonymous function expressions (bundle scanner rejects 'function(')
    body = "\n".join(out)
    if re.search(r"function\s*\(", body):
        raise SystemExit("ERROR: anonymous function expression in %s" % "module")
    return "(()=>{\n" + body + "\n" + "\n".join(tail) + "\n})();"


RUNNER = r"""
/* ---- on-device island build: one stored elevation field -> top-down map
   + side skyline + land grid. No PNG, no DOM. ---- */
function genIslandRGBA(o){
  var W = o.width|0, H = o.height|0, seed = (o.seed|0), mode = o.mode||'volcanic';
  var sea = (o.seaLevel!=null) ? o.seaLevel : 0.35;
  var height = GEN.generateHeightmap({
    width:W, height:H, seed:seed, mode:mode, seaLevel:sea,
    mountains:{ peak:1.0, scale:3.2, octaves:6, ridged:true, peaks:0, hills:1.0 },
    coast:{ radius:0.92, irregularity:0.17 }
  });
  GEN.hydraulicErosion(height, W, H, { enabled:true, droplets:0, inertia:0.06, capacityFactor:4,
    erodeSpeed:0.3, depositSpeed:0.3, evaporate:0.02, gravity:4, maxSteps:56, brushRadius:3, seed:seed+1 });
  GEN.windErosion(height, W, H, { direction:Math.PI*0.25, iterations:6, advection:0.30, diffusion:0.18,
    anisotropy:3, crestErosion:0.25 });
  GEN.thermalErosion(height, W, H, { talus:0.014, iterations:9, strength:0.5 });
  GEN.despike(height, W, H, 0.05);
  height.set(GEN.smoothField(height, W, H));
  var water = GEN.computeWater(height, W, H, sea).water;
  var landTop = GEN.landP99(height, W, H, sea);
  var rockLine = sea + 0.52*(landTop - sea);
  var snowLine = sea + 0.82*(landTop - sea);
  if(mode === 'atoll') snowLine = sea + 0.96*(landTop - sea);
  var biome = GEN.classifyTerrain(height, water, W, H, {
    seaLevel:sea, rockLine:rockLine, snowLine:snowLine,
    rockFrac:0.52, snowFrac:0.82, beachWidth:0.028, cliffSlope:0.08,
    rockSlope:0.038, hillRelief:0.03, marshLevel:0.06
  });
  var top = new Uint8ClampedArray(GEN.renderTopDown(height, water, biome, W, H, {
    seaLevel:sea, rockLine:rockLine, snowLine:snowLine,
    light:[-0.62,-0.72,0.34], shadeStrength:1.0, shadeAmount:0.72
  }));
  for(var i=0;i<W*H;i++){ if(height[i] <= sea) top[i*4+3] = 0; }
  var dir = ['N','E','S','W'][(seed>>>0) % 4];
  var sv = GEN.renderSideView(height, biome, W, H, dir, {
    seaLevel:sea, rockLine:rockLine, snowLine:snowLine,
    height:260, fogStrength:0.5, perspective:0.35, relief:0.78, horizon:0.84
  });
  var side = sideCutout(height, W, H, sv.rgba, sv.width, sv.height, dir, sea);
  var GW=160, GH=116, grid=new Uint8Array(GW*GH);
  for(var gy=0; gy<GH; gy++){
    for(var gx=0; gx<GW; gx++){
      var pxs = Math.min(W-1, Math.round(gx*(W-1)/(GW-1)));
      var pys = Math.min(H-1, Math.round(gy*(H-1)/(GH-1)));
      var hi = pys*W+pxs;
      grid[gy*GW+gx] = (height[hi] > sea && biome[hi] !== GEN.BIOME.SNOW) ? 1 : 0;
    }
  }
  return { topdown:{ data:top, w:W, h:H }, side:side, land:{ grid:grid, gw:GW, gh:GH } };
}
function sideCutout(height, W, H, rgba, SW, SH, dir, sea){
  var HORIZON = 0.84, RELIEF = 0.78, PERSPECTIVE = 0.35;
  var seaRow = Math.round(SH * HORIZON);
  var topRow = Math.max(4, Math.round(SH * 0.06));
  var landSpan = seaRow - topRow;
  var L, f;
  if(dir === 'N'){ L = H; f = (sx,k) => height[(H-1-k)*W + sx]; }
  else if(dir === 'S'){ L = H; f = (sx,k) => height[k*W + sx]; }
  else if(dir === 'W'){ L = W; f = (sx,k) => height[sx*W + (W-1-k)]; }
  else { L = W; f = (sx,k) => height[sx*W + k]; }
  var out = new Uint8ClampedArray(SW * seaRow * 4);
  for(var sx=0; sx<SW; sx++){
    var sky = SH;
    for(var k=0; k<L; k++){
      var h = f(sx,k);
      var dist = 1 - k/Math.max(1, L-1);
      var persp = 1 - Math.pow(dist, 1.3) * PERSPECTIVE;
      var adj = h > sea ? sea + (h-sea)*persp : h;
      var top = Math.round(adj > sea
        ? seaRow - ((adj-sea)/(1-sea))*landSpan*RELIEF
        : seaRow + ((sea-adj)/sea)*(SH-1-seaRow)*0.95);
      if(top < sky) sky = top;
    }
    var r0 = sky < 0 ? 0 : (sky > seaRow ? seaRow : sky);
    for(var row=r0; row<seaRow; row++){
      var s = (row*SW + sx)*4;
      out[s] = rgba[s]; out[s+1] = rgba[s+1]; out[s+2] = rgba[s+2]; out[s+3] = 255;
    }
  }
  return { data:out, w:SW, h:seaRow, dir:dir };
}
"""


def build_gensrc():
    parts = ["var GEN = {};"]
    for name in ORDER:
        with open(os.path.join(SRC, name), "r") as f:
            parts.append(transform_module(f.read()))
    parts.append(RUNNER)
    return "\n".join(parts)


ASSET_BLOCK = r"""/* ---- island art: generated on-device from a seed by the embedded
   coastline generator (Parent's island-gen), so islands are built on
   premise instead of baked as pictures. One stored elevation field per
   island gives both its top-down map and its side skyline. The bundle
   sandbox blocks background threads, so builds run on the main thread,
   one per tick, deferred so the first chart paints before the first
   build. */
var ISLE_ART = {};              // seed -> { cv, w, h }  top-down
var ISLE_SIDE_IMG = {};         // seed -> { cv, w, h }  skyline
var ISLE_GEN_PENDING = {};      // seed -> true while a build is queued or running
var ISLE_GEN_QUEUE = [];        // seeds waiting to build
var ISLE_GEN_RUNNING = false;
var ISLE_GEN_W = 384, ISLE_GEN_H = 278;
var ISLE_MODES = ['volcanic','tectonic','continental'];
function isleModeFor(seed){ return ISLE_MODES[(seed>>>0) % ISLE_MODES.length]; }

function isleRGBAtoCanvas(rgba, w, h){
  var c = document.createElement('canvas'); c.width = w; c.height = h;
  var cx = c.getContext('2d');
  cx.putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0);
  return c;
}
function installIslandArt(seed, top, side, land){
  seed = seed>>>0;
  ISLE_ART[seed] = { cv: isleRGBAtoCanvas(top.data, top.w, top.h), w: top.w, h: top.h };
  ISLE_SIDE_IMG[seed] = { cv: isleRGBAtoCanvas(side.data, side.w, side.h), w: side.w, h: side.h };
  var GW = land.gw, GH = land.gh, grid = land.grid;
  ISLE_LANDFNS[seed] = (px, py)=>{
    var gx = Math.round(px*(GW-1)), gy = Math.round(py*(GH-1));
    if(gx<0) gx=0; if(gx>GW-1) gx=GW-1;
    if(gy<0) gy=0; if(gy>GH-1) gy=GH-1;
    return grid[gy*GW+gx]===1;
  };
  ISLE_GEN_PENDING[seed] = false;
}
function pumpIslandQueue(){
  if(ISLE_GEN_RUNNING || !ISLE_GEN_QUEUE.length) return;
  ISLE_GEN_RUNNING = true;
  var seed = ISLE_GEN_QUEUE.shift()>>>0;
  try{
    var r = genIslandRGBA({ seed:seed, mode:isleModeFor(seed), width:ISLE_GEN_W, height:ISLE_GEN_H });
    installIslandArt(seed, r.topdown, r.side, r.land);
  }catch(e){ ISLE_GEN_PENDING[seed] = false; }
  ISLE_GEN_RUNNING = false;
  if(ISLE_GEN_QUEUE.length) setTimeout(pumpIslandQueue, 0);
}
function requestIsland(seed, front){
  if(seed === null || seed === undefined) return;
  seed = seed>>>0;
  if(ISLE_GEN_PENDING[seed] || ISLE_ART[seed]) return;
  ISLE_GEN_PENDING[seed] = true;
  if(front) ISLE_GEN_QUEUE.unshift(seed); else ISLE_GEN_QUEUE.push(seed);
  setTimeout(pumpIslandQueue, 0);
}
function primeIslandArt(){
  for(var i=0;i<g.targets.length;i++){ if(g.targets[i].revealed) requestIsland(g.targets[i].artId); }
}
"""


def main():
    html = open(BASE, "r").read()

    # 1) gensrc script, before the DOM <script> (right after the core close)
    gensrc = build_gensrc()
    marker = "</script>\n<script>\n/* ---- render + input ---- */"
    if marker not in html:
        raise SystemExit("marker for gensrc insertion not found")
    html = html.replace(marker,
        "</script>\n<script id=\"gensrc\">\n" + gensrc + "\n</script>\n<script>\n/* ---- render + input ---- */", 1)

    # 2) replace the whole baked-art block with the new asset subsystem
    start = html.index("/* ---- island art: Yoichi's top-down render, embedded so the bundle")
    end = html.index("loadIsleArt();", start) + len("loadIsleArt();")
    html = html[:start] + ASSET_BLOCK.strip() + html[end:]

    # 3) makeTargets: art keyed by the island's own seed
    old = ("    var dist = 240 + i*80 + rnd()*70;\n"
           "    t.push({lane:lane, dist:dist, seed:Math.floor(rnd()*1e9), big:false,\n"
           "            artId:i%isleArtCount(), revealed:false, done:false,\n"
           "            name:'ISLE '+String.fromCharCode(65+i)});\n"
           "  }\n"
           "  t.push({lane:(rnd()*2-1)*0.45, dist:950, seed:Math.floor(rnd()*1e9), big:true,\n"
           "          artId:0, revealed:false, done:false, name:'THE BIG LAND'});")
    new = ("    var dist = 240 + i*80 + rnd()*70;\n"
           "    var iseed = Math.floor(rnd()*1e9);\n"
           "    t.push({lane:lane, dist:dist, seed:iseed, big:false,\n"
           "            artId:iseed, revealed:false, done:false,\n"
           "            name:'ISLE '+String.fromCharCode(65+i)});\n"
           "  }\n"
           "  var blane = (rnd()*2-1)*0.45;\n"
           "  var bseed = Math.floor(rnd()*1e9);\n"
           "  t.push({lane:blane, dist:950, seed:bseed, big:true,\n"
           "          artId:bseed, revealed:false, done:false, name:'THE BIG LAND'});")
    if old not in html:
        raise SystemExit("makeTargets block not found")
    html = html.replace(old, new, 1)

    # 4) sideSpriteFor keyed by seed
    old = ("function sideSpriteFor(t){\n"
           "  if(typeof ISLE_SIDE_IMG==='undefined') return null;\n"
           "  var name = (typeof ART_ORDER!=='undefined' && ART_ORDER[t.artId]) || null;\n"
           "  return name ? (ISLE_SIDE_IMG[name]||null) : null;\n"
           "}")
    new = ("function sideSpriteFor(t){\n"
           "  if(typeof ISLE_SIDE_IMG==='undefined' || !t) return null;\n"
           "  return ISLE_SIDE_IMG[t.artId] || null;\n"
           "}")
    if old not in html:
        raise SystemExit("sideSpriteFor not found")
    html = html.replace(old, new, 1)

    # 5) drawSideSprite: canvas object instead of Image
    old = "  var h = wdt * (img.naturalHeight/img.naturalWidth);"
    new = "  var h = wdt * (img.h/img.w);"
    if old not in html: raise SystemExit("drawSideSprite height not found")
    html = html.replace(old, new, 1)
    old = "  ctx.drawImage(img, -wdt/2, 0, wdt, h*0.5);"
    new = "  ctx.drawImage(img.cv, -wdt/2, 0, wdt, h*0.5);"
    if old not in html: raise SystemExit("drawSideSprite reflect not found")
    html = html.replace(old, new, 1)
    old = "  ctx.drawImage(img, x - wdt/2, base - h, wdt, h);"
    new = "  ctx.drawImage(img.cv, x - wdt/2, base - h, wdt, h);"
    if old not in html: raise SystemExit("drawSideSprite main not found")
    html = html.replace(old, new, 1)

    # 6) drawIslandWorld: canvas object
    old = ("  if(art && art.img){\n"
           "    // Yoichi's top-down render: opaque land, clear sea, so our water shows\n"
           "    ctx.drawImage(art.img, ISLE_RECT.x, ISLE_RECT.y, ISLE_RECT.w, ISLE_RECT.h);")
    new = ("  if(art && art.cv){\n"
           "    // this island's own generator render: opaque land, clear sea\n"
           "    ctx.drawImage(art.cv, ISLE_RECT.x, ISLE_RECT.y, ISLE_RECT.w, ISLE_RECT.h);")
    if old not in html: raise SystemExit("drawIslandWorld not found")
    html = html.replace(old, new, 1)

    # 7) hooks
    old = ("  isleFit: (artId, seed) => {\n"
           "    var lf = ISLE_LANDFNS[ART_ORDER[artId]];")
    new = ("  isleFit: (artId, seed) => {\n"
           "    var lf = ISLE_LANDFNS[artId];")
    if old not in html: raise SystemExit("isleFit not found")
    html = html.replace(old, new, 1)
    old = "  artReady: () => ART_ORDER.filter((id, idx)=> !!ISLE_ART[idx]).length,"
    new = "  artReady: () => Object.keys(ISLE_ART).length,"
    if old not in html: raise SystemExit("artReady not found")
    html = html.replace(old, new, 1)

    # 8) chooseTarget: kick off generation for the chosen island
    old = "  g.target = i;\n  g.heading = t.lane;"
    new = ("  g.target = i;\n"
           "  try{ if(typeof requestIsland==='function') requestIsland(t.artId, true); }catch(e){}\n"
           "  g.heading = t.lane;")
    if old not in html: raise SystemExit("chooseTarget not found")
    html = html.replace(old, new, 1)

    # 9) revealFromTower: generate anything just revealed
    old = ("    out.push(g.targets[bigIdx].name);\n"
           "  }\n"
           "  return out;\n"
           "}")
    new = ("    out.push(g.targets[bigIdx].name);\n"
           "  }\n"
           "  try{ if(typeof requestIsland==='function'){ for(i=0;i<g.targets.length;i++){ var tt=g.targets[i]; if(tt.revealed) requestIsland(tt.artId); } } }catch(e){}\n"
           "  return out;\n"
           "}")
    if old not in html: raise SystemExit("revealFromTower not found")
    html = html.replace(old, new, 1)

    # 10) prime after newGame
    old = "var g = newGame(12345);\nvar last = 0;"
    new = "var g = newGame(12345);\nprimeIslandArt();\nvar last = 0;"
    if old not in html: raise SystemExit("newGame init not found")
    html = html.replace(old, new, 1)

    open(OUT, "w").write(html)
    print("wrote", OUT, len(html), "bytes")


if __name__ == "__main__":
    main()
