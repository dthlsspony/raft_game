const fs = require('fs');
const html = fs.readFileSync('index.html','utf8');
const m = html.match(/<script id="core">([\s\S]*?)<\/script>/);
if(!m){ console.error('NO CORE BLOCK'); process.exit(1); }
eval(m[1]);
let pass=0, fail=0;
function ok(name, cond){ if(cond){pass++;} else {fail++; console.error('FAIL: '+name);} }

// defaults
let g = newGame(42);
ok('food 100', g.food===100);
ok('integrity 100', g.integrity===100);
ok('scene drift', g.scene==='drift');

// drift drains supplies
let f0=g.food;
tickDrift(g, 1.0);
ok('food drains on 1s drift', g.food < f0);
ok('water drains', g.water < 100);

// island spawns after islandAt
tickDrift(g, 5.0);
ok('island spawned', g.island !== null);
ok('small island first', g.island.kind==='small');

// can't dock while far
let g2 = newGame(7); tickDrift(g2, 5.0);
g2.island.x = 700; tryDock(g2);
ok('no dock when far', g2.scene==='drift');
g2.island.x = 120; tryDock(g2);
ok('docks when close', g2.scene==='island');
ok('grid made', g2.grid && g2.grid.map.length===11);
ok('spawn is land', g2.grid.map[g2.grid.spawn.y][g2.grid.spawn.x]===1);
ok('has pickups incl power', g2.pickups.some(p=>p.k==='power'));
ok('dockings not yet counted', g2.dockings===0);

// gather
let mat0 = g2.materials;
let p = g2.pickups.find(x=>!x.taken && (x.k==='wood'||x.k==='rope'));
g2.player.x=p.x; g2.player.y=p.y; g2.player.tx=p.x; g2.player.ty=p.y;
gatherAt(g2);
ok('gather adds materials', g2.materials > mat0);

// repair costs 2
g2.materials = 2; g2.integrity = 40;
repairRaft(g2);
ok('repair spends 2 mats', g2.materials===0);
ok('repair adds integrity', g2.integrity===70);
g2.integrity=40; repairRaft(g2);
ok('repair blocked when poor', g2.integrity===40 && g2.msg.indexOf('not enough')>=0);

// set sail increments dockings, back to drift
g2.integrity=100;
setSail(g2);
ok('sail -> drift', g2.scene==='drift');
ok('dockings=1', g2.dockings===1);

// big land after maxIslands dockings
g2.dockings = 3;
ok('next kind big', nextKind(g2)==='big');

// big land win
let g3 = newGame(3);
g3.dockings = 3; g3.scene='drift'; g3.island={x:100,kind:'big',seed:11};
tryDock(g3);
ok('big land docks', g3.islandKind==='big');
setSail(g3);
ok('big land wins', g3.scene==='win' && g3.won===true);

// out of supplies = over
let g4 = newGame(4); g4.food=1; tickDrift(g4, 1.0);
ok('starvation ends run', g4.ended && g4.scene==='over');

// passing the big land = over
let g5 = newGame(5); g5.scene='drift'; g5.island={x:-80,kind:'big',seed:2};
tickDrift(g5, 0.01);
ok('passing big land ends run', g5.ended && g5.scene==='over');

// storm is deterministic for a fixed seed
let stormCount=0;
for(let s=1;s<=200;s++){ let x=newGame(s); x.integrity=1; stormOnDepart(x); if(x.msg.indexOf('storm')>=0) stormCount++; }
ok('storms happen sometimes', stormCount>0 && stormCount<200);

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
