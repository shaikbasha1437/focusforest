// Pixel-art tree renderer on canvas. Each tree is drawn on a 16x16 pixel grid.
(function (root) {
  const P = { trunk: '#6b4a2f', trunkD: '#4a321f', soil: '#3b2a1c', grass: '#4f7a3a', grassL: '#6d9b4a' };
  const SP = {
    oak: { leaf: '#3f8f46', leafL: '#66b35a', leafD: '#2b6634' },
    pine: { leaf: '#2e6b4f', leafL: '#4c8f69', leafD: '#1d4a37' },
    birch: { leaf: '#9cc95a', leafL: '#c4e27c', leafD: '#6f9a3c', trunk: '#e8e2d4', trunkD: '#555' },
    cherry: { leaf: '#f2a7c3', leafL: '#ffd0e0', leafD: '#c97597' },
    maple: { leaf: '#d9622b', leafL: '#f2914d', leafD: '#a2431c' },
    willow: { leaf: '#7fae5d', leafL: '#a6cf7e', leafD: '#557a3c' },
    golden: { leaf: '#e8b931', leafL: '#ffe07a', leafD: '#b58a17' },
  };
  function px(ctx, s, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x * s, y * s, w * s, h * s); }
  function blob(ctx, s, cx, cy, r, c, cl, cd) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = x * x + y * y; if (d > r * r + r * 0.6) continue;
      px(ctx, s, cx + x, cy + y, 1, 1, y < -r / 3 && x < 0 ? cl : y > r / 2 ? cd : c);
    }
  }
  function drawTree(ctx, species, stage, withered, scale) {
    const s = scale; const c = SP[species] || SP.oak; const tr = c.trunk || P.trunk; const trd = c.trunkD || P.trunkD;
    px(ctx, s, 1, 14, 14, 2, P.soil); px(ctx, s, 1, 14, 14, 1, P.grass); px(ctx, s, 3, 14, 2, 1, P.grassL); px(ctx, s, 11, 14, 1, 1, P.grassL);
    if (withered) { px(ctx, s, 6, 11, 4, 3, '#7a5a3f'); px(ctx, s, 6, 11, 4, 1, '#a48466'); px(ctx, s, 7, 12, 2, 1, '#5e4430'); px(ctx, s, 5, 13, 1, 1, '#7a5a3f'); px(ctx, s, 10, 13, 1, 1, '#7a5a3f'); return; }
    if (stage <= 0) { px(ctx, s, 7, 13, 2, 1, '#8a6a3f'); return; }                       // seed
    if (stage === 1) { px(ctx, s, 8, 11, 1, 3, '#5f8f3a'); px(ctx, s, 7, 11, 1, 1, c.leafL); px(ctx, s, 9, 10, 1, 1, c.leaf); return; } // sprout
    const big = stage >= 4; const mid = stage === 3;
    const th = big ? 6 : mid ? 5 : 3;
    px(ctx, s, 7, 14 - th, 2, th, tr); px(ctx, s, 8, 14 - th, 1, th, trd);
    if (species === 'birch') for (let y = 14 - th; y < 14; y += 2) px(ctx, s, 7, y, 1, 1, '#333');
    const top = 14 - th;
    if (species === 'pine') {
      const layers = big ? 4 : mid ? 3 : 2;
      for (let i = 0; i < layers; i++) { const w = 2 + (layers - i) * 2; const y = top - i * 2 - 1; px(ctx, s, 8 - w / 2, y, w, 2, i % 2 ? c.leafD : c.leaf); px(ctx, s, 8 - w / 2, y, 2, 1, c.leafL); }
      px(ctx, s, 7, top - layers * 2 - 1, 2, 1, c.leafL); return;
    }
    if (species === 'willow') {
      const r = big ? 4 : mid ? 3 : 2; blob(ctx, s, 8, top - r + 1, r, c.leaf, c.leafL, c.leafD);
      for (let x = 8 - r; x <= 8 + r; x += 2) px(ctx, s, x, top, 1, big ? 4 : 2, c.leafD); return;
    }
    const r = big ? 5 : mid ? 4 : 2; blob(ctx, s, 8, top - r + 1, r, c.leaf, c.leafL, c.leafD);
    if (big && (species === 'cherry' || species === 'golden')) { px(ctx, s, 5, top - 5, 1, 1, '#fff'); px(ctx, s, 10, top - 3, 1, 1, '#fff'); px(ctx, s, 8, top - 7, 1, 1, '#fff'); }
    if (big && species === 'oak') { px(ctx, s, 5, top - 3, 1, 1, '#c44'); px(ctx, s, 11, top - 5, 1, 1, '#c44'); }
  }
  function renderTile(species, stage, withered, size) {
    const cv = document.createElement('canvas'); cv.width = cv.height = size; const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    drawTree(ctx, species, stage, withered, size / 16); return cv;
  }
  root.FFForest = { drawTree, renderTile, SPECIES_COLORS: SP };
})(typeof self !== 'undefined' ? self : this);
