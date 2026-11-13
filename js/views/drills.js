// Word-knowledge drills: quiz engine + question types.
import { h, tile, tiles, toast, segmented, select, pageHeader, pct } from '../ui.js';
import { D, anagramsOf, frontHooks, backHooks, makePhony, stems, buildable, alphagramsByProbability } from '../dict.js';
import { alphagram, shuffle, fullBag, wordScore } from '../tiles.js';
import * as store from '../store.js';
import { SPECIAL, anagramSource, wordsOfLen, STUDY_PATH, stepProgress } from '../lists.js';

export const DRILLS = [
  { id: 'anagram', title: 'Anagrams', icon: '🔀', desc: 'See the letters, find every word. Work through lists in probability order with a cardbox.' },
  { id: 'phony', title: 'Valid or Phony?', icon: '✅', desc: 'Judge whether a word is real. Builds the confidence to play, and to challenge.' },
  { id: 'hooks', title: 'Hooks', icon: '🪝', desc: 'Which letters can go in front of or behind a word?' },
  { id: 'stems', title: 'Bingo Stems', icon: '🌱', desc: 'Which letters turn AEINST-style stems into 7-letter bingos?' },
  { id: 'bingo', title: 'Bingo Hunt', icon: '🎯', desc: 'A real rack: is there a 7-letter word in it? Find it or call "no bingo".' },
  { id: 'builder', title: 'Word Builder', icon: '⏱️', desc: 'Timed: find as many words as you can in one rack.' },
];

// ---------- Drill hub ----------
export function drillsHub() {
  const due = store.dueCards().length;
  return h('div.page', {},
    pageHeader('Drills'),
    due ? h('a.card.cta', { href: '#/review' }, h('div', {}, h('strong', {}, `Review ${due} due card${due === 1 ? '' : 's'}`), h('p.muted', {}, 'Spaced repetition: missed words come back sooner, known words later.')), h('span.chev', {}, '›')) : null,
    h('h2', {}, 'Study path'),
    h('p.muted', {}, 'A suggested order used by coaches: short words first, then the high-probability bingos.'),
    h('div.list', {}, STUDY_PATH.map((s, i) => {
      const p = stepProgress(s);
      return h('a.card.step', { href: s.href },
        h('div.step-num', {}, i + 1),
        h('div.grow', {}, h('strong', {}, s.title), h('p.muted.small', {}, s.why),
          h('div.bar', { title: `${p.known} of ${p.total} learned` }, h('span', { style: { width: `${pct(p.known, p.total)}%` } })),
          h('p.small.muted', {}, `${p.known} / ${p.total} learned`)),
        h('span.chev', {}, '›'));
    })),
    h('h2', {}, 'All drills'),
    h('div.grid2', {}, DRILLS.map((d) => h('a.card.drill', { href: `#/drill/${d.id}` },
      h('div.icon', { 'aria-hidden': 'true' }, d.icon), h('strong', {}, d.title), h('p.muted.small', {}, d.desc)))));
}

// ---------- Setup screens ----------
const LEN_OPTS = [2, 3, 4, 5, 6, 7, 8].map((n) => [String(n), `${n}s`]);
const RANGE_OPTS = [['100', 'Top 100'], ['500', 'Top 500'], ['1000', 'Top 1000'], ['3000', 'Top 3000'], ['all', 'All']];

