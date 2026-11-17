// Tiny DOM helpers.
import { VALUES } from './tiles.js';

export function h(tag, attrs = {}, ...kids) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, kids);
  return el;
}
function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export function tile(letter, { blank = false, small = false, cls = '' } = {}) {
  const isBlank = letter === '?';
  return h(`span.tile${small ? '.sm' : ''}${blank ? '.blank' : ''}${cls ? '.' + cls : ''}`, {},
    isBlank ? '' : letter.toUpperCase(),
    !isBlank && !blank ? h('sub', {}, VALUES[letter.toUpperCase()]) : null);
}

export function tiles(word, opts) {
  return h('span.tiles', {}, [...word].map((l) => tile(l, opts)));
}

export function toast(msg, ms = 2200) {
  const t = h('div.toast', { role: 'status' }, msg);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
}

export function modal(title, body, actions = [{ label: 'Close' }]) {
  return new Promise((resolve) => {
    const close = (v) => { wrap.remove(); resolve(v); };
    const wrap = h('div.modal-wrap', { onclick: (e) => { if (e.target === wrap) close(null); } },
      h('div.modal', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('h3', {}, title),
        body,
        h('div.row.end', {}, actions.map((a) => h(`button.btn${a.primary ? '.primary' : ''}`, { onclick: () => close(a.value ?? a.label) }, a.label)))));
    document.body.append(wrap);
    wrap._close = close;
  });
}

export function pickLetter() {
  return new Promise((resolve) => {
    let wrapRef;
    const grid = h('div.letter-grid', {}, [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((l) =>
      h('button.letter-btn', { onclick: () => { wrapRef._close(l); } }, l)));
    const p = modal('Blank is…', grid, [{ label: 'Cancel', value: null }]);
    wrapRef = document.querySelector('.modal-wrap:last-of-type');
    p.then(resolve);
  });
}

export function segmented(options, value, onChange) {
  const el = h('div.seg', { role: 'radiogroup' });
  const draw = () => {
    el.replaceChildren(...options.map(([v, label]) =>
      h(`button${v === value ? '.on' : ''}`, { role: 'radio', 'aria-checked': String(v === value), onclick: () => { value = v; draw(); onChange(v); } }, label)));
  };
  draw();
  return el;
}

export function select(options, value, onChange) {
  return h('select', { onchange: (e) => onChange(e.target.value) },
    options.map(([v, label]) => h('option', { value: v, selected: String(v) === String(value) }, label)));
}

export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export function pageHeader(title, back) {
  return h('header.page-head', {},
    back ? h('a.back', { href: back, 'aria-label': 'Back' }, '‹') : null,
    h('h1', {}, title));
}
