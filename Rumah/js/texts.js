/*
 * Teks: objek bertuliskan yang bisa diletakkan di mana saja, dengan ukuran, font, dan warna yang bisa diubah.
 *
 * Tiap teks digambar sekali ke kanvas kecil (resolusi tinggi) lalu diperlakukan seperti PNG biasa oleh
 * bagian game lain (ukuran, posisi, lapisan, malam/hujan, ekspor). Hasilnya disimpan (cache) per kombinasi
 * isi + ukuran + font + warna, jadi tidak digambar ulang tiap frame.
 *
 * Font diambil dari Google Fonts (lihat index.html). Kalau offline, font cadangan di `css` dipakai.
 * Tambah font baru: tambahkan satu baris di FONTS dan satu <link> di index.html.
 */
(function (global) {
  'use strict';

  const FONTS = [
    { id: 'nunito',   label: 'Bulat',          css: '"Nunito", system-ui, sans-serif' },
    { id: 'fredoka',  label: 'Imut',           css: '"Fredoka", "Nunito", system-ui, sans-serif' },
    { id: 'pacifico', label: 'Skrip',          css: '"Pacifico", "Brush Script MT", cursive' },
    { id: 'caveat',   label: 'Tulisan tangan', css: '"Caveat", "Segoe Script", cursive' },
    { id: 'lora',     label: 'Serif',          css: '"Lora", Georgia, "Times New Roman", serif' },
    { id: 'bebas',    label: 'Poster',         css: '"Bebas Neue", Impact, "Arial Narrow", sans-serif' },
    { id: 'mono',     label: 'Mesin tik',      css: '"Courier New", Courier, monospace' }
  ];

  const DEFAULTS = { text: 'Teks baru', size: 22, font: 'nunito', color: '#342628', bold: false, italic: false, stroke: 0, strokeColor: '#ffffff' };
  const SIZE_MIN = 6, SIZE_MAX = 96, STROKE_MAX = 12, MAX_LINES = 4, MAX_LINE = 40;   // ukuran dalam satuan canvas (480 x 300)
  const cache = new Map(), loaded = {};
  let measureCtx = null;

  function fontOf(id) { return FONTS.find(function (f) { return f.id === id; }) || FONTS[0]; }
  function spec(o, px) { return (o.italic ? 'italic ' : '') + (o.bold ? '700 ' : '400 ') + px + 'px ' + fontOf(o.font).css; }
  function show(o) { return o.text.trim() ? o.text : 'Teks'; }

  // Rapikan dan batasi semua nilai teks. live = true saat sedang mengetik: teks kosong boleh sementara.
  function clean(o, live) {
    o = o || {};
    let text = String(o.text == null ? DEFAULTS.text : o.text).replace(/\r/g, '').split('\n').slice(0, MAX_LINES)
      .map(function (l) { return l.slice(0, MAX_LINE); }).join('\n');
    if (!live && !text.trim()) text = 'Teks';
    const size = Math.round(+o.size);
    return {
      text: text,
      size: isFinite(size) ? Math.max(SIZE_MIN, Math.min(SIZE_MAX, size)) : DEFAULTS.size,
      font: FONTS.some(function (f) { return f.id === o.font; }) ? o.font : DEFAULTS.font,
      color: /^#[0-9a-f]{6}$/i.test(o.color || '') ? o.color.toLowerCase() : DEFAULTS.color,
      bold: !!o.bold,
      italic: !!o.italic,
      // Garis tepi: tebal 0 = tanpa garis; satuan canvas, dihitung ke arah luar huruf.
      stroke: isFinite(+o.stroke) ? Math.max(0, Math.min(STROKE_MAX, Math.round(+o.stroke))) : DEFAULTS.stroke,
      strokeColor: /^#[0-9a-f]{6}$/i.test(o.strokeColor || '') ? o.strokeColor.toLowerCase() : DEFAULTS.strokeColor
    };
  }

  function key(o) { return [o.text, o.size, o.font, o.color, o.bold ? 1 : 0, o.italic ? 1 : 0, o.stroke, o.strokeColor].join('\u0001'); }

  // Minta browser memuat font (kanvas tidak memuatnya sendiri); setelah siap, gambar ulang.
  function ensure(o) {
    const d = global.document;
    if (!d || !d.fonts || !d.fonts.load) return;
    const s = spec(o, 16);
    if (loaded[s]) return;
    try { if (d.fonts.check(s, o.text)) { loaded[s] = 1; return; } } catch (e) { /* abaikan */ }
    loaded[s] = 1;
    d.fonts.load(s, o.text).then(function () { cache.clear(); global.dispatchEvent(new Event('rumah-redraw')); }, function () { /* pakai font cadangan */ });
  }

  function build(o) {
    const lines = show(o).split('\n');
    measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
    measureCtx.font = spec(o, 100);
    let widest = 0;
    lines.forEach(function (l) { widest = Math.max(widest, measureCtx.measureText(l || ' ').width); });
    const padX = o.size * 0.2 + o.stroke, padY = o.size * 0.22 + o.stroke, lh = o.size * 1.2;   // garis tepi menambah ruang di sekeliling
    const wU = widest * o.size / 100 + padX * 2, hU = lines.length * lh + padY * 2;   // satuan canvas
    const R = Math.max(1, Math.min(6, 4096 / wU, 4096 / hU));                          // piksel per satuan
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(wU * R); cv.height = Math.ceil(hU * R);
    const x = cv.getContext('2d');
    x.font = spec(o, o.size * R);
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = o.color;
    const at = function (i) { return (padY + lh * (i + 0.5)) * R; };
    if (o.stroke > 0) {   // garis dulu (semua baris), baru isi di atasnya: bagian dalam garis tertutup huruf
      x.strokeStyle = o.strokeColor; x.lineWidth = o.stroke * 2 * R; x.lineJoin = 'round'; x.miterLimit = 2;
      lines.forEach(function (l, i) { x.strokeText(l, cv.width / 2, at(i)); });
    }
    lines.forEach(function (l, i) { x.fillText(l, cv.width / 2, at(i)); });
    const first = show(o).split('\n')[0];
    return { id: 'text', label: first.length > 18 ? first.slice(0, 17) + '\u2026' : first, img: cv, w: cv.width / R };
  }

  const Texts = {
    FONTS: FONTS, DEFAULTS: DEFAULTS, SIZE_MIN: SIZE_MIN, SIZE_MAX: SIZE_MAX, STROKE_MAX: STROKE_MAX, MAX_LINES: MAX_LINES, MAX_LINE: MAX_LINE,
    clean: clean,
    key: function (p) { return key(clean(p, true)); },
    // Item gambar untuk sebuah potongan teks (bentuknya sama dengan item aset PNG: img, w, label).
    item: function (p) {
      const o = clean(p, true), k = key(o);
      let it = cache.get(k);
      if (!it) {
        ensure(o);
        it = build(o);
        cache.set(k, it);
        if (cache.size > 60) cache.delete(cache.keys().next().value);
      }
      return it;
    },
    label: function (p) { return Texts.item(p).label; }
  };

  // Satu pintu untuk mendapatkan item gambar sebuah potongan, teks atau aset PNG.
  Assets.itemOf = function (p) {
    return p.kind === 'text' ? Texts.item(p) : Assets.find(State.GROUP[p.kind], p.type);
  };

  if (global.document && document.fonts && document.fonts.addEventListener) {
    document.fonts.addEventListener('loadingdone', function () { cache.clear(); global.dispatchEvent(new Event('rumah-redraw')); });
  }

  global.Texts = Texts;
})(window);
