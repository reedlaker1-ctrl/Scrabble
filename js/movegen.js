// Move generation (Appel & Jacobson anchor/cross-check algorithm on a trie).
import { D, child } from './dict.js';
import { N, CENTER, scoreTiles, placementToMove } from './board.js';
import { VALUES } from './tiles.js';
import { leaveValue } from './leave.js';

const ALL = (1 << 26) - 1;

export function generateMoves(board, rack) {
  const counts = new Int8Array(27);
  for (const ch of rack) counts[ch === '?' ? 26 : ch.charCodeAt(0) - 65]++;
  const out = [];
  const seen = new Set();
  const empty = board.every((x) => !x);

  for (const dir of ['A', 'D']) {
    // In "row" space: for across, row r col c; for down, transposed.
    const cell = dir === 'A' ? (r, c) => board[r * N + c] : (r, c) => board[c * N + r];
    const filled = (r, c) => r >= 0 && c >= 0 && r < N && c < N && !!cell(r, c);
    for (let r = 0; r < N; r++) {
      const cross = new Int32Array(N);
      const anchor = new Uint8Array(N);
      for (let c = 0; c < N; c++) {
        if (cell(r, c)) continue;
        const up = filled(r - 1, c), down = filled(r + 1, c);
        if (up || down) {
          let a = '', b = '';
          for (let k = r - 1; filled(k, c); k--) a = cell(k, c).l + a;
          for (let k = r + 1; filled(k, c); k++) b += cell(k, c).l;
          let mask = 0;
          for (let L = 0; L < 26; L++) if (D.set.has(a + String.fromCharCode(65 + L) + b)) mask |= 1 << L;
          cross[c] = mask;
          anchor[c] = 1;
        } else {
          cross[c] = ALL;
          if (empty) anchor[c] = r === CENTER && c === CENTER ? 1 : 0;
          else anchor[c] = filled(r, c - 1) || filled(r, c + 1) ? 1 : 0;
        }
      }

      const placed = []; // {c, L, b}
      const record = () => {
        const tiles = placed.map((p) => (dir === 'A' ? { r, c: p.c, l: p.L, b: p.b } : { r: p.c, c: r, l: p.L, b: p.b }));
        const key = tiles.map((t) => `${t.r},${t.c}${t.l}${t.b ? '?' : ''}`).sort().join('|');
        if (seen.has(key)) return;
        seen.add(key);
        // For a single tile the main word may run the other way; let scoring pick a sensible dir.
        let d = dir;
        if (tiles.length === 1) {
          const t = tiles[0];
          const horiz = (board[t.r * N + t.c - 1] && t.c > 0) || (t.c < N - 1 && board[t.r * N + t.c + 1]);
          d = horiz ? 'A' : 'D';
        }
        const res = scoreTiles(board, tiles, d);
        res.dir = d;
        out.push(placementToMove(res, tiles));
      };

      const extendRight = (node, c, anchorCol) => {
        if (c < N && cell(r, c)) {
          const k = child(node, cell(r, c).l.charCodeAt(0) - 65);
          if (k >= 0) extendRight(k, c + 1, anchorCol);
          return;
        }
        if (D.term[node] && c > anchorCol) record();
        if (c >= N) return;
        const mask = cross[c];
        for (let k = D.first[node]; k >= 0; k = D.next[k]) {
          const L = D.letter[k];
          if (!(mask & (1 << L))) continue;
          const ch = String.fromCharCode(65 + L);
          if (counts[L] > 0) {
            counts[L]--; placed.push({ c, L: ch, b: false });
            extendRight(k, c + 1, anchorCol);
            placed.pop(); counts[L]++;
          }
          if (counts[26] > 0) {
            counts[26]--; placed.push({ c, L: ch, b: true });
            extendRight(k, c + 1, anchorCol);
            placed.pop(); counts[26]++;
          }
        }
      };

      const leftPart = (node, limit, anchorCol, prefix) => {
        // prefix letters occupy anchorCol - prefix.length .. anchorCol - 1
        const base = placed.length;
        prefix.forEach((p, i) => placed.push({ c: anchorCol - prefix.length + i, L: p.L, b: p.b }));
        extendRight(node, anchorCol, anchorCol);
        placed.length = base;
        if (limit <= 0) return;
        for (let k = D.first[node]; k >= 0; k = D.next[k]) {
          const L = D.letter[k];
          const ch = String.fromCharCode(65 + L);
          if (counts[L] > 0) {
            counts[L]--; prefix.push({ L: ch, b: false });
            leftPart(k, limit - 1, anchorCol, prefix);
            prefix.pop(); counts[L]++;
          }
          if (counts[26] > 0) {
            counts[26]--; prefix.push({ L: ch, b: true });
            leftPart(k, limit - 1, anchorCol, prefix);
            prefix.pop(); counts[26]++;
          }
        }
      };

      for (let c = 0; c < N; c++) {
        if (!anchor[c]) continue;
        if (c > 0 && cell(r, c - 1)) {
          let k = c - 1;
          while (k >= 0 && cell(r, k)) k--;
          let node = 0;
          for (let j = k + 1; j < c && node >= 0; j++) node = child(node, cell(r, j).l.charCodeAt(0) - 65);
          if (node >= 0) extendRight(node, c, c);
        } else {
          let limit = 0;
          for (let k = c - 1; k >= 0 && !cell(r, k) && !anchor[k]; k--) limit++;
          leftPart(0, Math.min(limit, 6), c, []);
        }
      }
    }
  }
  return out;
}

