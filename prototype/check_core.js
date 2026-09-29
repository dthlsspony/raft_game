const fs = require('fs');
const html = fs.readFileSync(process.argv[2] || '/workspace/raft/index.html','utf8');
const m = html.match(/<script id="core">([\s\S]*?)<\/script>/);
if(!m){ console.error('no core block'); process.exit(2); }
const core = m[1];

const fn = new Function(core + `
  return {newGame, reachOf, chooseTarget, tickSail, tickChart, leaveIsland, backToChart,
          clamp, DMAX, BASE_SPEED, planRifts, canLand, doLandfall, makeIsle,
          moveTo, runNode, endDay, revealFromTower, ensureDestinations,
          makeIsleGraph, isleHops, bearingWord,
          gatherHere, setSail,
          ACTIONS_PER_DAY, DAY_FOOD, DAY_WATER,
          LAND_RANGE, RIFT_KEEPOUT, RIFT_HIT};
`);
const C = fn();

let pass=0, fail=0;
function ok(name, cond, extra){ if(cond){pass++; console.log('ok  '+name);} else {fail++; console.log('FAIL '+name+(extra?'  '+extra:''));} }

/* 1 reach */
let g = C.newGame(1);
ok('reach ~962 at full supplies', Math.abs(C.reachOf(g)-25*100/2.6) < 1, C.reachOf(g));

/* 2 choose target */
g = C.newGame(1);
const t0 = g.targets[0];
C.chooseTarget(g, 0);
ok('choose sets sail scene', g.scene==='sail');
ok('heading takes the lane', Math.abs(g.heading - t0.lane) < 1e-9);

/* 2b hidden islands start hidden, two are sighted */
g = C.newGame(1);
ok('two nearest islands start sighted', g.targets[0].revealed && g.targets[1].revealed);
ok('the far one starts hidden', g.targets[2].revealed === false);
ok('the big land starts hidden', g.targets[3].revealed === false);

/* 2c cannot set a heading for an island you have not sighted */
g = C.newGame(1);
C.chooseTarget(g, 2);
ok('cannot choose an unsighted island', g.scene==='chart', g.scene);

/* 3 arrival goes ashore */
g = C.newGame(1);
g.dragging = true;
C.chooseTarget(g, 0);
const t = g.targets[0];
let steps=0;
while(g.scene==='sail' && steps<100000){ g.heading = t.lane; C.tickSail(g, 1/60); steps++; }
ok('arrival goes ashore', g.scene==='island', g.scene+' '+g.msg);
ok('leg counted', g.legs===1, String(g.legs));
ok('target marked done', g.targets[0].done===true);
ok('island opens the day budget', !!(g.isle && g.isle.day===1 && g.isle.actions===C.ACTIONS_PER_DAY), JSON.stringify(g.isle));
ok('landfall no longer force-refills supplies', g.food<120, String(g.food));

/* 4 supplies out */
g = C.newGame(1);
C.chooseTarget(g, 0);
g.food = 0.0001; g.water = 0.0001;
C.tickSail(g, 1);
ok('running dry ends the run', g.scene==='over' && g.ended, g.scene);

/* 5 rift hit costs the raft */
g = C.newGame(1);
C.chooseTarget(g, 0);
g.rifts = [{lane:g.heading, d:5, age:1}];
const integ0 = g.integrity;
C.tickSail(g, 1/60);
ok('rift hit damages raft', g.integrity < integ0, g.integrity+' vs '+integ0);

/* 5b rift bites when you share its lane */
g = C.newGame(1);
C.chooseTarget(g, 0);
g.heading = 0.20;
g.rifts = [{lane:0.0, d:5, age:1}];
const iA = g.integrity;
C.tickSail(g, 1/60);
ok('rift in your third bites', g.integrity < iA, g.integrity+' vs '+iA);

/* 5c a passed rift is culled */
g = C.newGame(1);
C.chooseTarget(g, 0);
g.heading = -0.95;
g.rifts = [{lane:0.95, d:6, age:1}];
for(let i=0;i<120;i++) C.tickSail(g, 1/60);
ok('a passed rift is culled', g.rifts.length===0, String(g.rifts.length));