export function drillSetup(id, params) {
  const d = DRILLS.find((x) => x.id === id);
  if (!d) return h('div.page', {}, pageHeader('Not found', '#/drills'));
  if (id === 'builder') return wordBuilder();
  const set = store.settings();
  const level = set.level;
  const opts = {
    src: params.get('src') || (level === 'beginner' ? '3' : level === 'advanced' ? '7' : '7'),
    range: params.get('range') || (level === 'advanced' ? '1000' : '100'),
    len: params.get('len') || (level === 'advanced' ? '4' : '2'),
    size: String(set.sessionSize || 20),
    order: set.order || 'probability',
  };
  const form = h('div.stack');
  const row = (label, ctl) => h('label.field', {}, h('span', {}, label), ctl);
  if (id === 'anagram') {
    form.append(
      row('Word list', select([...LEN_OPTS.map(([v, l]) => [v, `${l.replace('s', '')}-letter words`]), ...Object.entries(SPECIAL).map(([k, v]) => [k, v.label])], opts.src, (v) => { opts.src = v; })),
      row('How many', select(RANGE_OPTS, opts.range, (v) => { opts.range = v; })),
      row('Order', segmented([['probability', 'Most likely first'], ['random', 'Random']], opts.order, (v) => { opts.order = v; store.setSetting('order', v); })));
  } else if (id === 'phony' || id === 'hooks') {
    form.append(
      row('Word length', segmented(LEN_OPTS.slice(0, id === 'hooks' ? 5 : 7), opts.len, (v) => { opts.len = v; })),
      row('Pool', select(RANGE_OPTS, opts.range === '100' && +opts.len <= 3 ? 'all' : opts.range, (v) => { opts.range = v; })));
    if (+opts.len <= 3) opts.range = 'all';
  } else if (id === 'stems') {
    form.append(row('Stems', select([['10', 'Top 10'], ['50', 'Top 50'], ['100', 'Top 100'], ['all', 'All']], params.get('range') || '10', (v) => { opts.range = v; })));
    opts.range = params.get('range') || '10';
  } else if (id === 'bingo') {
    form.append(row('Racks', select([['mixed', 'Real draws (some have no bingo)'], ['bingo', 'Always has a bingo']], 'mixed', (v) => { opts.mode = v; })));
    opts.mode = 'mixed';
  }
  form.append(row('Questions', segmented([['10', '10'], ['20', '20'], ['50', '50']], opts.size, (v) => { opts.size = v; store.setSetting('sessionSize', +v); })));
  const root = h('div.page', {},
    pageHeader(d.title, '#/drills'),
    h('p.muted', {}, d.desc),
    h('div.card', {}, form),
    h('button.btn.primary.big', { onclick: () => {
      const qs = buildQuestions(id, opts);
      if (!qs.length) { toast('Nothing to study in that list.'); return; }
      root.replaceWith(runSession({ title: d.title, questions: qs, drillType: id, back: `#/drill/${id}` }));
    } }, 'Start'),
    tipsFor(id));
  return root;
}

function tipsFor(id) {
  const tips = {
    anagram: 'Say the letters out loud, then try common endings: -ING, -ED, -ER, -IER, -IEST, and prefixes like RE-, UN-, OUT-.',
    phony: 'Phonies often look "almost right". When unsure in a real game, an unchallenged phony can still score, but know the risk.',
    hooks: 'Front hooks are harder to spot than back hooks. S, D, R, Y, E and A are the most common back hooks.',
    stems: 'Memorise which letters DON\'T work with a stem: it is usually the shorter list.',
    bingo: 'Look for common suffixes first (-ING, -ERS, -IEST), then put the leftover letters in front.',
  };
  return tips[id] ? h('p.tip', {}, h('strong', {}, 'Tip: '), tips[id]) : null;
}

// ---------- Question building ----------
function pickByCardbox(entries, idOf, size, order) {
  const now = Date.now();
  const due = [], fresh = [], rest = [];
  for (const e of entries) {
    const c = store.card(idOf(e));
    if (!c) fresh.push(e); else if (c.due <= now) due.push(e); else rest.push(e);
  }
  if (order === 'random') shuffle(fresh);
  shuffle(due);
  rest.sort((a, b) => store.card(idOf(a)).due - store.card(idOf(b)).due);
  return [...due, ...fresh, ...rest].slice(0, size);
}

