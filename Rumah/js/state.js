/*
 * State game: daftar potongan bangunan (dinding, jendela, pintu, atap, tambahan),
 * masing-masing punya posisi bebas. Tersimpan otomatis di localStorage.
 */
(function (global) {
  'use strict';

  const KEY = 'rumah-mungil-v4';
  const GROUP = { wall: 'walls', window: 'windows', door: 'doors', roof: 'roofs', lamp: 'lamps', foliage: 'foliage', trunk: 'trunks', extra: 'extras',
                  aksesoris_pintu: 'aksesoris_pintu', aksesoris_jendela: 'aksesoris_jendela', ruko: 'ruko', papan: 'papan', papan_menyala: 'papan_menyala', vandal: 'vandal', hiasan: 'hiasan' };
  // Aksesoris menempel ke tuan rumahnya: pintu atau jendela.
  const HOST = { aksesoris_pintu: 'door', aksesoris_jendela: 'window' };
  const listeners = [], drawListeners = [];
  let data = null, nextId = 1, selected = null, textLive = false;

  const STANDS = { roof: 1, wall: 1, door: 1, trunk: 1, ruko: 1, lamp: 1 };   // jenis yang tepi bawahnya dijaga saat diganti (lihat replace)
  const size = function (p) { return Assets.dims(Assets.itemOf(p)); };
  const dimsOf = function (kind, type) { return Assets.dims(Assets.find(GROUP[kind], type)); };
  const clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
  const ofKind = function (k) { return data.pieces.filter(function (p) { return p.kind === k; }); };

  const TIMES = ['morning', 'day', 'dusk', 'night'];                 // pagi, siang, sore, malam
  const TIME_SUN = { morning: 0.1, dusk: 0.9 };                      // pagi/sore memindahkan matahari (arah bayangan) ke posisi rendah

  function limit(p) {
    const s = size(p);
    p.x = Math.round(clamp(p.x, Camera.MAP.x0, Camera.MAP.x1 - s.w) * 10) / 10;   // seluruh peta (latar asli + salinan kiri/kanan)
    p.y = Math.round(clamp(p.y, 0, Renderer.HEIGHT - s.h) * 10) / 10;
  }

  function add(kind, type, x, y, extra) {
    const p = { id: nextId++, kind: kind, type: type, x: x, y: y };
    if (extra) Object.assign(p, extra);   // teks: isi, ukuran, font, warna
    limit(p);
    data.pieces.push(p);
    return p;
  }

  // Susun rumah: lantai-lantai dinding + jendela + pintu + atap, sesuai ukuran aset.
  function build(o) {
    const pick = function (v) { return typeof v === 'function' ? v() : v; };
    const G = Renderer.GROUND, W = dimsOf('wall', o.wall0 || Assets.walls[0].id);
    const x = (Renderer.WIDTH - W.w) / 2;
    for (let f = 0; f < o.floors; f++) {
      const top = G - W.h * (f + 1), n = f ? 3 : 2;
      add('wall', pick(o.wall), x, top);
      for (let k = 0; k < n; k++) {
        const wt = pick(o.window), wd = dimsOf('window', wt);
        add('window', wt, x + W.w / n * (k + 0.5) - wd.w / 2, top + (W.h - wd.h) / 2);
      }
    }
    const dt = pick(o.door), dd = dimsOf('door', dt);
    const door = add('door', dt, x + (W.w - dd.w) / 2, G - dd.h);
    const roofBottom = G - W.h * o.floors;
    if (o.chimney) { const ch = add('extra', 'chimney', x + W.w * 0.72, 0); ch.y = roofBottom - 4 - size(ch).h; limit(ch); }
    const rt = pick(o.roof), rd = dimsOf('roof', rt);
    add('roof', rt, x + (W.w - rd.w) / 2, roofBottom - rd.h);
    if (o.awning) { const aw = add('extra', 'awning', 0, 0); aw.x = door.x + dd.w / 2 - size(aw).w / 2; aw.y = door.y - 8; limit(aw); }
  }

  function defaults() {
    data = { pieces: [], theme: data ? data.theme : 'forest', time: data ? data.time : 'day', weather: data ? data.weather : 'clear', bg: data ? data.bg : '#ffffff', sun: data ? data.sun : 0.2 };
    build({ floors: 2, wall: 'brick', window: 'square', door: 'wood', roof: 'gable_red', chimney: true, awning: true });
    return data;
  }

  function sanitize(saved) {
    if (!saved || !Array.isArray(saved.pieces)) return null;
    data = { pieces: [], theme: Themes.has(saved.theme) ? saved.theme : 'forest',
             time: TIMES.indexOf(saved.time) > -1 ? saved.time : 'day', weather: saved.weather === 'rain' ? 'rain' : 'clear',
             bg: /^#[0-9a-f]{6}$/i.test(saved.bg || '') ? saved.bg.toLowerCase() : '#ffffff',
             sun: typeof saved.sun === 'number' && isFinite(saved.sun) ? clamp(saved.sun, 0, 1) : 0.2 };
    saved.pieces.forEach(function (p) {
      // Bangunan lama: papan warung dan neon dulu satu folder dengan papan biasa, sekarang kategori sendiri (papan_menyala).
      if (p.kind === 'papan' && (p.type === 'warung' || p.type === 'neon')) p = Object.assign({}, p, { kind: 'papan_menyala' });
      if (p.kind === 'text') add('text', 'text', +p.x || 0, +p.y || 0, Texts.clean(p));
      else if (GROUP[p.kind] && Assets.has(GROUP[p.kind], p.type)) add(p.kind, p.type, +p.x || 0, +p.y || 0);
    });
    return data.pieces.length ? data : null;
  }

  // Riwayat urungkan/ulangi: tiap perubahan menyimpan snapshot keadaan SEBELUMNYA (past), snapshot untuk
  // ulangi ada di future. Yang tercatat: objek, tema, waktu, cuaca, warna latar, dan posisi matahari. Kamera dan pilihan objek tidak.
  const HISTORY_MAX = 200;
  let past = [], future = [], quiet = 0, bgLive = false, sunLive = false;

  function plain(p) {
    const o = { id: p.id, kind: p.kind, type: p.type, x: p.x, y: p.y };
    if (p.kind === 'text') { o.text = p.text; o.size = p.size; o.font = p.font; o.color = p.color; o.bold = p.bold; o.italic = p.italic; o.stroke = p.stroke; o.strokeColor = p.strokeColor; }
    return o;
  }
  function snapshot() {
    return JSON.stringify({
      pieces: data.pieces.map(plain),
      theme: data.theme, time: data.time, weather: data.weather, bg: data.bg, sun: data.sun
    });
  }
  function restore(str) {
    const s = JSON.parse(str);
    textLive = false;
    data = { pieces: s.pieces, theme: s.theme, time: s.time, weather: s.weather, bg: s.bg, sun: typeof s.sun === 'number' ? s.sun : 0.2 };
    if (selected != null && !data.pieces.some(function (p) { return p.id === selected; })) selected = null;
  }
  // Panggil SEBELUM mengubah data. quiet > 0 = bagian dari perubahan besar yang sudah tercatat (mis. acak).
  function record(before) {
    if (quiet) return;
    past.push(before || snapshot());
    if (past.length > HISTORY_MAX) past.shift();
    future = [];
  }

  function persist() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* abaikan */ } }
  function notifyDraw() { drawListeners.forEach(function (f) { f(data); }); }
  function commit() { persist(); notifyDraw(); listeners.forEach(function (f) { f(data); }); }

  // Posisi aksesoris relatif ke pintu/jendela `host`, menurut `dock` pada itemnya (lihat js/assets.js).
  function dockPos(item, host, s) {
    const hs = size(host), d = item.dock || {}, dx = d.dx || 0, dy = d.dy || 0;
    const x = d.x === 'right' ? host.x + hs.w + dx : d.x === 'left' ? host.x - s.w + dx
            : d.x === 'inright' ? host.x + hs.w - s.w + dx : d.x === 'inleft' ? host.x + dx
            : host.x + (hs.w - s.w) / 2 + dx;
    const y = d.y === 'top' ? host.y + dy : d.y === 'bottom' ? host.y + hs.h - s.h + dy
            : d.y === 'above' ? host.y - s.h + dy : host.y + (hs.h - s.h) / 2 + dy;
    return [x, y];
  }

  // Titik awal yang masuk akal saat pemain menekan sebuah pilihan.
  function spot(kind, type, w, h) {
    const walls = ofKind('wall'), G = Renderer.GROUND, WD = dimsOf('wall', Assets.walls[0].id);
    const top = walls.reduce(function (a, b) { return !a || b.y < a.y ? b : a; }, null);
    const low = walls.reduce(function (a, b) { return !a || b.y > a.y ? b : a; }, null);
    const sel = data.pieces.find(function (p) { return p.id === selected && p.kind === 'wall'; });
    const base = sel || low;
    const cx = (Renderer.WIDTH - w) / 2;
    if (HOST[kind]) {   // aksesoris: pada pintu/jendela terpilih, kalau tidak ya yang pertama
      const hosts = ofKind(HOST[kind]), host = data.pieces.find(function (p) { return p.id === selected && p.kind === HOST[kind]; }) || hosts[hosts.length - 1];
      return host ? dockPos(Assets.find(GROUP[kind], type), host, { w: w, h: h }) : [cx, G - h - 40];
    }
    const item = Assets.find(GROUP[kind], type);
    if (kind === 'ruko') {
      const rs = ofKind('ruko'), right = rs.reduce(function (m, r) { return Math.max(m, r.x + size(r).w); }, 0);
      return [rs.length && right + w <= Camera.MAP.x1 ? right : cx, G - h];
    }
    const sign = kind === 'papan' || kind === 'papan_menyala';   // papan biasa dan papan menyala diletakkan sama
    if (sign || kind === 'hiasan' || kind === 'vandal') {
      const dr = ofKind('door')[0], ru = ofKind('ruko').slice(-1)[0], bx0 = low ? low.x : cx;
      if (item.ground) return [Math.min(bx0 + size(low || { kind: 'wall', type: Assets.walls[0].id }).w + 6, Camera.MAP.x1 - w), G + 4 - h];
      if (sign && ru) return [ru.x + (size(ru).w - w) / 2, ru.y + size(ru).h - 34 - h];
      if (sign && dr) return [dr.x + size(dr).w / 2 - w / 2, dr.y - h - 3];
      if (kind === 'hiasan') return [base ? base.x + (size(base).w - w) / 2 : cx, (top ? top.y : 80) - 2];
      return [base ? base.x + (size(base).w - w) / 2 : cx, base ? base.y + (size(base).h - h) / 2 : 100];   // vandal: di dinding
    }
    if (kind === 'wall') {
      if (!top) return [cx, G - h];
      return top.y - h >= 0 ? [top.x, top.y - h] : [Math.min(top.x + size(top).w, Camera.MAP.x1 - w), top.y];
    }
    if (kind === 'roof') return top ? [top.x + (size(top).w - w) / 2, top.y - h] : [cx, 40];
    if (kind === 'door') return low ? [low.x + (size(low).w - w) / 2, low.y + size(low).h - h] : [cx, G - h];
    if (kind === 'window') {
      return [base ? base.x + (size(base).w - w) / 2 : cx, base ? base.y + (size(base).h - h) / 2 : 80];
    }
    if (kind === 'lamp') { const dr = ofKind('door')[0]; return dr ? [dr.x + size(dr).w + 3, dr.y + 2] : [cx, 100]; }
    const win = ofKind('window')[0], door = ofKind('door')[0], bx = low ? low.x : cx;
    if (kind === 'trunk') return [bx - 24, G + 4 - h];
    if (kind === 'foliage') {
      const tr = ofKind('trunk').slice(-1)[0];
      return tr ? [tr.x + size(tr).w / 2 - w / 2, tr.y - h * 0.65] : [bx - 26, G + 4 - h];
    }
    if (type === 'chimney') return [bx + WD.w * 0.72, (top ? top.y : 80) - 4 - h];
    if (type === 'flowerbox') return win ? [win.x - 1, win.y + size(win).h - 2] : [cx, 100];
    if (type === 'awning') return door ? [door.x + size(door).w / 2 - w / 2, door.y - 8] : [cx, 100];
    if (type === 'plant') return [bx + WD.w + 1, G + 4 - h];
    return [bx - 12, G + 4 - h]; // lampu
  }

  const State = {
    GROUP: GROUP,
    init: function () {
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* abaikan */ }
      if (!sanitize(saved)) defaults();
    },
    get data() { return data; },
    get selected() { return selected; },
    size: size, ofKind: ofKind,
    HOST: HOST,
    // Posisi pasang aksesoris `p` di pintu/jendela `host` (titik awal saat aksesoris ditambah lewat klik/ketuk; menyeret tidak lagi menempel).
    dock: function (p, host) { return dockPos(Assets.itemOf(p), host, size(p)); },
    on: function (fn) { listeners.push(fn); },
    onDraw: function (fn) { drawListeners.push(fn); },
    get: function (id) { return data.pieces.find(function (p) { return p.id === id; }); },

    select: function (id) { selected = id; commit(); },
    // Geser tanpa menyimpan (dipanggil berkali-kali saat menyeret).
    moveTo: function (p, x, y) { p.x = x; p.y = y; limit(p); notifyDraw(); },
    commit: commit,

    // Pilihan dari panel (klik) atau dilepas di canvas (x, y diberikan).
    // Tidak ada batas jumlah; potongan baru selalu di lapisan paling atas.
    place: function (kind, type, x, y) {
      record();
      const d = dimsOf(kind, type);
      const pos = x != null ? [x - d.w / 2, y - d.h / 2] : spot(kind, type, d.w, d.h);
      const p = add(kind, type, pos[0], pos[1]);
      // Dari klik: geser sedikit bila persis menumpuk potongan sejenis.
      for (let i = 0; x == null && i < 20 && data.pieces.some(function (q) {
        return q !== p && q.kind === kind && q.type === type && q.x === p.x && q.y === p.y;
      }); i++) { p.x += 8; limit(p); }
      selected = p.id;
      commit();
    },
    // Ganti jenis objek yang sudah ada di gambar (mis. pintu kayu -> pintu kaca) tanpa memindahkannya.
    // Posisi tengah (kiri-kanan) dipertahankan; untuk benda yang berdiri/bertumpu (pintu, dinding, atap, batang, ruko, lampu)
    // tepi bawahnya juga dipertahankan, sisanya tengah atas-bawahnya.
    replace: function (id, type) {
      const p = data.pieces.find(function (q) { return q.id === id; });
      if (!p || p.kind === 'text' || p.type === type || !Assets.find(GROUP[p.kind], type)) return;
      record();
      const o = size(p), cx = p.x + o.w / 2, cy = p.y + o.h / 2, bottom = p.y + o.h;
      p.type = type;
      const d = size(p);
      p.x = cx - d.w / 2;
      p.y = STANDS[p.kind] ? bottom - d.h : cy - d.h / 2;
      limit(p);
      commit();
    },
    // Teks baru di tengah tampilan kamera (atau di x, y bila diberikan). props boleh sebagian: sisanya bawaan.
    addText: function (props, x, y) {
      record();
      const p = add('text', 'text', 0, 0, Texts.clean(Object.assign({}, Texts.DEFAULTS, props)));
      const d = size(p), v = Camera.view;
      p.x = x != null ? x : v.x - d.w / 2;
      p.y = y != null ? y : v.y - d.h / 2;
      limit(p);
      selected = p.id;
      commit();
      return p;
    },
    // Ubah isi/ukuran/font/warna teks. live = true saat mengetik atau menggeser penggeser: hanya gambar yang diperbarui
    // (panel tidak dibangun ulang) dan satu gerakan = satu langkah riwayat. Titik tengah teks tetap saat ukurannya berubah.
    updateText: function (id, props, live) {
      const p = data.pieces.find(function (q) { return q.id === id; });
      if (!p || p.kind !== 'text') return;
      const next = Texts.clean(Object.assign({}, p, props), live);
      const changed = Object.keys(next).some(function (k) { return next[k] !== p[k]; });
      if (!changed) { if (!live) textLive = false; return; }
      if (!live || !textLive) record();
      textLive = !!live;
      const a = size(p), cx = p.x + a.w / 2, cy = p.y + a.h / 2;
      Object.assign(p, next);
      const b = size(p);
      p.x = cx - b.w / 2; p.y = cy - b.h / 2;
      limit(p);
      if (live) { persist(); notifyDraw(); } else commit();
    },
    remove: function (id) {
      if (!data.pieces.some(function (p) { return p.id === id; })) return;
      record();
      data.pieces = data.pieces.filter(function (p) { return p.id !== id; });
      if (selected === id) selected = null;
      commit();
    },
    // Atur lapisan: 'forward' / 'backward' satu tingkat, 'front' / 'back' ke ujung tumpukan.
    restack: function (id, mode) {
      const a = data.pieces, i = a.findIndex(function (p) { return p.id === id; });
      if (i < 0) return;
      const j = mode === 'forward' ? i + 1 : mode === 'backward' ? i - 1 : mode === 'front' ? a.length - 1 : 0;
      if (j < 0 || j >= a.length || j === i) return;
      record();
      a.splice(j, 0, a.splice(i, 1)[0]);
      commit();
    },
    // Geser seluruh bangunan ke tengah canvas (arah mendatar).
    center: function () {
      const ps = data.pieces;
      if (!ps.length) return;
      const x0 = Math.min.apply(null, ps.map(function (p) { return p.x; }));
      const x1 = Math.max.apply(null, ps.map(function (p) { return p.x + size(p).w; }));
      const dx = Math.round(Camera.view.x - (x1 - x0) / 2 - x0);   // ke tengah pandangan kamera saat ini
      if (!dx) return;
      ps.forEach(function (p) { p.x += dx; limit(p); });
      commit();
    },
    setEnv: function (key, val) {
      if (data[key] !== val && ((key === 'time' && TIMES.indexOf(val) > -1) || (key === 'weather' && (val === 'clear' || val === 'rain')))) {
        record();
        if (key === 'time') {   // matahari mengikuti suasana: rendah di kiri (pagi) / kanan (sore); kembali ke siang = posisi siang bila sebelumnya diatur otomatis
          if (TIME_SUN[val] != null) data.sun = TIME_SUN[val]; else if (val === 'day' && TIME_SUN[data.time] != null) data.sun = 0.35;
        }
        data[key] = val; commit();
      }
    },
    setTheme: function (id) { if (Themes.has(id) && data.theme !== id) { record(); data.theme = id; commit(); } },
    // Warna latar tema polos (#rrggbb). live = true saat pemilih warna sedang digeser: gambar saja
    // yang diperbarui (panel tidak dibangun ulang, supaya pemilih warna tidak menutup sendiri).
    setBg: function (hex, live) {
      if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return;
      hex = hex.toLowerCase();
      // Satu gerakan pemilih warna = satu langkah riwayat (dicatat saat input live pertama, bukan tiap warna).
      if (hex !== data.bg && (!live || !bgLive)) record();
      bgLive = !!live;
      data.bg = hex;
      if (live) { persist(); notifyDraw(); } else commit();
    },
    // Posisi matahari 0 (kiri, terbit) - 0.5 (puncak) - 1 (kanan, terbenam). Memengaruhi arah dan panjang bayangan.
    // live = true saat penggeser sedang diseret: hanya gambar yang diperbarui, satu seretan = satu langkah riwayat.
    setSun: function (v, live) {
      v = Math.round(clamp(+v, 0, 1) * 100) / 100;
      if (!isFinite(v)) return;
      if (v !== data.sun && (!live || !sunLive)) record();
      sunLive = !!live;
      data.sun = v;
      if (live) { persist(); notifyDraw(); } else commit();
    },
    reset: function () { record(); selected = null; defaults(); commit(); },
    // Hapus semua objek bangunan (tema, cuaca, dan matahari tetap). Bisa diurungkan.
    clear: function () { if (!data.pieces.length) return; record(); selected = null; data.pieces = []; commit(); },
    randomize: function () {
      record(); quiet++;
      selected = null; data = { pieces: [], theme: data.theme, time: data.time, weather: data.weather, bg: data.bg, sun: data.sun };
      const rnd = function (g) { return function () { return g[Math.floor(Math.random() * g.length)].id; }; };
      build({ floors: 1 + Math.floor(Math.random() * 3), wall: rnd(Assets.walls), window: rnd(Assets.windows),
              door: rnd(Assets.doors), roof: rnd(Assets.roofs) });
      Assets.extras.forEach(function (e) {
        if (e.id !== 'chimney' && e.id !== 'awning' && Math.random() < 0.35) State.place('extra', e.id);
      });
      quiet--;
      commit();
    },

    // Seret objek: ui.js mengambil snapshot saat mulai (snap), lalu mencatatnya hanya kalau posisinya benar-benar berubah.
    snap: snapshot,
    pushUndo: function (before) { if (before !== snapshot()) record(before); },

    undo: function () {
      if (!past.length) return false;
      future.push(snapshot()); restore(past.pop()); commit(); return true;
    },
    redo: function () {
      if (!future.length) return false;
      past.push(snapshot()); restore(future.pop()); commit(); return true;
    },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; }
  };

  global.State = State;
})(window);
