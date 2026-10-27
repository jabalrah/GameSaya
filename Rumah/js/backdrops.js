/*
 * Gambar latar buatan sendiri: tiap tema (forest, city, beach) punya 4 layer PNG di
 * assets/backgrounds/<tema>/, dari paling belakang ke paling depan:
 *
 *   background  langit + tanah, layer paling belakang
 *   awan        awan, di atas background; bergoyang pelan (seperti dedaunan)
 *   jauh        objek jauh (bukit, pohon, gedung, laut), di atas awan
 *   --- bangunan yang dirancang pemain ---
 *   depan       objek depan (garis tanah, rumput, pagar, dll.), di atas bangunan
 *
 * Keempat file WAJIB berukuran kanvas sama: 1920 x 1200 piksel (= dunia 480 x 300 satuan, 4 piksel per satuan).
 * Awan, jauh, dan depan berlatar transparan. Garis tanah ada di y = 1080 piksel (270 satuan); bangunan berdiri di sana.
 * Semua layer diulang ke samping, jadi sisi kiri dan kanan sebaiknya menyambung. Peta memanjang: latar asli (x 0-480) disalin
 * ke kiri dan kanan (lihat COPIES di js/camera.js, bawaan 1 salinan tiap sisi = peta 3 kali lebar); geser dengan menyeret latar
 * kosong atau tombol panah. Seluruh layer, termasuk animasi depan, ikut diulang.
 * Malam dan hujan menggelapkan gambar otomatis. File yang tidak ada memakai latar vektor bawaan (js/themes.js).
 *
 * ANIMASI DEPAN: tiap tema boleh punya depan_anim_1.png, depan_anim_2.png, depan_anim_3.png (ukuran dan aturan sama dengan depan.png).
 * Frame yang ada dimainkan bergantian (ANIM.fps) di atas depan.png; bila tidak ada satu pun, depan.png dipakai sendirian.
 * ANIM.base = true (bawaan) menggambar depan.png tetap di bawah frame; false = frame menggantikan depan.png sepenuhnya.
 *
 * depth = kedalaman parallax (0 = nyaris diam, 1 = ikut bangunan penuh).
 * pin   = 1 berarti garis tanah gambar selalu sejajar garis tanah bangunan saat zoom/geser.
 * extend = true berarti baris piksel paling atas/bawah direntangkan bila layar lebih tinggi dari dunia (langit dan tanah).
 * sway  = goyangan awan: amp (satuan canvas, makin besar makin lebar), speed (radian/detik).
 */