export function buildQuestions(id, opts) {
  const size = +opts.size || 20;
  if (id === 'anagram') {
    const list = anagramSource(opts.src, opts.range);
    return shuffle(pickByCardbox(list, (x) => `anagram:${x.a}`, size, opts.order)).map((x) => anagramQ(x.a));
  }
  if (id === 'phony') {
    let words = wordsOfLen(+opts.len);
    if (opts.range && opts.range !== 'all') words = words.slice(0, +opts.range);
    const half = Math.ceil(size / 2);
    const valid = pickByCardbox(words, (w) => `phony:${w}`, half, 'random');
    const qs = valid.map(phonyQ);
    let guard = 0;
    while (qs.length < size && guard++ < 500) {
      const src = words[(Math.random() * words.length) | 0];
      const p = +opts.len === 2 ? randomTwo() : makePhony(src);
      if (p && p.length === +opts.len && !qs.some((q) => q.word === p)) qs.push(phonyQ(p));
    }
    return shuffle(qs);
  }
  if (id === 'hooks') {
    let words = wordsOfLen(+opts.len);
    if (opts.range && opts.range !== 'all') words = words.slice(0, +opts.range);
    return shuffle(pickByCardbox(words, (w) => `hooks:${w}`, size, 'random')).map(hooksQ);
  }
  if (id === 'stems') {
    const all = stems();
    const list = opts.range === 'all' ? all : all.slice(0, +opts.range);
    return shuffle(pickByCardbox(list, (s) => `stem:${s.stem}`, size, 'probability')).map((s) => stemQ(s.stem));
  }
  if (id === 'bingo') {
    const top = alphagramsByProbability(7).slice(0, 3000);
    const qs = [];
    const due = pickByCardbox(top.filter((x) => store.card(`bingo:${x.a}`)), (x) => `bingo:${x.a}`, Math.ceil(size / 3), 'random');
    for (const x of due) if (store.isDue(`bingo:${x.a}`)) qs.push(bingoQ(x.a.split('')));
    while (qs.length < size) {
      if (opts.mode === 'bingo' || Math.random() < 0.45) {
        const x = top[(Math.random() * top.length) | 0];
        qs.push(bingoQ(shuffle(x.a.split(''))));
      } else {
        qs.push(bingoQ(fullBag().filter((l) => l !== '?').slice(0, 7)));
      }
    }
    return shuffle(qs);
  }
  return [];
}

function randomTwo() {
  const L = 'ABCDEFGHIJKLMNOPRSTUWY';
  for (let i = 0; i < 50; i++) {
    const w = L[(Math.random() * L.length) | 0] + 'AEIOUAEIOUBDHMNST'[(Math.random() * 17) | 0];
    if (!D.set.has(w)) return Math.random() < 0.5 ? w : w[1] + w[0];
  }
  return 'IA';
}

export const anagramQ = (a) => ({ type: 'anagram', id: `anagram:${a}`, letters: a, answers: anagramsOf(a) });
export const phonyQ = (w) => ({ type: 'phony', id: `phony:${w}`, word: w, valid: D.set.has(w) });
export const hooksQ = (w) => ({ type: 'hooks', id: `hooks:${w}`, word: w, front: frontHooks(w), back: backHooks(w) });
export function stemQ(stem) {
  const s = stems().find((x) => x.stem === stem);
  return { type: 'stem', id: `stem:${stem}`, stem, adds: s ? s.adds : {} };
}
export function bingoQ(rack) {
  const a = alphagram(rack.join(''));
  const answers = anagramsOf(a);
  return { type: 'bingo', id: answers.length ? `bingo:${a}` : null, rack, answers };
}

export function questionFromId(id) {
  const [type, key] = id.split(':');
  if (type === 'anagram') return anagramQ(key);
  if (type === 'phony') return phonyQ(key);
  if (type === 'hooks') return hooksQ(key);
  if (type === 'stem') return stemQ(key);
  if (type === 'bingo') return bingoQ(shuffle(key.split('')));
  return null;
}

