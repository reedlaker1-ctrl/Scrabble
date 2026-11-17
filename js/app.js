// App shell: boot, router, navigation, home screen.
import { h, pageHeader, pct } from './ui.js';
import { loadDict } from './dict.js';
import * as store from './store.js';
import { STUDY_PATH, stepProgress } from './lists.js';
import { drillsHub, drillSetup, reviewView, dailyMix } from './views/drills.js';
import { puzzlesHub, puzzleView } from './views/puzzles.js';
import { playView } from './views/play.js';
import { moreHub, lookupView, statsView, learnView, settingsView, applyTheme } from './views/more.js';

const main = document.getElementById('main');
const nav = document.getElementById('nav');

const TABS = [
  ['#/', 'Home', 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
  ['#/drills', 'Drills', 'M4 5h16v4H4zM4 11h10v4H4zM4 17h13v3H4z'],
  ['#/puzzles', 'Puzzles', 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'],
  ['#/play', 'Play', 'M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18'],
  ['#/more', 'More', 'M5 12h.01M12 12h.01M19 12h.01'],
];

function drawNav(path) {
  const section = (path.split('/')[1] || '').split('?')[0];
  const map = { '': '#/', drills: '#/drills', drill: '#/drills', review: '#/drills', mix: '#/', puzzles: '#/puzzles', puzzle: '#/puzzles', play: '#/play' };
  const active = map[section] || '#/more';
  nav.replaceChildren(...TABS.map(([href, label, d]) => h(`a${href === active ? '.on' : ''}`, { href, 'aria-current': href === active ? 'page' : null },
    svgIcon(d), h('span', {}, label))));
}

function svgIcon(d) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', d);
  svg.append(p);
  return svg;
}

function home() {
  const s = store.S();
  const due = store.dueCards().length;
  const game = s.game && !s.game.over ? s.game : null;
  const next = STUDY_PATH.map((st) => ({ st, p: stepProgress(st) })).find((x) => pct(x.p.known, x.p.total) < 80) || null;
  const action = (href, title, desc, cls = '') => h(`a.card.cta${cls ? '.' + cls : ''}`, { href }, h('div', {}, h('strong', {}, title), h('p.small', {}, desc)), h('span.chev', {}, '›'));
  const hour = new Date().getHours();
  return h('div.page', {},
    h('header.hero', {},
      h('div', {}, h('p.small.muted', {}, hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'), h('h1', {}, 'Rackwise')),
      h('div.streak', { title: 'Days in a row you\'ve practised' }, h('b', {}, store.streak()), h('span', {}, 'day streak'))),
    h('div.list', {},
      action('#/mix', 'Daily mix', 'About 20 questions mixing due cards and new material for your level.', 'primary'),
      due ? action('#/review', `Review ${due} due card${due === 1 ? '' : 's'}`, 'Clear these first: spaced repetition works best when you keep up.') : null,
      game ? action('#/play', 'Continue your game', `You ${game.scores[0]} – ${game.scores[1]} CPU`) : null,
      next ? h('a.card.step', { href: next.st.href },
        h('div.grow', {}, h('p.small.muted', {}, 'Next on your study path'), h('strong', {}, next.st.title), h('p.small.muted', {}, next.st.why),
          h('div.bar', {}, h('span', { style: { width: `${pct(next.p.known, next.p.total)}%` } })), h('p.small.muted', {}, `${next.p.known} / ${next.p.total} learned`)),
        h('span.chev', {}, '›')) : null),
    h('h2', {}, 'Quick practice'),
    h('div.grid2', {},
      h('a.card.drill', { href: '#/puzzle/bestplay' }, h('div.icon', {}, '🧩'), h('strong', {}, 'Best play'), h('p.muted.small', {}, 'Find the top move on a real board.')),
      h('a.card.drill', { href: '#/drill/bingo' }, h('div.icon', {}, '🎯'), h('strong', {}, 'Bingo hunt'), h('p.muted.small', {}, 'Spot 7-letter words in a rack.')),
      h('a.card.drill', { href: '#/drill/phony?len=2' }, h('div.icon', {}, '✅'), h('strong', {}, 'Two-letter words'), h('p.muted.small', {}, 'Valid or phony?')),
      h('a.card.drill', { href: '#/drill/builder' }, h('div.icon', {}, '⏱️'), h('strong', {}, 'Word builder'), h('p.muted.small', {}, 'Timed rack challenge.'))));
}

function route() {
  const hash = location.hash || '#/';
  const [path, query = ''] = hash.slice(1).split('?');
  const params = new URLSearchParams(query);
  const parts = path.split('/').filter(Boolean);
  let view;
  try {
    switch (parts[0]) {
      case undefined: view = home(); break;
      case 'drills': view = drillsHub(); break;
      case 'drill': view = drillSetup(parts[1], params); break;
      case 'review': view = reviewView(); break;
      case 'mix': view = dailyMix(); break;
      case 'puzzles': view = puzzlesHub(); break;
      case 'puzzle': view = puzzleView(parts[1]); break;
      case 'play': view = playView(); break;
      case 'more': view = moreHub(); break;
      case 'lookup': view = lookupView(params); break;
      case 'stats': view = statsView(); break;
      case 'learn': view = learnView(); break;
      case 'settings': view = settingsView(); break;
      default: view = h('div.page', {}, pageHeader('Not found'), h('a.btn', { href: '#/' }, 'Home'));
    }
  } catch (err) {
    console.error(err);
    view = h('div.page', {}, pageHeader('Something went wrong'), h('p', {}, String(err.message || err)), h('a.btn', { href: '#/' }, 'Home'));
  }
  main.replaceChildren(view);
  window.scrollTo(0, 0);
  drawNav(hash);
}

async function boot() {
  applyTheme();
  try {
    await loadDict();
  } catch (err) {
    main.replaceChildren(h('div.page.center', {}, h('h2', {}, 'Couldn\'t load the word list'), h('p', {}, 'Check your connection and reload. After the first load the app works offline.'), h('button.btn.primary', { onclick: () => location.reload() }, 'Reload')));
    return;
  }
  window.addEventListener('hashchange', route);
  route();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.addEventListener('pagehide', () => store.save(true));
  document.addEventListener('visibilitychange', () => { if (document.hidden) store.save(true); });
}

boot();
