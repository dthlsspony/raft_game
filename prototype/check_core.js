const fs = require('fs');
const html = fs.readFileSync('/workspace/raft/index.html','utf8');
const m = html.match(/<script id="core">([\s\S]*?)<\/script>/);
if(!m){ console.error('no core block'); process.exit(2); }
const core = m[1];

const sandbox = {};
const fn = new Function(core + `
  return {newGame, reachOf, chooseTarget, tickSail, tickChart, clamp, DMAX, BASE_SPEED};
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

// 3. arrival at near island
g = C.newGame(1);
g.dragging = true;                 // hold the helm, no decay
C.chooseTarget(g, 0);
g.riftAt = 1e9;                    // no rifts in this test
const t = g.targets[0];
// steer to exact lane each tick
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
g.riftAt = 1e9;
g.rifts = [{lane:g.heading, d:5}];
const integ0 = g.integrity;
C.tickSail(g, 1/60);
ok('rift hit damages raft', g.integrity < integ0, g.integrity+' vs '+integ0);

// 6. missed island ends the run
g = C.newGame(1);
g.dragging = true;
C.chooseTarget(g, 1);
g.riftAt = 1e9;
g.heading = g.targets[1].lane + 1;   // hopelessly off
g.dragging = true;
let s2=0;
while(g.scene==='sail' && s2<100000){ g.heading = g.targets[1].lane + 1; C.tickSail(g, 1/60); s2++; }
ok('missing the island ends the run', g.scene==='over', g.scene+' '+g.msg);

// 7. rifts spawn over time
g = C.newGame(7);
C.chooseTarget(g, 0);
for(let i=0;i<200;i++) C.tickSail(g, 1/60);
ok('rifts spawn while sailing', g.rifts.length > 0, String(g.rifts.length));

// 8. rifts are deterministic per seed
function riftCount(seed){ let q=C.newGame(seed); C.chooseTarget(q,0); for(let i=0;i<120;i++) C.tickSail(q,1/60); return q.rifts.length; }
ok('rift stream is seeded', riftCount(42)===riftCount(42));

// 9. choose a done target is refused
g = C.newGame(3);
g.targets[0].done = true;
C.chooseTarget(g, 0);
ok('cannot re-choose a visited island', g.scene==='chart');

console.log('\\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
