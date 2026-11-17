// Interactive board + rack component shared by Play and Puzzles.
import { h, pickLetter } from '../ui.js';
import { N, premium, at } from '../board.js';
import { VALUES, shuffle } from '../tiles.js';

const PREM_LABEL = { T: '3W', D: '2W', t: '3L', d: '2L', '*': '★' };
const PREM_CLASS = { T: 'tw', D: 'dw', t: 'tl', d: 'dl', '*': 'st' };

export function createBoardView({ interactive = true, onChange = () => {} } = {}) {
  let board = new Array(N * N).fill(null);
  let rack = []; // [{l, used:boolean}]
  let pending = new Map(); // key -> {r,c,l,b,ri}
  let selected = -1;
  let highlight = new Set();
  let preview = null; // tiles to show as ghost
  let locked = !interactive;

  const boardEl = h('div.board', { role: 'grid', 'aria-label': 'Board' });
  const cells = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const p = premium(r, c);
      const cell = h(`div.cell${PREM_CLASS[p] ? '.' + PREM_CLASS[p] : ''}`, { 'data-r': r, 'data-c': c, role: 'gridcell' });
      cell.addEventListener('click', () => onCellTap(r, c));
      cells.push(cell);
      boardEl.append(cell);
    }
  }
  const wrap = h('div.board-wrap', {}, boardEl);
  const rackEl = h('div.rack', { 'aria-label': 'Your rack' });

  function tileNode(t, cls = '') {
    return h(`span.btile${t.b ? '.blank' : ''}${cls ? '.' + cls : ''}`, {}, t.l, !t.b ? h('sub', {}, VALUES[t.l]) : null);
  }

  function render() {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const k = r * N + c;
        const cell = cells[k];
        const t = board[k];
        const pend = pending.get(k);
        const pv = preview?.find((x) => x.r === r && x.c === c);
        cell.replaceChildren();
        cell.classList.toggle('filled', !!(t || pend || pv));
        if (t) cell.append(tileNode(t, highlight.has(k) ? 'last' : ''));
        else if (pend) cell.append(tileNode(pend, 'pending'));
        else if (pv) cell.append(tileNode(pv, 'preview'));
        else {
          const p = premium(r, c);
          if (PREM_LABEL[p]) cell.append(h('span.plabel', {}, PREM_LABEL[p]));
        }
      }
    }
    rackEl.replaceChildren(...rack.map((t, i) => {
      const el = h(`button.rtile${t.used ? '.used' : ''}${i === selected ? '.sel' : ''}${t.l === '?' ? '.blank' : ''}`, {
        'aria-label': t.l === '?' ? 'blank' : t.l, disabled: t.used || locked,
      }, t.l === '?' ? '' : t.l, t.l !== '?' ? h('sub', {}, VALUES[t.l]) : null);
      if (!t.used && !locked) attachDrag(el, i);
      return el;
    }));
  }

  // Tap to select / drag to place.
  function attachDrag(el, i) {
    let ghost = null, sx = 0, sy = 0, moved = false;
    el.addEventListener('pointerdown', (e) => {
      sx = e.clientX; sy = e.clientY; moved = false;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!el.hasPointerCapture(e.pointerId)) return;
      if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) {
        moved = true;
        ghost = el.cloneNode(true);
        ghost.classList.add('drag-ghost');
        document.body.append(ghost);
      }
      if (ghost) { ghost.style.left = `${e.clientX}px`; ghost.style.top = `${e.clientY}px`; }
    });
    el.addEventListener('pointerup', async (e) => {
      if (ghost) {
        ghost.remove(); ghost = null;
        const target = document.elementFromPoint(e.clientX, e.clientY);
        const cell = target?.closest?.('.cell');
        const rt = target?.closest?.('.rtile');
        if (cell && boardEl.contains(cell)) { selected = i; await onCellTap(+cell.dataset.r, +cell.dataset.c); }
        else if (rt && rackEl.contains(rt)) { // reorder rack
          const j = [...rackEl.children].indexOf(rt);
          if (j >= 0 && j !== i) { const [m] = rack.splice(i, 1); rack.splice(j, 0, m); selected = -1; render(); }
        }
      } else if (!moved) {
        selected = selected === i ? -1 : i;
        render();
      }
    });
    el.addEventListener('pointercancel', () => { ghost?.remove(); ghost = null; });
  }

  async function onCellTap(r, c) {
    if (locked) return;
    const k = r * N + c;
    if (at(board, r, c)) return;
    if (pending.has(k)) {
      const p = pending.get(k);
      p.t.used = false;
      pending.delete(k);
      render(); onChange();
      return;
    }
    if (selected < 0) return;
    const t = rack[selected];
    let l = t.l, b = false;
    if (l === '?') {
      const pick = await pickLetter();
      if (!pick) return;
      l = pick; b = true;
    }
    t.used = true;
    pending.set(k, { r, c, l, b, t });
    selected = -1;
    render(); onChange();
  }

  const api = {
    el: h('div.bv', {}, wrap),
    boardEl, rackEl, wrap,
    setBoard(b) { board = b; pending.clear(); preview = null; render(); },
    setRack(letters) { rack = letters.map((l) => ({ l, used: false })); pending.clear(); selected = -1; render(); },
    rackLetters: () => rack.map((t) => t.l),
    placement: () => [...pending.values()].map(({ r, c, l, b }) => ({ r, c, l, b })),
    recall() { pending.clear(); rack.forEach((t) => { t.used = false; }); selected = -1; render(); onChange(); },
    shuffle() { if (pending.size) api.recall(); rack = shuffle(rack); render(); },
    setHighlight(keys) { highlight = new Set(keys); render(); },
    showPreview(tiles) { preview = tiles; render(); },
    lock(v = true) { locked = v; selected = -1; render(); },
    toggleZoom() { wrap.classList.toggle('zoom'); return wrap.classList.contains('zoom'); },
    render,
  };
  render();
  return api;
}
