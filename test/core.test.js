const test = require('node:test'); const assert = require('node:assert');
const C = require('../core.js');
const S = C.sanitizeSettings({});
const day = (y, m, d, h = 10) => new Date(y, m - 1, d, h).getTime();
const sess = (ts, min = 25, completed = true) => ({ id: String(ts), start: ts - min * 60000, end: ts, minutes: min, completed, species: 'oak' });

test('defaults 25/5/15 every 4', () => { assert.deepStrictEqual([S.focus, S.short, S.long, S.longEvery], [25, 5, 15, 4]); });
test('settings clamp bad input', () => { const s = C.sanitizeSettings({ focus: 'x', short: -3, longEvery: 99 }); assert.strictEqual(s.focus, 25); assert.strictEqual(s.short, 1); assert.strictEqual(s.longEvery, 12); });
test('timer uses timestamps', () => {
  let t = C.createTimer('focus', S); assert.strictEqual(t.remaining, 1500000);
  t = C.start(t, 1000); assert.strictEqual(C.remaining(t, 1000 + 600000), 900000);
  t = C.pause(t, 1000 + 600000); assert.strictEqual(C.remaining(t, 9e12), 900000);
  t = C.start(t, 5000000); assert.ok(!C.isDone(t, 5000000 + 899999)); assert.ok(C.isDone(t, 5000000 + 900000));
});
test('throttled tick still finishes on time', () => { const t = C.start(C.createTimer('short', S), 0); assert.strictEqual(C.remaining(t, 10 * 60000), 0); });
test('double start/pause are no-ops', () => { const t = C.start(C.createTimer('focus', S), 0); assert.strictEqual(C.start(t, 50).endAt, t.endAt); const p = C.pause(t, 10); assert.strictEqual(C.pause(p, 99).remaining, p.remaining); });
test('long break every N', () => {
  assert.strictEqual(C.nextPhase('focus', 1, S), 'short'); assert.strictEqual(C.nextPhase('focus', 4, S), 'long');
  assert.strictEqual(C.nextPhase('focus', 8, S), 'long'); assert.strictEqual(C.nextPhase('long', 4, S), 'focus');
  assert.strictEqual(C.nextPhase('focus', 2, C.sanitizeSettings({ longEvery: 2 })), 'long');
});
test('tree stages', () => { assert.deepStrictEqual([0, 0.2, 0.5, 0.8, 1].map(C.treeStage), [0, 1, 2, 3, 4]); });
test('fmt', () => { assert.strictEqual(C.fmt(1500000), '25:00'); assert.strictEqual(C.fmt(61001), '01:02'); });
test('streak current and best', () => {
  const h = [sess(day(2026, 10, 1)), sess(day(2026, 10, 2)), sess(day(2026, 10, 3)), sess(day(2026, 10, 10)), sess(day(2026, 10, 11)), sess(day(2026, 10, 12, 9), 25, false)];
  assert.deepStrictEqual(C.streaks(h, day(2026, 10, 12)), { current: 2, best: 3 });
  assert.strictEqual(C.streaks(h, day(2026, 10, 13)).current, 0);
});
test('streak across month boundary', () => { const h = [sess(day(2026, 9, 30)), sess(day(2026, 10, 1))]; assert.deepStrictEqual(C.streaks(h, day(2026, 10, 1)), { current: 2, best: 2 }); });
test('stats today/week', () => {
  const now = day(2026, 10, 16, 15);
  const h = [sess(day(2026, 10, 16, 9)), sess(day(2026, 10, 16, 11), 50), sess(day(2026, 10, 14)), sess(day(2026, 10, 1)), sess(day(2026, 10, 16, 12), 10, false)];
  const s = C.stats(h, now);
  assert.strictEqual(s.todayMinutes, 75); assert.strictEqual(s.todaySessions, 2); assert.strictEqual(s.weekMinutes, 100);
  assert.strictEqual(s.week.length, 7); assert.strictEqual(s.week[6].minutes, 75); assert.strictEqual(s.withered, 1); assert.strictEqual(s.totalSessions, 4);
});
test('species unlocks', () => {
  assert.deepStrictEqual(C.unlocked({ totalSessions: 0, bestStreak: 0, totalMinutes: 0 }), ['oak']);
  assert.deepStrictEqual(C.unlocked({ totalSessions: 10, bestStreak: 2, totalMinutes: 250 }), ['oak', 'pine', 'birch', 'cherry']);
  assert.strictEqual(C.pickSpecies('maple', { totalSessions: 0, bestStreak: 0, totalMinutes: 0 }, 1), 'oak');
});
test('import validation and merge', () => {
  assert.throws(() => C.validateImport({}));
  const d = C.validateImport({ history: [sess(5), { bad: 1 }], settings: { focus: 50 } });
  assert.strictEqual(d.history.length, 1); assert.strictEqual(d.settings.focus, 50);
  assert.strictEqual(C.mergeHistory([sess(5)], [sess(5), sess(9)]).length, 2);
});