// ---------- Session engine ----------
export function runSession({ title, questions, drillType, back = '#/drills' }) {
  let i = 0;
  const results = [];
  const requeued = new Set();
  const root = h('div.page.session');
  const progress = h('div.bar.thin', {}, h('span'));
  const counter = h('span.muted');
  const body = h('div.qbody');
  root.append(pageHeader(title, back), h('div.row.between', {}, counter, h('span.muted', { id: 'score' })), progress, body);

  const show = () => {
    if (i >= questions.length) return finish();
    const q = questions[i];
    counter.textContent = `Question ${i + 1} of ${questions.length}`;
    progress.firstChild.style.width = `${pct(i, questions.length)}%`;
    const right = results.filter((r) => r.correct).length;
    root.querySelector('#score').textContent = results.length ? `${right}/${results.length} correct` : '';
    let verdict = null;
    const footer = h('div.qfoot');
    const onAnswer = (correct) => {
      verdict = correct;
      const box = q.id ? store.card(q.id)?.b ?? 0 : null;
      const msg = h(`div.verdict.${correct ? 'good' : 'bad'}`, { role: 'status' }, correct ? '✓ Correct' : '✗ Not quite');
      const override = !correct ? h('button.link', { onclick: () => { verdict = true; msg.className = 'verdict good'; msg.textContent = '✓ Counted as correct'; override.remove(); } }, 'I knew it (typo)') : null;
      footer.replaceChildren(msg, override || '', h('button.btn.primary', { onclick: next, id: 'next-btn' }, i + 1 < questions.length ? 'Next ›' : 'Finish'));
      if (box != null) footer.prepend(h('span.small.muted', {}, store.card(q.id) ? `Cardbox ${box}` : 'New card'));
      setTimeout(() => footer.querySelector('#next-btn')?.focus(), 30);
    };
    const next = () => {
      if (q.id) store.grade(q.id, verdict, q.type === 'bingo' ? 'bingo' : drillType === 'review' || drillType === 'mix' ? q.type : drillType);
      results.push({ q, correct: verdict });
      if (!verdict && !requeued.has(q) && questions.length < 200) { requeued.add(q); questions.push(q); }
      i++;
      show();
    };
    body.replaceChildren(RENDER[q.type](q, onAnswer), footer);
    body.querySelector('input')?.focus();
  };

  const finish = () => {
    store.sessionDone(drillType);
    const firstTry = new Map();
    for (const r of results) if (!firstTry.has(r.q)) firstTry.set(r.q, r.correct);
    const right = [...firstTry.values()].filter(Boolean).length;
    const missed = [...firstTry.entries()].filter(([, c]) => !c).map(([q]) => q);
    progress.firstChild.style.width = '100%';
    counter.textContent = 'Session complete';
    root.querySelector('#score').textContent = '';
    body.replaceChildren(
      h('div.card.center', {},
        h('div.big-num', {}, `${pct(right, firstTry.size)}%`),
        h('p', {}, `${right} of ${firstTry.size} right first time`),
        h('p.muted.small', {}, `Streak: ${store.streak()} day${store.streak() === 1 ? '' : 's'}`)),
      missed.length ? h('div.card', {}, h('h3', {}, 'Review these'), h('div.missed', {}, missed.map(summarize))) : h('p.center', {}, 'Perfect round! 🎉'),
      h('div.row', {},
        h('a.btn', { href: back }, 'Done'),
        h('button.btn.primary', { onclick: () => { location.hash = back + (back.includes('?') ? '&' : '?') + 'r=' + Date.now(); } }, 'New session')));
  };

  show();
  return root;
}

function summarize(q) {
  if (q.type === 'anagram') return h('div.mrow', {}, tiles(q.letters, { small: true }), ' → ', h('strong', {}, q.answers.join(', ')));
  if (q.type === 'phony') return h('div.mrow', {}, h('strong', {}, q.word), q.valid ? ' is valid' : ' is a phony');
  if (q.type === 'hooks') return h('div.mrow', {}, h('strong', {}, `${q.front.join('').toLowerCase() || '–'} ${q.word} ${q.back.join('').toLowerCase() || '–'}`));
  if (q.type === 'stem') return h('div.mrow', {}, h('strong', {}, q.stem), ' + ', Object.keys(q.adds).join(''));
  if (q.type === 'bingo') return h('div.mrow', {}, tiles(q.rack.join(''), { small: true }), ' → ', h('strong', {}, q.answers.join(', ') || 'no bingo'));
  return '';
}

// ---------- Question renderers ----------
const norm = (s) => s.toUpperCase().replace(/[^A-Z]/g, '');
const lettersSet = (s) => [...new Set(norm(s).split(''))].sort().join('');

const wordChip = (w, cls = '') => h(`span.chip${cls ? '.' + cls : ''}`, {}, w);

function hookLine(w) {
  const f = frontHooks(w), b = backHooks(w);
  return h('span.hookline', {}, h('span.hk', {}, f.join('').toLowerCase()), h('strong', {}, w), h('span.hk', {}, b.join('').toLowerCase()));
}

