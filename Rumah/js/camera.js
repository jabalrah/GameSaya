/*
 * Kamera: zoom (1x - 3x, hanya mendekat) dan geser. Bangunan memakai kamera ini apa adanya;
 * latar belakang memakai kamera yang sama tetapi dilemahkan sesuai kedalaman
 * lapisan (lihat Renderer), sehingga muncul efek parallax.
 */
(function (global) {
  'use strict';

  const W = 480, H = 300, ZMIN = 1, ZMAX = 3;   // ZMIN = 1: tidak bisa zoom keluar dari ukuran latar
  // Peta memanjang: latar asli (0 - 480) disalin ke kiri dan kanan sebanyak COPIES kali. Dengan COPIES = 1 peta membentang
  // dari x = -480 sampai x = 960 (3 kali lebar latar). Ubah COPIES untuk peta lebih panjang/pendek (0 = peta lama).
  const COPIES = 1, MAP = { x0: -W * COPIES, x1: W * (1 + COPIES) };
  let VW = 480, VH = 300;   // ukuran layar dalam satuan dunia (lebih besar dari dunia saat layar penuh)
  const cur = { z: 1, x: W / 2, y: H / 2 };
  const listeners = [];
  let target = 1, pivot = null, raf = 0, last = 0;
  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
  const emit = function () { listeners.forEach(function (f) { f(cur); }); };

  // Titik tengah pandangan dijaga supaya pandangan tidak keluar dari dunia (saat zoom in).
  function bound() {
    const hw = VW / (2 * cur.z), hh = VH / (2 * cur.z);
    cur.x = hw >= (MAP.x1 - MAP.x0) / 2 ? (MAP.x0 + MAP.x1) / 2 : clamp(cur.x, MAP.x0 + hw, MAP.x1 - hw);
    cur.y = hh >= H / 2 ? H / 2 : clamp(cur.y, hh, H - hh);
  }

  // Titik dunia (pivot) tetap berada di titik layar yang sama selama zoom.
  function place() {
    if (pivot) {
      cur.x = pivot.ax - (pivot.sx - VW / 2) / cur.z;
      cur.y = pivot.ay - (pivot.sy - VH / 2) / cur.z;
    }
    bound();
  }

  function frame(t) {
    const k = 1 - Math.exp(-Math.min(0.05, (t - last) / 1000) * 14);
    last = t;
    cur.z = Math.exp(Math.log(cur.z) + (Math.log(target) - Math.log(cur.z)) * k);
    const done = Math.abs(Math.log(target / cur.z)) < 0.002;
    if (done) cur.z = target;
    place();
    if (done) { pivot = null; raf = 0; } else raf = requestAnimationFrame(frame);
    emit();
  }

  const Camera = {
    ZMIN: ZMIN, ZMAX: ZMAX, MAP: MAP,
    view: cur,
    size: { w: VW, h: VH },
    setSize: function (w, h) { VW = w; VH = h; Camera.size.w = w; Camera.size.h = h; bound(); emit(); },
    onChange: function (fn) { listeners.push(fn); },
    toWorld: function (sx, sy) { return [(sx - VW / 2) / cur.z + cur.x, (sy - VH / 2) / cur.z + cur.y]; },

    // Zoom dengan faktor tertentu, titik layar (sx, sy) tetap di tempatnya.
    zoomAt: function (factor, sx, sy) {
      target = clamp(target * factor, ZMIN, ZMAX);
      const a = Camera.toWorld(sx, sy);
      pivot = { ax: a[0], ay: a[1], sx: sx, sy: sy };
      if (calm) { cur.z = target; place(); pivot = null; emit(); return; }
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    },
    zoomBy: function (factor) { Camera.zoomAt(factor, VW / 2, VH / 2); },
    reset: function () { Camera.zoomAt(1 / target, VW / 2, VH / 2); },

    // Geser pandangan (dx, dy dalam satuan layar); dipakai saat menyeret latar kosong.
    panBy: function (dx, dy) {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      pivot = null; target = cur.z;
      cur.x -= dx / cur.z; cur.y -= dy / cur.z;
      bound(); emit();
    }
  };

  global.Camera = Camera;
})(window);
