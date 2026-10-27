/*
 * Suara latar (tanpa file audio dan tanpa musik): hanya suara suasana yang dibuat langsung dengan Web Audio API
 * dan mengikuti tema, waktu, dan cuaca: burung dan angin (hutan siang), jangkrik (malam), ombak dan camar (pantai),
 * lalu lintas (kota), dan suara hujan. Tema Polos hanya punya suara hujan. Ada juga efek suara lembut saat klik dan saat
 * objek dijatuhkan. Browser mewajibkan interaksi pengguna dulu, jadi suara mulai pada klik/ketukan pertama
 * atau lewat tombol "Suara". Angka volume tiap lapisan ada di levels().
 */
(function (global) {
  'use strict';

  const KEY = 'rumah-mungil-suara';
  let ctx = null, master = null, running = false, last = null, btn = null;
  const L = {};

  function buf(kind) {
    const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let v = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { v = (v + 0.02 * w) / 1.02; d[i] = v * 3.5; } else d[i] = w;
    }
    return b;
  }

  function lfo(param, type, rate, depth) {
    const o = ctx.createOscillator(), d = ctx.createGain();
    o.type = type; o.frequency.value = rate; d.gain.value = depth;
    o.connect(d); d.connect(param); o.start();
  }

  // Noise berulang lewat filter; rate/depth menambah gelombang naik-turun (angin, ombak).
  function bed(kind, type, freq, rate, depth) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), sw = ctx.createGain(), g = ctx.createGain();
    s.buffer = buf(kind); s.loop = true; f.type = type; f.frequency.value = freq;
    sw.gain.value = rate ? 1 - depth : 1; g.gain.value = 0;
    s.connect(f); f.connect(sw); sw.connect(g); g.connect(master); s.start();
    if (rate) lfo(sw.gain, 'sine', rate, depth);
    return g;
  }

  function cricket(freq, trill, burst) {
    const o = ctx.createOscillator(), a = ctx.createGain(), b = ctx.createGain();
    o.frequency.value = freq; a.gain.value = 0.5; b.gain.value = 0.5;
    o.connect(a); a.connect(b); b.connect(L.crickets); o.start();
    lfo(a.gain, 'sine', trill, 0.5); lfo(b.gain, 'square', burst, 0.5);
  }

  function chirp() {
    const t = ctx.currentTime, gull = last.theme === 'beach', n = gull ? 1 : 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), s = t + i * 0.13, f = gull ? 900 : 2200 + Math.random() * 1800;
      o.frequency.setValueAtTime(f, s);
      o.frequency.exponentialRampToValueAtTime(gull ? f * 0.6 : f * (0.7 + Math.random() * 0.8), s + (gull ? 0.45 : 0.09));
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(gull ? 0.05 : 0.07, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + (gull ? 0.5 : 0.11));
      o.connect(g); g.connect(L.birds); o.start(s); o.stop(s + 0.6);
    }
  }

  const mtof = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };

  // ---- Efek suara: nada piano lembut (tangga nada pentatonik, jadi selalu enak didengar) ----
  // Nada piano = beberapa harmonik yang meredup berbeda: harmonik tinggi cepat hilang, nada dasar bertahan.
  function piano(m, t, vol, dur) {
    const f = mtof(m);
    [[1, 1, 1], [2, 0.45, 0.5], [3, 0.2, 0.3], [4.02, 0.1, 0.2]].forEach(function (h, i) {
      const o = ctx.createOscillator(), g = ctx.createGain(), d = dur * h[2];
      o.type = 'sine'; o.frequency.value = f * h[0];
      if (i === 0) o.detune.value = 3;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol * h[1], t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(L.sfx); o.start(t); o.stop(t + d + 0.05);
    });
  }

  // Gema ruangan kecil supaya nada terdengar lebih "penuh".
  function reverb() {
    const n = Math.floor(ctx.sampleRate * 1.4), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    }
    const cv = ctx.createConvolver(), wet = ctx.createGain();
    cv.buffer = b; wet.gain.value = 0.28;
    L.sfx.connect(cv); cv.connect(wet); wet.connect(master);
  }

  // Klik: ketukan marimba pendek dan lembut, nadanya diacak sedikit dari tangga nada pentatonik.
  function tick(m, t) {
    const f = mtof(m);
    [[1, 0.24, 0.22], [3.9, 0.08, 0.07]].forEach(function (h) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f * h[0];
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(h[1], t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + h[2]);
      o.connect(g); g.connect(L.sfx); o.start(t); o.stop(t + h[2] + 0.05);
    });
  }

  const TICKS = [76, 79, 81, 84];
  const SFX = {
    click: function (t) { tick(TICKS[Math.floor(Math.random() * TICKS.length)], t); },
    // Jatuhkan: akor C mayor yang hangat dan singkat.
    drop: function (t) { piano(60, t, 0.3, 1.3); piano(67, t, 0.2, 1.3); piano(76, t + 0.07, 0.18, 1.1); }
  };

  // Volume tiap lapisan menurut suasana (0 = mati).
  function levels(e) {
    return {
      rain: e.rain ? 0.3 : 0,
      wind: e.theme === 'plain' ? 0 : e.rain ? 0.4 : 0.3,
      waves: e.theme === 'beach' ? (e.rain ? 0.15 : 0.35) : 0,
      traffic: e.theme === 'city' ? (e.night ? 0.35 : 0.55) : 0,
      crickets: e.night && !e.rain && e.theme !== 'city' && e.theme !== 'plain' ? 0.06 : 0,
      birds: !e.night && !e.rain && e.theme !== 'city' && e.theme !== 'plain' ? 1 : 0
    };
  }

  function apply() {
    if (!ctx || !last) return;
    const v = levels(last), t = ctx.currentTime;
    Object.keys(v).forEach(function (k) { L[k].gain.setTargetAtTime(v[k], t, 1.2); });
  }

  function label() { if (btn) { btn.textContent = running ? 'Suara: nyala' : 'Suara: mati'; btn.setAttribute('aria-pressed', String(running)); } }

  function start() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
      L.rain = bed('white', 'bandpass', 3500, 0, 0);
      L.wind = bed('brown', 'lowpass', 600, 0.07, 0.4);
      L.waves = bed('white', 'lowpass', 900, 0.12, 0.5);
      L.traffic = bed('brown', 'lowpass', 250, 0.05, 0.25);
      ['crickets', 'birds'].forEach(function (k) { L[k] = ctx.createGain(); L[k].gain.value = 0; L[k].connect(master); });
      L.sfx = ctx.createGain(); L.sfx.connect(master); reverb();
      cricket(4300, 38, 1.6); cricket(4650, 41, 1.15);
      setInterval(function () { if (running && last && levels(last).birds && Math.random() < 0.45) chirp(); }, 900);
    }
    ctx.resume();
    master.gain.setTargetAtTime(0.5, ctx.currentTime, 0.5);
    running = true; apply(); label();
  }

  function stop() {
    running = false; label();
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
  }

  const Sound = {
    // Efek suara singkat; diam bila suara dimatikan.
    sfx: function (name) { if (running && SFX[name]) SFX[name](ctx.currentTime); },

    set: function (data) { last = { theme: data.theme, night: window.Weather ? Weather.isNight(data) : data.time === 'night', rain: data.weather === 'rain' }; apply(); },

    bind: function (button) {
      btn = button; label();
      button.addEventListener('click', function () {
        if (running) { stop(); try { localStorage.setItem(KEY, 'off'); } catch (e) {} }
        else { start(); try { localStorage.removeItem(KEY); } catch (e) {} }
      });
      // Mulai otomatis pada interaksi pertama, kecuali pengguna pernah mematikannya.
      const first = function (e) {
        if (e.target && e.target.closest && e.target.closest('#sound')) return;
        document.removeEventListener('click', first); document.removeEventListener('keydown', first);
        let off = false;
        try { off = localStorage.getItem(KEY) === 'off'; } catch (err) {}
        if (!off && !running) start();
      };
      document.addEventListener('click', first); document.addEventListener('keydown', first);
      document.addEventListener('visibilitychange', function () {
        if (!ctx) return;
        if (document.hidden) ctx.suspend(); else if (running) ctx.resume();
      });
      // Semua tombol (panel, tab, zoom, lapisan, dll.) berbunyi klik saat ditekan.
      document.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('button')) Sound.sfx('click');
      });
      State.onDraw(function () { Sound.set(State.data); });
      Sound.set(State.data);
    }
  };

  global.Sound = Sound;
})(window);
