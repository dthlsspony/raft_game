const fs = require('fs');
const html = fs.readFileSync('/workspace/raft/index.html','utf8');
const m = html.match(/<script id="core">([\s\S]*?)<\/script>/);
if(!m){ console.error('no core block'); process.exit(2); }
const core = m[1];

const sandbox = {};
const fn = new Function(core + `
  return {newGame, reachOf, chooseTarget, tickSail, tickChart, clamp, DMAX, BASE_SPEED,
          planRifts, canLand, doLandfall, LAND_RANGE, backToChart};
`);
const C = fn();

let pass=0, fail=0;
function ok(name, cond, extra){ if(cond){pass++; console.log('ok  '+name);} else {fail++; console.log('FAIL '+name+(extra?'  '+extra:''));} }

// 1. reach
let g = C.newGame(1);
ok('reach ~962 at full supplies', Math.abs(C.reachOf(g)-25*100/2.6) < 1, C.reachOf(g));

// 2. choose target
g = C.newGame(1);
const t0 = g.targets[0];
C.chooseTarget(g, 0);
ok('choose sets sail scene', g.scene==='sail');
ok('heading takes the lane', Math.abs(g.heading - t0.lane) < 1e-9);

// 3. arrival at near island (auto safety net still works)
g = C.newGame(1);
g.dragging = true;
C.chooseTarget(g, 0);
const t = g.targets[0];
let steps=0;
g.heading = t.lane;
while(g.scene==='sail' && steps<100000){ g.heading = t.lane; C.tickSail(g, 1/60); steps++; }
ok('arrival returns to chart', g.scene==='chart', g.scene+' '+g.msg);
ok('leg counted', g.legs===1, String(g.legs));
ok('target marked done', g.targets[0].done===true);
ok('restocked above start', g.food>100, String(g.food));

// 4. supplies out
g = C.newGame(1);
C.chooseTarget(g, 0);
g.food = 0.0001; g.water = 0.0001;
C.tickSail(g, 1);
ok('running dry ends the run', g.scene==='over' && g.ended, g.scene);

// 5. rift hit costs the raft
g = C.newGame(1);
C.chooseTarget(g, 0);
g.rifts = [{lane:g.heading, d:5, age:1}];
const integ0 = g.integrity;
C.tickSail(g, 1/60);
ok('rift hit damages raft', g.integrity < integ0, g.integrity+' vs '+integ0);

// 6. missed island ends the run
g = C.newGame(1);
g.dragging = true;
C.chooseTarget(g, 1);
g.heading = g.targets[1].lane + 1;
g.dragging = true;
let s2=0;
while(g.scene==='sail' && s2<100000){ g.heading = g.targets[1].lane + 1; C.tickSail(g, 1/60); s2++; }
ok('missing the island ends the run', g.scene==='over', g.scene+' '+g.msg);

// 7. rifts are planned at leg start, in a small handful
g = C.newGame(7);
C.chooseTarget(g, 0);
ok('rifts are planned on departure (not spawned endlessly)', g.rifts.length >= 2 && g.rifts.length <= 3, String(g.rifts.length));
const nAtStart = g.rifts.length;
for(let i=0;i<600;i++) C.tickSail(g, 1/60);
ok('rift count never grows while sailing', g.rifts.length <= nAtStart, String(g.rifts.length));

// 8. every planned rift arrives BEFORE the island (land must not come first)
[0,1,2,3,4,5].forEach(seed=>{
  const q = C.newGame(seed+1);
  C.chooseTarget(q, 0);
  const legDist = q.targets[0].dist;
  const allBefore = q.rifts.every(r => r.d < legDist);
  ok('seed '+(seed+1)+' rifts land before the island', allBefore,
     q.rifts.map(r=>Math.round(r.d)).join(',')+' vs leg '+Math.round(legDist));
});

// 9. TAP TO LAND: canLand opens a window; the tap performs the landfall
g = C.newGame(1);
C.chooseTarget(g, 0);
g.dragging = true;
g.heading = g.targets[0].lane;
let sawWindow=false, guard=0;
while(g.scene==='sail' && guard<100000){
  g.heading = g.targets[0].lane;
  C.tickSail(g, 1/60); guard++;
  if(C.canLand(g)){ sawWindow=true; break; }
}
ok('landing window opens before the island', sawWindow);
ok('window is not on contact', g.targets[0].dist > 8, String(g.targets[0].dist));
const beforeDist = g.targets[0].dist;
C.doLandfall(g);
ok('tap lands: scene goes to chart', g.scene==='chart', g.scene);
ok('tap lands well before drift-through distance', beforeDist > 8, String(beforeDist));
ok('leg counted by the tap', g.legs===1, String(g.legs));

// 10. tap landing on the big land wins
g = C.newGame(2);
const bi = g.targets.findIndex(x=>x.big);
g.target = bi; g.scene='sail'; g.heading=g.targets[bi].lane; g.dragging=true;
g.targets[bi].dist = 40;
ok('canLand true on the big land', C.canLand(g)===true);
C.doLandfall(g);
ok('landing the big land wins', g.scene==='win' && g.won===true, g.scene);

// 11. off-lane tap does NOT land
g = C.newGame(1);
C.chooseTarget(g, 0);
g.targets[0].dist = 60;
g.heading = g.targets[0].lane + 1;
ok('off-lane cannot land', C.canLand(g)===false);

// 12. rift stream deterministic per seed
function riftPlan(seed){ const q=C.newGame(seed); C.chooseTarget(q,0); return q.rifts.map(r=>Math.round(r.d*1000)+':'+Math.round(r.lane*1000)).join('|'); }
ok('rift plan is seeded', riftPlan(42)===riftPlan(42));
ok('rift plan varies by seed', riftPlan(42)!==riftPlan(43));

// 13. choose a done target is refused
g = C.newGame(3);
g.targets[0].done = true;
C.chooseTarget(g, 0);
ok('cannot re-choose a visited island', g.scene==='chart');

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
