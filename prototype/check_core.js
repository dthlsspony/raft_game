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
ok('no islands at start', g.islands.length===0);
ok('heading 0', g.heading===0);

// supply drain
let f0=g.food, w0=g.water;
tickDrift(g, 1.0);
ok('food drains on drift', g.food < f0);
ok('water drains', g.water < w0);

// island spawns
let g2 = newGame(7);
tickDrift(g2, 3.0);
ok('island spawned', g2.islands.length >= 1);
ok('small is first kind', g2.islands[0].kind==='small');
ok('island has lane in range', g2.islands[0].lane>=-1 && g2.islands[0].lane<=1);
ok('island is mid-approach', g2.islands[0].d < DMAX && g2.islands[0].d > 0);

// cannot dock while far / misaligned
let g3 = newGame(11); g3.islands=[{d:DMAX,lane:0.4,kind:'small',seed:5}];
ok('not dockable when far', dockableIndex(g3) === -1);
g3.islands[0].d = 12;
ok('not dockable when misaligned', dockableIndex(g3) === -1);
g3.heading = 0.4;
ok('dockable when close + aligned', dockableIndex(g3) === 0);
tryDock(g3);
ok('docks -> island scene', g3.scene==='island');
ok('grid made', g3.grid && g3.grid.map.length===11);
ok('spawn is land', g3.grid.map[g3.grid.spawn.y][g3.grid.spawn.x]===1);
ok('has pickups incl power', g3.pickups.some(p=>p.k==='power'));
ok('islands cleared on dock', g3.islands.length===0);
ok('dockings not yet counted', g3.dockings===0);

// steering moves the heading
let g4 = newGame(3); g4.steer = 1; tickDrift(g4, 0.5); g4.steer = 0;
ok('steer right raises heading', g4.heading > 0);
let h1 = g4.heading; tickDrift(g4, 1.0);
ok('heading eases back with no input', g4.heading < h1 && g4.heading >= 0);
g4.steer = -1; tickDrift(g4, 0.4); g4.steer = 0;
ok('steer left lowers heading', g4.heading < 1);

// walk + gather
let g5 = newGame(3); g5.islands=[{d:12,lane:0,kind:'small',seed:9}]; tryDock(g5);
let mat0 = g5.materials;
let p = g5.pickups.find(x=>!x.taken && (x.k==='wood'||x.k==='rope'));
g5.player.goal = { x:p.x, y:p.y };
for(let i=0;i<600 && g5.player.goal;i++) stepPlayer(g5, 1/60);
ok('player reaches goal', g5.player.goal===null);
ok('gather adds materials', g5.materials > mat0);

// water is not walkable
ok('water not walkable', !walkable(g5, 0, 0) || !walkable(g5, g5.grid.w-1, 0));

// repair costs 2
g5.materials = 2; g5.integrity = 40;
repairRaft(g5);
ok('repair spends 2 mats', g5.materials===0);
ok('repair adds integrity', g5.integrity===70);
g5.integrity=40; repairRaft(g5);
ok('repair blocked when poor', g5.integrity===40 && g5.msg.indexOf('not enough')>=0);

// set sail
g5.integrity=100;
setSail(g5);
ok('sail -> drift', g5.scene==='drift');
ok('dockings=1', g5.dockings===1);
ok('sail clears islands', g5.islands.length===0);

// big land after maxIslands
g5.dockings = 3;
ok('next kind big', nextKind(g5)==='big');

// big land win
let g6 = newGame(3);
g6.dockings = 3; g6.scene='drift'; g6.islands=[{d:12,lane:0,kind:'big',seed:11}];
tryDock(g6);
ok('big land docks', g6.islandKind==='big');
setSail(g6);
ok('big land wins', g6.scene==='win' && g6.won===true);

// starvation
let g7 = newGame(4); g7.food=1; tickDrift(g7, 1.0);
ok('starvation ends run', g7.ended && g7.scene==='over');

// passing the big land = over
let g8 = newGame(5); g8.scene='drift'; g8.heading=0.9; g8.islands=[{d:-7,lane:0,kind:'big',seed:2}];
tickDrift(g8, 0.01);
ok('passing big land ends run', g8.ended && g8.scene==='over' && g8.msg.indexOf('big land')>=0);

// small island passed is not a loss
let g9 = newGame(5); g9.scene='drift'; g9.heading=0.9; g9.islands=[{d:-7,lane:0,kind:'small',seed:2}];
tickDrift(g9, 0.01);
ok('passing a small island is fine', !g9.ended && g9.passed===1);

// storm deterministic
let stormCount=0;
for(let s=1;s<=200;s++){ let x=newGame(s); x.integrity=1; stormOnDepart(x); if(x.msg.indexOf('storm')>=0) stormCount++; }
ok('storms happen sometimes', stormCount>0 && stormCount<200);

// fleet
let g10 = newGame(6); tickFleet(g10, 10);
ok('fleet grows', g10.fleet > 0);
g10.fleet = 99.9; tickFleet(g10, 1);
ok('fleet catches you', g10.ended && g10.scene==='over');
ok('fleet message', g10.msg.indexOf('fleet')>=0);

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
