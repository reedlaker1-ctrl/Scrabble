// Heuristic rack-leave evaluation. Single-tile values are rough approximations of the
// published computer-analysis values; duplicates, vowel/consonant balance and Q-without-U
// are penalised. Good enough to teach the principles of rack management.
import { VOWELS } from './tiles.js';

export const TILE_LEAVE = {
  '?': 25, S: 8, Z: 5, X: 3.5, E: 3.5, R: 1.5, H: 1, A: 1, C: 1, D: 0.5, M: 0.5, N: 0.5,
  T: 0, L: -0.5, I: -1, P: -0.5, K: -1, Y: -1, O: -1.5, J: -2, B: -2, F: -2, G: -2.5,
  W: -3.5, U: -4.5, V: -5.5, Q: -7,
};

export function leaveValue(leave) {
  if (!leave.length) return 0;
  let v = 0;
  const counts = {};
  let vowels = 0, cons = 0;
  for (const l of leave) {
    v += TILE_LEAVE[l] ?? 0;
    counts[l] = (counts[l] || 0) + 1;
    if (l === '?') continue;
    if (VOWELS.has(l)) vowels++; else cons++;
  }
  for (const [l, n] of Object.entries(counts)) {
    if (n < 2 || l === '?') continue;
    const per = l === 'S' ? 3 : VOWELS.has(l) ? (l === 'E' ? 2.5 : 4) : 3.5;
    v -= per * (n - 1) * (n - 1 > 1 ? 1.5 : 1);
  }
  if (counts.Q && !counts.U) v -= 3;
  if (counts.Q && counts.U) v += 3;
  const diff = vowels - cons;
  if (diff > 1) v -= (diff - 1) * 3.5;
  if (cons - vowels > 2) v -= (cons - vowels - 2) * 3;
  if (leave.length >= 2 && vowels === 0 && !counts['?']) v -= 2;
  return Math.round(v * 10) / 10;
}

export function explainLeave(leave) {
  const bad = [], good = [];
  const counts = {};
  let vowels = 0, cons = 0;
  for (const l of leave) {
    counts[l] = (counts[l] || 0) + 1;
    if (l === '?') continue;
    if (VOWELS.has(l)) vowels++; else cons++;
  }
  const dups = Object.entries(counts).filter(([l, n]) => n > 1 && l !== '?').map(([l]) => l);
  if (counts.Q && !counts.U) bad.push('Q without a U.');
  if (dups.length) bad.push(`Duplicate ${dups.join(', ')}.`);
  if (vowels - cons > 1) bad.push('Too many vowels.');
  if (cons - vowels > 2) bad.push('Too many consonants.');
  if (leave.length >= 2 && vowels === 0 && !counts['?']) bad.push('No vowels.');
  const clunky = [...'VWUJQFGB'].filter((l) => counts[l] && !(l === 'U' && counts.Q));
  if (clunky.length) bad.push(`Clunky: ${clunky.join(', ')}.`);
  if (counts['?']) good.push('Keeps the blank.');
  if (counts.S) good.push('Keeps the S.');
  if (!bad.length && Math.abs(vowels - cons) <= 1) good.push('Balanced.');
  if (counts.E || counts.R) good.push('Flexible letters.');
  const notes = [...bad, ...good];
  return notes.length ? notes : ['Fine.'];
}
