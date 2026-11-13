// Play a full game against the computer, with move-by-move feedback.
import { h, toast, modal, segmented, pageHeader, tile } from '../ui.js';
import { createBoardView } from './boardview.js';
import { newBoard, evaluatePlacement, applyTiles, placementToMove, moveLabel, N } from '../board.js';
import { generateMoves, chooseMove, rackAfter, rankMoves } from '../movegen.js';
import { fullBag, shuffle, VALUES, DIST } from '../tiles.js';
import * as store from '../store.js';

const LEVELS = [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']];

function newGame(level) {
  const bag = fullBag();
  return {
    board: newBoard(), bag, racks: [bag.splice(0, 7), bag.splice(0, 7)], scores: [0, 0],
    turn: Math.random() < 0.5 ? 0 : 1, history: [], passes: 0, level, over: false,
    started: Date.now(), last: [], pcts: [], hints: 0, bingos: 0, feedback: null,
  };
}

export function playView() {
  const saved = store.S().game;
  if (saved && !saved.over) return gameScreen(saved);
  return startScreen();
}

function startScreen() {
  let level = store.settings().ai || 'medium';
  const games = store.S().games;
  const vs = (lv) => games.filter((g) => g.level === lv);
  return h('div.page', {},
    pageHeader('Play'),
    h('div.card', {},
      h('p', {}, 'A full game against the computer. After each of your moves you\'ll see how it ranked against every possible play.'),
      h('label.field', {}, h('span', {}, 'Opponent'), segmented(LEVELS, level, (v) => { level = v; store.setSetting('ai', v); })),
      h('ul.small.muted', {},
        h('li', {}, 'Easy: short words, middling scores.'),
        h('li', {}, 'Medium: takes the highest score each turn.'),
        h('li', {}, 'Hard: weighs score and the tiles it keeps, and exchanges bad racks.')),
      h('button.btn.primary.big', { onclick: () => { const g = newGame(level); store.saveGame(g); location.hash = '#/play?g=' + g.started; } }, 'New game')),
    games.length ? h('div.card', {}, h('h3', {}, 'Your record'),
      h('table.tbl', {}, h('tr', {}, h('th', {}, 'Level'), h('th', {}, 'W–L'), h('th', {}, 'Avg score'), h('th', {}, 'Move quality')),
        LEVELS.map(([lv, name]) => {
          const g = vs(lv);
          if (!g.length) return null;
          const w = g.filter((x) => x.won).length;
          const avg = Math.round(g.reduce((s, x) => s + x.me, 0) / g.length);
          const q = Math.round(g.reduce((s, x) => s + (x.avgPct || 0), 0) / g.length);
          return h('tr', {}, h('td', {}, name), h('td', {}, `${w}–${g.length - w}`), h('td', {}, avg), h('td', {}, `${q}%`));
        }))) : null);
}

function unseen(g) {
  const counts = { ...DIST };
  for (const t of g.board) if (t) counts[t.b ? '?' : t.l]--;
  for (const l of g.racks[0]) counts[l]--;
  return counts;
}

function gameScreen(g) {
  const root = h('div.page.play');
  const scoreEl = h('div.scoreboard');
  const feedbackEl = h('div.feedback', { role: 'status' });
  const playBtn = h('button.btn.primary', { onclick: () => humanPlay() }, 'Play');
  const bv = createBoardView({ onChange: () => updatePlayBtn() });
  const extra = h('div.extra');
  let busy = false;

  const actions = h('div.actions', {},
    h('button.btn', { onclick: () => bv.shuffle(), title: 'Shuffle' }, '⟳'),
    h('button.btn', { onclick: () => bv.recall(), title: 'Recall tiles' }, '↩'),
    h('button.btn', { onclick: () => exchange() }, 'Swap'),
    h('button.btn', { onclick: () => pass() }, 'Pass'),
    h('button.btn', { onclick: () => hint() }, 'Hint'),
    playBtn);

  const tools = h('div.row.wrap', {},
    h('button.btn.ghost.small', { onclick: () => { const z = bv.toggleZoom(); toast(z ? 'Zoomed in, scroll the board' : 'Zoomed out'); } }, '🔍 Zoom'),
    h('button.btn.ghost.small', { onclick: () => toggleExtra('log') }, 'Move log'),
    h('button.btn.ghost.small', { onclick: () => toggleExtra('unseen') }, 'Unseen tiles'),
    h('button.btn.ghost.small', { onclick: () => resign() }, 'Resign'));

  root.append(pageHeader('Play'), scoreEl, bv.el, bv.rackEl, actions, feedbackEl, tools, extra);

  let extraMode = null;
  function toggleExtra(mode) { extraMode = extraMode === mode ? null : mode; drawExtra(); }
  function drawExtra() {
    extra.replaceChildren();
    if (extraMode === 'log') {
      extra.append(h('div.card', {}, h('h3', {}, 'Moves'), g.history.length ? h('table.tbl.small', {},
        g.history.map((m) => h('tr', {}, h('td', {}, m.p === 0 ? 'You' : 'CPU'), h('td', {}, m.label), h('td.num', {}, m.score), h('td.num.muted', {}, m.total))))
        : h('p.muted', {}, 'No moves yet.')));
    } else if (extraMode === 'unseen') {
      const u = unseen(g);
      const letters = Object.keys(DIST).filter((l) => u[l] > 0);
      const total = letters.reduce((s, l) => s + u[l], 0);
      const vow = 'AEIOU'.split('').reduce((s, l) => s + (u[l] || 0), 0);
      extra.append(h('div.card', {}, h('h3', {}, `Unseen tiles (${total})`),
        h('p.small.muted', {}, 'Tiles in the bag plus your opponent\'s rack. Tracking these is how strong players plan the endgame.'),
        h('div.unseen', {}, letters.map((l) => h('span.u', {}, tile(l, { small: true }), u[l] > 1 ? h('b', {}, `×${u[l]}`) : null))),
        h('p.small', {}, `Vowels ${vow} · Consonants ${total - vow - (u['?'] || 0)}${u['?'] ? ` · Blanks ${u['?']}` : ''}`)));
    }
  }

  function drawScores() {
    const me = g.turn === 0 && !g.over;
    scoreEl.replaceChildren(
      h(`div.sc${me ? '.on' : ''}`, {}, h('span', {}, 'You'), h('b', {}, g.scores[0])),
      h('div.sc.mid', {}, h('span', {}, 'Bag'), h('b', {}, g.bag.length)),
      h(`div.sc${!me && !g.over ? '.on' : ''}`, {}, h('span', {}, `CPU · ${g.level}`), h('b', {}, g.scores[1])));
  }

  function drawFeedback() {
    feedbackEl.replaceChildren();
    const f = g.feedback;
    if (!f) return;
    if (f.cpu) feedbackEl.append(h('div', {}, h('span.muted', {}, 'CPU played '), h('strong', {}, f.cpu)));
    if (f.mine) {
      const cls = f.pct >= 100 ? 'good' : f.pct >= 75 ? 'ok' : 'bad';
      feedbackEl.append(h(`div.fb.${cls}`, {},
        f.pct >= 100 ? `⭐ ${f.mine} was the top-scoring play!` : `Your ${f.mine}: ranked #${f.rank} of ${f.of}. Top play: ${f.best}`));
    }
  }

  function updatePlayBtn() {
    const tiles = bv.placement();
    if (!tiles.length) { playBtn.textContent = 'Play'; playBtn.classList.remove('warn'); return; }
    const ev = evaluatePlacement(g.board, tiles);
    if (ev.score != null && ev.words?.length) {
      playBtn.textContent = `Play ${ev.score}`;
      playBtn.classList.toggle('warn', !ev.ok);
    } else { playBtn.textContent = 'Play'; playBtn.classList.add('warn'); }
  }

  function refresh() {
    bv.setBoard(g.board.slice());
    bv.setRack(g.racks[0].slice());
    bv.setHighlight(g.last);
    bv.lock(g.turn !== 0 || g.over || busy);
    drawScores(); drawFeedback(); drawExtra(); updatePlayBtn();
  }

  function draw(p) {
    const need = 7 - g.racks[p].length;
    g.racks[p].push(...g.bag.splice(0, need));
  }

  function endTurn(p, move, score) {
    g.scores[p] += score;
    g.history.push({ p, label: moveLabel(move), score, total: g.scores[p] });
    g.passes = score === 0 && move.type !== 'play' ? g.passes + 1 : 0;
    if (move.type === 'play' && g.racks[p].length === 0 && g.bag.length === 0) return finish(p);
    if (g.passes >= 6) return finish(-1);
    g.turn = 1 - p;
    store.saveGame(g);
    refresh();
    if (g.turn === 1) cpuTurn();
  }

  function humanPlay() {
    if (g.turn !== 0 || busy) return;
    const tiles = bv.placement();
    const ev = evaluatePlacement(g.board, tiles);
    if (!ev.ok) { toast(ev.error || 'Not a valid play'); return; }
    // Analyse against every possible move.
    const all = generateMoves(g.board, g.racks[0]).sort((a, b) => b.score - a.score);
    const move = placementToMove(ev, tiles);
    const rank = 1 + all.filter((m) => m.score > move.score).length;
    const best = all[0];
    const p = best ? Math.min(100, Math.round((move.score / best.score) * 100)) : 100;
    g.pcts.push(p);
    g.feedback = { mine: `${moveLabel(move)} (${move.score})`, rank, of: all.length, best: best ? `${moveLabel(best)} (${best.score})` : '', pct: p };
    if (move.bingo) g.bingos++;
    applyTiles(g.board, tiles);
    g.racks[0] = rackAfter(g.racks[0], tiles);
    draw(0);
    g.last = tiles.map((t) => t.r * N + t.c);
    endTurn(0, move, move.score);
  }

  function cpuTurn() {
    busy = true;
    bv.lock(true);
    feedbackEl.append(h('div.muted.small', {}, 'CPU is thinking…'));
    setTimeout(() => {
      const mv = chooseMove(g.board, g.racks[1], g.bag.length, g.level);
      busy = false;
      g.feedback = { ...(g.feedback || {}) };
      if (mv.type === 'play') {
        applyTiles(g.board, mv.tiles);
        g.racks[1] = rackAfter(g.racks[1], mv.tiles);
        draw(1);
        g.last = mv.tiles.map((t) => t.r * N + t.c);
        g.feedback.cpu = `${moveLabel(mv)} for ${mv.score}${mv.bingo ? ' — bingo!' : ''}`;
        endTurn(1, mv, mv.score);
      } else if (mv.type === 'exchange') {
        g.racks[1] = rackAfter(g.racks[1], mv.tiles.map((l) => ({ l, b: l === '?' })));
        draw(1);
        g.bag.push(...mv.tiles); shuffle(g.bag);
        g.feedback.cpu = `an exchange of ${mv.tiles.length} tile${mv.tiles.length > 1 ? 's' : ''}`;
        endTurn(1, mv, 0);
      } else {
        g.feedback.cpu = 'a pass';
        endTurn(1, mv, 0);
      }
    }, 450);
  }

  async function exchange() {
    if (g.turn !== 0 || busy) return;
    if (g.bag.length < 7) { toast('You can only swap when 7 or more tiles are in the bag.'); return; }
    bv.recall();
    const chosen = new Set();
    const grid = h('div.rack.sm-gap', {}, g.racks[0].map((l, i) => {
      const b = h('button.rtile', { onclick: () => { chosen.has(i) ? chosen.delete(i) : chosen.add(i); b.classList.toggle('sel'); } }, l === '?' ? '' : l, l !== '?' ? h('sub', {}, VALUES[l]) : null);
      if (l === '?') b.classList.add('blank');
      return b;
    }));
    const res = await modal('Swap which tiles?', h('div', {}, h('p.small.muted', {}, 'Tap the tiles to throw back. You score 0 this turn.'), grid), [{ label: 'Cancel', value: false }, { label: 'Swap', value: true, primary: true }]);
    if (!res || !chosen.size) return;
    const out = [...chosen].map((i) => g.racks[0][i]);
    g.racks[0] = g.racks[0].filter((_, i) => !chosen.has(i));
    draw(0);
    g.bag.push(...out); shuffle(g.bag);
    g.feedback = { mine: null };
    g.last = [];
    endTurn(0, { type: 'exchange', tiles: out }, 0);
  }

  async function pass() {
    if (g.turn !== 0 || busy) return;
    const ok = await modal('Pass this turn?', h('p', {}, 'You score nothing. Six scoreless turns in a row end the game.'), [{ label: 'Cancel', value: false }, { label: 'Pass', value: true, primary: true }]);
    if (!ok) return;
    bv.recall();
    g.feedback = { mine: null };
    endTurn(0, { type: 'pass' }, 0);
  }

  function hint() {
    if (g.turn !== 0 || busy) return;
    const moves = rankMoves(generateMoves(g.board, g.racks[0]), g.racks[0], g.bag.length);
    if (!moves.length) { toast('No plays available. Try swapping.'); return; }
    g.hints++;
    const m = moves[0];
    bv.recall();
    bv.showPreview(m.tiles);
    toast(`Try ${moveLabel(m)} for ${m.score}`, 3500);
    setTimeout(() => bv.showPreview(null), 3500);
  }

  async function resign() {
    if (g.over) return;
    const ok = await modal('Resign this game?', h('p', {}, 'It will count as a loss.'), [{ label: 'Cancel', value: false }, { label: 'Resign', value: true, primary: true }]);
    if (ok) finish(-2);
  }

  function finish(outPlayer) {
    g.over = true;
    const sum = (r) => r.reduce((s, l) => s + VALUES[l], 0);
    let note = '';
    if (outPlayer === 0 || outPlayer === 1) {
      const other = 1 - outPlayer;
      const v = sum(g.racks[other]);
      g.scores[outPlayer] += v; g.scores[other] -= v;
      note = `${outPlayer === 0 ? 'You' : 'CPU'} went out: +${v} from the other rack.`;
    } else if (outPlayer === -1) {
      g.scores[0] -= sum(g.racks[0]); g.scores[1] -= sum(g.racks[1]);
      note = 'Six scoreless turns: each side loses the value of its tiles.';
    }
    const won = outPlayer !== -2 && g.scores[0] > g.scores[1];
    const avgPct = g.pcts.length ? Math.round(g.pcts.reduce((a, b) => a + b, 0) / g.pcts.length) : 0;
    store.recordGame({ date: Date.now(), me: g.scores[0], cpu: g.scores[1], won, level: g.level, avgPct, bingos: g.bingos, hints: g.hints });
    store.saveGame(null);
    refresh();
    bv.lock(true);
    modal(won ? 'You won! 🎉' : outPlayer === -2 ? 'Resigned' : g.scores[0] === g.scores[1] ? 'A tie' : 'CPU wins',
      h('div', {},
        h('p', {}, h('strong', {}, `${g.scores[0]} – ${g.scores[1]}`)),
        note ? h('p.small.muted', {}, note) : null,
        h('p', {}, `Move quality: ${avgPct}% of the top score on average over ${g.pcts.length} moves.`),
        g.bingos ? h('p', {}, `Bingos: ${g.bingos}`) : null,
        h('p.small.muted', {}, 'Tip: replay the move log in your head. The gap between what you played and the top play is your study list.')),
      [{ label: 'Close' }, { label: 'New game', value: 'new', primary: true }]).then((v) => {
      if (v === 'new') { const ng = newGame(g.level); store.saveGame(ng); location.hash = '#/play?g=' + ng.started; }
    });
  }

  refresh();
  if (g.turn === 1 && !g.over) cpuTurn();
  return root;
}