/* ---------- the island: a net of hidden places ---------- */

function landAt(g, i){
  g.target = i; g.scene='sail'; g.heading = g.targets[i].lane; g.dragging = true;
  g.targets[i].dist = 5;
  C.doLandfall(g);
  return g;
}
function routeTo(g, kind){
  const gr = g.isle.graph;
  let target = -1;
  for(let i=0;i<gr.n;i++) if(gr.nodes[i].type===kind){ target=i; break; }
  if(target<0) return null;
  const prev = {}; prev[g.isle.at] = -1; const q = [g.isle.at];
  while(q.length){ const c=q.shift(); if(c===target) break;
    for(const nx of gr.adj[c]) if(prev[nx]===undefined){ prev[nx]=c; q.push(nx); } }
  if(prev[target]===undefined) return null;
  const path=[]; let c=target; while(prev[c]!==-1){ path.push(c); c=prev[c]; }
  return path.reverse();
}
function walkPath(g, path){
  for(const step of path){
    let guard=0;
    while(g.isle.actions<=0 && g.scene==='island' && guard++<40){ g.food=200; g.water=200; C.endDay(g); }
    if(g.scene!=='island') return;
    C.moveTo(g, step);
  }
}

/* 6 land: the island opens as a net of 10-30 hidden places */
g = C.newGame(1); landAt(g, 0);
const gr0 = g.isle.graph;
ok('doLandfall opens the island scene', g.scene==='island');
ok('you come ashore at the shore dot', g.isle.at === 0, String(g.isle.at));
ok('the island opens the day budget', g.isle.day===1 && g.isle.actions===C.ACTIONS_PER_DAY);
ok('the net holds 10..30 places', gr0.n>=10 && gr0.n<=30, String(gr0.n));
ok('the shore is known from the start', gr0.nodes[0].seen===true && gr0.nodes[0].type==='shore');
ok('every other place starts hidden', gr0.nodes.slice(1).every(n=>n.seen===false));
ok('exactly one watchtower, not the shore', gr0.nodes.filter(n=>n.type==='tower').length===1 && gr0.tower!==0);

/* 6a the net is connected, and the tower is a real walk */
g = C.newGame(1); landAt(g,0);
const grA = g.isle.graph, hopsA = C.isleHops(grA.adj, 0);
ok('every place is reachable from the shore', hopsA.every(h=>h>=0), JSON.stringify(hopsA));
ok('the tower is a real walk, not one step', hopsA[grA.tower]>=3, String(hopsA[grA.tower]));
ok('the tower is not adjacent to the shore', grA.adj[0].indexOf(grA.tower)<0);

/* 6a1 the beach always feeds you: a grove and a spring within a day's walk,
   so being forced to resupply on a small island is never a death sentence */
[1,2,3,5,7,11,42,99,123,777,4242].forEach(seed=>{
  const q = C.makeIsleGraph(seed);
  const hp = C.isleHops(q.adj, 0);
  const nearFood  = q.nodes.some((nd,i)=> nd.type==='forage' && hp[i]>=1 && hp[i]<=2);
  const nearWater = q.nodes.some((nd,i)=> nd.type==='water'  && hp[i]>=1 && hp[i]<=2);
  ok('seed '+seed+' beach has a grove within a day', nearFood,  JSON.stringify(hp)+' '+JSON.stringify(q.nodes.map(x=>x.type)));
  ok('seed '+seed+' beach has a spring within a day', nearWater, JSON.stringify(hp)+' '+JSON.stringify(q.nodes.map(x=>x.type)));
});

/* 6a2 the net is seeded, and varies by island */
const sig = (seed) => JSON.stringify(C.makeIsleGraph(seed).nodes.map(n=>n.type)) + '|' + C.makeIsleGraph(seed).n;
ok('the net is deterministic per seed', sig(4242)===sig(4242));
ok('the net varies by seed', sig(4242)!==sig(4243));

