// Board and rack puzzles: best play, rack leave, score-it.
import { h, toast, tile, pageHeader, pct, segmented } from '../ui.js';
import { createBoardView } from './boardview.js';
import { newBoard, evaluatePlacement, applyTiles, placementToMove, moveLabel, N } from '../board.js';
import { generateMoves, chooseMove, rackAfter, rankMoves } from '../movegen.js';
import { fullBag, shuffle } from '../tiles.js';
import { leaveValue, explainLeave } from '../leave.js';
import * as store from '../store.js';

export const PUZZLES = [
  { id: 'bestplay', title: 'Find the Best Play', icon: '🧩', desc: 'A real board and rack. Find the highest-scoring move, then see every option ranked.' },
  { id: 'leave', title: 'Rack Leave', icon: '⚖️', desc: 'Which tiles would you keep? Learn what makes a good rack: blanks, S, balance, no duplicates.' },
  { id: 'scoreit', title: 'Score It', icon: '🧮', desc: 'Add up a play on the board. Trains premium-square vision and quick scoring.' },
];

export function puzzlesHub() {
  const P = store.S().puzzles;
  return h('div.page', {},
    pageHeader('Puzzles'),
    h('p.muted', {}, 'Puzzles build board vision and judgement, the skills word lists alone don\'t teach.'),
    h('div.list', {}, PUZZLES.map((p) => h('a.card.drill.row-card', { href: `#/puzzle/${p.id}` },
      h('div.icon', { 'aria-hidden': 'true' }, p.icon),
      h('div.grow', {}, h('strong', {}, p.title), h('p.muted.small', {}, p.desc),
        P[p.id]?.n ? h('p.small', {}, `${P[p.id].n} solved · average ${Math.round(P[p.id].sum / P[p.id].n)}%`) : null),
      h('span.chev', {}, '›')))));
}

// Build a realistic position by letting the computer play both sides.
function makePosition(moves) {
  const bag = fullBag();
  const board = newBoard();
  const racks = [bag.splice(0, 7), bag.splice(0, 7)];
  let p = 0, last = [];
  for (let i = 0; i < moves; i++) {
    const mv = chooseMove(board, racks[p], bag.length, Math.random() < 0.5 ? 'medium' : 'hard');
    if (mv.type !== 'play') break;
    applyTiles(board, mv.tiles);
    racks[p] = rackAfter(racks[p], mv.tiles);
    racks[p].push(...bag.splice(0, 7 - racks[p].length));
    last = mv.tiles;
    p = 1 - p;
  }
  // Puzzle rack: the player to move's rack.
  return { board, rack: racks[p], bag, last };
}

export function puzzleView(id) {
  if (id === 'bestplay') return bestPlay();
  if (id === 'leave') return rackLeave();
  if (id === 'scoreit') return scoreIt();
  return h('div.page', {}, pageHeader('Not found', '#/puzzles'));
}

