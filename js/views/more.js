// More: word lookup tools, stats, learn reference, settings.
import { h, tile, toast, modal, segmented, pageHeader, pct } from '../ui.js';
import { D, anagramsWithBlanks, frontHooks, backHooks, buildable, matchPattern, stems } from '../dict.js';
import { DIST, VALUES } from '../tiles.js';
import * as store from '../store.js';
import { SPECIAL, wordsOfLen, STUDY_PATH, stepProgress } from '../lists.js';
import { DRILLS } from './drills.js';
import { PUZZLES } from './puzzles.js';

export function moreHub() {
  const link = (href, icon, title, desc) => h('a.card.drill.row-card', { href }, h('div.icon', { 'aria-hidden': 'true' }, icon), h('div.grow', {}, h('strong', {}, title), h('p.muted.small', {}, desc)), h('span.chev', {}, '›'));
  return h('div.page', {}, pageHeader('More'),
    h('div.list', {},
      link('#/lookup', '🔎', 'Word lookup', 'Check a word, find anagrams (use ? for blanks), hooks and patterns.'),
      link('#/stats', '📈', 'Progress', 'Cardbox, accuracy, streaks and game record.'),
      link('#/learn', '📚', 'Learn', 'Word lists, tile values and strategy basics.'),
      link('#/settings', '⚙️', 'Settings', 'Level, theme, backup and reset.')));
}