/* 6b one move spends one action and reveals only that dot */
g = C.newGame(1); landAt(g,0);
const nbr = g.isle.graph.adj[0][0];
C.moveTo(g, nbr);
ok('moving to a linked dot spends one action', g.isle.actions===C.ACTIONS_PER_DAY-1);
ok('you are now on that dot', g.isle.at===nbr);
ok('arriving reveals that dot', g.isle.graph.nodes[nbr].seen===true);
ok('only two dots are known so far', g.isle.graph.nodes.filter(n=>n.seen).length===2);

/* 6c no teleporting to an unlinked dot, and a refused move costs nothing */
g = C.newGame(1); landAt(g,0);
let far = -1;
for(let i=1;i<g.isle.graph.n;i++){ if(g.isle.graph.adj[0].indexOf(i)<0){ far=i; break; } }
const actsRef = g.isle.actions;
C.moveTo(g, far);
ok('a non-linked dot is refused', g.isle.at===0 && g.isle.actions===actsRef);

/* 6d a grove feeds you when you find it */
g = C.newGame(5); landAt(g,0);
const pF = routeTo(g,'forage');
ok('a grove exists on the net', !!pF, String(g.isle.graph.n));
g.food=120; g.water=120;
const fBefore = g.food; walkPath(g, pF);
ok('a grove feeds you when you find it', g.food > fBefore, g.food+' vs '+fBefore);

/* 6e rocks give materials when you find them */
g = C.newGame(5); landAt(g,0);
const pT = routeTo(g,'timber');
ok('rocks exist on the net', !!pT);
const mBefore = g.materials; walkPath(g, pT);
ok('rocks give materials when you find them', g.materials > mBefore, String(g.materials));

/* 6f the tower is found by walking, and it sights islands */
g = C.newGame(5); landAt(g,0);
const revBefore = g.targets.filter(x=>x.revealed).length;
const pW = routeTo(g,'tower');
walkPath(g, pW);
ok('walking to the tower finds it', g.isle.tower===true && g.towers===1);
const newSight = g.targets.filter(x=>x.revealed).length - revBefore;
ok('the tower sights 1..3 new islands', newSight>=1 && newSight<=3, String(newSight));
ok('tower sighting is logged', g.isle.log.join('|').toLowerCase().includes('sight'));

/* 6g a ridge is a hidden pointer: a bearing, never a mark */
g = C.newGame(5); landAt(g,0);
const pV = routeTo(g,'vantage');
ok('a ridge exists on the net', !!pV);
if(pV && pV.indexOf(g.isle.graph.tower)<0){
  walkPath(g, pV);
  ok('the ridge gives a bearing to the tower', !!(g.isle.hint && g.isle.hint.b), JSON.stringify(g.isle.hint));
  ok('the bearing is a compass word',
     ['north','north-east','east','south-east','south','south-west','west','north-west'].indexOf(g.isle.hint.b)>=0,
     g.isle.hint && g.isle.hint.b);
}

/* 6h no actions left means no more moves */
g = C.newGame(1); landAt(g,0);
const nb0 = g.isle.graph.adj[0][0];
while(g.isle.actions>0) C.moveTo(g, nb0);
const atNow = g.isle.at, actsNow = g.isle.actions;
const nbNow = g.isle.graph.adj[atNow].filter(i=>i!==atNow)[0];
if(nbNow!==undefined) C.moveTo(g, nbNow);
ok('no actions left refuses movement', g.isle.at===atNow && g.isle.actions===actsNow);

/* 6i next day resets actions and eats rations */
const fB = g.food;
C.endDay(g);
ok('next day refills actions', g.isle.actions === C.ACTIONS_PER_DAY, String(g.isle.actions));
ok('next day advances the day', g.isle.day === 2, String(g.isle.day));
ok('next day eats rations', Math.abs((fB - g.food) - C.DAY_FOOD) < 1e-6, (fB-g.food)+' vs '+C.DAY_FOOD);
ok('still on the island', g.scene==='island');

/* 6j starving on land strands you */
g = C.newGame(1); landAt(g,0);
g.food = 1;
C.endDay(g);
ok('running out on land strands you', g.scene==='over' && g.ended, g.scene);