(function (global) {
  'use strict';

  const DIR = 'assets/backgrounds/';
  const CW = 480, CH = 300;
  const SLOTS = {
    background: { depth: 0.15, pin: 1, extend: true },
    awan:       { depth: 0.06, pin: 0, sway: { amp: 7, speed: 0.7 } },
    jauh:       { depth: 0.5,  pin: 1 },
    depan:      { depth: 1,    pin: 1 },
    depan_anim_1: { depth: 1,  pin: 1 },
    depan_anim_2: { depth: 1,  pin: 1 },
    depan_anim_3: { depth: 1,  pin: 1 }
  };
  const ANIM_SLOTS = ['depan_anim_1', 'depan_anim_2', 'depan_anim_3'];
  const ANIM = { fps: 6, base: true };   // fps = frame per detik; base = gambar depan.png tetap di bawah frame
  const items = {};

  // Gambar layer diulang ke samping sampai menutupi seluruh area terlihat b (koordinat dunia).
  // Bila `stretch`, baris piksel paling atas dan paling bawah direntangkan ke atas/bawah (langit dan tanah) bila area terlihat lebih tinggi.
  function tile(c, im, b, stretch, ovl) {
    const W = im.naturalWidth || im.width, H = im.naturalHeight || im.height;
    const T = Math.min(b.y0 - 2, 0), B = Math.max(b.y1 + 2, CH);
    for (let x = Math.floor((b.x0 - 1) / CW) * CW; x < b.x1 + 1; x += CW) {
      if (stretch && T < 0) c.drawImage(im, 0, 0, W, 1, x, T, CW + ovl, -T + ovl);
      if (stretch && B > CH) c.drawImage(im, 0, H - 1, W, 1, x, CH - ovl, CW + ovl, B - CH + ovl);
      c.drawImage(im, x, 0, CW + ovl, CH);
    }
  }

  // Versi layer yang sudah diperkecil + digelapkan (malam/hujan), disimpan per ukuran. Menggambar PNG 1920x1200
  // yang diperkecil setiap frame (apalagi dari kanvas hasil digelapkan) adalah bagian paling mahal dari gambar ulang;
  // dengan versi seukuran layar, tiap layer tinggal ditempel 1:1. Versi dibuat sekali (kualitas tinggi) lalu dipakai ulang.
  const LEVELS = [800, 1200];       // lebar piksel versi kecil; yang asli (1920) dipakai bila layar lebih rapat dari itu
  const MAX_CACHED = 30, lru = [];  // batasi memori: ~3,6 MB per versi 1200 px
  function level(item, env, w) {
    const key = env.key + ':' + w;
    item.lv = item.lv || {};
    let cv = item.lv[key];
    if (cv) {
      const i = lru.findIndex(function (e) { return e.item === item && e.key === key; });
      if (i > -1 && i < lru.length - 1) lru.push(lru.splice(i, 1)[0]);
      return cv;
    }
    const im = item.img, W = im.naturalWidth || im.width, H = im.naturalHeight || im.height;
    cv = document.createElement('canvas');
    cv.width = w; cv.height = Math.max(1, Math.round(H * w / W));
    const x = cv.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(im, 0, 0, cv.width, cv.height);
    Weather.dimCanvas(cv, env);
    item.lv[key] = cv;
    lru.push({ item: item, key: key });
    while (lru.length > MAX_CACHED) { const o = lru.shift(); delete o.item.lv[o.key]; }
    return cv;
  }

  // Pilih sumber gambar terkecil yang masih cukup tajam untuk skala layar `a` (piksel per satuan dunia).
  function source(item, env, a) {
    const im = item.img, W = im.naturalWidth || im.width, native = W / CW;   // piksel per satuan pada file asli
    for (let i = 0; i < LEVELS.length; i++) {
      const per = LEVELS[i] / CW;
      if (per < native && per >= a * 0.9) return { im: level(item, env, LEVELS[i]), ratio: per / a };
    }
    return { im: Weather.dimmed(item, env), ratio: native / a };
  }

  const Backdrop = global.Backdrop = {
    SLOTS: SLOTS,
    init: function (themeIds, onLoad) {
      themeIds.forEach(function (t) {
        Object.keys(SLOTS).forEach(function (s) {
          const im = new Image();
          im.onload = function () { items[t + '/' + s] = { img: im }; onLoad(); };
          im.src = DIR + t + '/' + s + '.png';
        });
      });
    },
    // Item gambar (atau null bila file tidak ada / belum termuat).
    get: function (theme, slot) { return items[theme + '/' + slot] || null; },
    // Tema ini punya layer yang bergerak (awan)?
    animated: function (theme) { return !!items[theme + '/awan'] || !!Backdrop.frontFrame(theme, 0); },

    ANIM: ANIM,
    // Frame animasi layer depan untuk waktu t (detik): { slot, item }, atau null bila tidak ada file frame yang termuat.
    frontFrame: function (theme, t) {
      const ok = ANIM_SLOTS.filter(function (s) { return items[theme + '/' + s]; });
      if (!ok.length) return null;
      const slot = ok[Math.floor(Math.max(0, t) * ANIM.fps) % ok.length];
      return { slot: slot, item: items[theme + '/' + slot] };
    },

    // Gambar satu layer. b = area terlihat dari Renderer.setView (b.pin = geseran agar sejajar garis tanah).
    // Sumber gambar dipilih sesuai skala layar (lihat source()), jadi hampir selalu digambar 1:1 tanpa resampling mahal.
    draw: function (c, b, item, slot, env) {
      const cfg = SLOTS[slot], m = c.getTransform(), a = m.a, src = source(item, env, a);
      const dy = cfg.pin && b.pin ? b.pin * cfg.pin : 0;
      c.save();
      c.imageSmoothingQuality = src.ratio > 1.4 ? 'medium' : 'low';   // 'high' per frame jauh lebih mahal dan tidak perlu di sini
      // Skala pas 1:1 (zoom 100%): tempel di posisi piksel bulat tanpa tumpang-tindih. Blit 1:1 bulat jauh lebih murah
      // (~10x di jalur CPU) daripada blit berskala/pecahan. Awan sengaja tetap sub-piksel agar geraknya mulus.
      const exact = slot !== 'awan' && Math.abs(src.im.width - CW * a) < 0.01;
      if (exact) c.setTransform(a, 0, 0, a, Math.round(m.e), Math.round(m.f + dy * a));
      else if (dy) c.translate(0, dy);
      if (slot === 'awan') {
        // Goyang lembut seperti dedaunan: dua gelombang (ayunan utama + hembusan kecil), sedikit lebih kencang saat hujan.
        const sw = cfg.sway, wind = env.rain ? 1.35 : 1, ph = (Weather.still ? 0 : Weather.time) * sw.speed;
        const gust = Math.sin(ph) + 0.35 * Math.sin(ph * 2.3 + 1.3);
        c.translate(CW / 2 + gust * sw.amp * wind, CH / 2 + Math.sin(ph * 0.7 + 0.5) * 0.8);
        c.translate(-CW / 2, -CH / 2);
      }
      tile(c, src.im, { x0: b.x0 - 12, x1: b.x1 + 12, y0: b.y0 - dy, y1: b.y1 - dy }, cfg.extend, exact ? 0 : 0.5);   // 12 = ruang untuk goyangan awan (amp x angin <= 12)
      c.restore();
    }
  };
})(window);
