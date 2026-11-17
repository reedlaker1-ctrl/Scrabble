// Tile values, distribution and probability helpers (standard English set).

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const VALUES = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
  N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10, '?': 0,
};

export const DIST = {
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1, L: 4, M: 2,
  N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1, '?': 2,
};

export const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

export const alphagram = (w) => w.split('').sort().join('');

export function fullBag() {
  const bag = [];
  for (const [l, n] of Object.entries(DIST)) for (let i = 0; i < n; i++) bag.push(l);
  return shuffle(bag);
}

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const binom = (n, k) => {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
};

// Number of ways to draw this exact multiset from a full bag (ignoring blanks).
// Higher = more likely to show up on your rack. Used to order study lists.
export function combos(word) {
  const counts = {};
  for (const ch of word) counts[ch] = (counts[ch] || 0) + 1;
  let r = 1;
  for (const [ch, k] of Object.entries(counts)) r *= binom(DIST[ch] || 0, k);
  return r;
}

export const wordScore = (w) => [...w].reduce((s, c) => s + (VALUES[c] || 0), 0);

export function drawRack(n = 7, bag = fullBag()) {
  return bag.splice(0, n);
}
