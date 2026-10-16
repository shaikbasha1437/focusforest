// FocusForest core logic: pure functions, no DOM. Works in browser and Node.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FFCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULTS = { focus: 25, short: 5, long: 15, longEvery: 4, autoStart: false, notify: false, chime: true, stumps: true, species: 'auto' };
  const MIN = 60000;

  function sanitizeSettings(s) {
    const o = Object.assign({}, DEFAULTS, s || {});
    const clamp = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
    o.focus = clamp(o.focus, 1, 180, DEFAULTS.focus);
    o.short = clamp(o.short, 1, 60, DEFAULTS.short);
    o.long = clamp(o.long, 1, 90, DEFAULTS.long);
    o.longEvery = Math.round(clamp(o.longEvery, 1, 12, DEFAULTS.longEvery));
    ['autoStart', 'notify', 'chime', 'stumps'].forEach((k) => { o[k] = !!o[k]; });
    return o;
  }
  function phaseMinutes(phase, s) { return phase === 'focus' ? s.focus : phase === 'short' ? s.short : s.long; }

  // Timer is driven by wall-clock timestamps so throttled tabs stay accurate.
  function createTimer(phase, s) { const d = phaseMinutes(phase, s) * MIN; return { phase, duration: d, remaining: d, running: false, endAt: null, startedAt: null }; }
  function start(t, now) { if (t.running) return t; return Object.assign({}, t, { running: true, endAt: now + t.remaining, startedAt: t.startedAt || now }); }
  function pause(t, now) { if (!t.running) return t; return Object.assign({}, t, { running: false, remaining: Math.max(0, t.endAt - now), endAt: null }); }
  function remaining(t, now) { return t.running ? Math.max(0, t.endAt - now) : t.remaining; }
  function progress(t, now) { return t.duration ? 1 - remaining(t, now) / t.duration : 0; }
  function isDone(t, now) { return remaining(t, now) <= 0; }
  function nextPhase(phase, completedFocusCount, s) {
    if (phase !== 'focus') return 'focus';
    return completedFocusCount > 0 && completedFocusCount % s.longEvery === 0 ? 'long' : 'short';
  }
  function treeStage(p) { return p >= 1 ? 4 : p >= 0.75 ? 3 : p >= 0.4 ? 2 : p >= 0.1 ? 1 : 0; }
  function fmt(ms) { const s = Math.ceil(ms / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }

  function dayKey(ts) { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDays(ts, n) { const d = new Date(ts); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d.getTime(); }

  function streaks(history, now) {
    const days = new Set(history.filter((h) => h.completed).map((h) => dayKey(h.end)));
    let current = 0; let cur = days.has(dayKey(now)) ? now : addDays(now, -1);
    while (days.has(dayKey(cur))) { current++; cur = addDays(cur, -1); }
    const sorted = [...days].sort(); let best = 0, run = 0, prev = null;
    for (const k of sorted) {
      const [y, m, d] = k.split('-').map(Number); const t = new Date(y, m - 1, d, 12).getTime();
      run = prev !== null && dayKey(addDays(prev, 1)) === k ? run + 1 : 1; best = Math.max(best, run); prev = t;
    }
    return { current, best };
  }

  function stats(history, now) {
    const done = history.filter((h) => h.completed);
    const today = dayKey(now);
    const week = [];
    for (let i = 6; i >= 0; i--) { const t = addDays(now, -i); const k = dayKey(t); week.push({ key: k, label: new Date(t).toLocaleDateString(undefined, { weekday: 'short' }), minutes: 0 }); }
    const idx = Object.fromEntries(week.map((w, i) => [w.key, i]));
    let todayMin = 0, todaySessions = 0, total = 0;
    for (const h of done) {
      const k = dayKey(h.end); total += h.minutes;
      if (k === today) { todayMin += h.minutes; todaySessions++; }
      if (k in idx) week[idx[k]].minutes += h.minutes;
    }
    const st = streaks(history, now);
    return { todayMinutes: todayMin, todaySessions, weekMinutes: week.reduce((a, w) => a + w.minutes, 0), totalSessions: done.length, totalMinutes: total, withered: history.length - done.length, week, streak: st.current, bestStreak: st.best };
  }

  const SPECIES = [
    { id: 'oak', name: 'Oak', need: 'Always available', ok: () => true },
    { id: 'pine', name: 'Pine', need: '3 trees planted', ok: (s) => s.totalSessions >= 3 },
    { id: 'birch', name: 'Birch', need: '2-day streak', ok: (s) => s.bestStreak >= 2 },
    { id: 'cherry', name: 'Cherry blossom', need: '10 trees planted', ok: (s) => s.totalSessions >= 10 },
    { id: 'maple', name: 'Maple', need: '5-day best streak', ok: (s) => s.bestStreak >= 5 },
    { id: 'willow', name: 'Willow', need: '25 trees planted', ok: (s) => s.totalSessions >= 25 },
    { id: 'golden', name: 'Golden tree', need: '50 hours focused', ok: (s) => s.totalMinutes >= 3000 },
  ];
  function unlocked(st) { return SPECIES.filter((sp) => sp.ok(st)).map((sp) => sp.id); }
  function pickSpecies(choice, st, seed) {
    const u = unlocked(st);
    if (choice && choice !== 'auto' && u.includes(choice)) return choice;
    return u[Math.abs(seed | 0) % u.length];
  }

  function validateImport(data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.history)) throw new Error('Not a FocusForest export (missing history).');
    const history = data.history.filter((h) => h && Number.isFinite(h.end) && Number.isFinite(h.minutes)).map((h) => ({
      id: String(h.id || h.end), start: Number(h.start) || h.end - h.minutes * MIN, end: h.end, minutes: Math.max(0, h.minutes),
      completed: !!h.completed, species: String(h.species || 'oak'), task: String(h.task || '').slice(0, 120),
    }));
    return { history, settings: sanitizeSettings(data.settings) };
  }
  function mergeHistory(a, b) { const m = new Map(); [...a, ...b].forEach((h) => m.set(h.id, h)); return [...m.values()].sort((x, y) => x.end - y.end); }

  return { DEFAULTS, SPECIES, sanitizeSettings, phaseMinutes, createTimer, start, pause, remaining, progress, isDone, nextPhase, treeStage, fmt, dayKey, addDays, streaks, stats, unlocked, pickSpecies, validateImport, mergeHistory };
});
