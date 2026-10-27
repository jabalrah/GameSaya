/*
 * Bayangan objek. Semuanya dibuat dari siluet PNG (piksel tidak transparan jadi hitam),
 * jadi bentuk bayangan selalu mengikuti bentuk objeknya. Tiga jenis:
 *
 *  1. Bayangan tanah: siluet dibalik terhadap garis tanah, dipipihkan, dan dimiringkan
 *     ke kanan, seolah matahari ada di kiri. Objek yang tinggi (dinding, atap, pohon)
 *     menghasilkan bayangan yang panjang di tanah.
 *  2. Bayangan kontak: elips tipis di bawah objek yang menempel ke tanah, supaya
 *     objek terlihat "duduk" di tanah.
 *  3. Bayangan jatuh: atap, kanopi, cerobong, pot bunga, batang, dan dedaunan menjatuhkan bayangan
 *     lembut ke bangunan. Bayangan hanya jatuh pada objek yang ada DI BELAKANG pemberi bayangan dalam
 *     urutan lapisan: objek itu sendiri dan objek di depannya tidak pernah ikut gelap. Bayangan
 *     digambar tepat setelah penerima terakhir di belakang pemberinya, dan bagian penerima yang
 *     tertutup objek lain di depannya dibuang dari bayangan.
 *
 * Semua bayangan satu jenis digambar ke satu kanvas lalu ditempel sekali dengan satu alpha,
 * jadi bagian yang saling menumpuk tidak jadi lebih gelap. Hasilnya disimpan (cache) dan
 * hanya dihitung ulang kalau posisi objek, kamera, atau suasana berubah, jadi goyangan
 * dedaunan dan hujan tidak membebani.
 *
 * Atur tampilan lewat Shadows.config (di bawah).
 */