const RENDER = {
  anagram(q, onAnswer) {
    const found = new Set();
    let wrong = 0, done = false;
    const chips = h('div.chips');
    const input = h('input.answer', { type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'Type a word, press Enter', enterkeyhint: 'enter', 'aria-label': 'Answer' });
    const reveal = () => {
      if (done) return;
      done = true;
      input.disabled = true;
      chips.replaceChildren(...q.answers.map((w) => h('div.ans', {}, wordChip(w, found.has(w) ? 'good' : 'missed'), hookLine(w))));
      onAnswer(found.size === q.answers.length && wrong === 0);
      controls.remove();
    };
    const submit = () => {
      const w = norm(input.value);
      input.value = '';
      if (!w) { reveal(); return; }
      if (found.has(w)) return;
      if (q.answers.includes(w)) { found.add(w); chips.append(wordChip(w, 'good')); }
      else { wrong++; chips.append(wordChip(w, 'bad')); }
      if (found.size === q.answers.length) reveal();
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    const controls = h('div.row', {}, h('button.btn', { onclick: submit }, 'Add'), h('button.btn.ghost', { onclick: reveal }, 'Show answers'));
    const rack = h('div.rack-show', {}, [...q.letters].map((l) => tile(l)));
    return h('div.q', {},
      h('p.prompt', {}, `Find ${q.answers.length === 1 ? 'the word' : `all ${q.answers.length} words`}`),
      rack,
      h('button.link.small', { onclick: () => rack.replaceChildren(...shuffle([...q.letters]).map((l) => tile(l))) }, '⟳ Shuffle tiles'),
      input, controls, chips);
  },

  phony(q, onAnswer) {
    const out = h('div.reveal');
    const answer = (saysValid) => {
      btns.remove();
      const ok = saysValid === q.valid;
      const ana = anagramsOf(q.word).filter((w) => w !== q.word);
      out.append(h('p', {}, h('strong', {}, q.word), q.valid ? ' is a valid word.' : ' is not in the word list.'),
        q.valid ? h('p.small', {}, 'Hooks: ', hookLine(q.word)) : null,
        ana.length ? h('p.small.muted', {}, `${q.valid ? 'Also' : 'Real'} anagram${ana.length > 1 ? 's' : ''}: ${ana.join(', ')}`) : null);
      onAnswer(ok);
    };
    const btns = h('div.row.center', {}, h('button.btn.big.good', { onclick: () => answer(true) }, 'Valid'), h('button.btn.big.bad', { onclick: () => answer(false) }, 'Phony'));
    return h('div.q', {}, h('p.prompt', {}, 'Is this a word?'), h('div.rack-show', {}, [...q.word].map((l) => tile(l))), btns, out);
  },

  hooks(q, onAnswer) {
    const fi = h('input.hook-in', { type: 'text', autocapitalize: 'characters', autocomplete: 'off', placeholder: 'front', 'aria-label': 'Front hooks' });
    const bi = h('input.hook-in', { type: 'text', autocapitalize: 'characters', autocomplete: 'off', placeholder: 'back', 'aria-label': 'Back hooks' });
    const out = h('div.reveal');
    const check = () => {
      fi.disabled = bi.disabled = true;
      btn.remove();
      const gf = lettersSet(fi.value), gb = lettersSet(bi.value);
      const okF = gf === q.front.join('');
      const okB = gb === q.back.join('');
      const wrong = (given, real, mk) => [...given].filter((c) => !real.includes(c)).map((c) => wordChip(mk(c), 'bad'));
      out.append(
        h('div.chips', {}, h('span.muted', {}, 'Front: '), q.front.length ? q.front.map((c) => wordChip(c + q.word, gf.includes(c) ? 'good' : 'missed')) : 'none', wrong(gf, q.front, (c) => c + q.word)),
        h('div.chips', {}, h('span.muted', {}, 'Back: '), q.back.length ? q.back.map((c) => wordChip(q.word + c, gb.includes(c) ? 'good' : 'missed')) : 'none', wrong(gb, q.back, (c) => q.word + c)));
      onAnswer(okF && okB);
    };
    [fi, bi].forEach((x) => x.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (x === fi) bi.focus(); else check(); } }));
    const btn = h('button.btn.primary', { onclick: check }, 'Check');
    return h('div.q', {}, h('p.prompt', {}, 'Type every letter that hooks on. Leave blank for none.'),
      h('div.hook-row', {}, fi, h('div.rack-show', {}, [...q.word].map((l) => tile(l))), bi), btn, out);
  },

  stem(q, onAnswer) {
    const input = h('input.answer', { type: 'text', autocapitalize: 'characters', autocomplete: 'off', placeholder: 'Letters that make a bingo, e.g. BCD…', 'aria-label': 'Letters' });
    const out = h('div.reveal');
    const correct = Object.keys(q.adds).sort().join('');
    const check = () => {
      input.disabled = true;
      btn.remove();
      const given = new Set(lettersSet(input.value));
      out.append(h('div.stem-table', {}, Object.keys(q.adds).sort().map((l) =>
        h('div.mrow', {}, wordChip('+' + l, given.has(l) ? 'good' : 'missed'), ' ', q.adds[l].join(', ')))),
      [...given].filter((l) => !q.adds[l]).length ? h('p.small.bad-text', {}, `No bingo with: ${[...given].filter((l) => !q.adds[l]).join(' ')}`) : null);
      onAnswer(lettersSet(input.value) === correct);
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
    const btn = h('button.btn.primary', { onclick: check }, 'Check');
    return h('div.q', {}, h('p.prompt', {}, `Which letters make a 7-letter word? (${correct.length} do)`),
      h('div.rack-show', {}, [...q.stem].map((l) => tile(l)), tile('?', { cls: 'ghost' })), input, btn, out);
  },

  bingo(q, onAnswer) {
    const input = h('input.answer', { type: 'text', autocapitalize: 'characters', autocomplete: 'off', placeholder: 'Type the bingo…', 'aria-label': 'Bingo' });
    const out = h('div.reveal');
    let done = false;
    const end = (ok, said) => {
      if (done) return;
      done = true;
      input.disabled = true;
      ctl.remove();
      out.append(said ? h('p', {}, said) : null, q.answers.length
        ? h('p', {}, 'Bingo: ', q.answers.map((w) => wordChip(w, 'good')))
        : h('p', {}, 'No 7-letter word in this rack.'));
      onAnswer(ok);
    };
    const tryWord = () => {
      const w = norm(input.value);
      if (!w) return;
      if (q.answers.includes(w)) end(true);
      else { input.value = ''; input.classList.add('shake'); setTimeout(() => input.classList.remove('shake'), 400); toast(`${w} isn't it`); }
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); tryWord(); } });
    const rack = h('div.rack-show', {}, q.rack.map((l) => tile(l)));
    const ctl = h('div.row', {},
      h('button.btn.primary', { onclick: tryWord }, 'Check'),
      h('button.btn', { onclick: () => end(q.answers.length === 0, q.answers.length ? 'There was one!' : null) }, 'No bingo'),
      h('button.btn.ghost', { onclick: () => end(false) }, 'Show'));
    return h('div.q', {}, h('p.prompt', {}, 'Is there a 7-letter word here?'), rack,
      h('button.link.small', { onclick: () => rack.replaceChildren(...shuffle([...q.rack]).map((l) => tile(l))) }, '⟳ Shuffle tiles'),
      input, ctl, out);
  },
};

