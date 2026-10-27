/*
 * Tema: latar belakang dibagi menjadi LAPISAN, dari paling jauh ke paling dekat.
 * Tiap lapisan punya `depth` (0 = sangat jauh, 1 = sama dengan bangunan).
 * Saat zoom/geser, lapisan berskala zoom^depth dan bergeser sebesar depth x geseran
 * bangunan, jadi yang jauh nyaris diam dan yang dekat bergerak cepat (parallax).
 * Lapisan digambar langsung dengan vektor (selalu tajam di zoom berapa pun) dan
 * hanya untuk area yang terlihat: draw(c, b) menerima b = {x0, x1, y0, y1, G, H}.
 * Pola berulang dihitung dari koordinat absolut agar tetap konsisten saat digeser.
 * Garis tanah (`ground`) digambar Renderer paling depan, di atas semua potongan.
 */
(function (global) {
  'use strict';

  const mod = function (n, m) { return ((n % m) + m) % m; };
  function fill(c, col, x, y, w, h) { c.fillStyle = col; c.fillRect(x, y, w, h); }

  // Isi pita mendatar dari ya sampai yb (default: dasar area terlihat).
  function band(c, col, b, ya, yb) {
    const t = Math.max(ya, b.y0 - 2), d = Math.min(yb == null ? b.y1 + 2 : yb, b.y1 + 2);
    if (d > t) fill(c, col, b.x0 - 2, t, b.x1 - b.x0 + 4, d - t);
  }

  function grad(c, y0, y1, stops) {
    const g = c.createLinearGradient(0, y0, 0, y1);
    stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    return g;
  }

  function glow(c, x, y, r, inner, outer) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, inner); g.addColorStop(1, outer);
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function cloud(c, x, y, s, col) {
    c.fillStyle = col || 'rgba(255,255,255,0.92)';
    [[0, 6, 10], [12, 0, 13], [26, 5, 11], [14, 8, 12]].forEach(function (k) {
      c.beginPath(); c.arc(x + k[0] * s, y + k[1] * s, k[2] * s, 0, Math.PI * 2); c.fill();
    });
    c.fillRect(x, y + 6 * s, 37 * s, 10 * s);
    c.beginPath(); c.arc(x + 37 * s, y + 11 * s, 5 * s, 0, Math.PI * 2); c.fill();
  }

  // Panggil fn(x, i) untuk x = start + i*step yang terlihat (i boleh negatif).
  function across(b, step, start, pad, fn) {
    const i0 = Math.floor((b.x0 - pad - start) / step), i1 = Math.ceil((b.x1 + pad - start) / step);
    for (let i = i0; i <= i1; i++) fn(start + i * step, i);
  }

  // Garis y = f(x) sepanjang area terlihat; `close` menutupnya sampai dasar (untuk diisi).
  function curve(c, b, step, f, close) {
    const x0 = Math.floor(b.x0 / step) * step - step, x1 = b.x1 + step;
    c.beginPath();
    if (close) c.moveTo(x0, b.y1 + 4);
    for (let x = x0, first = !close; x <= x1; x += step, first = false) {
      first ? c.moveTo(x, f(x)) : c.lineTo(x, f(x));
    }
    if (close) { c.lineTo(x1, b.y1 + 4); c.closePath(); }
  }

  function hills(c, col, b, base, amp, freq, ph) {
    curve(c, b, 4, function (x) {
      return base + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 2.3 + ph * 2) * amp * 0.4;
    }, true);
    c.fillStyle = col; c.fill();
  }

  function pine(c, x, base, h, col, trunk) {
    fill(c, trunk, x - 2, base - 8, 4, 10);
    c.fillStyle = col;
    for (let k = 0; k < 3; k++) {
      const top = base - 6 - h + k * h * 0.27, w = h * (0.34 + 0.13 * k), t = h * 0.42;
      c.beginPath(); c.moveTo(x, top); c.lineTo(x + w / 2, top + t); c.lineTo(x - w / 2, top + t); c.closePath(); c.fill();
    }
  }

  function tower(c, body, win, lit, x, base, w, h, seed) {
    fill(c, body, x, base - h, w, h + 4);
    for (let y = base - h + 8, r = 0; y < base - 10; y += 11, r++) {
      for (let wx = x + 6, k = 0; wx < x + w - 6; wx += 10, k++) {
        fill(c, lit && (seed + r + k) % 3 === 0 ? lit : win, wx, y, 5, 6);
      }
    }
  }

  function wave(c, b, y, amp, len, col, lw) {
    curve(c, b, 3, function (x) { return y + Math.sin(x / len) * amp; }, false);
    c.strokeStyle = col; c.lineWidth = lw; c.stroke();
  }

  function dot(c, col, x, y, r) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }

  const sky = function (stops, to) {
    return function (c, b) { band(c, grad(c, 0, to || b.G, stops), b, b.y0 - 2); };
  };

  const THEMES = [
    {
      id: 'forest', label: 'Hutan', sun: [380, 60],
      ground: { y: -2, h: 5, body: '#5c9440', top: '#3f6f2e' },
      layers: [
        { depth: 0, slot: 'background', draw: sky([[0, '#cdebdc'], [1, '#eef8ea']]) },
        { depth: 0.18, slot: 'jauh', draw: function (c, b) { hills(c, '#b4dbb4', b, b.G - 78, 22, 0.018, 0); } },
        { depth: 0.32, slot: 'jauh', draw: function (c, b) { hills(c, '#8fc79a', b, b.G - 46, 18, 0.026, 1.7); } },
        { depth: 0.5, slot: 'jauh', draw: function (c, b) {
          across(b, 30, 12, 30, function (x, i) { pine(c, x, b.G - 4, 52 + mod(i * 7, 3) * 9, '#7fb792', '#7fb792'); });
        } },
        { depth: 0.72, slot: 'jauh', draw: function (c, b) {
          across(b, 66, 22, 40, function (x, i) { pine(c, x, b.G - 2, 84 + mod(i * 5, 3) * 12, '#3f7d54', '#6b4a33'); });
        } },
        { depth: 1, slot: 'background', draw: function (c, b) {
          const G = b.G;
          band(c, grad(c, G - 2, b.H, [[0, '#a8d47c'], [1, '#86b95c']]), b, G - 2);
          across(b, 16, 6, 6, function (x, i) {
            dot(c, '#7aae52', x + mod(i, 3) * 4, G + 12 + mod(i, 4) * 5, 1.6);
            if (mod(i, 4) === 0) dot(c, mod(i, 8) ? '#ffffff' : '#f4c542', x + 7, G + 8 + mod(i, 3) * 7, 1.5);
          });
        } }
      ]
    },
    {
      id: 'city', label: 'Kota', sun: [90, 50],
      ground: { y: -2, h: 5, body: '#c8cbd0', top: '#6b717a' },
      layers: [
        { depth: 0, slot: 'background', draw: sky([[0, '#b9d6f3'], [1, '#eaf3fb']]) },
        { depth: 0.05, slot: 'awan', draw: function (c) { cloud(c, 230, 30, 0.6); } },
        { depth: 0.08, slot: 'awan', draw: function (c) { cloud(c, 330, 70, 0.8); } },
        { depth: 0.11, slot: 'awan', draw: function (c) { cloud(c, 60, 50, 1); } },
        { depth: 0.38, slot: 'jauh', draw: function (c, b) {
          across(b, 38, 0, 38, function (x, i) { tower(c, '#b7c6da', '#d3deec', null, x, b.G, 31, 78 + mod(i * 37, 5) * 18, i); });
        } },
        { depth: 0.62, slot: 'jauh', draw: function (c, b) {
          across(b, 58, 12, 50, function (x, i) {
            const h = 100 + mod(i * 53, 4) * 22;
            tower(c, '#8499b4', '#6a7d98', '#f8e8a8', x, b.G, 46, h, i);
            if (mod(i, 2)) fill(c, '#8499b4', x + 21, b.G - h - 12, 3, 12);
          });
        } },
        { depth: 1, slot: 'background', draw: function (c, b) {
          const G = b.G;
          band(c, grad(c, G - 2, G + 18, [[0, '#a8aeb7'], [1, '#8f959e']]), b, G - 2, G + 18);
          band(c, '#656b75', b, G + 18);
          c.strokeStyle = '#f3e6aa'; c.lineWidth = 3; c.lineCap = 'round';
          across(b, 30, 10, 16, function (x) { c.beginPath(); c.moveTo(x, G + 28); c.lineTo(x + 14, G + 28); c.stroke(); });
        } }
      ]
    },
    {
      id: 'beach', label: 'Pantai', sun: [400, 64], disc: true,
      ground: { y: -2, h: 5, body: '#e6c981', top: '#b99552' },
      layers: [
        { depth: 0, slot: 'background', draw: sky([[0, '#a9dff3'], [1, '#eaf7fb']], 170) },
        { depth: 0.05, slot: 'awan', draw: function (c) { cloud(c, 230, 34, 0.7); } },
        { depth: 0.09, slot: 'awan', draw: function (c) { cloud(c, 50, 52, 1); } },
        { depth: 0.25, slot: 'jauh', draw: function (c, b) {
          band(c, grad(c, 168, b.G - 10, [[0, '#2f9ccb'], [1, '#8fd6e8']]), b, 168);
          band(c, 'rgba(255,255,255,0.5)', b, 168, 169.5);
          for (let i = 0, y = 182; y < b.G - 22; y += 15, i++) wave(c, b, y, 1.8, 9 + i * 1.5, 'rgba(255,255,255,0.4)', 1.2);
        } },
        { depth: 1, slot: 'background', draw: function (c, b) {
          const G = b.G, top = function (x) { return G - 13 + Math.sin(x / 12) * 2; };
          curve(c, b, 3, top, true);
          c.fillStyle = grad(c, G - 14, b.H, [[0, '#f7e6b5'], [1, '#e9cf93']]); c.fill();
          curve(c, b, 3, top, false);
          c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 2.2; c.stroke();
          across(b, 17, 6, 6, function (x, i) { dot(c, '#d9bd80', x + mod(i, 3) * 5, G + 8 + mod(i, 4) * 6, 1); });
        } }
      ]
    },
    // Polos: tanpa latar belakang dan tanpa garis tanah, hanya satu warna rata (warna dipilih pemain,
    // state.bg). Tidak punya lapisan sendiri; Weather.layers menggambar warnanya.
    { id: 'plain', label: 'Polos', plain: true, ground: null, layers: [] }
  ];

  global.Themes = {
    cloud: cloud, across: across,
    list: THEMES,
    has: function (id) { return THEMES.some(function (t) { return t.id === id; }); },
    find: function (id) { return THEMES.find(function (t) { return t.id === id; }) || THEMES[0]; }
  };
})(window);
