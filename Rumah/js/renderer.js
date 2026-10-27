/*
 * Menggambar latar berlapis + bangunan. Koordinat dalam satuan canvas (480x300);
 * gambar sebenarnya dirender SCALE kali lebih besar agar halus dan tajam.
 *
 * Parallax: bangunan memakai kamera penuh (zoom z, pusat x/y). Lapisan latar dengan
 * kedalaman d memakai skala z^d dan pusat yang bergeser d kali geseran kamera.
 * d kecil = jauh = nyaris diam; d = 1 = sama dengan bangunan (tanah).
 * Urutan lapisan bangunan = urutan potongan ditambahkan; layer depan (garis tanah, objek depan) paling depan.
 */
(function (global) {
  'use strict';

  const CW = 480, CH = 300, GROUND = 270, SCALE = 2.5;
  const HOME = { z: 1, x: CW / 2, y: CH / 2 };

  // Pasang transformasi untuk kedalaman d; kembalikan area (koordinat lapisan) yang terlihat.
  function setView(ctx, scale, cam, size, d) {
    const s = Math.pow(cam.z, d);
    const lx = CW / 2 + (cam.x - CW / 2) * d, ly = CH / 2 + (cam.y - CH / 2) * d;
    ctx.setTransform(scale * s, 0, 0, scale * s, scale * (size.w / 2 - lx * s), scale * (size.h / 2 - ly * s));
    // pin = geseran vertikal (koordinat lapisan) agar garis tanah lapisan ini tepat di garis tanah bangunan (dipakai layer PNG).
    return { x0: lx - size.w / (2 * s), x1: lx + size.w / (2 * s), y0: ly - size.h / (2 * s), y1: ly + size.h / (2 * s), G: GROUND, H: CH,
             pin: cam.z * (GROUND - cam.y) / s + ly - GROUND };
  }


  // ---- Garis seleksi mengikuti bentuk PNG (bagian yang tidak transparan) ----
  // Dibuat dari siluet gambar tanpa membaca piksel (aman untuk file://), lalu disimpan sampai ukuran layarnya berubah.
  const OUTLINE = { item: null, key: '', out: null };
  const SEL_COLOR = '#342628', SEL_HALO = '#ffffff';

  function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  function outlineOf(item, w, h, th, halo) {
    const key = w + 'x' + h + 'x' + th + 'x' + halo;
    if (OUTLINE.item === item && OUTLINE.key === key && OUTLINE.out) return OUTLINE.out;
    const pad = Math.ceil(th + halo) + 2, W = w + pad * 2, H = h + pad * 2;
    // siluet penuh (alfa dikuatkan agar piksel samar ikut terhitung)
    const sil = canvasOf(W, H), sx = sil.getContext('2d');
    sx.imageSmoothingQuality = 'high';
    sx.drawImage(item.img, pad, pad, w, h);
    sx.globalCompositeOperation = 'source-in'; sx.fillStyle = '#000'; sx.fillRect(0, 0, W, H);
    const solid = canvasOf(W, H), lx = solid.getContext('2d');
    for (let i = 0; i < 3; i++) lx.drawImage(sil, 0, 0);
    // cincin: siluet digeser ke banyak arah (melebar), lalu diwarnai
    function grow(r, color) {
      const c = canvasOf(W, H), x = c.getContext('2d'), N = 16;
      [r, r * 0.5].forEach(function (rr) {
        for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; x.drawImage(solid, Math.cos(a) * rr, Math.sin(a) * rr); }
      });
      x.drawImage(solid, 0, 0);
      x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, W, H);
      return c;
    }
    const out = canvasOf(W, H), ox = out.getContext('2d');
    ox.drawImage(grow(th + halo, SEL_HALO), 0, 0);
    ox.drawImage(grow(th, SEL_COLOR), 0, 0);
    ox.globalCompositeOperation = 'destination-out';   // bagian dalam dilubangi: hanya garis di luar bentuk
    ox.drawImage(solid, 0, 0); ox.drawImage(solid, 0, 0);
    OUTLINE.item = item; OUTLINE.key = key; OUTLINE.out = { cv: out, pad: pad };
    return OUTLINE.out;
  }

  // Goyang dedaunan (dipakai gambar objek dan garis seleksinya agar tetap berimpit).
  function applySway(ctx, item, p, env, x0, y0, w, h) {
    const sw = item.sway || { amp: 0.045, speed: 1.2 }, ph = Weather.time * sw.speed + (+p.id || 0) * 1.7, wind = env.rain ? 1.35 : 1;
    // Dua gelombang digabung (utama + hembusan cepat yang lebih kecil) supaya geraknya tidak terlalu seragam.
    const gust = Math.sin(ph) + 0.35 * Math.sin(ph * 2.3 + 1.3);
    ctx.translate(x0 + w / 2, y0 + h);
    ctx.transform(1 + 0.015 * wind * Math.cos(ph * 2), 0, -gust * sw.amp * wind, 1 - 0.008 * wind * Math.abs(gust), 0, 0);
  }

  // Kanvas sementara untuk waktu kedua saat dua suasana dicampur (dipakai ulang; ukurannya mengikuti kanvas tujuan).
  let blendCv = null;
  function blendCanvas(w, h) {
    if (!blendCv) blendCv = document.createElement('canvas');
    if (blendCv.width !== w || blendCv.height !== h) { blendCv.width = w; blendCv.height = h; }
    return blendCv;
  }

  // Seluruh adegan (latar, bangunan, bayangan, cahaya, layer depan, hujan) untuk satu suasana, tanpa garis seleksi.
  function scene(ctx, state, theme, env, scale, cam, size) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
      Weather.layers(theme, env).forEach(function (layer) {
        ctx.save();
        if (layer.tone !== false) Weather.tint(ctx, env);
        layer.draw(ctx, setView(ctx, scale, cam, size, layer.depth));
        Weather.untint(ctx);
        ctx.restore();
      });

      // Bangunan: sisi tiap potongan dibulatkan ke piksel agar tidak ada celah di antara dinding.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const k = scale * cam.z, ox = scale * size.w / 2 - cam.x * k, oy = scale * size.h / 2 - cam.y * k;
      Shadows.prepare(ctx, state, k, ox, oy, env);
      Shadows.ground(ctx);                      // bayangan di tanah: di belakang semua potongan
      state.pieces.forEach(function (p, i) {
        const item = Assets.itemOf(p), d = Assets.dims(item);
        const x0 = Math.round(ox + p.x * k), y0 = Math.round(oy + p.y * k);
        const w = Math.round(ox + (p.x + d.w) * k) - x0, h = Math.round(oy + (p.y + d.h) * k) - y0, img = Weather.piece(item, p, env);
        if (p.kind === 'foliage' && !Weather.still) {
          // Goyang lembut: miring ke kiri-kanan dengan poros di tengah bawah (+ sedikit melebar); fase tiap objek berbeda.
          ctx.save();
          applySway(ctx, item, p, env, x0, y0, w, h);
          ctx.drawImage(img, -w / 2, -h, w, h);
          ctx.restore();
        } else ctx.drawImage(img, x0, y0, w, h);
        Shadows.drop(ctx, i);   // bayangan atap/pohon jatuh ke objek di belakangnya (tidak ke dirinya sendiri)
      });

      Shadows.low(ctx);   // pagi/sore: bayangan dinding dan atap menimpa semua objek, di depan maupun di belakang dinding

      Weather.lights(ctx, state, k, ox, oy, env);

      // Layer depan (objek depan / garis tanah): paling depan, di atas semua potongan.
      const b = setView(ctx, scale, cam, size, 1), gl = theme.ground;   // tema polos: gl = null, tanpa layer depan
      if (gl) {
        const gy = GROUND + gl.y, depan = Backdrop.get(theme.id, 'depan'), fr = Backdrop.frontFrame(theme.id, Weather.still ? 0 : Weather.time);
        if (fr) {   // animasi frame-by-frame (depan_anim_1..3)
          const base = depan && Backdrop.ANIM.base;
          if (base) Backdrop.draw(ctx, b, depan, 'depan', env);
          Backdrop.draw(ctx, b, fr.item, fr.slot, env);
          Shadows.front(ctx, theme.id, base ? ['depan', fr.slot] : [fr.slot]);   // pagi/sore: bayangan juga jatuh di layer depan
        } else if (depan) { Backdrop.draw(ctx, b, depan, 'depan', env); Shadows.front(ctx, theme.id, ['depan']); } else {
          Weather.tint(ctx, env);
          ctx.fillStyle = gl.body; ctx.fillRect(b.x0 - 1, gy, b.x1 - b.x0 + 2, gl.h);
          ctx.fillStyle = gl.top; ctx.fillRect(b.x0 - 1, gy, b.x1 - b.x0 + 2, 2);
          Weather.untint(ctx); }
      }
      if (env.rain) {
        ctx.save(); Weather.fogFront(ctx, setView(ctx, scale, cam, size, 1), env); ctx.restore();   // kabut rendah di depan rumah
        ctx.save(); Weather.rainFront(ctx, setView(ctx, scale, cam, size, 0), env); ctx.restore();
      }
    return { k: k, ox: ox, oy: oy };
  }

  const Renderer = {
    WIDTH: CW, HEIGHT: CH, GROUND: GROUND, SCALE: SCALE,

    draw: function (ctx, state, selectedId, scale, cam, view) {
      // Tanpa kamera (thumbnail, ekspor) = pemandangan 480x300 saja; dengan kamera = ukuran layar saat ini.
      const size = view || (cam ? Camera.size : { w: CW, h: CH });   // view = ukuran area gambar (satuan dunia), untuk ekspor peta penuh
      scale = scale || SCALE; cam = cam || HOME;
      const theme = Themes.find(state.theme);

      // Suasana: satu waktu saja, atau (jam hari berjalan) dua waktu bersebelahan yang dicampur halus: waktu b digambar di kanvas
      // sementara lalu ditempel di atas waktu a dengan bobot f. Bagian yang sama di keduanya tetap sama persis.
      const mixed = Weather.mix(state), env = mixed.a;
      const g = scene(ctx, state, theme, env, scale, cam, size);
      if (mixed.b) {
        const bc = blendCanvas(ctx.canvas.width, ctx.canvas.height), bx = bc.getContext('2d');
        bx.setTransform(1, 0, 0, 1, 0, 0); bx.globalAlpha = 1; bx.clearRect(0, 0, bc.width, bc.height);
        scene(bx, state, theme, mixed.b, scale, cam, size);
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = mixed.f; ctx.drawImage(bc, 0, 0); ctx.restore();
      }
      const k = g.k, ox = g.ox, oy = g.oy;

      const sel = state.pieces.find(function (p) { return p.id === selectedId; });
      if (sel) {
        const item = Assets.itemOf(sel), s = State.size(sel), u = 1 / cam.z;   // garis seleksi tetap setebal sama di layar
        if (sel.kind === 'text' || !item || !item.img) {   // teks: tetap kotak putus-putus (garis huruf terlalu ramai)
          ctx.strokeStyle = '#342628';
          ctx.lineWidth = 1.2 * u;
          ctx.setLineDash([4 * u, 3 * u]);
          ctx.strokeRect(sel.x - 1.5 * u, sel.y - 1.5 * u, s.w + 3 * u, s.h + 3 * u);
          ctx.setLineDash([]);
        } else {   // objek PNG: garis mengikuti bentuk gambar yang tidak transparan
          const x0 = Math.round(ox + sel.x * k), y0 = Math.round(oy + sel.y * k);
          const w = Math.round(ox + (sel.x + s.w) * k) - x0, h = Math.round(oy + (sel.y + s.h) * k) - y0;
          const o = outlineOf(item, Math.max(1, w), Math.max(1, h), Math.max(1.5, 0.9 * scale), Math.max(1, 0.5 * scale));
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          if (sel.kind === 'foliage' && !Weather.still) { applySway(ctx, item, sel, env, x0, y0, w, h); ctx.drawImage(o.cv, -w / 2 - o.pad, -h - o.pad); }
          else ctx.drawImage(o.cv, x0 - o.pad, y0 - o.pad);
          ctx.restore();
        }
      }
    },

    // Potongan paling atas di titik dunia (x, y), atau null.
    hit: function (state, x, y) {
      for (let i = state.pieces.length - 1; i >= 0; i--) {
        const p = state.pieces[i], s = State.size(p);
        if (!(x >= p.x && x < p.x + s.w && y >= p.y && y < p.y + s.h)) continue;
        // Di dalam kotak: untuk objek PNG, hanya bagian yang terisi yang dihitung kena (bagian transparan menembus ke objek di belakangnya).
        // Teks, atau piksel yang tidak bisa dibaca (file lokal), tetap memakai kotak.
        const item = p.kind === 'text' ? null : Assets.itemOf(p);
        if (item && item.img) {
          const tol = Math.max(1, Math.round(item.img.width / s.w * 0.6));   // ±0,6 satuan dunia (sekitar 1,5 px layar) agar tepi mudah diklik
          if (Assets.opaqueAt(item, (x - p.x) / s.w, (y - p.y) / s.h, tol) === false) continue;
        }
        return p;
      }
      return null;
    },

    // Hasil akhir sebagai file PNG (scale 3 = 4320x900 untuk peta 3 kali lebar): seluruh peta panjang, tanpa zoom dan seleksi.
    exportBlob: function (state, scale) {
      const out = document.createElement('canvas'), M = Camera.MAP, mw = M.x1 - M.x0;
      out.width = Math.round(mw * scale); out.height = Math.round(CH * scale);
      Renderer.draw(out.getContext('2d'), state, null, scale, { z: 1, x: (M.x0 + M.x1) / 2, y: CH / 2 }, { w: mw, h: CH });
      return new Promise(function (resolve, reject) {
        try {
          out.toBlob(function (b) { b ? resolve(b) : reject(new Error('Gambar kosong')); }, 'image/png');
        } catch (e) { reject(e); }
      });
    }
  };

  global.Renderer = Renderer;
})(window);