export function rackAfter(rack, tiles) {
  const left = [...rack];
  for (const t of tiles) {
    const i = left.indexOf(t.b ? '?' : t.l);
    if (i >= 0) left.splice(i, 1);
  }
  return left;
}

// Rank moves by equity (score + value of tiles kept). Adds .leave and .equity.
export function rankMoves(moves, rack, bagCount = 50) {
  for (const m of moves) {
    m.leave = rackAfter(rack, m.tiles);
    m.equity = m.score + (bagCount > 0 ? leaveValue(m.leave) : -2 * m.leave.reduce((s, l) => s + VALUES[l], 0));
  }
  return moves.sort((a, b) => b.equity - a.equity || b.score - a.score);
}

// Best set of tiles to keep when exchanging.
export function bestExchange(rack) {
  let best = { keep: [], value: -Infinity };
  const n = rack.length;
  const seen = new Set();
  for (let mask = 0; mask < 1 << n; mask++) {
    const keep = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) keep.push(rack[i]);
    if (keep.length === n) continue;
    const key = keep.slice().sort().join('');
    if (seen.has(key)) continue;
    seen.add(key);
    const v = leaveValue(keep);
    if (v > best.value) best = { keep, value: v };
  }
  const throwAway = rackAfter(rack, best.keep.map((l) => ({ l, b: l === '?' })));
  return { ...best, exchange: throwAway };
}

// Choose a computer move. level: 'easy' | 'medium' | 'hard'
export function chooseMove(board, rack, bagCount, level = 'medium') {
  const moves = generateMoves(board, rack);
  const canExchange = bagCount >= 7;
  if (!moves.length) {
    if (canExchange) {
      const ex = level === 'easy' ? { exchange: rack.slice() } : bestExchange(rack);
      return { type: 'exchange', tiles: ex.exchange };
    }
    return { type: 'pass' };
  }
  if (level === 'easy') {
    const pool = moves.filter((m) => m.word.length <= 5).sort((a, b) => a.score - b.score);
    const use = pool.length ? pool : moves.sort((a, b) => a.score - b.score);
    const lo = Math.floor(use.length * 0.35), hi = Math.max(lo + 1, Math.floor(use.length * 0.7));
    return use[lo + Math.floor(Math.random() * (hi - lo))];
  }
  if (level === 'medium') {
    moves.sort((a, b) => b.score - a.score);
    // Slight randomness among near-best plays
    const top = moves.filter((m) => m.score >= moves[0].score - 3).slice(0, 4);
    return top[Math.floor(Math.random() * top.length)];
  }
  rankMoves(moves, rack, bagCount);
  const best = moves[0];
  if (canExchange) {
    const ex = bestExchange(rack);
    if (ex.value > best.equity + 2) return { type: 'exchange', tiles: ex.exchange };
  }
  return best;
}