/* 8 leaving returns to the chart */
g = C.newGame(1);
C.chooseTarget(g, 0); g.targets[0].dist = 5; C.doLandfall(g);
C.leaveIsland(g);
ok('leaveIsland returns to the chart', g.scene==='chart');
ok('leaving clears the island', g.isle===null);

/* 9 no dead end: with nothing sighted, the big land appears */
g = C.newGame(1);
const bIdx = g.targets.findIndex(x=>x.big);
g.targets.forEach(x => { if(!x.big){ x.done = true; x.revealed = false; } });
g.targets[bIdx].revealed = false;
C.backToChart(g);
ok('no dead end: big land is sighted when the chart is empty', g.targets[bIdx].revealed === true);

/* 10 rifts planned at leg start, 1-3 */
g = C.newGame(7);
C.chooseTarget(g, 0);
ok('rifts planned on departure, 1-3', g.rifts.length >= 1 && g.rifts.length <= 3, String(g.rifts.length));
const nAtStart = g.rifts.length;
for(let i=0;i<600;i++) C.tickSail(g, 1/60);
ok('rift count never grows while sailing', g.rifts.length <= nAtStart, String(g.rifts.length));

/* 11 every rift arrives before the island, out of the landing approach */
[0,1,2,3,4,5].forEach(seed=>{
  const q = C.newGame(seed+1);
  C.chooseTarget(q, 0);
  const legDist = q.targets[0].dist;
  const before = q.rifts.every(r => r.d < legDist);
  const clear  = q.rifts.every(r => (legDist - r.d) >= C.RIFT_KEEPOUT);
  ok('seed '+(seed+1)+' rifts arrive before the island', before,
     q.rifts.map(r=>Math.round(r.d)).join(',')+' vs leg '+Math.round(legDist));
  ok('seed '+(seed+1)+' rifts stay out of the landing approach', clear);
});

/* 12 TAP TO LAND window */
g = C.newGame(1);
C.chooseTarget(g, 0);
g.dragging = true;
g.heading = g.targets[0].lane;
let sawWindow=false, g2=0;
while(g.scene==='sail' && g2<100000){
  g.heading = g.targets[0].lane;
  C.tickSail(g, 1/60); g2++;
  if(C.canLand(g)){ sawWindow=true; break; }
}
ok('landing window opens before the island', sawWindow);
ok('window is not on contact', g.targets[0].dist > 8, String(g.targets[0].dist));
C.doLandfall(g);
ok('tap lands: scene goes ashore', g.scene==='island' || g.scene==='win', g.scene);

/* 13 landing the big land wins */
g = C.newGame(2);
const bi = g.targets.findIndex(x=>x.big);
g.target = bi; g.scene='sail'; g.heading=g.targets[bi].lane; g.dragging=true;
g.targets[bi].dist = 40;
ok('canLand true on the big land', C.canLand(g)===true);
C.doLandfall(g);
ok('landing the big land wins', g.scene==='win' && g.won===true, g.scene);

/* 14 off-lane tap still lands */
g = C.newGame(1);
C.chooseTarget(g, 0);
g.targets[0].dist = 60;
g.heading = g.targets[0].lane + 1;
ok('off-lane tap still lands', C.canLand(g)===true);

/* 15 rift stream deterministic per seed */
function riftPlan(seed){ const q=C.newGame(seed); C.chooseTarget(q,0); return q.rifts.map(r=>Math.round(r.d*1000)+':'+Math.round(r.lane*1000)).join('|'); }
ok('rift plan is seeded', riftPlan(42)===riftPlan(42));
ok('rift plan varies by seed', riftPlan(42)!==riftPlan(43));

/* 16 cannot re-choose a visited island */
g = C.newGame(3);
g.targets[0].done = true;
C.chooseTarget(g, 0);
ok('cannot re-choose a visited island', g.scene==='chart');

