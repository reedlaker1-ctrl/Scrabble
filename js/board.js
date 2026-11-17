// Board model, premium squares, placement validation and scoring.
import { VALUES } from './tiles.js';
import { D } from './dict.js';

export const N = 15;
export const CENTER = 7;

// T = triple word, D = double word, t = triple letter, d = double letter, * = start (double word)
const TOP = [
  'T..d...T...d..T',
  '.D...t...t...D.',
  '..D...d.d...D..',
  'd..D...d...D..d',
  '....D.....D....',
  '.t...t...t...t.',
  '..d...d.d...d..',
  'T..d...*...d..T',
];
const LAYOUT = [...TOP, ...TOP.slice(0, 7).reverse()];

export const premium = (r, c) => LAYOUT[r][c];
export const letterMult = (p) => (p === 't' ? 3 : p === 'd' ? 2 : 1);
export const wordMult = (p) => (p === 'T' ? 3 : p === 'D' || p === '*' ? 2 : 1);

export function newBoard() {
  return new Array(N * N).fill(null);
}
export const cloneBoard = (b) => b.slice();
export const at = (b, r, c) => (r < 0 || c < 0 || r >= N || c >= N ? null : b[r * N + c]);
export const isEmptyBoard = (b) => b.every((x) => !x);

export function applyTiles(b, tiles) {
  for (const t of tiles) b[t.r * N + t.c] = { l: t.l, b: !!t.b };
}

// Read the full word through (r,c) in direction (dr,dc), treating `placed` as on the board.
function readWord(b, placed, r, c, dr, dc) {
  const get = (rr, cc) => placed.get(rr * N + cc) || at(b, rr, cc);
  let sr = r, sc = c;
  while (get(sr - dr, sc - dc)) { sr -= dr; sc -= dc; }
  const squares = [];
  let rr = sr, cc = sc;
  while (rr < N && cc < N && get(rr, cc)) {
    const key = rr * N + cc;
    squares.push({ r: rr, c: cc, tile: get(rr, cc), isNew: placed.has(key) });
    rr += dr; cc += dc;
  }
  return squares;
}

function scoreSquares(squares) {
  let sum = 0, mult = 1;
  for (const s of squares) {
    const v = s.tile.b ? 0 : VALUES[s.tile.l];
    if (s.isNew) {
      const p = premium(s.r, s.c);
      sum += v * letterMult(p);
      mult *= wordMult(p);
    } else sum += v;
  }
  return sum * mult;
}

// Score a set of new tiles laid in direction dir ('A' across / 'D' down). No dictionary check.
export function scoreTiles(b, tiles, dir) {
  const placed = new Map(tiles.map((t) => [t.r * N + t.c, { l: t.l, b: !!t.b }]));
  const [dr, dc] = dir === 'A' ? [0, 1] : [1, 0];
  const words = [];
  const main = readWord(b, placed, tiles[0].r, tiles[0].c, dr, dc);
  if (main.length >= 2) words.push({ word: main.map((s) => s.tile.l).join(''), score: scoreSquares(main), main: true, squares: main });
  for (const t of tiles) {
    const cross = readWord(b, placed, t.r, t.c, dc, dr);
    if (cross.length >= 2) words.push({ word: cross.map((s) => s.tile.l).join(''), score: scoreSquares(cross), squares: cross });
  }
  let score = words.reduce((s, w) => s + w.score, 0);
  const bingo = tiles.length === 7;
  if (bingo) score += 50;
  return { score, words, bingo };
}

// Full validation of a human placement. Returns {ok, error, score, words, dir, invalid}
export function evaluatePlacement(b, tiles) {
  if (!tiles.length) return { ok: false, error: 'Place some tiles first.' };
  for (const t of tiles) if (at(b, t.r, t.c)) return { ok: false, error: 'Square already taken.' };
  const rows = new Set(tiles.map((t) => t.r));
  const cols = new Set(tiles.map((t) => t.c));
  if (rows.size > 1 && cols.size > 1) return { ok: false, error: 'Tiles must be in one row or column.' };
  const first = isEmptyBoard(b);
  const placed = new Map(tiles.map((t) => [t.r * N + t.c, t]));
  let dir;
  if (tiles.length > 1) dir = rows.size === 1 ? 'A' : 'D';
  else {
    const t = tiles[0];
    dir = at(b, t.r, t.c - 1) || at(b, t.r, t.c + 1) ? 'A' : 'D';
  }
  // contiguity
  const sorted = [...tiles].sort((x, y) => (dir === 'A' ? x.c - y.c : x.r - y.r));
  const a = sorted[0], z = sorted[sorted.length - 1];
  for (let i = dir === 'A' ? a.c : a.r; i <= (dir === 'A' ? z.c : z.r); i++) {
    const r = dir === 'A' ? a.r : i, c = dir === 'A' ? i : a.c;
    if (!placed.has(r * N + c) && !at(b, r, c)) return { ok: false, error: 'Tiles must form one unbroken word.' };
  }
  if (first) {
    if (!placed.has(CENTER * N + CENTER)) return { ok: false, error: 'The first word must cover the centre star.' };
    if (tiles.length < 2) return { ok: false, error: 'Words need at least two letters.' };
  } else {
    const touches = tiles.some((t) => at(b, t.r - 1, t.c) || at(b, t.r + 1, t.c) || at(b, t.r, t.c - 1) || at(b, t.r, t.c + 1));
    if (!touches) return { ok: false, error: 'Your word must connect to tiles on the board.' };
  }
  const res = scoreTiles(b, tiles, dir);
  if (!res.words.length) return { ok: false, error: 'Words need at least two letters.' };
  const invalid = res.words.filter((w) => !D.set.has(w.word)).map((w) => w.word);
  return { ok: invalid.length === 0, error: invalid.length ? `Not in word list: ${invalid.join(', ')}` : null, invalid, dir, ...res };
}

export function placementToMove(res, tiles) {
  const main = res.words.find((w) => w.main) || res.words[0];
  return {
    type: 'play', tiles, dir: res.dir, score: res.score, bingo: res.bingo,
    start: { r: main.squares[0].r, c: main.squares[0].c },
    word: main.squares.map((s) => (s.isNew && s.tile.b ? s.tile.l.toLowerCase() : s.tile.l)).join(''),
    words: res.words.map((w) => w.word),
  };
}

export const colName = (c) => String.fromCharCode(65 + c);

export function moveLabel(m) {
  if (!m) return '';
  if (m.type === 'exchange') return m.tiles?.length ? `Exchange ${m.tiles.length}` : 'Exchange';
  if (m.type === 'pass') return 'Pass';
  const coord = m.dir === 'A' ? `${m.start.r + 1}${colName(m.start.c)}` : `${colName(m.start.c)}${m.start.r + 1}`;
  return `${m.word} ${coord}`;
}
