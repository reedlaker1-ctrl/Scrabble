// Persistence (localStorage), spaced-repetition cardbox and stats.
const KEY = 'rackwise.v1';
const DAY = 86400000;
// Leitner intervals in days for boxes 0..8
export const INTERVALS = [0, 1, 2, 4, 7, 14, 30, 60, 120];

const defaults = () => ({
  settings: { level: 'mixed', ai: 'medium', theme: 'auto', sessionSize: 20, order: 'probability' },
  cards: {},
  drills: {},
  days: {},
  games: [],
  puzzles: {},
  best: {},
  game: null,
});

let state;
try {
  state = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}'));
  state.settings = Object.assign(defaults().settings, state.settings);
} catch {
  state = defaults();
}

let saveTimer = null;
export function save(now = false) {
  clearTimeout(saveTimer);
  const go = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ } };
  if (now) go(); else saveTimer = setTimeout(go, 150);
}
export const S = () => state;
export const settings = () => state.settings;
export function setSetting(k, v) { state.settings[k] = v; save(); }

export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function bumpDay(n = 1) {
  const t = today();
  state.days[t] = (state.days[t] || 0) + n;
}

export function streak() {
  let n = 0;
  const d = new Date();
  if (!state.days[today(d)]) d.setDate(d.getDate() - 1);
  while (state.days[today(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ---- Cardbox ----
export const card = (id) => state.cards[id];
export function grade(id, correct, drillType) {
  const now = Date.now();
  const c = state.cards[id] || { b: 0, due: now, r: 0, w: 0 };
  if (correct) {
    c.b = Math.min(c.b + 1, INTERVALS.length - 1);
    c.r++;
  } else {
    c.b = 0;
    c.w++;
  }
  c.due = now + (c.b === 0 ? 10 * 60000 : INTERVALS[c.b] * DAY - 3600000);
  c.last = now;
  state.cards[id] = c;
  const d = (state.drills[drillType] ||= { r: 0, w: 0, sessions: 0 });
  if (correct) d.r++; else d.w++;
  bumpDay();
  save();
  return c;
}
export const isDue = (id, now = Date.now()) => !!state.cards[id] && state.cards[id].due <= now;
export const isKnown = (id) => (state.cards[id]?.b || 0) >= 2;
export function dueCards(prefix = '') {
  const now = Date.now();
  return Object.entries(state.cards).filter(([id, c]) => id.startsWith(prefix) && c.due <= now).map(([id]) => id);
}
export function boxCounts() {
  const counts = new Array(INTERVALS.length).fill(0);
  for (const c of Object.values(state.cards)) counts[c.b]++;
  return counts;
}
export function sessionDone(drillType) {
  const d = (state.drills[drillType] ||= { r: 0, w: 0, sessions: 0 });
  d.sessions++;
  save();
}

// ---- Puzzles / games ----
export function recordPuzzle(kind, pct) {
  const p = (state.puzzles[kind] ||= { n: 0, sum: 0, perfect: 0 });
  p.n++; p.sum += pct; if (pct >= 99.5) p.perfect++;
  bumpDay();
  save();
}
export function recordBest(kind, value) {
  if (!state.best[kind] || value > state.best[kind]) { state.best[kind] = value; save(); return true; }
  return false;
}
export function recordGame(g) {
  state.games.push(g);
  if (state.games.length > 200) state.games.shift();
  bumpDay();
  save();
}
export function saveGame(g) { state.game = g; save(); }

export function exportData() { return JSON.stringify(state); }
export function importData(json) {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object' || !parsed.cards) throw new Error('Not a Rackwise backup');
  state = Object.assign(defaults(), parsed);
  save(true);
}
export function resetAll() { state = defaults(); save(true); }
