// Ambient soundscapes synthesized with Web Audio. No audio files.
(function (root) {
  let ctx = null, master = null, nodes = [], current = 'off';
  function ac() { if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); } if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  function noiseBuffer(type) {
    const c = ac(); const len = c.sampleRate * 4; const b = c.createBuffer(1, len, c.sampleRate); const d = b.getChannelData(0);
    let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else if (type === 'pink') { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18; }
      else d[i] = w;
    }
    return b;
  }
  function loop(type) { const s = ac().createBufferSource(); s.buffer = noiseBuffer(type); s.loop = true; s.start(); nodes.push(s); return s; }
  function filt(t, f, q) { const n = ctx.createBiquadFilter(); n.type = t; n.frequency.value = f; if (q) n.Q.value = q; return n; }
  function gain(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  let timers = [];
  function chirp() {
    if (current !== 'forest') return;
    const t = ctx.currentTime; const n = 2 + Math.floor(Math.random() * 4); const base = 2200 + Math.random() * 1800;
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(); const g = ctx.createGain(); const st = t + i * 0.13;
      o.frequency.setValueAtTime(base, st); o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), st + 0.08);
      g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.05, st + 0.02); g.gain.linearRampToValueAtTime(0, st + 0.1);
      o.connect(g).connect(master); o.start(st); o.stop(st + 0.12);
    }
    timers.push(setTimeout(chirp, 1500 + Math.random() * 5000));
  }
  function stop() { nodes.forEach((n) => { try { n.stop ? n.stop() : 0; } catch (e) {} try { n.disconnect(); } catch (e) {} }); nodes = []; timers.forEach(clearTimeout); timers = []; current = 'off'; }
  function play(kind) {
    stop(); if (kind === 'off') return; ac(); current = kind;
    if (kind === 'brown') { const s = loop('brown'); s.connect(gain(0.9)).connect(master); }
    if (kind === 'rain') { const s = loop('pink'); const hp = filt('highpass', 400); const lp = filt('lowpass', 6000); s.connect(hp).connect(lp).connect(gain(0.8)).connect(master); const d = loop('white'); d.connect(filt('bandpass', 3000, 0.8)).connect(gain(0.05)).connect(master); }
    if (kind === 'wind') {
      const s = loop('pink'); const bp = filt('bandpass', 500, 0.7); const g = gain(0.6); s.connect(bp).connect(g).connect(master);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08; const lg = gain(350); lfo.connect(lg).connect(bp.frequency); lfo.start(); nodes.push(lfo);
      const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.13; const lg2 = gain(0.3); lfo2.connect(lg2).connect(g.gain); lfo2.start(); nodes.push(lfo2);
    }
    if (kind === 'forest') { const s = loop('pink'); s.connect(filt('lowpass', 900)).connect(gain(0.35)).connect(master); timers.push(setTimeout(chirp, 600)); }
  }
  function volume(v) { ac(); master.gain.value = v; }
  function chime() {
    const c = ac(); const t = c.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = c.createOscillator(); const g = c.createGain(); o.type = 'sine'; o.frequency.value = f; const st = t + i * 0.18;
      g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.25, st + 0.02); g.gain.exponentialRampToValueAtTime(0.001, st + 1.2);
      o.connect(g).connect(c.destination); o.start(st); o.stop(st + 1.3);
    });
  }
  root.FFSound = { play, stop, volume, chime, get current() { return current; } };
})(typeof self !== 'undefined' ? self : this);
