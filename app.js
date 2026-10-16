(function () {
  const C = window.FFCore, F = window.FFForest, Snd = window.FFSound;
  const $ = (id) => document.getElementById(id);
  const K = { settings: 'focusforest.settings.v1', history: 'focusforest.history.v1', timer: 'focusforest.timer.v1', ui: 'focusforest.ui.v1' };
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  let settings = C.sanitizeSettings(load(K.settings, {}));
  let history = (load(K.history, []) || []).filter((h) => h && Number.isFinite(h.end));
  let ui = Object.assign({ cycle: 0, sound: 'off', volume: 0.5, species: 'auto', task: '' }, load(K.ui, {}));
  let timer = load(K.timer, null);
  if (!timer || !timer.phase || !Number.isFinite(timer.duration)) timer = C.createTimer('focus', settings);
  let seed = Math.floor(Math.random() * 1e6);
  let lastStage = -1, lastSec = -1, newTreeId = null;

  const persist = () => { save(K.timer, timer); save(K.ui, ui); };
  const now = () => Date.now();
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600); }
  function currentStats() { return C.stats(history, now()); }
  function nextSpecies() { return C.pickSpecies(ui.species, currentStats(), seed); }

  function setPhase(phase) { timer = C.createTimer(phase, settings); lastStage = -1; persist(); render(); }

  function recordFocus(completed, endTs) {
    const minutes = completed ? timer.duration / 60000 : Math.round((timer.duration - C.remaining(timer, endTs)) / 600) / 100;
    const h = { id: endTs + '-' + Math.random().toString(36).slice(2, 7), start: timer.startedAt || endTs - minutes * 60000, end: endTs, minutes: completed ? minutes : minutes, completed, species: nextSpecies(), task: ui.task.trim().slice(0, 120) };
    history.push(h); save(K.history, history); newTreeId = h.id; seed = Math.floor(Math.random() * 1e6);
    return h;
  }

  function complete(endTs) {
    const phase = timer.phase; let msg;
    if (phase === 'focus') {
      const before = C.unlocked(currentStats()); const h = recordFocus(true, endTs); ui.cycle++;
      const after = C.unlocked(currentStats()); const fresh = after.filter((x) => !before.includes(x));
      msg = 'Tree planted! ' + (h.task ? '“' + h.task + '” · ' : '') + 'Time for a break.';
      if (fresh.length) msg = 'New species unlocked: ' + fresh.map((id) => C.SPECIES.find((s) => s.id === id).name).join(', ') + '!';
    } else msg = 'Break over. Ready to focus?';
    toast(msg);
    if (settings.chime) { try { Snd.chime(); } catch (e) {} }
    if (settings.notify && 'Notification' in window && Notification.permission === 'granted' && document.hidden) { try { new Notification('FocusForest', { body: msg, icon: 'icon.svg' }); } catch (e) {} }
    const np = C.nextPhase(phase, ui.cycle, settings);
    timer = C.createTimer(np, settings); lastStage = -1;
    if (settings.autoStart) timer = C.start(timer, now());
    persist(); render(); renderData();
  }

  function startPause() {
    if (timer.running) timer = C.pause(timer, now()); else { timer = C.start(timer, now()); if (settings.notify && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }
    persist(); render();
  }
  function abandonIfNeeded() {
    if (timer.phase === 'focus' && timer.startedAt && C.remaining(timer, now()) < timer.duration && C.remaining(timer, now()) > 0) {
      if (settings.stumps) { recordFocus(false, now()); toast('Session abandoned — a stump remains.'); renderData(); }
    }
  }
  function reset() { abandonIfNeeded(); setPhase(timer.phase); }
  function skip() {
    if (timer.phase === 'focus') { abandonIfNeeded(); timer = C.createTimer(C.nextPhase('focus', ui.cycle + 1, settings), settings); }
    else timer = C.createTimer('focus', settings);
    lastStage = -1; persist(); render();
  }

  // --- rendering
  const gctx = $('growing').getContext('2d'); gctx.imageSmoothingEnabled = false;
  function render() {
    const t = now(); const rem = C.remaining(timer, t); const p = C.progress(timer, t);
    const label = C.fmt(rem);
    $('time').textContent = label; $('bar').style.width = (p * 100).toFixed(2) + '%';
    const name = timer.phase === 'focus' ? 'Focus' : timer.phase === 'short' ? 'Short break' : 'Long break';
    document.title = (timer.running ? '▶ ' : timer.startedAt ? '⏸ ' : '') + label + ' · ' + name + ' — FocusForest';
    $('startPause').textContent = timer.running ? 'Pause' : timer.startedAt ? 'Resume' : 'Start';
    document.querySelectorAll('.phase').forEach((b) => b.classList.toggle('active', b.dataset.phase === timer.phase));
    document.body.classList.toggle('break', timer.phase !== 'focus');
    const n = (ui.cycle % settings.longEvery) + 1;
    $('cycle').textContent = timer.phase === 'focus' ? 'Session ' + n + ' of ' + settings.longEvery + ' · long break after ' + settings.longEvery : name + ' · ' + ui.cycle + (ui.cycle === 1 ? ' session' : ' sessions') + ' done';
    const stage = timer.phase === 'focus' ? C.treeStage(p) : 4;
    const key = stage + timer.phase + nextSpecies();
    if (key !== lastStage) { lastStage = key; gctx.clearRect(0, 0, 192, 192); F.drawTree(gctx, timer.phase === 'focus' ? nextSpecies() : 'oak', timer.phase === 'focus' ? stage : 0, false, 12); if (timer.phase !== 'focus') { gctx.fillStyle = '#9db39f'; gctx.font = '28px system-ui'; gctx.textAlign = 'center'; gctx.fillText('☕', 96, 80); } }
  }
  function renderData() {
    const s = currentStats();
    $('stats').innerHTML = [
      [s.todayMinutes.toFixed(0), 'min today'], [s.todaySessions, 'sessions today'], [s.weekMinutes.toFixed(0), 'min this week'],
      [s.streak + (s.streak === 1 ? ' day' : ' days'), 'current streak'], [s.bestStreak + (s.bestStreak === 1 ? ' day' : ' days'), 'best streak'], [s.totalSessions, 'trees total'],
    ].map(([v, l]) => '<div class="stat"><b>' + v + '</b><span>' + l + '</span></div>').join('');
    const max = Math.max(25, ...s.week.map((w) => w.minutes));
    $('week').innerHTML = s.week.map((w, i) => { const h = (w.minutes / max) * 70; const x = 10 + i * 38; return '<rect class="b' + (i === 6 ? ' today' : '') + '" x="' + x + '" y="' + (88 - h) + '" width="26" height="' + Math.max(h, 1) + '" rx="3"><title>' + w.minutes.toFixed(0) + ' min</title></rect><text x="' + (x + 13) + '" y="104" text-anchor="middle">' + w.label + '</text>' + (w.minutes ? '<text x="' + (x + 13) + '" y="' + (84 - h) + '" text-anchor="middle">' + Math.round(w.minutes) + '</text>' : ''); }).join('');
    const forest = $('forest'); forest.innerHTML = '';
    history.forEach((h) => { const d = document.createElement('div'); d.className = 'tile' + (h.id === newTreeId ? ' new' : ''); d.title = (h.completed ? h.species : 'Withered stump') + ' · ' + Math.round(h.minutes) + ' min' + (h.task ? ' · ' + h.task : '') + ' · ' + new Date(h.end).toLocaleString(); d.appendChild(F.renderTile(h.species, 4, !h.completed, 64)); forest.appendChild(d); });
    $('forestEmpty').hidden = history.length > 0;
    $('forestCount').textContent = s.totalSessions + ' trees' + (s.withered ? ' · ' + s.withered + ' stumps' : '');
    const u = C.unlocked(s);
    $('unlocks').innerHTML = ''; C.SPECIES.forEach((sp) => { const li = document.createElement('li'); li.className = u.includes(sp.id) ? '' : 'locked'; li.appendChild(F.renderTile(sp.id, 4, false, 32)); li.append(sp.name + (u.includes(sp.id) ? '' : ' — ' + sp.need)); $('unlocks').appendChild(li); });
    const sel = $('species'); sel.innerHTML = '<option value="auto">Random unlocked</option>' + C.SPECIES.filter((sp) => u.includes(sp.id)).map((sp) => '<option value="' + sp.id + '">' + sp.name + '</option>').join('');
    sel.value = u.includes(ui.species) ? ui.species : 'auto';
    const list = $('history'); list.innerHTML = '';
    history.slice(-50).reverse().forEach((h) => { const li = document.createElement('li'); li.appendChild(F.renderTile(h.species, 4, !h.completed, 28)); const sp = document.createElement('span'); sp.textContent = (h.completed ? Math.round(h.minutes) + ' min focus' : 'Abandoned after ' + h.minutes.toFixed(1) + ' min') + (h.task ? ' — ' + h.task : ''); li.appendChild(sp); const w = document.createElement('span'); w.className = 'when'; w.textContent = new Date(h.end).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); li.appendChild(w); list.appendChild(li); });
    if (!history.length) list.innerHTML = '<li class="muted">No sessions yet.</li>';
    lastStage = -1;
  }

  function tick() {
    if (timer.running && C.isDone(timer, now())) complete(timer.endAt);
    const sec = Math.ceil(C.remaining(timer, now()) / 1000);
    if (sec !== lastSec) { lastSec = sec; render(); }
  }
  setInterval(tick, 250);
  document.addEventListener('visibilitychange', tick);

  // --- wiring
  $('startPause').onclick = startPause; $('reset').onclick = reset; $('skip').onclick = skip;
  document.querySelectorAll('.phase').forEach((b) => b.onclick = () => { if (b.dataset.phase !== timer.phase) { abandonIfNeeded(); setPhase(b.dataset.phase); } });
  $('task').value = ui.task; $('task').oninput = (e) => { ui.task = e.target.value; persist(); };
  $('species').onchange = (e) => { ui.species = e.target.value; persist(); lastStage = -1; render(); };
  function setSound(k) { ui.sound = k; persist(); try { Snd.play(k); Snd.volume(ui.volume); } catch (e) {} document.querySelectorAll('[data-sound]').forEach((b) => b.classList.toggle('active', b.dataset.sound === k)); }
  document.querySelectorAll('[data-sound]').forEach((b) => b.onclick = () => setSound(b.dataset.sound));
  document.querySelectorAll('[data-sound]').forEach((b) => b.classList.toggle('active', b.dataset.sound === 'off'));
  $('volume').value = ui.volume; $('volume').oninput = (e) => { ui.volume = Number(e.target.value); persist(); if (Snd.current !== 'off') Snd.volume(ui.volume); };
  let lastSound = 'rain';
  const form = $('settingsForm');
  function openSettings() { for (const k of ['focus', 'short', 'long', 'longEvery']) form.elements[k].value = settings[k]; for (const k of ['autoStart', 'chime', 'notify', 'stumps']) form.elements[k].checked = settings[k]; $('settings').showModal(); }
  $('openSettings').onclick = openSettings; $('openHelp').onclick = () => $('help').showModal();
  form.addEventListener('submit', (e) => {
    if (e.submitter && e.submitter.value !== 'save') return;
    const n = {}; for (const k of ['focus', 'short', 'long', 'longEvery']) n[k] = form.elements[k].value; for (const k of ['autoStart', 'chime', 'notify', 'stumps']) n[k] = form.elements[k].checked;
    settings = C.sanitizeSettings(n); save(K.settings, settings);
    if (settings.notify && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    if (!timer.startedAt) timer = C.createTimer(timer.phase, settings);
    persist(); render(); toast('Settings saved');
  });
  $('export').onclick = () => { const blob = new Blob([JSON.stringify({ app: 'FocusForest', version: 1, exported: new Date().toISOString(), settings, history }, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'focusforest-' + C.dayKey(now()) + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
  $('import').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { const d = C.validateImport(JSON.parse(await f.text())); history = C.mergeHistory(history, d.history); settings = d.settings; save(K.history, history); save(K.settings, settings); renderData(); render(); toast('Imported ' + d.history.length + ' sessions'); } catch (err) { toast('Import failed: ' + err.message); } e.target.value = ''; };
  $('clear').onclick = () => { if (confirm('Delete all FocusForest history? Export first if you want a backup.')) { history = []; ui.cycle = 0; save(K.history, history); persist(); renderData(); render(); } };

  document.addEventListener('keydown', (e) => {
    if ((e.target.matches && e.target.matches('input, textarea, select')) || document.querySelector('dialog[open]') || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (e.code === 'Space') { e.preventDefault(); startPause(); }
    else if (k === 'r') reset(); else if (k === 'n') skip();
    else if (k === '1' || k === '2' || k === '3') { const p = ['focus', 'short', 'long'][k - 1]; if (p !== timer.phase) { abandonIfNeeded(); setPhase(p); } }
    else if (k === 'm') { if (Snd.current === 'off') setSound(lastSound); else { lastSound = Snd.current; setSound('off'); } }
    else if (k === 't') { e.preventDefault(); $('task').focus(); }
    else if (k === 's') openSettings(); else if (k === '?') $('help').showModal();
  });

  // Test hook: jump the running timer to its end (used for automated checks).
  window.FocusForest = { core: C, fastForward() { if (!timer.running) timer = C.start(timer, now()); timer = Object.assign({}, timer, { endAt: now() - 1 }); tick(); return { history: history.length, cycle: ui.cycle, phase: timer.phase }; }, get state() { return { timer, settings, history, ui }; } };

  renderData(); render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