// ---------- Best play ----------
function bestPlay() {
  let phase = 'mid';
  const root = h('div.page.play');
  const bv = createBoardView({ onChange: () => upd() });
  const info = h('div.feedback');
  const submit = h('button.btn.primary', { onclick: () => check() }, 'Submit');
  const result = h('div');
  let pos, moves;

  const upd = () => {
    const t = bv.placement();
    if (!t.length) { submit.textContent = 'Submit'; return; }
    const ev = evaluatePlacement(pos.board, t);
    submit.textContent = ev.words?.length ? `Submit ${ev.score}` : 'Submit';
  };

  const fresh = () => {
    result.replaceChildren();
    info.replaceChildren(h('span.muted', {}, 'Setting up…'));
    setTimeout(() => {
      for (let tries = 0; tries < 5; tries++) {
        pos = makePosition(phase === 'open' ? 0 : 3 + ((Math.random() * 8) | 0));
        moves = generateMoves(pos.board, pos.rack);
        if (moves.length > 3) break;
      }
      rankMoves(moves, pos.rack, 50);
      moves.sort((a, b) => b.score - a.score);
      bv.setBoard(pos.board.slice());
      bv.setRack(pos.rack.slice());
      bv.setHighlight([]);
      bv.lock(false);
      info.replaceChildren(h('div', {}, 'Find the highest-scoring play ', h('span.muted', {}, `(${moves.length} legal plays)`)));
      submit.disabled = false;
    }, 30);
  };

  const showMove = (m) => { bv.recall(); bv.showPreview(m.tiles); };

  const check = (giveUp = false) => {
    let mine = null;
    if (!giveUp) {
      const t = bv.placement();
      const ev = evaluatePlacement(pos.board, t);
      if (!ev.ok) { toast(ev.error || 'Not a valid play'); return; }
      mine = placementToMove(ev, t);
    }
    bv.lock(true);
    submit.disabled = true;
    const best = moves[0];
    const score = mine ? mine.score : 0;
    const rank = mine ? 1 + moves.filter((m) => m.score > score).length : null;
    const p = mine ? Math.min(100, pct(score, best.score)) : 0;
    store.recordPuzzle('bestplay', p);
    const byEq = moves.slice().sort((a, b) => b.equity - a.equity)[0];
    info.replaceChildren(h(`div.fb.${p >= 100 ? 'good' : p >= 75 ? 'ok' : 'bad'}`, {},
      mine ? (p >= 100 ? `⭐ Top score! ${moveLabel(mine)} for ${score}.` : `${moveLabel(mine)} scores ${score}: #${rank} of ${moves.length} (${p}% of the top).`) : 'Here are the top plays.'));
    result.replaceChildren(h('div.card', {},
      h('h3', {}, 'Top plays (tap to show)'),
      h('table.tbl.small.clickable', {},
        h('tr', {}, h('th', {}, '#'), h('th', {}, 'Play'), h('th.num', {}, 'Score'), h('th', {}, 'Keeps'), h('th.num', {}, 'Value')),
        moves.slice(0, 10).map((m, i) => h('tr', { onclick: () => showMove(m) },
          h('td', {}, i + 1), h('td', {}, h('strong', {}, moveLabel(m))), h('td.num', {}, m.score), h('td', {}, m.leave.join('') || '–'), h('td.num', {}, m.equity.toFixed(1))))),
      h('p.small.muted', {}, '"Value" = score + how good the kept tiles are. Strong players often pick the best value, not the best score.'),
      byEq !== best ? h('p.small', {}, `Best by value: `, h('strong', { class: 'clicky', onclick: () => showMove(byEq) }, `${moveLabel(byEq)} (${byEq.score}, keeps ${byEq.leave.join('') || 'nothing'})`)) : null),
    h('button.btn.primary.big', { onclick: fresh }, 'Next puzzle'));
    showMove(best);
  };

  root.append(pageHeader('Find the Best Play', '#/puzzles'),
    segmented([['mid', 'Mid-game'], ['open', 'Opening move']], phase, (v) => { phase = v; fresh(); }),
    info, bv.el, bv.rackEl,
    h('div.actions', {},
      h('button.btn', { onclick: () => bv.shuffle() }, '⟳'),
      h('button.btn', { onclick: () => bv.recall() }, '↩'),
      h('button.btn', { onclick: () => bv.toggleZoom() }, '🔍'),
      h('button.btn.ghost', { onclick: () => check(true) }, 'Show me'),
      submit),
    result);
  fresh();
  return root;
}

// ---------- Rack leave ----------
function bestKeeps(rack) {
  const seen = new Map();
  for (let mask = 0; mask < 1 << rack.length; mask++) {
    const keep = rack.filter((_, i) => mask & (1 << i));
    const key = keep.slice().sort().join('');
    if (keep.length === 7 || seen.has(key)) continue;
    seen.set(key, { keep: key, value: leaveValue(keep) });
  }
  return [...seen.values()].sort((a, b) => b.value - a.value);
}