// ---------- Review & daily mix ----------
export function reviewView() {
  const ids = shuffle(store.dueCards()).slice(0, 50);
  if (!ids.length) {
    return h('div.page', {}, pageHeader('Review', '#/'), h('div.card.center', {}, h('p', {}, 'Nothing due right now. 🎉'), h('a.btn.primary', { href: '#/drills' }, 'Learn new words')));
  }
  return runSession({ title: 'Cardbox review', questions: ids.map(questionFromId).filter(Boolean), drillType: 'review', back: '#/' });
}

export function dailyMix() {
  const level = store.settings().level;
  const due = shuffle(store.dueCards()).slice(0, 8).map(questionFromId).filter(Boolean);
  const plan = level === 'beginner'
    ? [['phony', { len: '2', size: 4, range: 'all' }], ['phony', { len: '3', size: 4, range: 'all' }], ['hooks', { len: '2', size: 3, range: 'all' }], ['anagram', { src: 'jqxz', range: 'all', size: 3 }], ['anagram', { src: '5', range: '500', size: 2 }]]
    : level === 'advanced'
      ? [['anagram', { src: '7', range: '3000', size: 4 }], ['anagram', { src: '8', range: '3000', size: 3 }], ['stems', { range: '100', size: 2 }], ['hooks', { len: '4', size: 3, range: '1000' }], ['phony', { len: '7', size: 3, range: '3000' }], ['bingo', { mode: 'mixed', size: 3 }]]
      : [['phony', { len: '3', size: 3, range: 'all' }], ['hooks', { len: '3', size: 3, range: 'all' }], ['anagram', { src: '6', range: '500', size: 3 }], ['anagram', { src: '7', range: '500', size: 3 }], ['stems', { range: '50', size: 1 }], ['bingo', { mode: 'mixed', size: 3 }]];
  const qs = [...due];
  for (const [id, o] of plan) qs.push(...buildQuestions(id, { order: 'probability', ...o }));
  const seen = new Set();
  return runSession({ title: 'Daily mix', questions: qs.filter((q) => { const k = q.id || Math.random(); if (seen.has(k)) return false; seen.add(k); return true; }), drillType: 'mix', back: '#/' });
}

