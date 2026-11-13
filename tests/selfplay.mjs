// Engine check: plays computer-vs-computer games and verifies every generated move
// passes the same validation and scoring used for human moves. Run: node tests/selfplay.mjs
import fs from 'fs';
const R = new URL('../js/', import.meta.url).href;
const { initDict, D, anagramsOf, stems, buildable, alphagramsByProbability, makePhony } = await import(R+'dict.js');
const B = await import(R+'board.js');
const M = await import(R+'movegen.js');
const T = await import(R+'tiles.js');
let t=Date.now(); initDict(fs.readFileSync(new URL('../words/words.txt', import.meta.url), 'utf8')); console.log('dict ms',Date.now()-t,'nodes',D.nodes);
t=Date.now(); console.log(anagramsOf('RETAINS'), alphagramsByProbability(7).slice(0,5).map(x=>x.a), 'ms', Date.now()-t);
t=Date.now(); const st=stems(); console.log('stems',st.length, st.slice(0,8).map(s=>s.stem+':'+s.count),'ms',Date.now()-t);
console.log(buildable('AEINRST',7,7).length, makePhony('RETAINS'));
// self play games, verify every move with evaluatePlacement
let games=0, totalMs=0, maxMs=0, moves=0;
for (let g=0; g<6; g++){
  const bag=T.fullBag(); const board=B.newBoard(); const racks=[bag.splice(0,7),bag.splice(0,7)]; const scores=[0,0]; let p=0, passes=0;
  while(true){
    const t0=Date.now(); const lvl=['easy','medium','hard'][g%3];
    const mv=M.chooseMove(board, racks[p], bag.length, p? 'hard': lvl); const ms=Date.now()-t0; totalMs+=ms; maxMs=Math.max(maxMs,ms); moves++;
    if(mv.type==='play'){
      const ev=B.evaluatePlacement(board, mv.tiles);
      if(!ev.ok || ev.score!==mv.score){ console.log('MISMATCH', mv, ev.error, ev.score); process.exit(1);}
      B.applyTiles(board, mv.tiles); scores[p]+=mv.score; racks[p]=M.rackAfter(racks[p], mv.tiles); racks[p].push(...bag.splice(0,7-racks[p].length)); passes=0;
      if(!racks[p].length) break;
    } else if(mv.type==='exchange'){ const r=M.rackAfter(racks[p], mv.tiles.map(l=>({l,b:l==='?'}))); bag.push(...mv.tiles); T.shuffle(bag); r.push(...bag.splice(0,7-r.length)); racks[p]=r; passes++; }
    else passes++;
    if(passes>=6) break;
    p=1-p;
  }
  games++; console.log('game',g, scores);
}
console.log('avg ms', (totalMs/moves).toFixed(1), 'max', maxMs);
// blanks timing
const board=B.newBoard(); t=Date.now(); const ms=M.generateMoves(board, ['?','?','E','S','R','A','T']); console.log('2 blanks opening moves', ms.length, Date.now()-t,'ms');
