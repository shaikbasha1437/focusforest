# 🌲 FocusForest

A Pomodoro focus timer that grows a pixel-art forest. Every focus session you finish plants a tree; give up halfway and a withered stump is left behind.

**Live app:** https://shaikbasha1437.github.io/focusforest/

Everything runs in your browser. No account, no server, no tracking — history lives in `localStorage`.

## Features
- **Timer** – focus / short break / long break (default 25 / 5 / 15 min), long break every N sessions, start · pause · reset · skip, optional auto-start.
- **Accurate timing** – based on wall-clock timestamps, so background-tab throttling or a sleeping laptop can't make it drift. A running timer survives a page reload.
- **Tab title** shows the time left; optional chime and browser notification when a phase ends.
- **Pixel forest** – the current tree grows through seed → sprout → sapling → young → full tree during the session. Completed sessions are planted in your forest.
- **Species** unlocked by totals and streaks: Oak, Pine (3 trees), Birch (2-day streak), Cherry blossom (10 trees), Maple (5-day streak), Willow (25 trees), Golden tree (50 hours).
- **Task label** per session, history list, and stats: minutes/sessions today, minutes this week, current & best daily streak, 7-day bar chart.
- **Export / import** history as JSON (imports merge, duplicates are skipped).
- **Ambient sounds** synthesized live with the Web Audio API — rain, wind, brown noise, forest with birdsong — plus volume. No audio files.
- **Keyboard shortcuts**, responsive dark UI, installable PWA that works offline.

## Keyboard shortcuts
| Key | Action |
|---|---|
| Space | Start / pause |
| R | Reset (abandons a running focus session) |
| N | Skip to next phase |
| 1 / 2 / 3 | Focus / short break / long break |
| M | Toggle ambient sound |
| T | Edit task label |
| S | Settings |
| ? | Shortcut help |

## Development
Plain HTML/CSS/JS, no build step.

```bash
npx serve .        # or any static server
npm test           # Node tests for timer, cycle, streak, stats and import logic
```

- `core.js` – pure timer/state/streak/stats logic (shared by the app and the tests)
- `forest.js` – pixel-art tree renderer (canvas)
- `sound.js` – Web Audio ambient generators and chime
- `app.js` – UI wiring, storage, shortcuts
- `sw.js` – network-first service worker with a versioned offline cache

## Notes
- Browser notifications need permission and only fire while the tab is in the background.
- Browsers start audio only after a click, so ambient sound begins when you pick one.
- If the tab is fully closed, the timer can't chime, but it completes correctly the next time you open the app.

## License
MIT