// ---------- Word builder (timed) ----------
function wordBuilder() {
  const root = h('div.page', {}, pageHeader('Word Builder', '#/drills'));
  let seconds = 90;
  const start = h('div.card', {},
    h('p', {}, 'You get a rack. Find as many words (3+ letters) as you can before time runs out. Longer words score more.'),
    h('label.field', {}, h('span', {}, 'Time'), segmented([['60', '1 min'], ['90', '90 s'], ['180', '3 min']], '90', (v) => { seconds = +v; })),
    h('button.btn.primary.big', { onclick: () => play() }, 'Start'),
    store.S().best.builder ? h('p.small.muted', {}, `Best: ${store.S().best.builder} points`) : null);
  root.append(start);

  const play = () => {
    const top = alphagramsByProbability(7).slice(0, 2000);
    const rackLetters = shuffle(top[(Math.random() * top.length) | 0].a.split(''));
    const answers = buildable(rackLetters.join(''), 3, 7).sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
    const found = new Set();
    let points = 0, left = seconds;
    const timer = h('div.timer', {}, `${left}s`);
    const scoreEl = h('div.timer', {}, '0 pts');
    const chips = h('div.chips');
    const input = h('input.answer', { type: 'text', autocapitalize: 'characters', autocomplete: 'off', placeholder: 'Type a word, Enter', 'aria-label': 'Word' });
    const rack = h('div.rack-show', {}, rackLetters.map((l) => tile(l)));
    const ptsFor = (w) => wordScore(w) + (w.length >= 7 ? 50 : 0) + (w.length - 2) * 2;
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const w = norm(input.value);
      input.value = '';
      if (!w) return;
      if (found.has(w)) { toast('Already found'); return; }
      if (answers.includes(w)) { found.add(w); points += ptsFor(w); scoreEl.textContent = `${points} pts`; chips.prepend(wordChip(w, 'good')); }
      else { input.classList.add('shake'); setTimeout(() => input.classList.remove('shake'), 400); }
    });
    const iv = setInterval(() => {
      left--;
      timer.textContent = `${left}s`;
      if (left <= 10) timer.classList.add('warn');
      if (left <= 0 || !document.body.contains(root)) { clearInterval(iv); end(); }
    }, 1000);
    const end = () => {
      if (!document.body.contains(root)) return;
      const isBest = store.recordBest('builder', points);
      store.recordPuzzle('builder', pct(found.size, answers.length));
      root.replaceChildren(pageHeader('Word Builder', '#/drills'),
        h('div.card.center', {}, h('div.big-num', {}, `${points}`), h('p', {}, `points · ${found.size} of ${answers.length} words`), isBest ? h('p', {}, '🏆 New best!') : null),
        h('div.card', {}, h('h3', {}, 'All words'), h('div.chips', {}, answers.map((w) => wordChip(w, found.has(w) ? 'good' : 'missed')))),
        h('div.row', {}, h('a.btn', { href: '#/drills' }, 'Done'), h('button.btn.primary', { onclick: () => { root.replaceChildren(pageHeader('Word Builder', '#/drills'), start); } }, 'Play again')));
    };
    root.replaceChildren(pageHeader('Word Builder', '#/drills'),
      h('div.row.between', {}, timer, scoreEl), rack,
      h('button.link.small', { onclick: () => rack.replaceChildren(...shuffle(rackLetters).map((l) => tile(l))) }, '⟳ Shuffle tiles'),
      input, h('div.row', {}, h('button.btn.ghost', { onclick: () => { left = 1; } }, 'End now')), chips);
    input.focus();
  };
  return root;
}
