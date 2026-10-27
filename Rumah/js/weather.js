/*
 * Suasana = waktu (siang/malam) x cuaca (cerah/hujan), berlaku di semua tema.
 * - Semua warna latar dan bangunan diubah lewat nada (tone) sesuai suasana.
 * - Tiap suasana juga menambah lapisan sendiri: matahari / bulan dan bintang,
 *   awan hujan, hujan (jauh di belakang bangunan, dekat di depan), lampu jendela malam hari.
 */
(function (global) {
  'use strict';

  const mod = function (n, m) { return ((n % m) + m) % m; };
  const hash = function (n) { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };
  const cache = {};
  let scratch = null, lightCv = null, lightSig = '';

  // Kegelapan malam: lapisan biru tua di atas semua gambar. alpha makin besar = makin gelap (0 - 1).
  const NIGHT = { rgb: '8,12,44', alpha: 0.78 };
  const NIGHT_FILL = 'rgba(' + NIGHT.rgb + ',' + NIGHT.alpha + ')';

  // Filter pencahayaan pagi dan sore: tiap baris = [r, g, b, alpha] yang ditumpuk berurutan di atas semua gambar.
  // Pagi = cahaya keemasan lembut; sore = jingga pekat lalu sedikit digelapkan keunguan. Naikkan alpha untuk efek lebih kuat.
  const LIGHT = { morning: [[255, 200, 150, 0.28]], dusk: [[255, 128, 60, 0.32], [78, 34, 72, 0.15]] };
  const lightFills = function (env) { return (LIGHT[env.tod] || []).map(function (f) { return 'rgba(' + f.join(',') + ')'; }); };

  // Suasana hujan: lapisan biru kelabu di atas semua gambar. alpha makin besar = makin gelap dan biru (0 - 1).
  const RAIN = { rgb: '46,68,112', alpha: 0.32, sky: 'rgba(38,60,104,0.6)' };
  const RAIN_FILL = 'rgba(' + RAIN.rgb + ',' + RAIN.alpha + ')';

  // Ubah satu warna (#rrggbb atau rgba) sesuai suasana.
  function tone(col, env) {
    const key = env.key + col;
    if (cache[key]) return cache[key];
    const m = /^#([0-9a-f]{6})$/i.exec(col), r = /^rgba?\(([^)]+)\)$/.exec(col);
    let c, a = 1;
    if (m) c = [0, 2, 4].map(function (i) { return parseInt(m[1].substr(i, 2), 16); });
    else if (r) { const p = r[1].split(',').map(parseFloat); c = p.slice(0, 3); a = p.length > 3 ? p[3] : 1; }
    else return col;
    if (env.rain) {
      const l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
      c = c.map(function (v) { return (v + (l - v) * 0.55) * 0.74; });
      c = [c[0] * 0.92, c[1] * 0.98, Math.min(255, c[2] * 1.12 + 6)];   // condong biru
    }
    (LIGHT[env.tod] || []).forEach(function (f) { c = [0, 1, 2].map(function (i) { return c[i] * (1 - f[3]) + f[i] * f[3]; }); });   // filter pagi/sore
    if (env.night) c = [c[0] * 0.09 + 3, c[1] * 0.12 + 6, c[2] * 0.26 + 16];   // warna vektor ikut lebih gelap
    return (cache[key] = 'rgba(' + c.map(Math.round).join(',') + ',' + a + ')');
  }

  // Pasang nada pada ctx: semua fillStyle, strokeStyle, dan gradasi lewat tone().
  function tint(ctx, env) {
    const proto = CanvasRenderingContext2D.prototype;
    ['fillStyle', 'strokeStyle'].forEach(function (k) {
      const d = Object.getOwnPropertyDescriptor(proto, k);
      Object.defineProperty(ctx, k, {
        configurable: true,
        get: function () { return d.get.call(ctx); },
        set: function (v) { d.set.call(ctx, typeof v === 'string' ? tone(v, env) : v); }
      });
    });
    ['createLinearGradient', 'createRadialGradient'].forEach(function (k) {
      ctx[k] = function () {
        const g = proto[k].apply(ctx, arguments), add = g.addColorStop.bind(g);
        g.addColorStop = function (o, col) { add(o, tone(col, env)); };
        return g;
      };
    });
  }

  function untint(ctx) {
    ['fillStyle', 'strokeStyle', 'createLinearGradient', 'createRadialGradient'].forEach(function (k) { delete ctx[k]; });
  }

  function disc(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }

  function radial(c, x, y, r, inner, outer) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, inner); g.addColorStop(1, outer);
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Cahaya jendela malam hari: halo lembut yang menyebar keluar dari jendela.
  //   size  = jari-jari halo sebagai kelipatan sisi terpanjang jendela (jendela besar = halo besar)
  //   alpha = kekuatan di pusat (0 - 1), color = 'r,g,b'
  // Bisa ditimpa per jendela di js/assets.js lewat glowR (jari-jari, satuan canvas), glowColor, dan glow (titik pusat).
  const WINDOW_GLOW = { size: 0.7, alpha: 0.5, color: '255,196,96' };

  // Gradasi bertahap (inti terang lalu memudar pelan) supaya cahaya tampak menyebar, bukan lingkaran datar.
  function softRadial(c, x, y, r, col, a) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(' + col + ',' + a + ')');
    g.addColorStop(0.3, 'rgba(' + col + ',' + (a * 0.6) + ')');
    g.addColorStop(0.65, 'rgba(' + col + ',' + (a * 0.2) + ')');
    g.addColorStop(1, 'rgba(' + col + ',0)');
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Bilangan acak tetap per butir hujan (posisi awal x, y, dan kecepatan relatif), dibuat sekali per seed.
  const RAND = {}, MAXDROPS = 1600;
  function rands(seed) {
    if (RAND[seed]) return RAND[seed];
    const r = { x: new Float32Array(MAXDROPS), y: new Float32Array(MAXDROPS), v: new Float32Array(MAXDROPS) };
    for (let i = 0; i < MAXDROPS; i++) { r.x[i] = hash(i + seed); r.y[i] = hash(i * 7 + seed); r.v[i] = 0.8 + 0.4 * hash(i * 13 + seed * 3); }
    return (RAND[seed] = r);
  }

  // Hujan: banyak goresan pendek dan tipis (satu path, satu stroke). n = jumlah butir untuk layar 480x300.
  function rain(c, b, n, len, alpha, speed, seed, lw, rgb) {
    n = Math.min(MAXDROPS, Math.round(n * (b.x1 - b.x0) * (b.y1 - b.y0) / 144000));
    const w = b.x1 - b.x0 + 60, h = b.y1 - b.y0 + 40, t = Weather.time, R = rands(seed);
    c.strokeStyle = 'rgba(' + (rgb || '205,222,242') + ',' + alpha + ')'; c.lineWidth = lw; c.lineCap = 'round';
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const v = R.v[i], l = len * (0.5 + 0.6 * v);
      const x = mod(R.x[i] * w - t * speed * 0.28 * v, w) - 30 + b.x0;   // jatuh ke kiri-bawah, searah goresan
      const y = (R.y[i] * h + t * speed * v) % h - 20 + b.y0;
      c.moveTo(x, y); c.lineTo(x - l * 0.28, y + l);
    }
    c.stroke();
  }

  // Kabut: tekstur awan kabut yang bisa disambung ke samping (dibuat sekali), diwarnai sesuai suasana.
  const FOG_W = 640, FOG_H = 160, FOG_PPU = 2;   // 320 x 80 satuan dunia
  let fogBase = null; const fogTint = {}, fogPat = {};
  function fogTexture(rgb) {
    if (fogTint[rgb]) return fogTint[rgb];
    if (!fogBase) {
      fogBase = document.createElement('canvas'); fogBase.width = FOG_W; fogBase.height = FOG_H;
      const x = fogBase.getContext('2d');
      for (let i = 0; i < 44; i++) {
        // Blob lonjong (tinggi 45% lebarnya) di tengah tekstur, jadi memudar habis sebelum tepi atas/bawah (tanpa garis lurus).
        const px = hash(i * 3.1 + 1) * FOG_W, py = FOG_H * (0.36 + hash(i * 5.7 + 2) * 0.28), r = 34 + hash(i * 7.3 + 3) * 64, a = 0.24 + hash(i * 2.9 + 4) * 0.28;
        [-FOG_W, 0, FOG_W].forEach(function (o) {   // diulang di kiri-kanan supaya ujungnya menyambung mulus
          x.save(); x.translate(px + o, py); x.scale(1, 0.45);
          const g = x.createRadialGradient(0, 0, 0, 0, 0, r);
          g.addColorStop(0, 'rgba(255,255,255,' + a + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
          x.fillStyle = g; x.fillRect(-r, -r, r * 2, r * 2);
          x.restore();
        });
      }
    }
    const cv = document.createElement('canvas'); cv.width = FOG_W; cv.height = FOG_H;
    const x = cv.getContext('2d');
    x.drawImage(fogBase, 0, 0);
    x.globalCompositeOperation = 'source-in'; x.fillStyle = 'rgb(' + rgb + ')'; x.fillRect(0, 0, FOG_W, FOG_H);
    return (fogTint[rgb] = cv);
  }
  const fogRGB = function (env) { return env.night ? '62,80,122' : '206,220,240'; };

  // Satu lajur kabut melayang pelan: y0 = tepi atas, h = tinggi (satuan dunia), speed = satuan dunia per detik.
  function fogBand(c, b, env, y0, h, speed, alpha, phase) {
    const tex = fogTexture(fogRGB(env)), tw = FOG_W / FOG_PPU, off = mod((Weather.still ? 0 : Weather.time) * speed + phase, tw);
    c.save();
    c.globalAlpha = alpha;
    fogPat[tex.width + fogRGB(env)] = fogPat[tex.width + fogRGB(env)] || c.createPattern(tex, 'repeat-x');
    c.fillStyle = fogPat[tex.width + fogRGB(env)];            // pola berulang: sambungan antar-ubin mulus, tanpa garis (dibuat sekali)
    c.translate(off, y0); c.scale(1 / FOG_PPU, h * FOG_PPU / FOG_H / FOG_PPU);
    c.fillRect((b.x0 - off) * FOG_PPU - FOG_W, 0, (b.x1 - b.x0) * FOG_PPU + FOG_W * 2, FOG_H);
    c.restore();
  }

  // Lapisan khusus suasana, disisipkan di antara lapisan tema (tone:false = warna apa adanya).
  // Lapisan bawaan yang punya gambar sendiri (Backdrop: background, awan, jauh) diganti satu lapisan gambar per slot.
  function swap(theme, env) {
    const done = {}, out = [], RANK = { background: 0, awan: 1, jauh: 2 };
    const png = function (slot, im) {
      return { slot: slot, depth: Backdrop.SLOTS[slot].depth, tone: false, draw: function (c, b) { Backdrop.draw(c, b, im, slot, env); } };
    };
    theme.layers.forEach(function (l) {
      const im = l.slot && Backdrop.get(theme.id, l.slot);
      if (!im) { out.push(l); return; }
      if (done[l.slot]) return;
      done[l.slot] = true;
      out.push(png(l.slot, im));
    });
    // Layer yang punya gambar tetapi tema tidak punya lapisan vektornya (mis. awan di Hutan): sisipkan sesuai urutan
    // background -> awan -> jauh, yaitu sebelum lapisan pertama yang peringkatnya lebih depan.
    Object.keys(RANK).forEach(function (slot) {
      const im = Backdrop.get(theme.id, slot);
      if (!im || done[slot]) return;
      const at = out.findIndex(function (l) { return RANK[l.slot] > RANK[slot]; });
      if (at < 0) out.push(png(slot, im)); else out.splice(at, 0, png(slot, im));
    });
    return out;
  }

  function layers(theme, env) {
    // Tema polos: hanya warna rata pilihan pemain (tidak ikut gelap saat malam/hujan), tanpa matahari,
    // bulan, bintang, atau awan. Hujan tetap turun, dengan goresan yang kontras terhadap warna latar.
    if (theme.plain) {
      const flat = [{ depth: 0, tone: false, draw: function (c, b) {
        c.fillStyle = env.bg; c.fillRect(b.x0 - 2, b.y0 - 2, b.x1 - b.x0 + 4, b.y1 - b.y0 + 4);
      } }];
      if (env.rain) flat.push({ depth: 0, tone: false, draw: function (c, b) { rain(c, b, 1100, 2.2, 0.36, 150, 1, 0.34, env.rainRGB); } });
      return flat;
    }
    const L = swap(theme, env), S = Weather.sunPos(env.night ? env.moon : env.sun), out = [L[0]];
    // Jika background memakai gambar sendiri, matahari/bulan/bintang bawaan tidak digambar.
    if (!Backdrop.get(theme.id, 'background')) out.push({ depth: 0.02, tone: false, draw: function (c, b) {
      const w = b.x1 - b.x0 + 4, h = b.y1 - b.y0 + 4;
      if (env.night || env.rain) {
        const g = c.createLinearGradient(0, 0, 0, b.G);
        g.addColorStop(0, env.night ? 'rgba(4,7,28,0.8)' : RAIN.sky); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(b.x0 - 2, b.y0 - 2, w, h);
      }
      if (env.rain) return;
      if (env.night) {
        Themes.across(b, 14, 0, 4, function (x, i) {
          for (let j = 0; j < 2; j++) {
            const r = hash(i * 2 + j + 1), sy = hash(i * 3 + j + 9) * (b.G - 90);
            if (sy < b.y0 || sy > b.y1) continue;
            disc(c, x + hash(i * 5 + j) * 14, sy, 0.35 + r * 0.7, 'rgba(255,255,240,' + (0.35 + r * 0.6).toFixed(2) + ')');
          }
        });
        radial(c, S[0], S[1], 75, 'rgba(190,210,255,0.45)', 'rgba(190,210,255,0)');
        disc(c, S[0], S[1], 15, '#f6f3dc');
        disc(c, S[0] - 5, S[1] - 3, 3, 'rgba(180,176,150,0.5)'); disc(c, S[0] + 4, S[1] + 5, 2.2, 'rgba(180,176,150,0.5)');
      } else {
        radial(c, S[0], S[1], theme.disc ? 90 : 115, 'rgba(255,246,205,0.72)', 'rgba(255,246,205,0)');
        if (theme.disc) {
          const g = c.createRadialGradient(S[0], S[1], 0, S[0], S[1], 28);
          g.addColorStop(0, '#fff6cc'); g.addColorStop(1, '#ffd36b');
          c.fillStyle = g; c.beginPath(); c.arc(S[0], S[1], 28, 0, Math.PI * 2); c.fill();
        }
      }
    } });
    out.push.apply(out, L.slice(1));
    if (env.lit) {
      // Cahaya pagi/sore di langit: kilau di cakrawala dan lingkaran cahaya di sekitar matahari (redup bila hujan).
      const dusk = env.tod === 'dusk', k = env.rain ? 0.5 : 1;
      out.push({ depth: 0.02, tone: false, draw: function (c, b) {
        const top = b.G - 170, bot = b.G + 10, g = c.createLinearGradient(0, top, 0, bot), col = dusk ? '255,118,52' : '255,196,140', a = (dusk ? 0.36 : 0.28) * k;
        g.addColorStop(0, 'rgba(' + col + ',0)'); g.addColorStop(1, 'rgba(' + col + ',' + a + ')');
        c.fillStyle = g; c.fillRect(b.x0 - 2, Math.max(top, b.y0 - 2), b.x1 - b.x0 + 4, bot - Math.max(top, b.y0 - 2));
        c.fillStyle = 'rgba(' + col + ',' + a + ')'; c.fillRect(b.x0 - 2, bot, b.x1 - b.x0 + 4, Math.max(0, b.y1 - bot + 2));
        if (!env.rain) radial(c, S[0], S[1], dusk ? 170 : 140, dusk ? 'rgba(255,150,70,0.42)' : 'rgba(255,228,175,0.38)', dusk ? 'rgba(255,150,70,0)' : 'rgba(255,228,175,0)');
      } });
    }
    if (env.rain) {
      // Kabut tipis di belakang rumah: makin pekat mendekati tanah, ditambah lajur kabut yang melayang pelan.
      out.push({ depth: 1, tone: false, draw: function (c, b) {
        const rgb = fogRGB(env), top = b.G - 190, hz = c.createLinearGradient(0, top, 0, b.G + 8);
        hz.addColorStop(0, 'rgba(' + rgb + ',0)'); hz.addColorStop(1, 'rgba(' + rgb + ',' + (env.night ? 0.46 : 0.64) + ')');
        c.fillStyle = hz; c.fillRect(b.x0 - 2, Math.max(top, b.y0 - 2), b.x1 - b.x0 + 4, b.G + 8 - Math.max(top, b.y0 - 2));
        c.fillStyle = 'rgba(' + rgb + ',' + (env.night ? 0.46 : 0.64) + ')'; c.fillRect(b.x0 - 2, b.G + 8, b.x1 - b.x0 + 4, Math.max(0, b.y1 - b.G));
        fogBand(c, b, env, b.G - 150, 135, 2, env.night ? 0.62 : 0.8, 90);    // lajur jauh: lebih tinggi dan lambat
        fogBand(c, b, env, b.G - 125, 115, 3, env.night ? 0.85 : 1, 0);
      } });
      out.push({ depth: 0, tone: false, draw: function (c, b) { rain(c, b, 1100, 2.2, env.night ? 0.2 : 0.3, 150, 1, 0.34); } });
    }
    return out;
  }

  // Suasana untuk satu waktu (tod = morning/day/dusk/night). sun = posisi matahari, moon = posisi bulan (0 kiri, 0,5 puncak, 1 kanan).
  function envFor(state, todIn, sunIn, moonIn) {
    const tod = ['morning', 'day', 'dusk', 'night'].indexOf(todIn) > -1 ? todIn : 'day';
    const night = tod === 'night', lit = tod === 'morning' || tod === 'dusk', rain = state.weather === 'rain';
    const bg = /^#[0-9a-f]{6}$/i.test(state.bg || '') ? state.bg : '#ffffff';
    // Goresan hujan gelap di atas latar terang, terang di atas latar gelap.
    const lum = [1, 3, 5].reduce(function (s, i, k) { return s + parseInt(bg.substr(i, 2), 16) * [0.3, 0.59, 0.11][k]; }, 0);
    const sun = typeof sunIn === 'number' ? sunIn : 0.2, moon = typeof moonIn === 'number' ? moonIn : sun;
    return { night: night, rain: rain, tod: tod, lit: lit, sun: sun, moon: moon, key: { morning: 'm', day: 'd', dusk: 's', night: 'n' }[tod] + (rain ? 'r' : 'c'),
             plain: state.theme === 'plain', bg: bg, rainRGB: lum > 140 ? '92,108,136' : '205,222,242' };
  }

  // ---- Jam hari: waktu sebagai fase kontinu 0 (pagi) - 1 (siang) - 2 (sore) - 3 (malam) - 4 (kembali ke pagi) ----
  // Di antara dua waktu yang bersebelahan, adegan digambar dua kali (waktu asal dan tujuan) lalu dicampur dengan bobot yang berjalan
  // halus (Renderer). Matahari dan bulan memakai satu posisi kontinu yang sama di kedua gambar, jadi tidak ada matahari ganda.
  const TODS = ['morning', 'day', 'dusk', 'night'];
  const PHASE_SECONDS = 60;          // lama satu perpindahan (pagi ke siang, siang ke sore, ...) pada kecepatan 1x
  const SPEEDS = [1, 2, 4, 8];       // pilihan kecepatan
  const CLOCK_KEY = 'rumah-mungil-clock';
  const ease = function (t) { return t * t * (3 - 2 * t); };
  // Matahari terbit di kiri (0,1) saat pagi, puncak (0,5) saat siang, terbenam (0,9) saat sore, lalu menghilang bersama gambar sore;
  // menjelang pagi ia muncul lagi dari ujung kiri. Bulan naik di antara sore dan pagi (puncak tengah malam).
  const sunAt = function (p) { p = mod(p, 4); return p < 2 ? 0.1 + 0.4 * p : p < 3 ? 0.9 + 0.1 * (p - 2) : 0.1 * (p - 3); };
  const moonAt = function (p) { p = mod(p, 4); return p >= 2 ? 0.1 + 0.4 * (p - 2) : 0.1; };
  const nightWeight = function (p) { p = mod(p, 4); return p < 2 ? 0 : p < 3 ? ease(p - 2) : 1 - ease(p - 3); };
  const clock = {
    on: false,       // true = suasana ditentukan jam (fase kontinu), bukan pilihan waktu biasa
    auto: false,     // true = fase maju sendiri
    phase: 1, speed: 1, dir: 1,   // dir: 1 maju, -1 mundur
    bias: 0,         // selisih posisi matahari saat masuk jam; menyusut halus ke 0 supaya tidak ada lompatan
    glide: null, drag: false, t: 0, saved: 0, night: null
  };
  function clockSave() {
    clock.saved = performance.now();
    try { localStorage.setItem(CLOCK_KEY, JSON.stringify({ on: clock.on, auto: clock.auto, phase: +mod(clock.phase, 4).toFixed(4), speed: clock.speed, dir: clock.dir })); } catch (e) { /* abaikan */ }
  }

  const Weather = {
    time: 0,
    still: false,   // true = tanpa animasi (preferensi "kurangi gerakan")
    // Suasana saat ini (waktu pilihan, tanpa jam otomatis). Lihat juga Weather.mix untuk jam otomatis.
    env: function (state) { return envFor(state, state.time, state.sun, state.sun); },
    layers: layers, tint: tint, untint: untint,

    // Posisi matahari (atau bulan di malam hari) di langit: 0 = kiri/terbit, 0.5 = puncak, 1 = kanan/terbenam.
    sunPos: function (sun) { return [30 + sun * 420, 185 - 145 * Math.sin(Math.PI * sun)]; },

    // Hujan di depan bangunan (lebih besar, lebih cepat).
    rainFront: function (c, b, env) { rain(c, b, 480, 3.8, 0.34, 320, 50, 0.42, env && env.rainRGB); },

    // Kabut tipis rendah di depan bangunan (di atas rumah, di bawah hujan depan). Tidak dipakai di tema polos.
    fogFront: function (c, b, env) {
      if (env.plain) return;
      fogBand(c, b, env, b.G - 64, 86, 5, env.night ? 0.66 : 0.8, 160);
    },

    // Gambar potongan versi malam/hujan: digelapkan per potongan lalu disimpan (cache).
    dimmed: function (item, env) {
      if (!env.night && !env.rain && !env.lit) return item.img;
      item.dim = item.dim || {};
      if (item.dim[env.key]) return item.dim[env.key];
      const im = item.img, cv = document.createElement('canvas');
      cv.width = im.naturalWidth || im.width; cv.height = im.naturalHeight || im.height;
      cv.getContext('2d').drawImage(im, 0, 0);
      return (item.dim[env.key] = Weather.dimCanvas(cv, env));
    },

    // Gelapkan isi kanvas (hanya piksel yang tidak transparan) sesuai hujan/malam. Dipakai juga oleh Backdrop.
    dimCanvas: function (cv, env) {
      if (!env.night && !env.rain && !env.lit) return cv;
      const x = cv.getContext('2d');
      x.globalCompositeOperation = 'source-atop';
      if (env.rain) { x.fillStyle = RAIN_FILL; x.fillRect(0, 0, cv.width, cv.height); }
      lightFills(env).forEach(function (f) { x.fillStyle = f; x.fillRect(0, 0, cv.width, cv.height); });
      if (env.night) { x.fillStyle = NIGHT_FILL; x.fillRect(0, 0, cv.width, cv.height); }
      x.globalCompositeOperation = 'source-over';
      return cv;
    },

    // Gambar yang dipakai untuk satu potongan: jendela malam memakai PNG sendiri (tidak digelapkan).
    piece: function (item, p, env) {
      if (p.kind === 'text') return item.img;   // teks tidak ikut digelapkan: warnanya tetap seperti yang dipilih
      return env.night && item.nightImg ? item.nightImg : Weather.dimmed(item, env);   // PNG _malam (jendela, lampu, ruko, papan menyala, hiasan) dipakai apa adanya
    },

    // Kanvas sementara untuk menggelapkan hanya piksel bangunan (bukan area transparan).
    scratch: function (w, h) {
      scratch = scratch || document.createElement('canvas');
      if (scratch.width !== w || scratch.height !== h) { scratch.width = w; scratch.height = h; }
      const c = scratch.getContext('2d');
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
      return c;
    },
    dim: function (ctx, pc, env) {
      const w = pc.canvas.width, h = pc.canvas.height;
      pc.globalCompositeOperation = 'source-atop';
      if (env.rain) { pc.fillStyle = RAIN_FILL; pc.fillRect(0, 0, w, h); }
      lightFills(env).forEach(function (f) { pc.fillStyle = f; pc.fillRect(0, 0, w, h); });
      if (env.night) { pc.fillStyle = NIGHT_FILL; pc.fillRect(0, 0, w, h); }
      pc.globalCompositeOperation = 'source-over';
      ctx.drawImage(pc.canvas, 0, 0);
    },

    // Malam: jendela menyala dan lampu jalan bercahaya hangat. Cahaya digambar di kanvas
    // tersendiri menurut urutan lapisan: tiap potongan memotong cahaya milik potongan di
    // belakangnya, jadi objek yang menutupi jendela juga menutupi cahayanya.
    lights: function (ctx, state, k, ox, oy, env) {
      if (!env.night) return;
      const w = ctx.canvas.width, h = ctx.canvas.height;
      lightCv = lightCv || document.createElement('canvas');
      if (lightCv.width !== w || lightCv.height !== h) { lightCv.width = w; lightCv.height = h; lightSig = ''; }
      // Cahaya tidak berubah antar-frame animasi (hujan, goyangan daun), jadi hanya dihitung ulang kalau objek atau kamera berubah.
      const sig = w + '|' + h + '|' + k + '|' + ox + '|' + oy + '|' + state.pieces.map(function (p) {
        return p.id + p.type + p.x + p.y + (p.kind === 'text' ? Texts.key(p) : '') + (Assets.itemOf(p).nightImg ? 'n' : '');
      }).join(',');
      if (sig !== lightSig) {
        lightSig = sig;
        const c = lightCv.getContext('2d');
        c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
        state.pieces.forEach(function (p) {
          const item = Assets.itemOf(p), d = Assets.dims(item);
          const x0 = Math.round(ox + p.x * k), y0 = Math.round(oy + p.y * k);
          const pw = Math.round(ox + (p.x + d.w) * k) - x0, ph = Math.round(oy + (p.y + d.h) * k) - y0;
          c.globalCompositeOperation = 'destination-out';
          c.drawImage(item.img, x0, y0, pw, ph);
          c.globalCompositeOperation = 'source-over';
          const win = p.kind === 'window', lamp = p.kind === 'lamp', lit = !win && !lamp && !!item.nightImg;   // ruko, papan menyala, hiasan dengan PNG _malam
          if (!win && !lamp && !lit) return;
          const gl = item.glow || [0.5, 0.5];
          if (lit) {
            const col = item.glowColor || '255,196,96';
            radial(c, x0 + pw * gl[0], y0 + ph * gl[1], (item.glowR || 28) * k, 'rgba(' + col + ',0.42)', 'rgba(' + col + ',0)');
            return;
          }
          if (win) {
            softRadial(c, x0 + pw * gl[0], y0 + ph * gl[1], (item.glowR || Math.max(d.w, d.h) * WINDOW_GLOW.size) * k,
                       item.glowColor || WINDOW_GLOW.color, WINDOW_GLOW.alpha);
          } else {
            radial(c, x0 + pw * gl[0], y0 + ph * gl[1], 44 * k, 'rgba(255,200,110,0.6)', 'rgba(255,196,96,0)');
          }
          if (!item.nightImg) c.drawImage(item.img, x0, y0, pw, ph);
        });
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(lightCv, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }
  };


  // ---- API jam ----
  Weather.clock = clock;
  Weather.saveClock = clockSave;
  Weather.SPEEDS = SPEEDS;
  Weather.PHASE_SECONDS = PHASE_SECONDS;
  Weather.TODS = TODS;

  // Suasana yang dipakai untuk menggambar: {a, b, f}. b = null kalau cukup satu suasana; kalau ada, b dicampur di atas a dengan bobot f (0 - 1).
  Weather.mix = function (state) {
    if (!clock.on || state.noClock) return { a: Weather.env(state), b: null, f: 0 };   // noClock: pratinjau tema, tidak ikut jam hari
    const p = mod(clock.phase, 4), i = Math.floor(p) % 4, w = ease(p - Math.floor(p));
    const sun = Math.max(0, Math.min(1, sunAt(p) + clock.bias)), moon = Math.max(0, Math.min(1, moonAt(p) + clock.bias));
    if (w < 0.004) return { a: envFor(state, TODS[i], sun, moon), b: null, f: 0 };
    if (w > 0.996) return { a: envFor(state, TODS[(i + 1) % 4], sun, moon), b: null, f: 0 };
    return { a: envFor(state, TODS[i], sun, moon), b: envFor(state, TODS[(i + 1) % 4], sun, moon), f: w };
  };

  // Apakah sekarang malam (untuk suara)? Jam: lebih dari separuh malam.
  Weather.isNight = function (state) { return clock.on ? nightWeight(clock.phase) > 0.5 : !!state && state.time === 'night'; };

  // Waktu terdekat dari fase jam (indeks 0-3), untuk menandai pilihan di panel.
  Weather.nearestTime = function () { return TODS[Math.round(mod(clock.phase, 4)) % 4]; };

  // Ada yang bergerak sendiri karena jam (perlu gambar tiap frame)?
  Weather.clockRunning = function () { return clock.on && ((clock.auto && !clock.drag) || !!clock.glide || clock.bias !== 0); };

  // Masuk ke mode jam dari suasana biasa: fase = waktu saat ini, posisi matahari mengalir halus dari posisi lama.
  Weather.clockStart = function (state) {
    if (clock.on) return;
    const k0 = TODS.indexOf(state.time), i = k0 < 0 ? 1 : k0, p = i;
    clock.on = true; clock.phase = p; clock.glide = null;
    const ref = TODS[i] === 'night' ? moonAt(p) : sunAt(p), cur = typeof state.sun === 'number' ? state.sun : ref;
    clock.bias = Math.abs(cur - ref) < 0.002 ? 0 : cur - ref;
    clock.night = Weather.isNight(state);
    clockSave();
  };
  Weather.setAuto = function (state, on) {
    if (on) Weather.clockStart(state);
    clock.auto = !!on && clock.on;
    clockSave();
  };
  // Atur fase langsung (penggeser waktu): maju atau mundur, selalu kontinu.
  Weather.setPhase = function (state, p) {
    Weather.clockStart(state);
    clock.glide = null;
    clock.phase = mod(+p, 4);
  };
  Weather.setSpeed = function (v) { if (SPEEDS.indexOf(v) > -1) { clock.speed = v; clockSave(); } };
  Weather.setDir = function (d) { clock.dir = d < 0 ? -1 : 1; clockSave(); };

  // Keluar dari jam menuju satu waktu: fase meluncur halus lewat jalur terpendek, lalu done(posisiMatahari) dipanggil dan mode jam mati.
  Weather.clockExit = function (tod, done) {
    const to0 = TODS.indexOf(tod);
    if (!clock.on || to0 < 0) { if (done) done(null); return; }
    const from = mod(clock.phase, 4), delta = mod(to0 - from + 2, 4) - 2;   // -2 .. 2: jalur terpendek
    const finish = function () {
      const sun = to0 === 3 ? moonAt(to0) : sunAt(to0);
      clock.on = false; clock.auto = false; clock.glide = null; clock.bias = 0; clock.night = null;
      clockSave();
      if (done) done(sun);
    };
    clock.auto = false;
    if (Math.abs(delta) < 0.01) { clock.phase = to0; finish(); return; }
    clock.glide = { from: from, to: from + delta, el: 0, dur: Math.max(0.7, Math.min(2.2, 0.6 + Math.abs(delta) * 0.7)), done: finish };
  };

  // Dipanggil tiap frame gambar dengan waktu rAF (ms). Mengembalikan true kalau ada yang berubah.
  Weather.tick = function (t) {
    const dt = clock.t ? Math.min(0.5, Math.max(0, (t - clock.t) / 1000)) : 0;   // maks 0,5 dtk: frame lambat tetap mengikuti waktu nyata, tapi tab yang lama disembunyikan tidak melompat jauh
    clock.t = t;
    if (!clock.on) return false;
    let moved = false;
    if (clock.glide) {
      const g = clock.glide; g.el += dt;
      const u = Math.min(1, g.el / g.dur);
      clock.phase = mod(g.from + (g.to - g.from) * ease(u), 4); moved = true;
      if (u >= 1) { clock.glide = null; g.done(); }
    } else if (clock.auto && !clock.drag) {
      clock.phase = mod(clock.phase + clock.dir * clock.speed * dt / PHASE_SECONDS, 4); moved = true;
    }
    if (clock.on && clock.bias) { clock.bias *= Math.exp(-dt / 0.9); if (Math.abs(clock.bias) < 0.002) clock.bias = 0; moved = true; }
    if (clock.on) {
      const n = Weather.isNight(global.State && State.data);
      if (n !== clock.night) { clock.night = n; if (global.Sound && global.State && State.data) Sound.set(State.data); }
      if (moved && t - clock.saved > 2000) clockSave();
    }
    return moved;
  };

  // Pulihkan jam dari sesi sebelumnya (dipanggil sekali setelah State siap).
  Weather.clockRestore = function () {
    try {
      const c = JSON.parse(localStorage.getItem(CLOCK_KEY) || 'null');
      if (!c || !c.on || !isFinite(c.phase)) return;
      clock.on = true; clock.phase = mod(+c.phase, 4); clock.auto = !!c.auto;
      clock.speed = SPEEDS.indexOf(c.speed) > -1 ? c.speed : 1; clock.dir = c.dir < 0 ? -1 : 1;
      clock.night = Weather.isNight(global.State && State.data);
    } catch (e) { /* abaikan */ }
  };
  window.addEventListener('pagehide', function () { if (clock.on) clockSave(); });

  global.Weather = Weather;
})(window);