(function (global) {
  'use strict';

  const CAST = { wall: 1, roof: 1, trunk: 1, extra: 1, foliage: 1, ruko: 1, papan: 1, papan_menyala: 1, hiasan: 1 };   // melempar bayangan ke tanah
  const DROP = { roof: 1, extra: 1 };                                  // melempar bayangan ke dinding
  const RECV = { wall: 1, door: 1, window: 1, ruko: 1 };                        // menerima bayangan jatuh
  const TREE = { trunk: 1, foliage: 1 };                               // batang dan daun: bayangan jatuh ke rumah
  const TREE_RECV = { wall: 1, door: 1, window: 1, roof: 1, extra: 1, ruko: 1, aksesoris_pintu: 1, aksesoris_jendela: 1, papan: 1, papan_menyala: 1, vandal: 1, hiasan: 1 };  // bagian rumah yang dinaungi pohon
  const caches = new WeakMap();
  const work = [];
  let cur = null;

  // Pengaturan performa. Bayangan itu lembut (diburamkan), jadi dibangun di setengah resolusi lalu diperbesar:
  // biaya blur dan isi piksel turun ~4x. Saat objek/kamera terus berubah (seret, zoom, geser), bayangan lama dipakai
  // dulu (diskalakan mengikuti kamera) dan dihitung ulang tepat begitu berhenti, jadi tidak ada rebuild tiap frame.
  const Q = 0.5;          // skala kanvas bayangan lembut (harus 0,5: kotak kerja pohon dibuat genap)
  const GAP = 50;         // ms: jeda minimum antar rebuild saat objek terus berubah
  const SETTLE = 130;     // ms: kamera diam selama ini -> bayangan dihitung ulang

  const Shadows = {
    config: {
      enabled: true,
      color: '22,26,64',            // biru-ungu gelap, bukan hitam murni
      // Arah bayangan mengikuti posisi matahari (state.sun: 0 kiri, 0.5 puncak, 1 kanan). Matahari rendah =
      // bayangan panjang dan miring; matahari tinggi = pendek dan lurus ke bawah.
      sun: {
        lean: 0.36,       // kemiringan bayangan di tanah (makin besar makin miring)
        maxSkew: 1.6,     // batas kemiringan
        minElev: 0.25,    // batas bawah tinggi matahari (mencegah bayangan tak hingga)
        flatMin: 0.14,    // tinggi bayangan di tanah saat matahari di puncak (dibanding tinggi objek)
        flatRange: 0.62,  // tambahan tinggi bayangan saat matahari rendah
        dx: 2.5,          // geseran mendatar bayangan jatuh di dinding
        dyMin: 2.2, dyRange: 4.0,  // geseran ke bawah: makin tinggi matahari makin jauh ke bawah
        // Bayangan jatuh atap (dan cerobong/kanopi) di dinding, pintu, jendela, dan ruko di bawahnya TIDAK ikut penggeser matahari
        // maupun pilihan waktu: posisinya selalu seperti pagi. Nilai = posisi matahari yang dipakai (0 kiri, 0,5 puncak, 1 kanan;
        // pagi = 0,1). Isi null supaya bayangan itu kembali mengikuti matahari. Bayangan pohon dan bayangan tanah tetap mengikuti matahari.
        dropSun: 0.1,
        // Bayangan atap itu juga dinaikkan: jarak jatuhnya ke bawah dikurangi sebesar ini (satuan canvas), jadi bayangan lebih dekat
        // ke tepi atap. 0 = tidak dinaikkan; makin besar makin naik (bayangannya makin tipis; terlalu besar = hampir hilang).
        dropLift: 1.5,
        // Bayangan batang dan dedaunan di rumah (pohon berdiri lebih jauh dari dinding, jadi geserannya lebih besar
        // dan tepinya lebih lembut). Hanya jatuh ke bagian rumah yang ada di belakang pohon dalam urutan lapisan.
        treeDx: 9, treeDyMin: 3, treeDyRange: 7, treeBlur: 1.6
      },
      contact: 3.6,                 // tebal bayangan kontak (satuan canvas)
      // alpha = kegelapan, blur = kelembutan (satuan canvas). Malam hanya bayangan kontak.
      day:   { alpha: 0.55, blur: 1.2, cast: true },
      rain:  { alpha: 0.30, blur: 2.2, cast: true },
      night: { alpha: 0.42, blur: 1.8, cast: false },

      // Bayangan pagi dan sore (matahari rendah). Dua bagian, keduanya memakai siluet PNG dinding dan atap:
      //  - whole: SELURUH dinding dan atap ikut terbayang, beserta semua objek yang menempel atau menutupinya
      //    (jendela, pintu, aksesoris, pohon di depannya), baik di belakang maupun di depan dinding;
      //  - side: bayangan seluas siluet itu juga jatuh ke sisi yang menjauhi matahari (matahari kiri -> bayangan ke kanan).
      // Keduanya juga menimpa layer depan.png dan depan_anim (hanya di piksel yang tidak transparan). Urutan lapisan tidak dipakai.
      // Siang tidak memakainya.
      low: {
        enabled: true,
        // Mengikuti penggeser "Posisi matahari" secara halus: makin rendah matahari, makin kuat dan makin jauh bayangannya.
        // fullElev = tinggi matahari (0 - 1) ke bawah yang bayangannya penuh; noElev = ke atas tidak ada bayangan sama sekali.
        // (Pagi/Sore memindahkan matahari ke 0,1 / 0,9 = penuh; siang dengan matahari tinggi = tidak ada.)
        fullElev: 0.31, noElev: 0.62,
        whole: true,       // seluruh dinding dan atap ikut gelap
        side: true,        // bayangan jatuh ke samping
        shift: 1.0,        // jarak geser bayangan samping, kelipatan lebar objek pemberinya (1 = tepat di samping dinding)
        blur: 0.8,         // kelembutan tepi (satuan canvas)
        alpha: 0.42,       // kegelapan saat cerah
        rainAlpha: 0.24    // kegelapan saat hujan
      }
    },

    prepare: function (ctx, state, k, ox, oy, env) {
      cur = null;
      if (!Shadows.config.enabled) return;
      const cv = ctx.canvas, w = cv.width, h = cv.height, gw = Math.max(1, Math.ceil(w * Q)), gh = Math.max(1, Math.ceil(h * Q));
      const geo = geometry(env.sun), now = performance.now(), lowF = lowFactor(env);
      const base = [w, h, env.key, state.theme, geo.skew, geo.flat, Math.round(lowF * 100), state.pieces.map(function (p) { return p.id + p.type + p.x + p.y + (p.kind === 'text' ? Texts.key(p) : ''); }).join(',')].join('|');
      const cam = k + '|' + ox + '|' + oy;
      let e = caches.get(cv);
      if (!e) { e = { ok: false, base: '', cam: '', camSeen: '', k: k, ox: ox, oy: oy, t: 0, camT: now, env: '', g: make(gw, gh), groups: [], pool: [], timer: 0, shade: make(gw, gh), lowC: make(gw, gh), low: null, front: {}, fm: {}, fmCam: '', rev: 0, lowF: 0 }; caches.set(cv, e); }
      if (e.w !== w || e.h !== h) { e.g.width = gw; e.g.height = gh; e.shade.width = e.lowC.width = gw; e.shade.height = e.lowC.height = gh; e.fm = {}; e.front = {}; e.ok = false; }
      if (e.camSeen !== cam) { e.camSeen = cam; e.camT = now; }

      let rebuild = !e.ok, wait = 0;
      if (!rebuild) {
        if (e.base !== base) {                       // objek, suasana, atau matahari berubah
          if (e.env !== env.key || now - e.t >= GAP) rebuild = true; else wait = GAP - (now - e.t);
        } else if (e.cam !== cam) {                  // hanya kamera (zoom/geser): pakai bayangan lama sampai kamera diam
          const sc = k / e.k;
          if (sc < 0.7 || sc > 1.45 || Math.abs(ox - e.ox * sc) > w * 0.4 || Math.abs(oy - e.oy * sc) > h * 0.4 || now - e.camT >= SETTLE) rebuild = true;
          else wait = SETTLE - (now - e.camT);
        }
      }
      if (rebuild) {
        const mode = env.night ? Shadows.config.night : env.rain ? Shadows.config.rain : Shadows.config.day;
        buildGround(e.g, state, k, ox, oy, mode, geo, w, h);
        buildDrop(e, w, h, state, k, ox, oy, mode, geo);
        buildLow(e, state, k, ox, oy, env, geo, w, h, lowF);
        e.base = base; e.cam = cam; e.k = k; e.ox = ox; e.oy = oy; e.env = env.key; e.ok = true; e.t = performance.now();
        if (e.timer) { clearTimeout(e.timer); e.timer = 0; }
      } else if (wait > 0) {
        // Jadwalkan satu gambar ulang setelah jeda supaya bayangan akhirnya tepat meski tidak ada event lain.
        clearTimeout(e.timer);
        e.timer = setTimeout(function () { e.timer = 0; window.dispatchEvent(new Event('rumah-redraw')); }, wait + 4);
      }
      const sc = k / e.k;
      e.mode = env.night ? 'night' : env.rain ? 'rain' : 'day';
      e.lowF = lowF;
      e.sc = sc; e.tx = ox - e.ox * sc; e.ty = oy - e.oy * sc; e.w = w; e.h = h;
      cur = e;
    },

    // Tanah: gambar sebelum semua potongan bangunan.
    ground: function (ctx) {
      if (!cur) return;
      ctx.save();
      ctx.imageSmoothingQuality = 'low';
      ctx.globalAlpha = Shadows.config[cur.mode].alpha;
      ctx.drawImage(cur.g, cur.tx, cur.ty, cur.w * cur.sc, cur.h * cur.sc);
      ctx.restore();
    },

    // Bayangan jatuh: dipanggil setelah potongan ke-i digambar. Menggambar semua bayangan yang penerima
    // terakhirnya di belakang pemberi bayangan adalah potongan i, jadi pemberi dan objek di depannya
    // (yang digambar setelahnya) tidak tertimpa.
    drop: function (ctx, i) {
      if (!cur || !cur.groups.length || !Shadows.config[cur.mode].cast) return;
      ctx.save();
      ctx.imageSmoothingQuality = 'low';
      ctx.globalAlpha = Shadows.config[cur.mode].alpha;
      cur.groups.forEach(function (g) {
        if (g.L === i) ctx.drawImage(g.cv, 0, 0, g.w, g.h, cur.tx + g.x * cur.sc, cur.ty + g.y * cur.sc, g.w * cur.sc, g.h * cur.sc);
      });
      ctx.restore();
    },

    // Bayangan pagi/sore di atas semua potongan bangunan (tanpa peduli urutan lapisan). Dipanggil sekali setelah semua potongan digambar.
    low: function (ctx) {
      if (!cur || !cur.low) return;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingQuality = 'low';
      ctx.globalAlpha = Shadows.config.low[cur.mode === 'rain' ? 'rainAlpha' : 'alpha'] * cur.lowF;
      ctx.drawImage(cur.low, cur.tx, cur.ty, cur.w * cur.sc, cur.h * cur.sc);
      ctx.restore();
    },

    // Bayangan pagi/sore di layer depan: hanya jatuh di piksel yang tidak transparan dari depan.png dan frame animasi yang sedang
    // tampil (slots, mis. ['depan', 'depan_anim_2']). Hasil tiap kombinasi disimpan sampai bayangan dihitung ulang.
    front: function (ctx, theme, slots) {
      const e = cur;
      if (!e || !e.low || !slots || !slots.length) return;
      const key = theme + ':' + slots.join(), gw = e.shade.width, gh = e.shade.height;
      // Topeng layer depan (piksel tidak transparan) hanya bergantung pada kamera dan gambar, bukan pada matahari:
      // dibuat sekali per kamera, jadi menggeser penggeser matahari tidak membangunnya ulang.
      const camKey = e.k + '|' + e.ox + '|' + e.oy + '|' + e.w;
      if (e.fmCam !== camKey) { e.fm = {}; e.front = {}; e.fmCam = camKey; }
      let F = e.fm[key];
      if (!F) {
        const items = slots.map(function (s) { return Backdrop.get(theme, s); });
        if (items.some(function (i) { return !i; })) return;           // gambar belum termuat: coba lagi di frame berikutnya
        const CW = Renderer.WIDTH, CH = Renderer.HEIGHT;
        F = e.fm[key] = make(gw, gh);
        const fx = F.getContext('2d');
        fx.setTransform(Q, 0, 0, Q, 0, 0);
        fx.imageSmoothingQuality = 'low';
        const x0 = Math.floor(-e.ox / e.k / CW) * CW;
        items.forEach(function (it) {
          for (let x = x0; e.ox + x * e.k < e.w; x += CW) fx.drawImage(it.img, e.ox + x * e.k, e.oy, CW * e.k, CH * e.k);
        });
      }
      // Hasil = bayangan (e.shade) dipotong topeng; dihitung ulang hanya bila bayangan dibangun ulang (e.rev berubah).
      let r = e.front[key];
      if (!r) r = e.front[key] = { cv: make(gw, gh), rev: -1 };
      if (r.rev !== e.rev) {
        const rc = r.cv.getContext('2d');
        rc.setTransform(1, 0, 0, 1, 0, 0); rc.globalCompositeOperation = 'source-over'; rc.clearRect(0, 0, gw, gh);
        rc.drawImage(e.shade, 0, 0);
        rc.globalCompositeOperation = 'destination-in';
        rc.drawImage(F, 0, 0);
        rc.globalCompositeOperation = 'source-over';
        r.rev = e.rev;
      }
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingQuality = 'low';
      ctx.globalAlpha = Shadows.config.low[e.mode === 'rain' ? 'rainAlpha' : 'alpha'] * e.lowF;
      ctx.drawImage(r.cv, e.tx, e.ty, e.w * e.sc, e.h * e.sc);
      ctx.restore();
    }
  };

  // Kekuatan bayangan pagi/sore (0 - 1) dari tinggi matahari: 1 saat matahari rendah, 0 saat tinggi, mulus di antaranya.
  function lowFactor(env) {
    const lo = Shadows.config.low;
    if (!lo.enabled || env.night || !(lo.whole || lo.side)) return 0;
    const elev = Math.sin(Math.PI * env.sun), t = Math.max(0, Math.min(1, (lo.noElev - elev) / (lo.noElev - lo.fullElev)));
    return t * t * (3 - 2 * t);
  }

  // Arah dan panjang bayangan dari posisi matahari (0 kiri, 0.5 puncak, 1 kanan).
  function geometry(sun) {
    const c = Shadows.config.sun, a = Math.PI * (typeof sun === 'number' ? sun : 0.2);
    const dir = Math.cos(a), elev = Math.sin(a);      // dir > 0: matahari di kiri, bayangan jatuh ke kanan
    const skew = Math.max(-c.maxSkew, Math.min(c.maxSkew, dir / Math.max(elev, c.minElev) * c.lean));
    return { skew: skew, flat: c.flatMin + c.flatRange * (1 - elev), dx: dir * c.dx, dy: c.dyMin + c.dyRange * elev,
             tdx: dir * c.treeDx, tdy: c.treeDyMin + c.treeDyRange * elev };
  }

  function make(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // Kanvas kerja ber-indeks i, dipakai ulang. slot() hanya menyiapkan konteksnya; isi lama dibiarkan.
  function slot(i, w, h) {
    let c = work[i];
    if (!c) c = work[i] = make(w, h);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const x = c.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    if ('filter' in x) x.filter = 'none';
    x.imageSmoothingQuality = 'medium';   // siluet diperkecil ~3x ke kanvas setengah resolusi: butuh mipmap agar tepinya tidak berpasir
    return c;
  }
  // Seluruh kanvas dikosongkan, atau hanya persegi (rx, ry, rw, rh) bila diberikan.
  function scratch(i, w, h, rx, ry, rw, rh) {
    const c = slot(i, w, h);
    if (rx == null) c.getContext('2d').clearRect(0, 0, w, h); else c.getContext('2d').clearRect(rx, ry, rw, rh);
    return c;
  }

  // Siluet hitam sebuah aset (dibuat sekali, disimpan di item).
  function sil(item) {
    if (item.sil) return item.sil;
    const im = item.img, c = make(im.naturalWidth || im.width, im.naturalHeight || im.height), x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#000';
    x.fillRect(0, 0, c.width, c.height);
    return (item.sil = c);
  }

  function rect(p, k, ox, oy) {
    const item = Assets.itemOf(p), d = Assets.dims(item);
    return { item: item, x: ox + p.x * k, y: oy + p.y * k, w: d.w * k, h: d.h * k };
  }

  // Tempel src ke dst dengan blur (kalau browser mendukung ctx.filter). Bila (w, h) diberikan, hanya persegi 0,0,w,h yang dipakai.
  function blurInto(dst, src, px, w, h) {
    const c = dst.getContext('2d');
    w = w || dst.width; h = h || dst.height;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
    if (px > 0 && 'filter' in c) c.filter = 'blur(' + px.toFixed(2) + 'px)';
    c.drawImage(src, 0, 0, w, h, 0, 0, w, h);
    if ('filter' in c) c.filter = 'none';
  }

  function colorize(t, col, w, h) {
    const x = t.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = 'rgb(' + col + ')';
    x.fillRect(0, 0, w || t.width, h || t.height);
    x.globalCompositeOperation = 'source-over';
  }

  // Bayangan tanah, dibangun di kanvas setengah resolusi `out` (W x H = ukuran kanvas utama).
  function buildGround(out, state, k, ox, oy, mode, geo, W, H) {
    const cfg = Shadows.config, G = Renderer.GROUND, gy = oy + G * k, q = out.width / W;
    const t = scratch(0, out.width, out.height), x = t.getContext('2d');
    x.save();
    x.setTransform(q, 0, 0, q, 0, 0);                                 // semua koordinat di bawah dalam piksel kanvas utama
    x.beginPath(); x.rect(0, gy, W, Math.max(0, H - gy)); x.clip();   // bayangan hanya di tanah
    state.pieces.forEach(function (p) {
      const r = rect(p, k, ox, oy), onGround = r.y + r.h >= oy + (G - 2.5) * k && r.y + r.h <= oy + (G + 2.5) * k;
      if (mode.cast && CAST[p.kind] && !(p.kind === 'foliage' && r.item.ground)) {
        x.save();
        x.setTransform(q, 0, -q * geo.skew, -q * geo.flat, q * geo.skew * gy, q * gy * (1 + geo.flat));   // balik, pipihkan, miringkan
        x.drawImage(sil(r.item), r.x, r.y, r.w, r.h);
        x.restore();
      }
      if ((onGround && (p.kind === 'wall' || p.kind === 'door' || p.kind === 'trunk' || p.kind === 'extra' || p.kind === 'ruko')) || r.item.ground) {
        x.fillStyle = '#000';
        x.beginPath();
        x.ellipse(r.x + r.w / 2, gy + 0.4 * k, r.w * 0.55, cfg.contact * k, 0, 0, Math.PI * 2);
        x.fill();
      }
    });
    x.restore();
    colorize(t, cfg.color);
    blurInto(out, t, mode.blur * k * q);
  }

  const hits = function (r, x0, y0, x1, y1) { return r.x < x1 && r.x + r.w > x0 && r.y < y1 && r.y + r.h > y0; };

  // Bayangan jatuh: dikelompokkan menurut jenis (atap/cerobong atau pohon) dan penerima terakhir di belakang
  // pemberinya. Tiap kelompok jadi satu kanvas kecil (kotak di sekitar bayangannya) di e.groups.
  function buildDrop(e, w, h, state, k, ox, oy, mode, geo) {
    const gw = Math.ceil(w * Q), gh = Math.ceil(h * Q), cfg = Shadows.config, pieces = state.pieces;
    e.groups.length = 0;
    if (!mode.cast) return;

    // Penerima = potongan yang indeksnya lebih kecil (di belakang) pemberi bayangan.
    const groups = {};
    pieces.forEach(function (p, ci) {
      const tree = !!TREE[p.kind];
      if (!tree && !DROP[p.kind]) return;
      const recv = tree ? TREE_RECV : RECV;
      let L = -1;
      for (let i = 0; i < ci; i++) if (recv[pieces[i].kind]) L = i;
      if (L < 0) return;                                          // tidak ada yang bisa dinaungi di belakangnya
      const key = (tree ? 't' : 'd') + L;
      (groups[key] = groups[key] || { tree: tree, L: L, recv: recv, casters: [] }).casters.push(p);
    });

    Object.keys(groups).forEach(function (key) {
      const g = groups[key];
      const blur = g.tree ? mode.blur * cfg.sun.treeBlur * k : mode.blur * 0.6 * k, pad = Math.ceil(blur * 3) + 2;
      const dg = g.tree || cfg.sun.dropSun == null ? geo : geometry(cfg.sun.dropSun);   // bayangan atap: posisi tetap (pagi)
      const sdx = (g.tree ? geo.tdx : dg.dx) * k, sdy = (g.tree ? geo.tdy : Math.max(0.3, dg.dy - (cfg.sun.dropLift || 0))) * k;

      // Kotak kerja (piksel kanvas utama) di sekitar bayangan, dibulatkan ke genap agar pas dengan kisi setengah resolusi.
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      g.casters.forEach(function (p) {
        const r = rect(p, k, ox, oy);
        x0 = Math.min(x0, r.x + sdx); y0 = Math.min(y0, r.y + sdy); x1 = Math.max(x1, r.x + sdx + r.w); y1 = Math.max(y1, r.y + sdy + r.h);
      });
      const bx0 = Math.max(0, Math.floor(x0 - pad) & ~1), by0 = Math.max(0, Math.floor(y0 - pad) & ~1);
      const bx1 = Math.min(w, (Math.ceil(x1 + pad) + 1) & ~1), by1 = Math.min(h, (Math.ceil(y1 + pad) + 1) & ~1);
      const bw = bx1 - bx0, bh = by1 - by0;
      if (bw <= 0 || bh <= 0) return;
      const sw = bw * Q, sh = bh * Q;

      // Siluet bayangan: kanvas setengah resolusi -> diwarnai -> diburamkan.
      const s = scratch(0, gw, gh, 0, 0, sw, sh), sc = s.getContext('2d');
      sc.setTransform(Q, 0, 0, Q, -bx0 * Q, -by0 * Q);
      g.casters.forEach(function (p) { const r = rect(p, k, ox, oy); sc.drawImage(sil(r.item), r.x + sdx, r.y + sdy, r.w, r.h); });
      colorize(s, cfg.color, sw, sh);
      const sb = scratch(1, gw, gh, 0, 0, sw, sh);
      blurInto(sb, s, blur * Q, sw, sh);

      // Topeng penerima (koordinat lokal kotak): potongan dari urutan 0 sampai L digambar berurutan;
      // penerima menambah topeng, potongan lain (yang berada di depan penerima) menghapusnya.
      // Pemberi bayangan ada setelah L, jadi dirinya tidak pernah masuk topeng.
      const m = scratch(2, w, h, 0, 0, bw, bh), mx = m.getContext('2d');
      mx.save(); mx.setTransform(1, 0, 0, 1, -bx0, -by0);
      mx.beginPath(); mx.rect(bx0, by0, bw, bh); mx.clip();
      for (let j = 0; j <= g.L; j++) {
        const q = pieces[j], d = rect(q, k, ox, oy);
        if (!hits(d, bx0, by0, bx1, by1)) continue;
        mx.globalCompositeOperation = g.recv[q.kind] ? 'source-over' : 'destination-out';
        mx.drawImage(sil(d.item), d.x, d.y, d.w, d.h);
      }
      mx.restore();

      // Kanvas hasil (ukuran kotak): bayangan diperbesar lalu dipotong topeng.
      const ov = e.pool[e.groups.length] = e.pool[e.groups.length] || make(bw, bh);
      if (ov.width !== bw || ov.height !== bh) { ov.width = bw; ov.height = bh; }
      const oc = ov.getContext('2d');
      oc.setTransform(1, 0, 0, 1, 0, 0); oc.globalCompositeOperation = 'source-over'; oc.clearRect(0, 0, bw, bh);
      oc.imageSmoothingQuality = 'low';
      oc.drawImage(sb, 0, 0, sw, sh, 0, 0, bw, bh);
      oc.globalCompositeOperation = 'destination-in';
      oc.drawImage(m, 0, 0, bw, bh, 0, 0, bw, bh);
      oc.globalCompositeOperation = 'source-over';
      e.groups.push({ L: g.L, cv: ov, x: bx0, y: by0, w: bw, h: bh });
    });
  }

  // Bayangan pagi/sore: siluet semua dinding dan atap dipakai apa adanya (whole) dan digeser ke sisi yang menjauhi matahari (side),
  // diwarnai dan diburamkan jadi e.shade. e.low = e.shade yang dipotong siluet semua potongan (teks tidak ikut), sehingga
  // bayangan hanya menempel di objek. Layer depan memakai e.shade sendiri (lihat Shadows.front).
  function buildLow(e, state, k, ox, oy, env, geo, w, h, lowF) {
    e.rev++; e.low = null;
    const lo = Shadows.config.low;
    if (lowF <= 0.002) return;
    const casters = state.pieces.filter(function (p) { return p.kind === 'wall' || p.kind === 'roof'; });
    if (!casters.length) return;
    const gw = e.shade.width, gh = e.shade.height;
    const side = Math.cos(Math.PI * (typeof env.sun === 'number' ? env.sun : 0.2)) >= 0 ? 1 : -1;   // 1: matahari di kiri, bayangan ke kanan

    const t = scratch(3, gw, gh), tx = t.getContext('2d');
    tx.setTransform(Q, 0, 0, Q, 0, 0);
    casters.forEach(function (p) {
      const r = rect(p, k, ox, oy);
      if (lo.whole) tx.drawImage(sil(r.item), r.x, r.y, r.w, r.h);                                          // seluruh objek sendiri
      if (lo.side) tx.drawImage(sil(r.item), r.x + side * lo.shift * (0.4 + 0.6 * lowF) * r.w, r.y + geo.dy * k, r.w, r.h);     // bayangan samping: makin rendah matahari, makin jauh
    });
    colorize(t, Shadows.config.color, gw, gh);
    blurInto(e.shade, t, lo.blur * k * Q, gw, gh);

    const m = scratch(4, gw, gh), mx = m.getContext('2d');
    mx.setTransform(Q, 0, 0, Q, 0, 0);
    state.pieces.forEach(function (p) {
      if (p.kind === 'text') return;
      const r = rect(p, k, ox, oy);
      mx.drawImage(sil(r.item), r.x, r.y, r.w, r.h);
    });

    const c = e.lowC.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, gw, gh);
    c.drawImage(e.shade, 0, 0);
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(m, 0, 0);
    c.globalCompositeOperation = 'source-over';
    e.low = e.lowC;
  }

  global.Shadows = Shadows;
})(window);