/* 17 the run that died on Parent's phone: forced onto a small island,
near-empty, and it has to be survivable */
function pathTo(g, target){
  const gr=g.isle.graph, prev={}; prev[g.isle.at]=-1; const q=[g.isle.at];
  while(q.length){ const c=q.shift(); if(c===target) break;
    for(const nx of gr.adj[c]) if(prev[nx]===undefined){ prev[nx]=c; q.push(nx); } }
  if(prev[target]===undefined) return null;
  const path=[]; let c=target; while(prev[c]!==-1){ path.push(c); c=prev[c]; }
  return path.reverse();
}
function nearestKind(g, kinds){
  const gr=g.isle.graph, hp=C.isleHops(gr.adj, g.isle.at);
  let best=-1, bh=Infinity;
  for(let i=0;i<gr.n;i++){ if(i===g.isle.at) continue;
    if(kinds.indexOf(gr.nodes[i].type)<0) continue; if(hp[i]<1) continue;
    if(hp[i]<bh){ bh=hp[i]; best=i; } }
  return best;
}
function playSupplyDay(g, order){
  for(const kind of order){
    if(g.isle.actions<=0) break;
    const tgt = nearestKind(g, [kind]); if(tgt<0) continue;
    const p = pathTo(g, tgt); if(!p) continue;
    while(p.length && g.isle.actions>0) C.moveTo(g, p.shift());
  }
  if(g.isle.actions>0 && !g.ended) C.moveTo(g, g.isle.at);
}
[1,2,3,5,7,11,42,99,123,777,4242].forEach(seed=>{
  const q = C.newGame(seed); landAt(q,0);
  q.food = 4; q.water = 3;
  // play the day the way a player who is low on water would
  playSupplyDay(q, q.water<=q.food ? ['water','forage'] : ['forage','water']);
  const fed = q.food, wet = q.water;
  C.endDay(q);
  ok('seed '+seed+' a near-empty landing survives the night',
     q.scene==='island' && q.food>0 && q.water>0,
     'after day food '+fed+' water '+wet+' -> '+q.food+'/'+q.water);
});

/* 18 GATHER: the explicit action on a resource dot */
g = C.newGame(7); landAt(g, 0); g.food = 200; g.water = 200;
const gpath = routeTo(g, 'forage');
ok('seed 7 has a reachable grove', !!gpath);
walkPath(g, gpath || []);
let gcamp = 0;
while(g.isle.actions<=0 && g.scene==='island' && gcamp++<40){ g.food=200; g.water=200; C.endDay(g); }
const gFoodB = g.food, gActB = g.isle.actions;
C.gatherHere(g);
ok('gather on a grove spends exactly one action', g.isle.actions===gActB-1, g.isle.actions+' vs '+gActB);
ok('gather on a grove feeds you', g.food>gFoodB, g.food+' vs '+gFoodB);

/* 18a gather where there is nothing to gather is free and says so */
g = C.newGame(7); landAt(g, 0);
const fShore = g.food, aShore = g.isle.actions;
C.gatherHere(g);
ok('gather at the shore spends nothing', g.isle.actions===aShore && g.food===fShore);
ok('the shore refusal is logged', g.isle.log.join('|').toLowerCase().includes('nothing to gather'));

/* 18b gather with no actions left refuses and costs nothing */
g = C.newGame(7); landAt(g, 0); g.food = 200; g.water = 200;
walkPath(g, routeTo(g, 'forage') || []);
g.isle.actions = 0;
const fNo = g.food;
C.gatherHere(g);
ok('gather with no actions refuses and costs nothing', g.isle.actions===0 && g.food===fNo);

/* 19 SET SAIL is two steps: ready, gather, then push off */
g = C.newGame(7); landAt(g, 0); g.food = 200; g.water = 200;
ok('the raft starts not-ready', g.isle.ready===false);
C.setSail(g);
ok('first sail readies the raft, still ashore', g.scene==='island' && g.isle.ready===true, g.scene);
ok('readiness is logged', g.isle.log.join('|').toLowerCase().includes('ready'));
const fReady = g.food;
C.gatherHere(g);   // at the shore that refuses: proves the island loop still runs while ready
ok('the island loop still runs while the raft is ready', g.scene==='island' && g.food===fReady);
C.setSail(g);
ok('second sail leaves for the chart', g.scene==='chart' && g.isle===null, g.scene);

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