function rackLeave() {
  const root = h('div.page');
  let size = 5;
  const body = h('div');
  const fresh = () => {
    const rack = fullBag().slice(0, 7);
    const keep = new Set();
    const tilesEl = h('div.rack-show.tap');
    const drawTiles = () => tilesEl.replaceChildren(...rack.map((l, i) => {
      const t = tile(l, { cls: keep.has(i) ? 'kept' : 'tossed' });
      t.setAttribute('role', 'button');
      t.setAttribute('aria-pressed', String(keep.has(i)));
      t.addEventListener('click', () => { if (done) return; keep.has(i) ? keep.delete(i) : keep.size < size && keep.add(i); drawTiles(); count.textContent = `Keeping ${keep.size} of ${size}`; });
      return t;
    }));
    let done = false;
    const count = h('p.small.muted', {}, `Keeping 0 of ${size}`);
    const out = h('div');
    const check = () => {
      if (keep.size !== size) { toast(`Pick exactly ${size} tiles to keep.`); return; }
      done = true;
      const mine = [...keep].map((i) => rack[i]);
      const all = bestKeeps(rack).filter((x) => x.keep.length === size);
      const myKey = mine.slice().sort().join('');
      const myVal = leaveValue(mine);
      const best = all[0];
      const worst = all[all.length - 1];
      const p = best.value === worst.value ? 100 : Math.round(((myVal - worst.value) / (best.value - worst.value)) * 100);
      store.recordPuzzle('leave', p);
      const rank = 1 + all.filter((x) => x.value > myVal).length;
      out.replaceChildren(
        h(`div.fb.${myKey === best.keep || p >= 99 ? 'good' : p >= 70 ? 'ok' : 'bad'}`, {}, myKey === best.keep || p >= 99 ? '⭐ Best keep!' : `Your keep ranks #${rank} of ${all.length}.`),
        h('div.card', {},
          h('table.tbl.small', {}, h('tr', {}, h('th', {}, 'Keep'), h('th.num', {}, 'Value'), h('th', {}, 'Why')),
            all.slice(0, 5).map((x) => h(`tr${x.keep === myKey ? '.me' : ''}`, {}, h('td', {}, h('strong', {}, x.keep)), h('td.num', {}, x.value.toFixed(1)), h('td.small', {}, explainLeave(x.keep.split('')).slice(0, 2).join(' ')))),
            rank > 5 ? h('tr.me', {}, h('td', {}, h('strong', {}, myKey)), h('td.num', {}, myVal.toFixed(1)), h('td.small', {}, explainLeave(mine).slice(0, 2).join(' '))) : null),
          h('p.small.muted', {}, 'Values are a heuristic: blank ≫ S > Z, X, E, R… and penalties for duplicates, Q without U and vowel/consonant imbalance.')),
        h('button.btn.primary.big', { onclick: fresh }, 'Next rack'));
      btn.remove();
    };
    const btn = h('button.btn.primary', { onclick: check }, 'Check');
    drawTiles();
    body.replaceChildren(h('p.prompt', {}, `You're playing ${7 - size} tile${7 - size > 1 ? 's' : ''}. Tap the ${size} you'd keep.`), tilesEl, count, btn, out);
  };
  root.append(pageHeader('Rack Leave', '#/puzzles'),
    h('label.field', {}, h('span', {}, 'Keep'), segmented([['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']], String(size), (v) => { size = +v; fresh(); })),
    body,
    h('p.tip', {}, h('strong', {}, 'Rules of thumb: '), 'keep blanks and S; aim for about one more consonant than vowels; dump duplicates and clunky tiles like V, W, U and Q.'));
  fresh();
  return root;
}

// ---------- Score it ----------
function scoreIt() {
  const root = h('div.page.play');
  const bv = createBoardView({ interactive: false });
  const body = h('div');
  let streak = 0;
  const fresh = () => {
    let pos, mv;
    for (let i = 0; i < 6; i++) {
      pos = makePosition(2 + ((Math.random() * 8) | 0));
      const moves = generateMoves(pos.board, pos.rack).filter((m) => m.tiles.length >= 2);
      if (!moves.length) continue;
      moves.sort((a, b) => b.score - a.score);
      mv = moves[(Math.random() * Math.min(25, moves.length)) | 0];
      break;
    }
    bv.setBoard(pos.board.slice());
    bv.setRack([]);
    bv.showPreview(mv.tiles);
    bv.setHighlight([]);
    const ev = evaluatePlacement(pos.board, mv.tiles);
    const input = h('input.answer', { type: 'number', inputmode: 'numeric', placeholder: 'Score', 'aria-label': 'Score' });
    const out = h('div');
    const check = () => {
      const v = +input.value;
      if (!input.value) return;
      input.disabled = true;
      btn.remove();
      const ok = v === mv.score;
      streak = ok ? streak + 1 : 0;
      store.recordPuzzle('scoreit', ok ? 100 : 0);
      out.replaceChildren(
        h(`div.fb.${ok ? 'good' : 'bad'}`, {}, ok ? `✓ ${mv.score} is right!${streak > 1 ? ` Streak: ${streak}` : ''}` : `✗ It scores ${mv.score}.`),
        h('div.card.small', {}, ev.words.map((w) => h('div', {}, h('strong', {}, w.word), ` ${w.score}`)), mv.bingo ? h('div', {}, 'Bingo bonus 50') : null),
        h('button.btn.primary.big', { onclick: fresh }, 'Next'));
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });
    const btn = h('button.btn.primary', { onclick: check }, 'Check');
    body.replaceChildren(h('p.prompt', {}, `How many points is ${moveLabel(mv)}? (new tiles are highlighted)`), h('div.row', {}, input, btn), out);
  };
  root.append(pageHeader('Score It', '#/puzzles'), bv.el, body,
    h('p.tip', {}, h('strong', {}, 'Remember: '), 'premium squares only count the turn a tile is placed on them; a blank is worth 0; using all 7 tiles adds 50.'));
  fresh();
  return root;
}
