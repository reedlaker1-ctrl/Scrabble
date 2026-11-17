// Word list, trie and lookup helpers.
import { alphagram, combos, LETTERS } from './tiles.js';

export const D = {
  words: [],
  set: new Set(),
  ready: false,
  // trie as typed arrays (first-child / next-sibling)
  first: null, next: null, letter: null, term: null, nodes: 0,
};

let byAlpha = null; // Map alphagram -> [words]
const alphaListCache = new Map(); // len -> alphagrams sorted by probability
let stemCache = null;

export async function loadDict(url = 'words/words.txt') {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not load word list');
  initDict(await res.text());
}

export function initDict(text) {
  const words = text.split(/\r?\n/).filter(Boolean);
  words.sort();
  D.words = words;
  D.set = new Set(words);
  buildTrie(words);
  D.ready = true;
}

function buildTrie(words) {
  let cap = 1 << 19;
  let first = new Int32Array(cap).fill(-1);
  let next = new Int32Array(cap).fill(-1);
  let letter = new Uint8Array(cap);
  let term = new Uint8Array(cap);
  let last = new Int32Array(cap).fill(-1);
  let n = 1;
  const grow = () => {
    const nc = cap * 2;
    const g32 = (a) => { const b = new Int32Array(nc).fill(-1); b.set(a); return b; };
    const g8 = (a) => { const b = new Uint8Array(nc); b.set(a); return b; };
    first = g32(first); next = g32(next); last = g32(last);
    letter = g8(letter); term = g8(term);
    cap = nc;
  };
  for (const w of words) {
    let node = 0;
    for (let i = 0; i < w.length; i++) {
      const c = w.charCodeAt(i) - 65;
      const lc = last[node];
      if (lc >= 0 && letter[lc] === c) { node = lc; continue; }
      if (n >= cap) grow();
      const nn = n++;
      letter[nn] = c;
      if (lc >= 0) next[lc] = nn; else first[node] = nn;
      last[node] = nn;
      node = nn;
    }
    term[node] = 1;
  }
  D.first = first; D.next = next; D.letter = letter; D.term = term; D.nodes = n;
}

export function child(node, c) {
  for (let k = D.first[node]; k >= 0; k = D.next[k]) {
    const l = D.letter[k];
    if (l === c) return k;
    if (l > c) return -1;
  }
  return -1;
}

export const isWord = (w) => D.set.has(w.toUpperCase());

function ensureAlpha() {
  if (byAlpha) return;
  byAlpha = new Map();
  for (const w of D.words) {
    const a = alphagram(w);
    const arr = byAlpha.get(a);
    if (arr) arr.push(w); else byAlpha.set(a, [w]);
  }
}

export function anagramsOf(letters) {
  ensureAlpha();
  return byAlpha.get(alphagram(letters.toUpperCase())) || [];
}

// All words that use exactly the given letters, where '?' is a blank.
export function anagramsWithBlanks(letters) {
  const L = letters.toUpperCase();
  if (!L.includes('?')) return anagramsOf(L);
  return buildable(L, L.length, L.length);
}

// Words formable from rack (with '?' blanks) of length min..max.
export function buildable(rack, min = 2, max = 15) {
  const counts = new Int8Array(27);
  for (const ch of rack.toUpperCase()) {
    if (ch === '?') counts[26]++;
    else if (ch >= 'A' && ch <= 'Z') counts[ch.charCodeAt(0) - 65]++;
  }
  const out = [];
  const buf = [];
  const walk = (node) => {
    if (D.term[node] && buf.length >= min) out.push(buf.join(''));
    if (buf.length >= max) return;
    for (let k = D.first[node]; k >= 0; k = D.next[k]) {
      const c = D.letter[k];
      if (counts[c] > 0) {
        counts[c]--; buf.push(LETTERS[c]); walk(k); buf.pop(); counts[c]++;
      } else if (counts[26] > 0) {
        counts[26]--; buf.push(LETTERS[c]); walk(k); buf.pop(); counts[26]++;
      }
    }
  };
  walk(0);
  return [...new Set(out)];
}

export function frontHooks(w) {
  w = w.toUpperCase();
  return [...LETTERS].filter((c) => D.set.has(c + w));
}
export function backHooks(w) {
  w = w.toUpperCase();
  return [...LETTERS].filter((c) => D.set.has(w + c));
}

// Alphagrams of a given length, sorted most-probable first.
export function alphagramsByProbability(len) {
  if (alphaListCache.has(len)) return alphaListCache.get(len);
  ensureAlpha();
  const list = [];
  for (const [a, ws] of byAlpha) if (a.length === len) list.push({ a, words: ws, p: combos(a) });
  list.sort((x, y) => y.p - x.p || (x.a < y.a ? -1 : 1));
  list.forEach((x, i) => { x.rank = i + 1; });
  alphaListCache.set(len, list);
  return list;
}

export const wordsOfLength = (len) => D.words.filter((w) => w.length === len);

// Bingo stems: 6-letter combos that make 7-letter words with many different added letters.
export function stems() {
  if (stemCache) return stemCache;
  const sevens = alphagramsByProbability(7);
  const map = new Map();
  for (const { a, words } of sevens) {
    const seen = new Set();
    for (let i = 0; i < 7; i++) {
      const ch = a[i];
      if (seen.has(ch)) continue;
      seen.add(ch);
      const stem = a.slice(0, i) + a.slice(i + 1);
      let s = map.get(stem);
      if (!s) { s = { stem, adds: {} }; map.set(stem, s); }
      s.adds[ch] = words;
    }
  }
  stemCache = [...map.values()]
    .map((s) => ({ ...s, count: Object.keys(s.adds).length, p: combos(s.stem) }))
    .filter((s) => s.count >= 8)
    .sort((x, y) => y.count * Math.log(y.p + 1) - x.count * Math.log(x.p + 1));
  return stemCache;
}

export function matchPattern(pattern, limit = 500) {
  // . or ? = any single letter, * = any run of letters
  const re = new RegExp('^' + pattern.toUpperCase().replace(/[^A-Z.?*]/g, '').replace(/\?/g, '.').replace(/\*/g, '[A-Z]*') + '$');
  const out = [];
  for (const w of D.words) {
    if (re.test(w)) { out.push(w); if (out.length >= limit) break; }
  }
  return out;
}

// A plausible-looking non-word built from a real word (for "valid or phony" drills).
export function makePhony(word, tries = 40) {
  const V = 'AEIOU';
  const C = 'BCDFGHKLMNPRSTVWY';
  for (let t = 0; t < tries; t++) {
    const arr = word.split('');
    const mode = Math.random();
    if (mode < 0.55) {
      const i = (Math.random() * arr.length) | 0;
      const pool = V.includes(arr[i]) ? V : C;
      arr[i] = pool[(Math.random() * pool.length) | 0];
    } else if (mode < 0.8 && arr.length > 2) {
      const i = (Math.random() * (arr.length - 1)) | 0;
      [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    } else {
      const s = 'SEDRY';
      if (Math.random() < 0.5 && !word.endsWith('S')) arr.push(s[(Math.random() * s.length) | 0]);
      else arr.unshift('ABCDEMOPRSTU'[(Math.random() * 12) | 0]);
    }
    const p = arr.join('');
    if (p !== word && !D.set.has(p)) return p;
  }
  return null;
}
