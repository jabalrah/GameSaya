/*
 * Titik awal: muat aset PNG, siapkan state, gambar canvas, lalu pasang panel.
 *
 * Gambar ulang: SEMUA permintaan gambar (seret objek, zoom, penggeser, animasi) lewat satu loop requestAnimationFrame,
 * jadi paling banyak satu gambar penuh per frame layar, tidak peduli berapa banyak event pointer yang masuk.
 * Performa otomatis: kalau perangkat tidak sanggup ~60 fps, resolusi internal canvas diturunkan bertahap
 * (dan dinaikkan lagi bila ringan), dan animasi ringan (hanya awan) dibatasi 30 fps. Tambahkan ?fps ke alamat
 * halaman untuk menampilkan penghitung fps, atau ?fixed untuk mengunci kualitas penuh.
 */
(function () {
  'use strict';

  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d', { alpha: false });   // canvas selalu penuh terisi: tanpa alpha = penyusunan layar lebih cepat
  const status = document.getElementById('status');
  const panel = document.getElementById('panel');
  const panelLeft = document.getElementById('panel-left');

  const app = document.getElementById('app');
  // Sembunyikan/tampilkan panel edit (kiri dan kanan) yang mengambang di atas kanvas.
  const toggle = document.getElementById('toggle');
  toggle.addEventListener('click', function () {
    const off = app.classList.toggle('panels-off');
    toggle.setAttribute('aria-expanded', String(!off));
    toggle.textContent = off ? 'Tampilkan panel edit' : 'Sembunyikan panel edit';
  });

  // Layar penuh browser: panel edit tetap tampil. Keluar dengan tombol yang sama atau tombol Esc.
  const fsBtn = document.getElementById('fullscreen');
  const root = document.documentElement;
  const fsRequest = root.requestFullscreen || root.webkitRequestFullscreen;
  const fsExit = document.exitFullscreen || document.webkitExitFullscreen;
  const fsElement = function () { return document.fullscreenElement || document.webkitFullscreenElement || null; };
  if (!fsRequest || !fsExit) fsBtn.hidden = true;   // browser tanpa layar penuh (misalnya iPhone): tombolnya disembunyikan
  fsBtn.addEventListener('click', function () {
    const r = fsElement() ? fsExit.call(document) : fsRequest.call(root);
    if (r && r.catch) r.catch(function () {});
  });
  function fsSync() {
    const on = !!fsElement();
    fsBtn.setAttribute('aria-pressed', String(on));
    fsBtn.textContent = on ? 'Keluar layar penuh' : 'Layar penuh';
  }
  document.addEventListener('fullscreenchange', fsSync);
  document.addEventListener('webkitfullscreenchange', fsSync);

  // Piksel per satuan dunia (dunia 480x300 selalu muat utuh di canvas).
  function ppu() { return Math.min(canvas.width / Renderer.WIDTH, canvas.height / Renderer.HEIGHT); }

  // Tingkat kualitas otomatis: faktor resolusi internal canvas. 0 = penuh. Naik/turun sendiri menurut kelancaran (lihat sample()).
  const FACTORS = [1, 0.8, 0.64, 0.5];
  let level = 0;

  // Canvas selalu memenuhi jendela; tinggi latar (300) pas dengan tinggi layar. Layar yang lebih lebar dari 1,6 menampilkan
  // lebih banyak bagian peta panjang di kiri-kanan (digeser lewat seret atau tombol panah). Resolusi ikut naik agar tajam.
  function fit() {
    const d = Math.min(window.devicePixelRatio || 1, 2, 2880 / window.innerWidth);
    const w = Math.max(240, Math.round(Math.round(window.innerWidth * d) * FACTORS[level]));
    const h = Math.round(w * window.innerHeight / window.innerWidth);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
    Camera.setSize(w / ppu(), h / ppu());   // memicu gambar ulang
  }
  window.addEventListener('resize', function () { requestAnimationFrame(fit); });

  canvas.width = Math.round(Renderer.WIDTH * Renderer.SCALE);   // 1200 x 750 agar halus
  canvas.height = Math.round(Renderer.HEIGHT * Renderer.SCALE);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);   // canvas tanpa alpha mulai hitam; isi putih dulu selama aset dimuat
  fit();   // langsung pas dengan jendela

  // ---- Loop gambar tunggal ----
  const calm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let raf = 0, dirty = false, lastDraw = 0, capGap = 0;          // capGap: batas laju darurat (ms) bila perangkat lambat
  let prevT = 0, nFrames = 0, sumDelta = 0, sumCost = 0, calmWins = 0, drawMs = 0, seen = 0, minLevel = 0, upAt = 0;

  function draw() { Renderer.draw(ctx, State.data, State.selected, ppu(), Camera.view); if (window.UI) { if (UI.layout) UI.layout(); if (UI.syncClock) UI.syncClock(); } }

  // Apakah ada yang bergerak sendiri (hujan, daun, awan)?
  function animation() {
    const clk = Weather.clockRunning() ? 1 : 0;   // jam hari berjalan (siklus otomatis atau meluncur ke waktu pilihan): 30 fps sudah mulus
    if (calm || !State.data) return clk;
    const rain = State.data.weather === 'rain', leaves = State.data.pieces.some(function (p) { return p.kind === 'foliage'; });
    if (rain || leaves) return 2;              // gerak cepat: sebisa mungkin 60 fps
    return Math.max(clk, Backdrop.animated(State.data.theme) ? 1 : 0);   // hanya awan: gerak sangat pelan, 30 fps sudah mulus
  }

  function requestDraw() { dirty = true; if (!raf) raf = requestAnimationFrame(loop); }

  function loop(t) {
    raf = 0;
    const anim = animation(), gap = Math.max(capGap, anim === 1 ? 33 : 0);
    if (!dirty && anim && gap && t - lastDraw < gap - 2) { raf = requestAnimationFrame(loop); return; }   // lewati frame: belum waktunya
    if (anim) Weather.time = t / 1000;
    Weather.tick(t);   // jam hari: majukan fase suasana
    dirty = false;
    const t0 = performance.now();
    draw();
    drawMs = performance.now() - t0;
    lastDraw = t;
    sample(t, drawMs, gap);
    if (anim || dirty) raf = requestAnimationFrame(loop);
  }

  // Ukur kelancaran: selisih waktu antar-frame berurutan (sudah termasuk kerja GPU/penyusunan), dan lama gambar di JS.
  const ADAPT = !/[?&]fixed\b/.test(location.search);   // ?fixed = kunci kualitas penuh (tanpa penyesuaian otomatis)
  function sample(t, cost, gap) {
    if (!ADAPT) return;
    const dt = t - prevT; prevT = t;
    if (dt <= 0 || dt > 120) { nFrames = sumDelta = sumCost = 0; return; }   // jeda (tab disembunyikan, animasi berhenti): abaikan
    if (++seen < 90) return;                                                   // pemanasan: decode aset dan rebuild pertama tidak dihitung
    sumDelta += dt; sumCost += cost; nFrames++;
    if (nFrames < 45) return;
    const avgDelta = sumDelta / nFrames, avgCost = sumCost / nFrames, want = Math.max(gap, 16.7);
    nFrames = sumDelta = sumCost = 0;
    if (avgDelta > want * 1.35) {                       // tidak sanggup: turunkan resolusi, lalu batasi laju
      calmWins = 0;
      if (level < FACTORS.length - 1) {
        // Baru saja dinaikkan lalu turun lagi = di batas kemampuan perangkat: jangan naik ke tingkat itu lagi.
        if (upAt && t - upAt < 25000) minLevel = level + 1;
        level++; fit();
      } else if (!capGap) capGap = 33;
    } else if (avgCost < 7 && (level > minLevel || capGap) && ++calmWins >= 6) {   // ringan terus ~5 detik: kembalikan
      calmWins = 0;
      const up = Math.pow(FACTORS[Math.max(0, level - 1)] / FACTORS[level], 2);
      if (capGap) capGap = 0;
      else if (avgCost * up < 8) { level--; upAt = t; fit(); }
    } else if (avgCost >= 7) calmWins = 0;
  }

  function fpsMeter() {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:99;font:12px/1.4 monospace;background:rgba(0,0,0,.65);color:#fff;padding:4px 8px;border-radius:6px;pointer-events:none';
    document.body.appendChild(el);
    let n = 0, t0 = performance.now();
    const count = function () { n++; requestAnimationFrame(count); };
    requestAnimationFrame(count);
    setInterval(function () {
      const now = performance.now(), fps = Math.round(n * 1000 / (now - t0)); n = 0; t0 = now;
      el.textContent = fps + ' fps | gambar ' + drawMs.toFixed(1) + ' ms | ' + canvas.width + 'x' + canvas.height + ' (kualitas ' + Math.round(FACTORS[level] * 100) + '%)' + (capGap ? ' | batas 30 fps' : '');
    }, 500);
  }
  if (/[?&]fps\b/.test(location.search)) fpsMeter();

  Assets.loadAll().then(function () {
    State.init();
    Weather.clockRestore();   // siklus hari dari sesi sebelumnya (kalau ada)
    UI.init({ panel: panel, left: panelLeft, status: status, canvas: canvas });

    State.onDraw(requestDraw);
    Camera.onChange(requestDraw);
    window.addEventListener('rumah-redraw', requestDraw);
    Assets.loadNight(requestDraw);
    draw();

    Weather.still = calm;
    // Layer latar dimuat belakangan: gambar ulang dan cek lagi apakah awan perlu digerakkan.
    Backdrop.init(Themes.list.filter(function (t) { return !t.plain; }).map(function (t) { return t.id; }), requestDraw);
    State.setEnv('weather', State.data.weather);
    Sound.bind(document.getElementById('sound'));
    requestDraw();
  }).catch(function (err) {
    panel.textContent = err.message + '. Pastikan folder assets/ ada di samping index.html.';
    panelLeft.textContent = '';
  });
})();
