// Verify the on-device island generator + mask after the v19 fixes:
//   1) walkable grid excludes snow caps (white peaks are impassable)
//   2) graph nodes never land on a white (snow) pixel
//   3) the net stays connected on the snow-excluded mask
const fs = require('fs');
const html = fs.readFileSync(process.argv[2] || '/workspace/raft_clone/prototype/index.html','utf8');
const core = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const gen  = html.match(/<script id="gensrc">([\s\S]*?)<\/script>/)[1];
const fn = new Function(gen + "\n" + core + `
  return { genIslandRGBA, makeIsleGraph, isleHops, newGame };
`);
const C = fn();
const MODES = ['volcanic','tectonic','continental'];
const W=384,H=278;
function landFnOf(land){
  const GW=land.gw,GH=land.gh,grid=land.grid;
  return (px,py)=>{
    let gx=Math.round(px*(GW-1)), gy=Math.round(py*(GH-1));
    gx=Math.max(0,Math.min(GW-1,gx)); gy=Math.max(0,Math.min(GH-1,gy));
    return grid[gy*GW+gx]===1;
  };
}
function isSnow(o){ // near-white, opaque
  return o[3]>200 && o[0]>195 && o[1]>200 && o[2]>210;
}
const seeds = C.newGame(12345).targets.map(t=>t.seed).concat([1,2,42,99,777,4242]);
let pass=0, fail=0;
const seen = new Set();
for(const seed of seeds){
  if(seen.has(seed)) continue; seen.add(seed);
  const mode = MODES[(seed>>>0)%3];
  const r = C.genIslandRGBA({seed, mode, width:W, height:H});
  const {topdown:top, land} = r;
  const lf = landFnOf(land);
  const GW=land.gw, GH=land.gh;

  // 1) no snow pixel marked walkable
  let snowWalk=0, snowTot=0;
  for(let gy=0; gy<GH; gy++) for(let gx=0; gx<GW; gx++){
    if(land.grid[gy*GW+gx]!==1) continue;
    const px=Math.min(W-1,Math.round(gx*(W-1)/(GW-1)));
    const py=Math.min(H-1,Math.round(gy*(H-1)/(GH-1)));
    const o=(py*W+px)*4;
    if(isSnow([top.data[o],top.data[o+1],top.data[o+2],top.data[o+3]])) snowWalk++;
  }
  // count snow on the island at all, for context
  for(let i=0;i<W*H;i++){ const o=i*4; if(top.data[o+3]>200 && isSnow([top.data[o],top.data[o+1],top.data[o+2],top.data[o+3]])) snowTot++; }

  // 2) graph nodes never on a white pixel
  const gr = C.makeIsleGraph(seed, lf);
  let nodeWhite=0, offLand=0;
  for(const nd of gr.nodes){
    if(!lf(nd.x,nd.y)) offLand++;
    // sample the SAME grid cell the game's landFn uses, so this is the real dot
    let gx=Math.round(nd.x*(GW-1)), gy=Math.round(nd.y*(GH-1));
    gx=Math.max(0,Math.min(GW-1,gx)); gy=Math.max(0,Math.min(GH-1,gy));
    const px=Math.min(W-1,Math.round(gx*(W-1)/(GW-1)));
    const py=Math.min(H-1,Math.round(gy*(H-1)/(GH-1)));
    const o=(py*W+px)*4;
    if(isSnow([top.data[o],top.data[o+1],top.data[o+2],top.data[o+3]])) nodeWhite++;
  }
  // 3) connectivity
  const hops = C.isleHops(gr.adj, 0);
  const unreachable = hops.filter(h=>h<0).length;

  const okAll = snowWalk===0 && nodeWhite===0 && offLand===0 && unreachable===0;
  if(okAll) pass++; else fail++;
  console.log((okAll?'ok  ':'FAIL')+` seed ${seed} (${mode}) nodes=${gr.nodes.length} snowWalk=${snowWalk} nodeWhite=${nodeWhite} offLand=${offLand} unreachable=${unreachable} snowPx=${snowTot}`);
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
