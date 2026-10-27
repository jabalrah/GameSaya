/*
 * Daftar semua aset PNG.
 * Untuk menambah pilihan baru: taruh PNG di folder assets/<jenis>/ lalu tambahkan satu baris di sini.
 */
(function (global) {
  'use strict';

  const Assets = {
    walls: [
      { id: 'brick', label: 'Bata', src: 'assets/walls/wall_brick.png' },
      { id: 'wood', label: 'Kayu', src: 'assets/walls/wall_wood.png' },
      { id: 'plaster', label: 'Plester', src: 'assets/walls/wall_plaster.png' },
      { id: 'stone', label: 'Batu', src: 'assets/walls/wall_stone.png' }
    ],
    // Jendela: cahaya malam menyebar otomatis (ukuran mengikuti jendela). Mau diatur per jendela? Tambahkan
    // glowR (jari-jari, satuan canvas), glowColor ('r,g,b'), atau glow (titik pusat, pecahan lebar/tinggi); bawaan di WINDOW_GLOW (js/weather.js).
    windows: [
      { id: 'square', label: 'Persegi', src: 'assets/windows/window_square.png' },
      { id: 'arch', label: 'Lengkung', src: 'assets/windows/window_arch.png' },
      { id: 'round', label: 'Bulat', src: 'assets/windows/window_round.png' },
      { id: 'shutter', label: 'Berdaun', src: 'assets/windows/window_shutter.png' }
    ],
    doors: [
      { id: 'wood', label: 'Kayu', src: 'assets/doors/door_wood.png' },
      { id: 'blue', label: 'Biru', src: 'assets/doors/door_blue.png' },
      { id: 'arch', label: 'Lengkung', src: 'assets/doors/door_arch.png' },
      { id: 'glass', label: 'Kaca', src: 'assets/doors/door_glass.png' }
    ],
    roofs: [
      { id: 'gable_red', label: 'Pelana merah', src: 'assets/roofs/roof_gable_red.png' },
      { id: 'gable_blue', label: 'Pelana biru', src: 'assets/roofs/roof_gable_blue.png' },
      { id: 'flat', label: 'Datar', src: 'assets/roofs/roof_flat.png' },
      { id: 'garden', label: 'Atap kebun', src: 'assets/roofs/roof_garden.png' },
      { id: 'thatch', label: 'Jerami', src: 'assets/roofs/roof_thatch.png' }
    ],
    // Lampu: dipasang di mana saja (dinding, atas tiang, dll.). Menyala di mode malam.
    // `glow` = titik pusat cahaya (pecahan lebar, tinggi). PNG malam: nama_malam.png.
    lamps: [
      { id: 'lantern', label: 'Lampu lentera', src: 'assets/lamps/lamp_lantern.png', glow: [0.5, 0.55] },
      { id: 'globe', label: 'Lampu bulat', src: 'assets/lamps/lamp_globe.png', glow: [0.5, 0.3] }
    ],
    // Dedaunan: bergoyang lembut ke kiri-kanan (poros di tengah bawah). `sway.amp` = kemiringan (makin besar makin
    // lebar), `sway.speed` = kecepatan (radian/detik), `ground` = posisi awal di tanah.
    foliage: [
      { id: 'crown', label: 'Tajuk bulat', src: 'assets/foliage/foliage_crown.png', sway: { amp: 0.05, speed: 1.1 } },
      { id: 'pinetop', label: 'Tajuk cemara', src: 'assets/foliage/foliage_pine.png', sway: { amp: 0.04, speed: 1.2 } },
      { id: 'bush', label: 'Semak', src: 'assets/foliage/foliage_bush.png', ground: true, sway: { amp: 0.05, speed: 1.3 } },
      { id: 'grass', label: 'Rumput', src: 'assets/foliage/foliage_grass.png', ground: true, sway: { amp: 0.14, speed: 1.9 } },
      { id: 'tallgrass', label: 'Rumput tinggi', src: 'assets/foliage/foliage_tallgrass.png', ground: true, sway: { amp: 0.12, speed: 1.7 } }
    ],
    // Batang pohon: diam (tidak beranimasi), dedaunan diletakkan terpisah di atasnya.
    trunks: [
      { id: 'oak', label: 'Batang pohon', src: 'assets/trunks/trunk_oak.png' },
      { id: 'pine', label: 'Batang cemara', src: 'assets/trunks/trunk_pine.png' }
    ],
    extras: [
      { id: 'chimney', label: 'Cerobong', src: 'assets/extras/extra_chimney.png' },
      { id: 'flowerbox', label: 'Pot bunga jendela', src: 'assets/extras/extra_flowerbox.png' },
      { id: 'plant', label: 'Tanaman', src: 'assets/extras/extra_plant.png' },
      { id: 'awning', label: 'Kanopi', src: 'assets/extras/extra_awning.png' }
    ],

    // --- Kategori tambahan ---
    // `dock` (aksesoris pintu/jendela): titik awal pemasangan di pintu/jendela terpilih saat aksesoris ditambah lewat klik/ketuk. x: center | right | left |
    // inright | inleft (terhadap pintu/jendela); y: center | top | bottom | above; dx, dy = geseran (satuan canvas).
    // `ground` = berdiri di tanah (posisi awalnya di tanah dan punya bayangan kontak; menyeret tidak lagi menempel).
    // `glow` / `glowR` / `glowColor` = titik, jari-jari, dan warna (r,g,b) cahaya malam; hanya dipakai bila ada PNG _malam.
    aksesoris_pintu: [
      { id: 'keset', label: 'Keset', src: 'assets/aksesoris_pintu/pintu_keset.png', dock: { x: 'center', y: 'bottom', dy: 3 } },
      { id: 'karangan', label: 'Karangan bunga', src: 'assets/aksesoris_pintu/pintu_karangan.png', dock: { x: 'center', y: 'top', dy: 5 } },
      { id: 'nomor', label: 'Nomor rumah', src: 'assets/aksesoris_pintu/pintu_nomor.png', dock: { x: 'right', y: 'top', dy: 6, dx: 1.5 } },
      { id: 'gagang', label: 'Gagang pintu', src: 'assets/aksesoris_pintu/pintu_gagang.png', dock: { x: 'inright', y: 'center', dy: 3, dx: -1.5 } },
      { id: 'lonceng', label: 'Lonceng angin', src: 'assets/aksesoris_pintu/pintu_lonceng.png', dock: { x: 'center', y: 'above', dy: 4 } },
      { id: 'kotak_surat', label: 'Kotak surat', src: 'assets/aksesoris_pintu/pintu_kotak_surat.png', dock: { x: 'right', y: 'center', dx: 2 } }
    ],
    aksesoris_jendela: [
      { id: 'tirai', label: 'Tirai', src: 'assets/aksesoris_jendela/jendela_tirai.png', dock: { x: 'center', y: 'center' } },
      { id: 'teralis', label: 'Teralis besi', src: 'assets/aksesoris_jendela/jendela_teralis.png', dock: { x: 'center', y: 'center' } },
      { id: 'daun', label: 'Daun jendela', src: 'assets/aksesoris_jendela/jendela_daun.png', dock: { x: 'center', y: 'center' } },
      { id: 'kanopi', label: 'Kanopi jendela', src: 'assets/aksesoris_jendela/jendela_kanopi.png', dock: { x: 'center', y: 'above', dy: 4 } },
      { id: 'pot', label: 'Pot di ambang', src: 'assets/aksesoris_jendela/jendela_pot.png', dock: { x: 'center', y: 'bottom', dy: 1 } },
      { id: 'kucing', label: 'Kucing', src: 'assets/aksesoris_jendela/jendela_kucing.png', dock: { x: 'center', y: 'bottom', dy: 1 } }
    ],
    ruko: [
      { id: 'klasik', label: 'Ruko klasik', src: 'assets/ruko/ruko_klasik.png', glow: [0.5, 0.78], glowR: 40 },
      { id: 'modern', label: 'Ruko modern', src: 'assets/ruko/ruko_modern.png', glow: [0.5, 0.84], glowR: 40 },
      { id: 'kopi', label: 'Ruko kopi', src: 'assets/ruko/ruko_kopi.png', glow: [0.5, 0.78], glowR: 40 },
      { id: 'warung', label: 'Warung', src: 'assets/ruko/ruko_warung.png', glow: [0.5, 0.7], glowR: 36 }
    ],
    papan: [
      { id: 'toko', label: 'Papan toko', src: 'assets/papan/papan_toko.png' },
      { id: 'buka', label: 'Buka', src: 'assets/papan/papan_buka.png' },
      { id: 'tutup', label: 'Tutup', src: 'assets/papan/papan_tutup.png' },
      { id: 'menu', label: 'Papan menu', src: 'assets/papan/papan_menu.png', ground: true },
      { id: 'nama', label: 'Papan nama', src: 'assets/papan/papan_nama.png' }
    ],
    // Papan yang menyala di malam hari: tiap papan punya PNG _malam di folder yang sama (papan_neon.png -> papan_neon_malam.png).
    papan_menyala: [
      { id: 'warung', label: 'Papan warung', src: 'assets/papan_menyala/papan_warung.png', glow: [0.5, 0.6], glowR: 30 },
      { id: 'neon', label: 'Neon OPEN', src: 'assets/papan_menyala/papan_neon.png', glow: [0.5, 0.5], glowR: 30, glowColor: '255,95,168' }
    ],
    vandal: [
      { id: 'bintang', label: 'Bintang', src: 'assets/vandal/vandal_bintang.png' },
      { id: 'hati', label: 'Hati', src: 'assets/vandal/vandal_hati.png' },
      { id: 'keren', label: 'Tulisan KEREN', src: 'assets/vandal/vandal_keren.png' },
      { id: 'tag', label: 'Tanda tangan', src: 'assets/vandal/vandal_tag.png' },
      { id: 'smiley', label: 'Senyum', src: 'assets/vandal/vandal_smiley.png' },
      { id: 'cipratan', label: 'Cipratan cat', src: 'assets/vandal/vandal_cipratan.png' }
    ],
    hiasan: [
      { id: 'bendera', label: 'Bendera merah putih', src: 'assets/hiasan/hiasan_bendera.png' },
      { id: 'bunting', label: 'Bunting warna-warni', src: 'assets/hiasan/hiasan_bunting.png' },
      { id: 'lampion', label: 'Lampion', src: 'assets/hiasan/hiasan_lampion.png', glow: [0.5, 0.45], glowR: 22, glowColor: '255,120,60' },
      { id: 'lampu_hias', label: 'Lampu hias', src: 'assets/hiasan/hiasan_lampu_hias.png', glow: [0.5, 0.5], glowR: 34 },
      { id: 'pot', label: 'Tanaman pot', src: 'assets/hiasan/hiasan_pot.png', ground: true },
      { id: 'bangku', label: 'Bangku', src: 'assets/hiasan/hiasan_bangku.png', ground: true },
      { id: 'gantung', label: 'Tanaman gantung', src: 'assets/hiasan/hiasan_gantung.png' }
    ]
  };

  // Gambar boleh berukuran bebas. Ukuran tampil di canvas = piksel asli / SCALE,
  // atau isi `w` (lebar dalam satuan canvas) pada item; tinggi mengikuti rasio gambar.
  Assets.SCALE = 4;

  // Aset otomatis: assets/manifest.js (dibuat tools/server.py atau tools/scan_assets.py) berisi semua PNG di
  // assets/<jenis>/. File yang belum terdaftar di atas ditambahkan sendiri, jadi tidak perlu mengedit file ini.
  // Nama file: "window_bulat_besar.png" -> id "bulat_besar", label "Bulat besar". Tambahkan "@w72" di nama file
  // (window_bulat@w72.png) untuk menentukan lebar tampil 72 satuan canvas; tanpa itu, lebar = piksel / 4.
  // Awalan nama file tiap folder (dibuang saat membuat id/label): aksesoris_pintu/pintu_keset.png -> id "keset".
  const PREFIX = { aksesoris_pintu: 'pintu', aksesoris_jendela: 'jendela', papan_menyala: 'papan' };

  (function mergeManifest() {
    const man = global.ASSET_MANIFEST;
    if (!man) return;
    Object.keys(man).forEach(function (g) {
      if (!Assets[g]) return;
      const list = Assets[g];
      man[g].forEach(function (src) {
        if (list.some(function (i) { return i.src === src; })) return;
        let base = src.split('/').pop().replace(/\.(png|webp)$/i, '');
        const m = base.match(/@w(\d+(?:\.\d+)?)$/i);
        if (m) base = base.slice(0, m.index);
        const low = base.toLowerCase();
        const prefix = [g.replace(/s$/, '') + '_', g + '_', (PREFIX[g] || g) + '_'].filter(function (x) { return low.indexOf(x) === 0; })[0] || '';
        let id = low.slice(prefix.length).replace(/[^a-z0-9_]+/g, '_') || 'baru';
        const root = id;
        for (let n = 2; list.some(function (i) { return i.id === id; }); n++) id = root + '_' + n;
        const text = id.replace(/_/g, ' ');
        const item = { id: id, label: text.charAt(0).toUpperCase() + text.slice(1), src: src };
        if (m) item.w = parseFloat(m[1]);
        if (g === 'lamps') item.glow = [0.5, 0.5];
        if (g === 'foliage') {
          item.sway = { amp: 0.05, speed: 1.2 };
          if (/grass|bush|rumput|semak/i.test(base)) item.ground = true;
        }
        list.push(item);
      });
    });
  })();

  const GROUPS = ['walls', 'windows', 'doors', 'roofs', 'lamps', 'foliage', 'trunks', 'extras',
                  'aksesoris_pintu', 'aksesoris_jendela', 'ruko', 'papan', 'papan_menyala', 'vandal', 'hiasan'];
  // Folder yang boleh punya PNG _malam (menyala di mode malam), selain lampu. Jendela punya folder sendiri: assets/windows_malam/.
  const NIGHT_GROUPS = ['ruko', 'papan_menyala', 'hiasan'];

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('Gagal memuat ' + src)); };
      img.src = src;
    });
  }

  Assets.loadAll = function () {
    const tasks = [];
    GROUPS.forEach(function (g) {
      Assets[g].forEach(function (item) {
        tasks.push(loadImage(item.src).then(function (img) { item.img = img; }));
      });
    });
    return Promise.all(tasks);
  };

  // Cari item berdasarkan id; kalau tidak ada, pakai item pertama.
  Assets.find = function (group, id) {
    return Assets[group].find(function (i) { return i.id === id; }) || Assets[group][0];
  };

  Assets.dims = function (item) {
    const nw = item.img.naturalWidth || item.img.width, nh = item.img.naturalHeight || item.img.height;
    const w = item.w || nw / Assets.SCALE;
    return { w: w, h: nh * w / nw };
  };

  // Kotak piksel yang terisi (alfa > ALPHA_MIN) dalam piksel asli gambar: {x, y, w, h}. Dipakai untuk memotong otomatis pratinjau di panel.
  // Hasilnya disimpan di item. null = tidak bisa dibaca (gambar kosong, atau browser memblokir baca piksel dari file lokal): pratinjau tampil utuh.
  const ALPHA_MIN = 12;
  Assets.bounds = function (item) {
    if (item.bounds !== undefined) return item.bounds;
    const im = item.img, nw = im.naturalWidth || im.width, nh = im.naturalHeight || im.height;
    let b = null;
    try {
      const c = document.createElement('canvas');
      c.width = nw; c.height = nh;
      const x = c.getContext('2d', { willReadFrequently: true });
      x.drawImage(im, 0, 0);
      const px = x.getImageData(0, 0, nw, nh).data;
      let x0 = nw, y0 = nh, x1 = -1, y1 = -1;
      for (let y = 0; y < nh; y++) {
        const row = y * nw * 4;
        for (let i = 0; i < nw; i++) {
          if (px[row + i * 4 + 3] > ALPHA_MIN) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; y1 = y; }
        }
      }
      if (x1 >= x0) b = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    } catch (e) { b = null; }
    return (item.bounds = b);
  };

  // Apakah di titik (u, v) gambar (0..1 dari kiri-atas) ada bagian terisi? Dipakai untuk klik yang hanya mengenai bagian PNG yang terisi.
  // Memeriksa titik itu dan 4 tetangga sejauh `tol` piksel gambar (toleransi klik tipis di tepi).
  // Mengembalikan null kalau piksel tidak bisa dibaca (browser memblokir file lokal): pemanggil memakai kotak seperti biasa.
  Assets.opaqueAt = function (item, u, v, tol) {
    if (item.mask === undefined) {
      const im = item.img, nw = im.naturalWidth || im.width, nh = im.naturalHeight || im.height;
      try {
        const c = document.createElement('canvas');
        c.width = nw; c.height = nh;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(im, 0, 0);
        const px = x.getImageData(0, 0, nw, nh).data, a = new Uint8Array(nw * nh);
        for (let i = 0; i < a.length; i++) a[i] = px[i * 4 + 3] > ALPHA_MIN ? 1 : 0;
        item.mask = { a: a, w: nw, h: nh };
      } catch (e) { item.mask = null; }
    }
    const m = item.mask;
    if (!m) return null;
    const cx = Math.floor(u * m.w), cy = Math.floor(v * m.h), t = tol || 0;
    const pts = t ? [[0, 0], [t, 0], [-t, 0], [0, t], [0, -t]] : [[0, 0]];
    for (let i = 0; i < pts.length; i++) {
      const x = cx + pts[i][0], y = cy + pts[i][1];
      if (x >= 0 && y >= 0 && x < m.w && y < m.h && m.a[y * m.w + x]) return true;
    }
    return false;
  };

  // PNG malam (opsional), ukurannya harus sama dengan versi siang. Kalau file tidak ada, versi siang digelapkan seperti biasa.
  //  - Jendela: assets/windows_malam/<nama file yang sama dengan jendela siang>, misalnya
  //    assets/windows/window_square.png -> assets/windows_malam/window_square.png.
  //    (Cara lama assets/windows/window_square_malam.png masih dipakai bila file di windows_malam tidak ada.)
  //  - Lampu, ruko, papan menyala, hiasan: nama_malam.png di folder yang sama (lamp_globe.png -> lamp_globe_malam.png).
  function suffixNight(src) { return src.replace(/\.(png|webp)$/i, '_malam.$1'); }

  Assets.loadNight = function (onLoad) {
    function load(item, srcs) {
      const img = new Image();
      let n = 0;
      img.onload = function () { item.nightImg = img; onLoad(); };
      img.onerror = function () { if (++n < srcs.length) img.src = srcs[n]; };
      img.src = srcs[0];
    }
    Assets.windows.forEach(function (item) {
      load(item, [item.src.replace('assets/windows/', 'assets/windows_malam/'), suffixNight(item.src)]);
    });
    NIGHT_GROUPS.reduce(function (all, g) { return all.concat(Assets[g]); }, Assets.lamps).forEach(function (item) {
      load(item, [suffixNight(item.src)]);
    });
  };

  Assets.has = function (group, id) {
    return Assets[group].some(function (i) { return i.id === id; });
  };

  global.Assets = Assets;
})(window);
