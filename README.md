# Rackwise

A practice app for crossword tile games (Scrabble-style). It's a static web app
you can add to your phone's Home Screen. It works offline after the first load.

## Sections

| Section | What's in it |
|---|---|
| **Home** | Daily mix, due cardbox reviews, saved game, next step on the study path |
| **Drills** | Anagrams, Valid or Phony?, Hooks, Bingo Stems, Bingo Hunt, Word Builder (timed). Drills use a Leitner cardbox: right answers move a word up a box and it comes back after 1, 2, 4, 7, 14, 30, 60 or 120 days. Wrong answers return to box 0. |
| **Study path** | 2-letter words → J/Q/X/Z words → Q without U → 3-letter words → hooks on 2s → top bingo stems → top 7s → top 8s, with progress bars |
| **Puzzles** | Find the Best Play (mid-game or opening, with every legal move ranked), Rack Leave (which tiles to keep), Score It (count up a play) |
| **Play** | Full game against an Easy, Medium or Hard computer. After each move it shows how your play ranked against every legal move. Also has a move log, unseen-tile tracking and hints. |
| **More** | Word lookup (check, anagram with `?` blanks, rack builder, pattern search), progress stats, a Learn reference with word lists and strategy notes, and settings including backup and restore |

## Word list

ENABLE (public domain, ~168k words of 2–15 letters) plus QI, ZA, KI, OI, EW, OK and their plurals.
The official tournament lists (NWL, Collins) are copyrighted and are not included.

## Run locally

Any static server works:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy (GitHub Pages)

1. Merge to `main`.
2. In the repo, go to **Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**.
   The workflow in `.github/workflows/pages.yml` publishes the site on every push to `main`.
3. Open `https://<user>.github.io/<repo>/` on your phone:
   - **iPhone (Safari):** Share → Add to Home Screen
   - **Android (Chrome):** ⋮ menu → Add to Home screen / Install app

Progress is stored in the browser on each device. Use **More → Settings → Export** to back it up.

## Code layout

- `js/dict.js`: word list, trie, anagram, hook and pattern helpers
- `js/board.js`: board layout, placement validation and scoring
- `js/movegen.js`: move generator (anchor/cross-check algorithm) and computer opponent
- `js/leave.js`: rack-leave heuristic
- `js/store.js`: localStorage persistence, cardbox and stats
- `js/views/*`: screens
- `sw.js`: offline cache. Bump `VERSION` when shipping changes.
