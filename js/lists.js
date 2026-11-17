// Word lists used by drills and the Learn section.
import { D, alphagramsByProbability, stems, frontHooks, backHooks } from './dict.js';
import { alphagram, combos, VOWELS } from './tiles.js';
import { isKnown } from './store.js';

const cache = new Map();
const memo = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };

const byProb = (words) => words.slice().sort((a, b) => combos(b) - combos(a) || (a < b ? -1 : 1));

export const SPECIAL = {
  jqxz: { label: 'J, Q, X, Z words (2–4 letters)', words: () => memo('jqxz', () => byProb(D.words.filter((w) => w.length <= 4 && /[JQXZ]/.test(w)))) },
  qnou: { label: 'Q without U', words: () => memo('qnou', () => byProb(D.words.filter((w) => /Q(?!U)/.test(w) && w.length <= 8))) },
  vowel: { label: 'Vowel dumps (4–6 letters)', words: () => memo('vowel', () => byProb(D.words.filter((w) => w.length >= 4 && w.length <= 6 && [...w].filter((c) => VOWELS.has(c)).length >= w.length - 1))) },
  novowel: { label: 'No A/E/I/O/U words', words: () => memo('novowel', () => byProb(D.words.filter((w) => w.length >= 3 && w.length <= 7 && ![...w].some((c) => VOWELS.has(c))))) },
};

export const wordsOfLen = (n) => memo('len' + n, () => byProb(D.words.filter((w) => w.length === n)));

// Returns alphagram entries [{a, words}] for an anagram source.
export function anagramSource(src, range) {
  let list;
  if (SPECIAL[src]) {
    const map = new Map();
    for (const w of SPECIAL[src].words()) {
      const a = alphagram(w);
      if (!map.has(a)) map.set(a, { a, words: [] });
      map.get(a).words.push(w);
    }
    list = [...map.values()];
  } else list = alphagramsByProbability(+src);
  return range && range !== 'all' ? list.slice(0, +range) : list;
}

// Ordered study path. Each step knows how to launch a drill and how to measure progress.
export const STUDY_PATH = [
  { id: 'twos', title: 'Two-letter words', why: 'The single most useful list: they let you play parallel to other words for big points.', href: '#/drill/phony?len=2', items: () => wordsOfLen(2).map((w) => [`phony:${w}`, `anagram:${alphagram(w)}`]) },
  { id: 'jqxz', title: 'J, Q, X, Z short words', why: 'Turn your heaviest tiles into points instead of dead weight.', href: '#/drill/anagram?src=jqxz&range=all', items: () => SPECIAL.jqxz.words().map((w) => [`anagram:${alphagram(w)}`, `phony:${w}`]) },
  { id: 'qnou', title: 'Q without U', why: 'Stops the Q from wrecking your rack.', href: '#/drill/anagram?src=qnou&range=all', items: () => SPECIAL.qnou.words().filter((w) => w.length <= 6).map((w) => [`anagram:${alphagram(w)}`]) },
  { id: 'threes', title: 'Three-letter words', why: 'The next layer of board vision and the base of most hooks.', href: '#/drill/phony?len=3', items: () => wordsOfLen(3).map((w) => [`phony:${w}`, `anagram:${alphagram(w)}`]) },
  { id: 'hooks2', title: 'Hooks on two-letter words', why: 'Knowing which letters extend a word shows you more places to play.', href: '#/drill/hooks?len=2', items: () => wordsOfLen(2).filter((w) => frontHooks(w).length + backHooks(w).length).map((w) => [`hooks:${w}`]) },
  { id: 'stems', title: 'Top bingo stems', why: 'Six-letter sets like AEINST combine with most letters for a 50-point bingo.', href: '#/drill/stems?range=50', items: () => stems().slice(0, 50).map((s) => [`stem:${s.stem}`]) },
  { id: 'sevens', title: 'Top 500 seven-letter words', why: 'High-probability bingos come up again and again.', href: '#/drill/anagram?src=7&range=500', items: () => alphagramsByProbability(7).slice(0, 500).map((x) => [`anagram:${x.a}`, `bingo:${x.a}`]) },
  { id: 'eights', title: 'Top 500 eight-letter words', why: 'Bingos through a letter already on the board.', href: '#/drill/anagram?src=8&range=500', items: () => alphagramsByProbability(8).slice(0, 500).map((x) => [`anagram:${x.a}`]) },
];

export function stepProgress(step) {
  const items = step.items();
  const known = items.filter((ids) => ids.some((id) => isKnown(id))).length;
  return { known, total: items.length };
}