// ---------- Lookup ----------
export function lookupView(params) {
  let mode = params.get('m') || 'check';
  const input = h('input.answer', { type: 'search', autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Letters', value: params.get('q') || '' });
  const out = h('div');
  const help = { check: 'Type a word to check it.', anagram: 'Type letters. Use ? for a blank.', build: 'Type a rack (? = blank) to see every word you can make.', pattern: 'Use . for one letter and * for any letters, e.g. Q..T or *ZZ*.' };
  const hint = h('p.small.muted', {}, help[mode]);
  const run = () => {
    const q = input.value.toUpperCase().replace(/[^A-Z?.*]/g, '');
    out.replaceChildren();
    if (!q) return;
    if (mode === 'check') {
      const w = q.replace(/[^A-Z]/g, '');
      const ok = D.set.has(w);
      const ana = anagramsWithBlanks(w).filter((x) => x !== w);
      out.append(h(`div.fb.${ok ? 'good' : 'bad'}`, {}, ok ? `✓ ${w} is valid` : `✗ ${w} is not in the word list`),
        ok ? h('div.card', {},
          h('p', {}, h('span.muted', {}, 'Hooks: '), h('span.hookline', {}, h('span.hk', {}, frontHooks(w).join('').toLowerCase() || '–'), h('strong', {}, w), h('span.hk', {}, backHooks(w).join('').toLowerCase() || '–'))),
          h('p', {}, h('span.muted', {}, 'Scores '), [...w].reduce((s, c) => s + VALUES[c], 0), h('span.muted', {}, ' face value'))) : null,
        ana.length ? h('div.card', {}, h('h3', {}, 'Anagrams'), h('div.chips', {}, ana.map(chipLink))) : null,
        w.length <= 12 ? extensions(w) : null);
    } else if (mode === 'anagram') {
      const res = anagramsWithBlanks(q.replace(/[.*]/g, ''));
      out.append(h('div.card', {}, h('h3', {}, `${res.length} anagram${res.length === 1 ? '' : 's'}`), h('div.chips', {}, res.map(chipLink))));
    } else if (mode === 'build') {
      const res = buildable(q.replace(/[.*]/g, ''), 2, 15).sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
      const groups = {};
      for (const w of res) (groups[w.length] ||= []).push(w);
      out.append(...Object.keys(groups).sort((a, b) => b - a).map((n) => h('div.card', {}, h('h3', {}, `${n} letters (${groups[n].length})`), h('div.chips', {}, groups[n].slice(0, 300).map(chipLink)))));
      if (!res.length) out.append(h('p.muted', {}, 'No words.'));
    } else {
      const res = matchPattern(q, 600);
      out.append(h('div.card', {}, h('h3', {}, `${res.length}${res.length >= 600 ? '+' : ''} matches`), h('div.chips', {}, res.map(chipLink))));
    }
  };
  input.addEventListener('input', () => { clearTimeout(input._t); input._t = setTimeout(run, 200); });
  const chipLink = (w) => h('a.chip', { href: `#/lookup?m=check&q=${w}` }, w);
  const extensions = (w) => {
    const longer = D.words.filter((x) => x.length > w.length + 1 && x.length <= w.length + 3 && x.includes(w)).slice(0, 60);
    return longer.length ? h('div.card', {}, h('h3', {}, 'Longer words containing it'), h('div.chips', {}, longer.map(chipLink))) : null;
  };
  setTimeout(run, 0);
  return h('div.page', {}, pageHeader('Word lookup', '#/more'),
    segmented([['check', 'Check'], ['anagram', 'Anagram'], ['build', 'Rack'], ['pattern', 'Pattern']], mode, (v) => { mode = v; hint.textContent = help[v]; run(); input.focus(); }),
    input, hint, out,
    h('p.small.muted', {}, `Word list: ENABLE (${D.words.length.toLocaleString()} words, 2–15 letters) plus QI, ZA, KI, OI, EW, OK and plurals.`));
}

// ---------- Stats ----------
export function statsView() {
  const S = store.S();
  const boxes = store.boxCounts();
  const total = boxes.reduce((a, b) => a + b, 0);
  const due = store.dueCards().length;
  const known = boxes.slice(2).reduce((a, b) => a + b, 0);
  const drills = Object.entries(S.drills);
  const r = drills.reduce((s, [, d]) => s + d.r, 0), w = drills.reduce((s, [, d]) => s + d.w, 0);
  const max = Math.max(1, ...boxes);
  const statTile = (label, value, sub) => h('div.stat', {}, h('span.lab', {}, label), h('b', {}, value), sub ? h('span.small.muted', {}, sub) : null);
  const names = Object.fromEntries([...DRILLS, ...PUZZLES].map((d) => [d.id, d.title]));
  names.review = 'Cardbox review'; names.mix = 'Daily mix';

  // last 14 days activity
  const days = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push({ k: store.today(d), d }); }
  const dmax = Math.max(1, ...days.map((x) => S.days[x.k] || 0));

  return h('div.page', {}, pageHeader('Progress', '#/more'),
    h('div.stats', {},
      statTile('Streak', `${store.streak()}`, 'days'),
      statTile('Due now', `${due}`, 'cards'),
      statTile('Learned', `${known}`, `of ${total} studied`),
      statTile('Accuracy', r + w ? `${pct(r, r + w)}%` : '–', `${r + w} answers`)),
    h('div.card', {}, h('h3', {}, 'Last 14 days'),
      h('div.spark', { role: 'img', 'aria-label': 'Activity over the last 14 days' }, days.map((x) => {
        const v = S.days[x.k] || 0;
        return h('div.sbar', { title: `${x.d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: ${v} answers/puzzles` },
          h('span', { style: { height: `${v ? Math.max(4, (v / dmax) * 100) : 0}%` } }));
      })),
      h('div.row.between.small.muted', {}, h('span', {}, '2 weeks ago'), h('span', {}, 'Today'))),
    h('div.card', {}, h('h3', {}, 'Cardbox'),
      h('p.small.muted', {}, 'Box 0 = new or just missed. Each correct answer moves a card up and waits longer before it comes back (1, 2, 4, 7, 14, 30, 60, 120 days).'),
      h('div.boxes', {}, boxes.map((n, i) => h('div.box', { title: `Box ${i}: ${n} cards` },
        h('span.v', {}, n), h('div.col', {}, h('span', { style: { height: `${n ? Math.max(3, (n / max) * 100) : 0}%` } })), h('span.l', {}, i))))),
    h('div.card', {}, h('h3', {}, 'Study path'),
      STUDY_PATH.map((s) => { const p = stepProgress(s); return h('div.pathrow', {}, h('span', {}, s.title), h('div.bar', {}, h('span', { style: { width: `${pct(p.known, p.total)}%` } })), h('span.small.muted', {}, `${pct(p.known, p.total)}%`)); })),
    drills.length ? h('div.card', {}, h('h3', {}, 'Drills'),
      h('table.tbl', {}, h('tr', {}, h('th', {}, 'Drill'), h('th.num', {}, 'Answers'), h('th.num', {}, 'Accuracy')),
        drills.map(([k, d]) => h('tr', {}, h('td', {}, names[k] || k), h('td.num', {}, d.r + d.w), h('td.num', {}, `${pct(d.r, d.r + d.w)}%`))))) : null,
    Object.keys(S.puzzles).length ? h('div.card', {}, h('h3', {}, 'Puzzles'),
      h('table.tbl', {}, h('tr', {}, h('th', {}, 'Puzzle'), h('th.num', {}, 'Played'), h('th.num', {}, 'Average')),
        Object.entries(S.puzzles).map(([k, p]) => h('tr', {}, h('td', {}, names[k] || k), h('td.num', {}, p.n), h('td.num', {}, `${Math.round(p.sum / p.n)}%`))))) : null,
    S.games.length ? h('div.card', {}, h('h3', {}, 'Recent games'),
      h('table.tbl.small', {}, h('tr', {}, h('th', {}, 'Date'), h('th', {}, 'Level'), h('th.num', {}, 'Score'), h('th.num', {}, 'Quality')),
        S.games.slice(-10).reverse().map((g) => h('tr', {}, h('td', {}, new Date(g.date).toLocaleDateString()), h('td', {}, g.level), h('td.num', {}, h('span', { class: g.won ? 'good-text' : 'bad-text' }, `${g.me}–${g.cpu}`)), h('td.num', {}, `${g.avgPct}%`))))) : null);
}

// ---------- Learn ----------
export function learnView() {
  const section = (title, ...kids) => h('details.card', {}, h('summary', {}, title), ...kids);
  const twos = wordsOfLen(2).slice().sort();
  const byFirst = {};
  for (const w of twos) (byFirst[w[0]] ||= []).push(w);
  const words = (list) => h('div.chips', {}, list.map((w) => h('a.chip', { href: `#/lookup?m=check&q=${w}` }, w)));
  return h('div.page', {}, pageHeader('Learn', '#/more'),
    section('How to get better (a study plan)',
      h('ol', {},
        h('li', {}, h('strong', {}, 'Learn the two-letter words. '), 'All of them. They unlock parallel plays that score on two words at once.'),
        h('li', {}, h('strong', {}, 'Learn the J, Q, X, Z short words and Q-without-U words. '), 'Heavy tiles become points, not rack-cloggers.'),
        h('li', {}, h('strong', {}, 'Learn the three-letter words and hooks. '), 'Hooks show you where words can be extended.'),
        h('li', {}, h('strong', {}, 'Study bingo stems and high-probability 7s and 8s. '), 'Using all seven tiles earns 50 extra points; the most likely racks come up again and again, so study in probability order.'),
        h('li', {}, h('strong', {}, 'Manage your rack. '), 'Think "score + leave". Keep blanks and S, balance vowels and consonants, play off duplicates.'),
        h('li', {}, h('strong', {}, 'Play and review. '), 'After every game, compare your moves with the top plays. The gap is your study list.')),
      h('p.small.muted', {}, 'Use the cardbox little and often: 15–20 minutes a day beats a long weekly session. Don\'t add too many new words at once; clear your due cards first.')),
    section('Two-letter words', h('div.twos', {}, Object.keys(byFirst).map((l) => h('div.trow', {}, h('b', {}, l), words(byFirst[l]))))),
    section('J, Q, X, Z two- and three-letter words', words(SPECIAL.jqxz.words().filter((w) => w.length <= 3).sort())),
    section('Q without U', words(SPECIAL.qnou.words().slice().sort((a, b) => a.length - b.length || (a < b ? -1 : 1)))),
    section('Vowel dumps', h('p.small.muted', {}, 'Too many vowels? These words use mostly vowels.'), words(SPECIAL.vowel.words().slice(0, 150))),
    section('Words with no A, E, I, O or U', words(SPECIAL.novowel.words().slice().sort((a, b) => a.length - b.length || (a < b ? -1 : 1)).slice(0, 200))),
    section('Top bingo stems', h('p.small.muted', {}, 'Each six-letter stem plus the shown letters makes at least one 7-letter word.'),
      h('div', {}, stems().slice(0, 20).map((s) => h('div.mrow', {}, h('strong', {}, s.stem), ` + ${Object.keys(s.adds).sort().join('')}`)))),
    section('Tiles: values and counts',
      h('div.tilegrid', {}, Object.keys(DIST).map((l) => h('div.tg', {}, tile(l, { small: true }), h('span.small', {}, `×${DIST[l]}`)))),
      h('p.small.muted', {}, '100 tiles: 98 letters and 2 blanks. There are 42 vowels (A×9, E×12, I×9, O×8, U×4).')),
    section('Scoring and rules recap',
      h('ul', {},
        h('li', {}, 'Double/triple letter squares multiply that tile; double/triple word squares multiply the whole word.'),
        h('li', {}, 'Premium squares only count on the turn a tile is placed on them.'),
        h('li', {}, 'Every new word formed by your tiles scores, including the "cross" words.'),
        h('li', {}, 'Using all seven tiles in one turn earns a 50-point bonus (a "bingo").'),
        h('li', {}, 'At the end, the player who goes out adds the value of the opponent\'s remaining tiles; the opponent loses that value.'))),
    section('Strategy tips',
      h('ul', {},
        h('li', {}, 'Score + leave: a play scoring 4 fewer points that keeps ERS is usually better than one that keeps UUV.'),
        h('li', {}, 'Don\'t burn an S or blank for less than about 8–10 (S) or 25 (blank) extra points.'),
        h('li', {}, 'Parallel plays with two-letter words often outscore long words.'),
        h('li', {}, 'Watch for triple-word lanes you open for your opponent.'),
        h('li', {}, 'Exchange when your rack is truly bad and no play scores well. Swapping costs one turn but can win the game.'),
        h('li', {}, 'Track tiles: count the unseen letters to know what your opponent could have.'))));
}

// ---------- Settings ----------
export function settingsView() {
  const s = store.settings();
  const fileIn = h('input', { type: 'file', accept: 'application/json', style: { display: 'none' }, onchange: async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { store.importData(await f.text()); toast('Progress restored'); location.hash = '#/'; } catch (err) { toast(err.message); }
  } });
  return h('div.page', {}, pageHeader('Settings', '#/more'),
    h('div.card.stack', {},
      h('label.field', {}, h('span', {}, 'Your level'), segmented([['beginner', 'Beginner'], ['mixed', 'Intermediate'], ['advanced', 'Advanced']], s.level, (v) => store.setSetting('level', v))),
      h('p.small.muted', {}, 'Sets the default word lists and what goes into the Daily mix. Every drill can still be set to any difficulty.'),
      h('label.field', {}, h('span', {}, 'Theme'), segmented([['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], s.theme, (v) => { store.setSetting('theme', v); applyTheme(); })),
      h('label.field', {}, h('span', {}, 'Computer opponent'), segmented([['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']], s.ai, (v) => store.setSetting('ai', v)))),
    h('div.card.stack', {},
      h('h3', {}, 'Backup'),
      h('p.small.muted', {}, 'Progress is saved on this device only. Export a backup now and then, especially on iPhone.'),
      h('div.row', {},
        h('button.btn', { onclick: () => {
          const blob = new Blob([store.exportData()], { type: 'application/json' });
          const a = h('a', { href: URL.createObjectURL(blob), download: `rackwise-backup-${store.today()}.json` });
          document.body.append(a); a.click(); a.remove();
        } }, 'Export'),
        h('button.btn', { onclick: () => fileIn.click() }, 'Import'), fileIn)),
    h('div.card.stack', {},
      h('h3', {}, 'Reset'),
      h('button.btn.bad', { onclick: async () => {
        const ok = await modal('Erase all progress?', h('p', {}, 'Cardbox, stats and saved game will be deleted. This cannot be undone.'), [{ label: 'Cancel', value: false }, { label: 'Erase', value: true, primary: true }]);
        if (ok) { store.resetAll(); toast('Progress erased'); location.hash = '#/'; }
      } }, 'Erase all progress')),
    h('p.small.muted', {}, 'Rackwise is an unofficial practice tool and is not affiliated with any word-game brand.'));
}

export function applyTheme() {
  const t = store.settings().theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}
