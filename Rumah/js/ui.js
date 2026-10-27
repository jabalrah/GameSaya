/*
 * Dua panel tombol (kiri: kategori objek bangunan; kanan: teks, tema, suasana, daftar lapisan, dan aksi).
 * Klik tombol kategori = panel itu berubah menjadi daftar pilihannya, dengan tombol Kembali di atasnya.
 * Dibangun ulang setiap state berubah
 * (kecil saja, jadi cukup cepat) dan fokus keyboard dikembalikan sesudahnya.
 */
(function (global) {
  'use strict';

  const TABS = [
    { id: 'roof', label: 'Atap', group: 'roofs', prop: 'roof' },
    { id: 'wall', label: 'Dinding', group: 'walls', prop: 'wall' },
    { id: 'window', label: 'Jendela', group: 'windows', prop: 'window' },
    { id: 'door', label: 'Pintu', group: 'doors', prop: 'door' },
    { id: 'aksesoris_pintu', label: 'Aksesoris pintu', group: 'aksesoris_pintu' },
    { id: 'aksesoris_jendela', label: 'Aksesoris jendela', group: 'aksesoris_jendela' },
    { id: 'ruko', label: 'Ruko', group: 'ruko' },
    { id: 'papan', label: 'Papan', group: 'papan' },
    { id: 'papan_menyala', label: 'Papan menyala', group: 'papan_menyala' },
    { id: 'vandal', label: 'Vandal', group: 'vandal' },
    { id: 'hiasan', label: 'Hiasan', group: 'hiasan' },
    { id: 'lamp', label: 'Lampu', group: 'lamps' },
    { id: 'foliage', label: 'Dedaunan', group: 'foliage' },
    { id: 'trunk', label: 'Batang', group: 'trunks' },
    { id: 'extras', label: 'Tambahan' }
  ];
  // Tombol di panel kanan yang membuka pilihannya di panel itu sendiri.
  const SET_TABS = [
    { id: 'text', label: 'Teks' },
    { id: 'theme', label: 'Tema' },
    { id: 'env', label: 'Suasana' },
    { id: 'layers', label: 'Daftar lapisan' }
  ];
  const LABEL = { wall: 'Dinding', window: 'Jendela', door: 'Pintu', roof: 'Atap', lamp: 'Lampu', foliage: 'Dedaunan', trunk: 'Batang', extra: 'Tambahan', text: 'Teks',
                  aksesoris_pintu: 'Aksesoris pintu', aksesoris_jendela: 'Aksesoris jendela', ruko: 'Ruko', papan: 'Papan', papan_menyala: 'Papan menyala', vandal: 'Vandal', hiasan: 'Hiasan' };

  const TAB_OF = function (kind) { return kind === 'extra' ? 'extras' : kind; };   // jenis objek -> id kategori di panel kiri

  let panel, left, statusEl;
  const view = { left: null, right: null };   // kategori yang sedang terbuka di tiap panel (null = menu tombol)
  let lastSelected = null;

  function h(tag, props) {
    const el = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      const v = props[k];
      if (v === false || v == null) return;
      if (k === 'class') el.className = v;
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (let i = 2; i < arguments.length; i++) {
      [].concat(arguments[i]).forEach(function (c) {
        if (c == null || c === false) return;
        el.append(c.nodeType ? c : document.createTextNode(c));
      });
    }
    return el;
  }

  // Gambar kecil yang pas di kotak pratinjau (skala halus, maksimal 3x). Hanya bagian PNG yang terisi yang ditampilkan:
  // tepi transparan dipotong otomatis (lewat Assets.bounds), jadi objek mengisi kotak. Gambar asli tidak diubah.
  function thumb(item, boxW, boxH) {
    const img = new Image();
    img.src = item.src;
    img.alt = '';
    const d = Assets.dims(item), nw = item.img.naturalWidth || item.img.width, nh = item.img.naturalHeight || item.img.height;
    const b = Assets.bounds(item) || { x: 0, y: 0, w: nw, h: nh };
    const ux = d.w / nw, uy = d.h / nh;                       // satuan canvas per piksel gambar
    const cw = b.w * ux, ch = b.h * uy, sc = Math.min(boxW / cw, boxH / ch, 3);
    const box = document.createElement('span');
    box.className = 'opt-crop';
    box.style.width = (cw * sc) + 'px';
    box.style.height = (ch * sc) + 'px';
    img.style.width = (d.w * sc) + 'px';
    img.style.height = (d.h * sc) + 'px';
    img.style.left = (-b.x * ux * sc) + 'px';
    img.style.top = (-b.y * uy * sc) + 'px';
    box.append(img);
    return box;
  }

  function optionButton(key, item, pressed, onClick) {
    return h('button', {
      type: 'button', class: 'opt', 'data-key': key,
      'aria-pressed': String(!!pressed), onClick: onClick
    }, h('span', { class: 'opt-preview' }, thumb(item, 58, 42)),
       h('span', { class: 'opt-label' }, item.label));
  }

  function setStatus(msg) { if (statusEl) statusEl.textContent = msg; }

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function saveImage() {
    Renderer.exportBlob(State.data, 3).then(function (blob) {
      downloadBlob(blob, 'rumah-mungil.png');
      setStatus('Gambar disimpan sebagai rumah-mungil.png.');
    }).catch(function () {
      setStatus('Gambar tidak bisa disimpan dari file lokal. Jalankan lewat server lokal (lihat README), lalu coba lagi.');
    });
  }

  const KIND = { roof: 'roof', wall: 'wall', window: 'window', door: 'door', lamp: 'lamp', foliage: 'foliage', trunk: 'trunk',
                 aksesoris_pintu: 'aksesoris_pintu', aksesoris_jendela: 'aksesoris_jendela', ruko: 'ruko', papan: 'papan', papan_menyala: 'papan_menyala', vandal: 'vandal', hiasan: 'hiasan' };

  const previews = {};
  function themePreview(t) {
    const pkey = t.id + (t.plain ? State.data.bg : '');   // pratinjau polos mengikuti warna yang dipilih
    if (!previews[pkey]) {
      const full = document.createElement('canvas');
      full.width = Renderer.WIDTH; full.height = Renderer.HEIGHT;
      Renderer.draw(full.getContext('2d'), { pieces: [], theme: t.id, bg: t.plain ? State.data.bg : undefined }, null, 1);
      previews[pkey] = full;
    }
    const c = document.createElement('canvas');
    c.width = 176; c.height = 110;
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(previews[pkey], 0, 0, 176, 110);
    return c;
  }

  // Pilihan warna latar untuk tema polos: warna siap pakai + pemilih warna bebas.
  const BG_COLORS = [
    ['#ffffff', 'Putih'], ['#f6efe3', 'Krem'], ['#e9ecef', 'Abu muda'], ['#dbeaf7', 'Biru muda'],
    ['#dcefe3', 'Hijau mint'], ['#fbf1c7', 'Kuning pucat'], ['#f9e1e6', 'Merah muda'], ['#e8e1f5', 'Ungu muda'],
    ['#2b2d3a', 'Biru tua'], ['#000000', 'Hitam']
  ];

  function bgSection() {
    const cur = State.data.bg;
    const input = h('input', { type: 'color', class: 'swatch swatch-input', 'data-key': 'bg-custom', value: cur, 'aria-label': 'Pilih warna sendiri', title: 'Warna sendiri' });
    input.addEventListener('input', function (e) { State.setBg(e.target.value, true); });
    input.addEventListener('change', function (e) { State.setBg(e.target.value); });
    return h('div', { class: 'bg-picker' },
      h('p', { class: 'tip' }, 'Warna latar. Pilih warna siap pakai, atau lingkaran pelangi di ujung untuk warna sendiri.'),
      h('div', { class: 'swatches' }, BG_COLORS.map(function (c) {
        return h('button', {
          type: 'button', class: 'swatch', 'data-key': 'bg-' + c[0].slice(1), style: 'background:' + c[0],
          'aria-pressed': String(cur === c[0]), 'aria-label': c[1], title: c[1],
          onClick: function () { State.setBg(c[0]); }
        });
      }).concat(input)));
  }

  function themeTab() {
    return h('div', null,
      h('p', { class: 'tip' }, 'Pilih tema. Latar belakang dan garis tanah berganti otomatis. Tema Polos hanya satu warna rata.'),
      h('div', { class: 'opt-grid' }, Themes.list.map(function (t) {
        return h('button', {
          type: 'button', class: 'opt', 'data-key': 'theme-' + t.id,
          'aria-pressed': String(State.data.theme === t.id),
          onClick: function () { State.setTheme(t.id); }
        }, h('span', { class: 'opt-preview' }, themePreview(t)), h('span', { class: 'opt-label' }, t.label));
      })),
      State.data.theme === 'plain' ? bgSection() : null);
  }

  // Posisi matahari: penggeser 0-100 (kiri = terbit, tengah = puncak, kanan = terbenam) + tiga pilihan cepat.
  const SUN_PRESETS = [['Pagi', 0.1], ['Siang', 0.5], ['Sore', 0.9]];
  function sunSection() {
    const cur = State.data.sun;
    const input = h('input', { type: 'range', class: 'sun-slider', 'data-key': 'sun-slider', min: '0', max: '100', step: '1',
      value: String(Math.round(cur * 100)), 'aria-label': 'Posisi matahari' });
    input.addEventListener('input', function (e) { State.setSun(e.target.value / 100, true); });
    input.addEventListener('change', function (e) { State.setSun(e.target.value / 100); });
    return h('div', null,
      h('p', { class: 'tip' }, 'Posisi matahari. Bayangan ikut berubah arah dan panjangnya. Di malam hari yang bergerak adalah bulan.'),
      h('div', { class: 'tabs' }, SUN_PRESETS.map(function (it) {
        return h('button', {
          type: 'button', class: 'tab', 'data-key': 'sun-' + it[0].toLowerCase(),
          'aria-pressed': String(Math.abs(cur - it[1]) < 0.005), onClick: function () { State.setSun(it[1]); }
        }, it[0]);
      })),
      input,
      h('div', { class: 'sun-scale' }, h('span', null, 'Kiri'), h('span', null, 'Puncak'), h('span', null, 'Kanan')));
  }

  function envTab() {
    const group = function (title, key, items) {
      return h('div', null, h('p', { class: 'tip' }, title),
        h('div', { class: 'tabs' }, items.map(function (it) {
          return h('button', {
            type: 'button', class: 'tab', 'data-key': 'env-' + key + '-' + it[0],
            'aria-pressed': String(State.data[key] === it[0]), onClick: function () { State.setEnv(key, it[0]); }
          }, it[1]);
        })));
    };
    return h('div', null,
      group('Waktu. Pagi dan sore memberi filter cahaya hangat; matahari ikut turun.', 'time', [['morning', 'Pagi'], ['day', 'Siang'], ['dusk', 'Sore'], ['night', 'Malam']]),
      group('Cuaca. Bisa digabung dengan siang atau malam.', 'weather', [['clear', 'Cerah'], ['rain', 'Hujan']]),
      sunSection());
  }

  // Tab Teks: tambah teks, lalu atur isi, ukuran, font, tebal/miring, dan warnanya.
  const TEXT_COLORS = [
    ['#342628', 'Cokelat tua'], ['#000000', 'Hitam'], ['#ffffff', 'Putih'], ['#e5484d', 'Merah'], ['#f2994a', 'Jingga'],
    ['#f2c94c', 'Kuning'], ['#4caf6a', 'Hijau'], ['#3b82d6', 'Biru'], ['#8e5fd0', 'Ungu'], ['#ec7fb0', 'Merah muda']
  ];

  function textTab() {
    const sel = State.get(State.selected), t = sel && sel.kind === 'text' ? sel : null;
    const addBtn = h('button', {
      type: 'button', class: 'btn primary', 'data-key': 'text-add',
      onClick: function () {
        State.addText({});
        Sound.sfx('drop');
        const ta = panel.querySelector('[data-key="text-input"]');
        if (ta) { ta.focus(); ta.select(); }   // langsung bisa mengetik
      }
    }, t ? 'Tambah teks lagi' : 'Tambah teks');

    if (!t) {
      return h('div', null,
        h('p', { class: 'tip' }, 'Tambahkan teks ke gambar, lalu ketik isinya dan atur ukuran, font, dan warnanya. Klik teks di gambar untuk mengubahnya, seret untuk memindahkannya.'),
        addBtn);
    }

    const live = function (props) { State.updateText(t.id, props, true); };   // saat mengetik / menggeser: gambar saja
    const done = function (props) { State.updateText(t.id, props); };         // pilihan sekali klik: masuk riwayat

    const input = h('textarea', {
      class: 'text-input', 'data-key': 'text-input', rows: '3', maxlength: '120',
      'aria-label': 'Isi teks', placeholder: 'Ketik teks di sini'
    }, t.text);
    input.addEventListener('input', function (e) {
      live({ text: e.target.value });
      const row = panel.querySelector('[data-key="layer-item-' + t.id + '"]'), now = State.get(t.id);
      if (row && now) row.textContent = 'Teks: ' + Texts.label(now);
    });
    input.addEventListener('change', function (e) { done({ text: e.target.value }); });

    const sizeOut = h('span', { class: 'size-value' }, String(t.size));
    const range = h('input', {
      type: 'range', class: 'sun-slider', 'data-key': 'text-size', min: String(Texts.SIZE_MIN), max: String(Texts.SIZE_MAX),
      step: '1', value: String(t.size), 'aria-label': 'Ukuran teks'
    });
    range.addEventListener('input', function (e) { sizeOut.textContent = e.target.value; live({ size: +e.target.value }); });
    range.addEventListener('change', function (e) { done({ size: +e.target.value }); });

    const custom = h('input', {
      type: 'color', class: 'swatch swatch-input', 'data-key': 'text-color-custom', value: t.color,
      'aria-label': 'Pilih warna sendiri', title: 'Warna sendiri'
    });
    custom.addEventListener('input', function (e) {
      live({ color: e.target.value });
      panel.querySelectorAll('.swatch[data-color]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.color === e.target.value.toLowerCase())); });
    });
    custom.addEventListener('change', function (e) { done({ color: e.target.value }); });

    // Garis tepi: tebal (0 = tanpa garis) dan warnanya. Memilih warna saat tebalnya 0 otomatis memberi garis tipis.
    const strokeOut = h('span', { class: 'size-value' }, t.stroke ? String(t.stroke) : 'tanpa garis');
    const strokeRange = h('input', {
      type: 'range', class: 'sun-slider', 'data-key': 'text-stroke', min: '0', max: String(Texts.STROKE_MAX),
      step: '1', value: String(t.stroke), 'aria-label': 'Tebal garis tepi'
    });
    const showStroke = function (n) { strokeRange.value = String(n); strokeOut.textContent = n ? String(n) : 'tanpa garis'; };
    strokeRange.addEventListener('input', function (e) { showStroke(+e.target.value); live({ stroke: +e.target.value }); });
    strokeRange.addEventListener('change', function (e) { done({ stroke: +e.target.value }); });
    const strokeCustom = h('input', {
      type: 'color', class: 'swatch swatch-input', 'data-key': 'stroke-color-custom', value: t.strokeColor,
      'aria-label': 'Pilih warna garis sendiri', title: 'Warna sendiri'
    });
    strokeCustom.addEventListener('input', function (e) {
      const now = State.get(t.id), w = now && now.stroke ? now.stroke : 2;
      showStroke(w);
      live({ strokeColor: e.target.value, stroke: w });
      panel.querySelectorAll('.swatch[data-scolor]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.scolor === e.target.value.toLowerCase())); });
    });
    strokeCustom.addEventListener('change', function (e) { done({ strokeColor: e.target.value, stroke: t.stroke || 2 }); });

    return h('div', { class: 'text-editor' },
      addBtn,
      h('p', { class: 'tip' }, 'Isi teks. Tekan Enter untuk baris baru (maksimal ' + Texts.MAX_LINES + ' baris).'),
      input,
      h('p', { class: 'tip' }, 'Ukuran: ', sizeOut),
      range,
      h('p', { class: 'tip' }, 'Font'),
      h('div', { class: 'font-grid' }, Texts.FONTS.map(function (f) {
        return h('button', {
          type: 'button', class: 'font-btn', 'data-key': 'font-' + f.id, style: 'font-family:' + f.css,
          'aria-pressed': String(t.font === f.id), onClick: function () { done({ font: f.id }); }
        }, f.label);
      })),
      h('div', { class: 'tabs' },
        h('button', { type: 'button', class: 'tab', 'data-key': 'text-bold', style: 'font-weight:700', 'aria-pressed': String(!!t.bold),
          onClick: function () { done({ bold: !t.bold }); } }, 'Tebal'),
        h('button', { type: 'button', class: 'tab', 'data-key': 'text-italic', style: 'font-style:italic', 'aria-pressed': String(!!t.italic),
          onClick: function () { done({ italic: !t.italic }); } }, 'Miring')),
      h('p', { class: 'tip' }, 'Warna. Pilih warna siap pakai, atau lingkaran pelangi di ujung untuk warna sendiri.'),
      h('div', { class: 'swatches' }, TEXT_COLORS.map(function (c) {
        return h('button', {
          type: 'button', class: 'swatch', 'data-key': 'tcolor-' + c[0].slice(1), 'data-color': c[0], style: 'background:' + c[0],
          'aria-pressed': String(t.color === c[0]), 'aria-label': c[1], title: c[1],
          onClick: function () { done({ color: c[0] }); }
        });
      }).concat(custom)),
      h('p', { class: 'tip' }, 'Garis tepi: ', strokeOut),
      strokeRange,
      h('p', { class: 'tip' }, 'Warna garis tepi.'),
      h('div', { class: 'swatches' }, TEXT_COLORS.map(function (c) {
        return h('button', {
          type: 'button', class: 'swatch', 'data-key': 'scolor-' + c[0].slice(1), 'data-scolor': c[0], style: 'background:' + c[0],
          'aria-pressed': String(t.strokeColor === c[0]), 'aria-label': 'Garis ' + c[1].toLowerCase(), title: c[1],
          onClick: function () { done({ strokeColor: c[0], stroke: t.stroke || 2 }); }
        });
      }).concat(strokeCustom)));
  }

  const COARSE = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

  function tabContent(tabId) {
    const tab = TABS.concat(SET_TABS).find(function (t) { return t.id === tabId; });
    if (tab.id === 'theme') return themeTab();
    if (tab.id === 'env') return envTab();
    if (tab.id === 'text') return textTab();
    if (tab.id === 'layers') return layersTab();
    const kind = tab.id === 'extras' ? 'extra' : KIND[tab.id];
    const hints = {
      wall: 'Seret dinding ke gambar untuk menambahkannya, lepas di posisi mana saja.',
      window: 'Seret jendela ke gambar, lepas di posisi mana saja.',
      roof: 'Seret atap ke gambar, lepas di posisi yang kamu mau.',
      door: 'Seret pintu ke gambar, lepas di posisi yang kamu mau.',
      foliage: 'Seret dedaunan atau rumput ke gambar. Daunnya bergoyang lembut ke kiri dan kanan. Taruh di atas batang untuk membuat pohon.',
      trunk: 'Seret batang ke gambar, lalu taruh dedaunan di atasnya. Batang tidak bergerak, hanya daunnya.',
      lamp: 'Seret lampu ke gambar dan lepas di mana saja: di dinding, di atas tiang, atau di tempat lain. Lampu menyala di mode malam.',
      extra: 'Seret benda tambahan ke gambar sebanyak yang kamu mau. Yang terbaru ada di lapisan paling atas.',
      aksesoris_pintu: 'Seret aksesoris ke gambar, lepas di dekat pintu: keset, karangan bunga, nomor rumah, dan lainnya.',
      aksesoris_jendela: 'Seret aksesoris ke gambar, lepas di dekat jendela: tirai, teralis, daun jendela, pot, atau kucing.',
      ruko: 'Seret ruko ke gambar, lepas di posisi mana saja. Di malam hari tokonya menyala.',
      papan: 'Seret papan ke gambar dan lepas di mana saja: di atas pintu, di ruko, atau berdiri di tanah (papan menu). Papan di kategori ini tidak menyala di malam hari.',
      papan_menyala: 'Seret papan ke gambar dan lepas di mana saja: di atas pintu atau di ruko. Papan di kategori ini menyala di malam hari.',
      vandal: 'Seret coretan ke dinding. Ukurannya bisa dicampur sebanyak yang kamu mau; atur lapisannya supaya tampil di depan dinding.',
      hiasan: 'Seret hiasan ke gambar: bendera, bunting, lampion, lampu hias, bangku, dan tanaman. Lampion dan lampu hias menyala di malam hari.'
    };
    const cur = State.get(State.selected), same = cur && cur.kind === kind ? cur : null;   // objek terpilih yang sejenis dengan kategori ini
    const grid = h('div', { class: 'opt-grid' }, (tab.id === 'extras' ? Assets.extras : Assets[tab.group]).map(function (item) {
      const btn = optionButton(tab.id + '-' + item.id, item, same && same.type === item.id, function (e) {
        // Ada objek sejenis yang terpilih: klik pilihan = ganti objek itu (posisinya tetap).
        const now = State.get(State.selected);
        if (now && now.kind === kind) { State.replace(now.id, item.id); setStatus(''); return; }
        // Selain itu klik biasa tidak menambah objek: harus di-drag. Pengecualian: keyboard (Enter/Spasi)
        // dan layar sentuh, karena drag-and-drop dari panel tidak tersedia di sana.
        if (e && e.detail > 0 && !COARSE) { setStatus('Seret objek ini ke gambar untuk menambahkannya.'); return; }
        State.place(kind, item.id);
        setStatus('');
      });
      btn.draggable = true;
      btn.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', kind + ':' + item.id);
      });
      return btn;
    }));

    const counts = h('p', { class: 'count' }, 'Dinding: ' + State.ofKind('wall').length +
      '  Jendela: ' + State.ofKind('window').length);
    const swap = same ? h('p', { class: 'tip swap' }, 'Objek ' + LABEL[kind].toLowerCase() + ' di gambar sedang terpilih: klik pilihan di bawah untuk menggantinya. Seret pilihan ke gambar untuk menambah yang baru.') : null;
    const free = same && COARSE ? h('button', { type: 'button', class: 'btn side', 'data-key': 'deselect', onClick: function () { State.select(null); } }, 'Tambah baru (lepas pilihan)') : null;
    return h('div', null, swap || h('p', { class: 'tip' }, hints[kind]), free, tab.id === 'wall' || tab.id === 'window' ? counts : null, grid);
  }

  // Daftar lapisan (1 = paling belakang): satu tombol per objek, urutan dari paling depan.
  function layersTab() {
    const sel = State.get(State.selected), stack = State.data.pieces, idx = sel ? stack.indexOf(sel) : -1;
    return h('div', null,
      h('p', { class: 'tip' }, sel ? 'Lapisan ' + (idx + 1) + ' dari ' + stack.length + ' (1 = paling belakang). Pintasan: ] [ } {'
                                  : 'Pilih objek, atau klik namanya di sini, untuk mengatur lapisannya.'),
      h('div', { class: 'layers' }, stack.slice().reverse().map(function (p) {
        const it = Assets.itemOf(p);
        return h('button', {
          type: 'button', class: 'btn', 'data-key': 'layer-item-' + p.id, 'aria-pressed': String(p.id === State.selected),
          onClick: function () { State.select(p.id); }
        }, (LABEL[p.kind] || p.kind) + ': ' + it.label);
      })));
  }

  function render(s) {
    const picked = State.get(State.selected);
    const reveal = picked && picked.id !== lastSelected;   // objek baru saja dipilih (klik di gambar, daftar lapisan, atau baru ditaruh)
    if (reveal && picked.kind === 'text') view.right = 'text';   // klik teks di gambar = buka Teks
    else if (reveal && TABS.some(function (t) { return t.id === TAB_OF(picked.kind); })) view.left = TAB_OF(picked.kind);   // klik pintu = panel pilihan pintu terbuka
    lastSelected = picked ? picked.id : null;
    const focusKey = document.activeElement && document.activeElement.dataset
      ? document.activeElement.dataset.key : null;
    const wasOpen = { left: view.left, right: view.right };
    const scroll = { left: left.scrollTop, right: panel.scrollTop };

    const sel = State.get(State.selected);
    const open = function (side, t) {   // tombol kategori: panelnya berubah menjadi pilihan
      return h('button', {
        type: 'button', class: 'tab side', 'data-key': 'tab-' + t.id,
        onClick: function () { view[side] = t.id; render(State.data); }
      }, t.label);
    };
    const back = function (side) {
      return h('button', {
        type: 'button', class: 'btn side', 'data-key': 'back-' + side,
        onClick: function () { view[side] = null; render(State.data); }
      }, '\u2190 Kembali');
    };
    const choice = function (side) {   // tombol Kembali + pilihan kategori yang terbuka
      const body = tabContent(view[side]);
      body.classList.add('choice');
      return [back(side), body];
    };
    const act = function (label, key, props) {
      return h('button', Object.assign({ type: 'button', class: 'btn side', 'data-key': key }, props), label);
    };

    // Panel kiri: kategori objek bangunan -> pilihan objek.
    left.replaceChildren.apply(left, view.left ? choice('left')
      : [h('section', { class: 'block' }, TABS.map(function (t) { return open('left', t); }))]);

    // Panel kanan: pengaturan, riwayat, edit, lapisan, aksi (semuanya tombol) -> pilihan pengaturan.
    panel.replaceChildren.apply(panel, view.right ? choice('right') : [
      h('section', { class: 'block' }, SET_TABS.map(function (t) { return open('right', t); })),
      h('section', { class: 'block' },
        act('Urungkan', 'undo', { disabled: !State.canUndo, title: 'Ctrl+Z', onClick: function () { State.undo(); } }),
        act('Ulangi', 'redo', { disabled: !State.canRedo, title: 'Ctrl+Y', onClick: function () { State.redo(); } }),
        act('Hapus terpilih', 'delete', { disabled: !sel, onClick: function () { State.remove(State.selected); } }),
        act('Gandakan', 'copy', {
          disabled: !sel,
          onClick: function () {
            if (sel.kind === 'text') State.addText(sel, sel.x + 8, sel.y + 8);
            else State.place(sel.kind, sel.type, sel.x + State.size(sel).w / 2 + 8, sel.y + State.size(sel).h / 2 + 8);
          }
        })),
      h('section', { class: 'block' },
        act('Simpan gambar', 'save', { class: 'btn side primary', onClick: saveImage }),
        act('Acak bangunan', 'random', { onClick: function () { State.randomize(); } }),
        act('Clear', 'clear', {
          disabled: !State.data.pieces.length, title: 'Hapus semua objek (bisa diurungkan dengan Ctrl+Z)',
          onClick: function () { State.clear(); }
        }),
        act('Mulai ulang', 'reset', {
          onClick: function () { if (window.confirm('Kembalikan bangunan ke bentuk awal?')) State.reset(); }
        }))]);

    // Tetap di posisi gulir yang sama setelah menaruh objek (hanya bila kategorinya tidak berganti).
    if (wasOpen.left && wasOpen.left === view.left) left.scrollTop = scroll.left;
    else if (reveal && view.left) {   // panel baru terbuka karena objek dipilih: tampilkan pilihan yang sedang dipakai
      const on = left.querySelector('.opt[aria-pressed="true"]');
      if (on) on.scrollIntoView({ block: 'nearest' });
    }
    if (wasOpen.right && wasOpen.right === view.right) panel.scrollTop = scroll.right;

    if (focusKey) {
      const q = '[data-key="' + focusKey + '"]';
      const el = panel.querySelector(q) || left.querySelector(q);
      if (el && !el.disabled) {
        el.focus({ preventScroll: true });
        if (el.tagName === 'TEXTAREA') el.setSelectionRange(el.value.length, el.value.length);
      }
    }
  }

  // --- Seret dan lepas di canvas ---
  function pointer(canvas, e) {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * Camera.size.w / r.width, (e.clientY - r.top) * Camera.size.h / r.height];
  }

  // Posisi pointer dalam koordinat dunia (memperhitungkan zoom dan geser).
  function world(canvas, e) { const s = pointer(canvas, e); return Camera.toWorld(s[0], s[1]); }

  function initCanvas(canvas) {
    let drag = null, pan = null;

    canvas.addEventListener('pointerdown', function (e) {
      const pt = world(canvas, e), p = Renderer.hit(State.data, pt[0], pt[1]);
      if (!p) {
        if (State.selected != null) State.select(null);
        pan = { x: e.clientX, y: e.clientY };
        canvas.setPointerCapture(e.pointerId);
        canvas.classList.add('panning');
        return;
      }
      drag = { p: p, dx: pt[0] - p.x, dy: pt[1] - p.y, moved: false, x0: e.clientX, y0: e.clientY, heard: false, pre: State.snap() };
      Sound.sfx('click');
      canvas.setPointerCapture(e.pointerId);
      if (State.selected !== p.id) State.select(p.id);
    });

    canvas.addEventListener('pointermove', function (e) {
      if (pan) {
        const r = canvas.getBoundingClientRect();
        Camera.panBy((e.clientX - pan.x) * Camera.size.w / r.width, (e.clientY - pan.y) * Camera.size.h / r.height);
        pan.x = e.clientX; pan.y = e.clientY;
        return;
      }
      if (!drag) return;
      const pt = world(canvas, e);   // posisi bebas: tidak ada magnet/tempel otomatis
      drag.moved = true;
      if (!drag.heard && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 4) drag.heard = true;
      State.moveTo(drag.p, pt[0] - drag.dx, pt[1] - drag.dy);
    });

    const end = function () { pan = null; canvas.classList.remove('panning'); if (drag) { const m = drag.moved, heard = drag.heard, drag0 = drag; drag = null; if (m) { State.pushUndo(drag0.pre); State.commit(); } if (heard) Sound.sfx('drop'); } };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    // Zoom: gulir (ke titik kursor), tombol, dan keyboard.
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
      const pt = pointer(canvas, e);
      Camera.zoomAt(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)), pt[0], pt[1]);
    }, { passive: false });

    const zin = document.getElementById('zoom-in'), zout = document.getElementById('zoom-out'),
          zreset = document.getElementById('zoom-reset');
    zin.addEventListener('click', function () { Camera.zoomBy(1.25); });
    zout.addEventListener('click', function () { Camera.zoomBy(1 / 1.25); });
    zreset.addEventListener('click', function () { Camera.reset(); });
    Camera.onChange(function (v) { zreset.textContent = Math.round(v.z * 100) + '%'; });
    document.addEventListener('keydown', function (e) {
      if (/INPUT|TEXTAREA/.test(document.activeElement.tagName) || e.ctrlKey || e.metaKey) return;
      if (e.key === '+' || e.key === '=') Camera.zoomBy(1.25);
      else if (e.key === '-' || e.key === '_') Camera.zoomBy(1 / 1.25);
      else if (e.key === '0') Camera.reset();
      else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.altKey) {   // geser peta panjang ke kiri/kanan
        e.preventDefault();
        Camera.panBy((e.key === 'ArrowLeft' ? 1 : -1) * (e.shiftKey ? 240 : 80) * Camera.view.z, 0);
      }
    });

    // Lepas pilihan dari panel langsung di canvas.
    canvas.addEventListener('dragover', function (e) { e.preventDefault(); });
    canvas.addEventListener('drop', function (e) {
      e.preventDefault();
      const parts = (e.dataTransfer.getData('text/plain') || '').split(':');
      if (parts.length !== 2 || !State.GROUP[parts[0]]) return;
      const pt = world(canvas, e);
      State.place(parts[0], parts[1], pt[0], pt[1]);
      Sound.sfx('drop');
    });

    // Ctrl/Cmd+Z = urungkan; Ctrl+Y atau Ctrl/Cmd+Shift+Z = ulangi. Tidak aktif saat mengetik atau menyeret.
    document.addEventListener('keydown', function (e) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || drag || pan) return;
      const a = document.activeElement;
      if (a && (a.tagName === 'TEXTAREA' || a.isContentEditable || (a.tagName === 'INPUT' && a.type !== 'color'))) return;
      const k = e.key.toLowerCase();
      if (k === 'z' || k === 'y') {
        e.preventDefault();
        if (k === 'y' || e.shiftKey) State.redo(); else State.undo();
      }
    });

    document.addEventListener('keydown', function (e) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && State.selected != null &&
          !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
        e.preventDefault();
        State.remove(State.selected);
      }
    });
  }

  document.addEventListener('keydown', function (e) {
    if (State.selected == null || e.ctrlKey || e.metaKey || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const mode = { ']': 'forward', '[': 'backward', '}': 'front', '{': 'back' }[e.key];
    if (mode) { e.preventDefault(); State.restack(State.selected, mode); }
  });

  // ---- Bilah urutan lapisan: kecil, berisi kata (bukan simbol), muncul di samping objek yang sedang dipilih (diklik atau baru diletakkan) ----
  const LAYER_BTNS = [['front', 'Paling depan', '}'], ['forward', 'Majukan', ']'], ['backward', 'Mundurkan', '['], ['back', 'Paling belakang', '{']];
  let bar = null, barBtns = {}, barW = 0, barH = 0, barKey = '';

  function createLayerBar() {
    bar = document.createElement('div');
    bar.className = 'layer-bar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', 'Urutan lapisan objek terpilih');
    bar.hidden = true;
    LAYER_BTNS.forEach(function (d) {
      const b = document.createElement('button');
      b.type = 'button';
      b.title = d[1] + ' (' + d[2] + ')';
      b.dataset.key = 'layer-' + d[0];
      b.textContent = d[1];
      b.addEventListener('click', function () { if (State.selected != null) State.restack(State.selected, d[0]); });
      barBtns[d[0]] = b;
      bar.appendChild(b);
    });
    document.body.appendChild(bar);
  }

  // Dipanggil setiap selesai menggambar (geser, zoom, pilih, letakkan): letakkan bilah di samping objek terpilih.
  function layoutLayerBar() {
    if (!bar) return;
    const sel = State.get(State.selected);
    if (!sel) { if (!bar.hidden) bar.hidden = true; return; }
    const s = State.size(sel), v = Camera.view, z = v.z, W = Camera.size.w, H = Camera.size.h, fx = window.innerWidth / W, fy = window.innerHeight / H;
    const x0 = ((sel.x - v.x) * z + W / 2) * fx, x1 = ((sel.x + s.w - v.x) * z + W / 2) * fx;
    const y0 = ((sel.y - v.y) * z + H / 2) * fy, y1 = ((sel.y + s.h - v.y) * z + H / 2) * fy;
    if (x1 < 0 || x0 > window.innerWidth || y1 < 0 || y0 > window.innerHeight) { if (!bar.hidden) bar.hidden = true; return; }   // objek di luar layar
    if (bar.hidden) bar.hidden = false;
    if (!barW) { barW = bar.offsetWidth; barH = bar.offsetHeight; }
    const stack = State.data.pieces, idx = stack.indexOf(sel), top = idx === stack.length - 1, bottom = idx === 0;
    const key = top + '|' + bottom;
    if (key !== barKey) {   // tombol yang tidak berguna (sudah paling depan/belakang) dinonaktifkan
      barKey = key;
      barBtns.front.disabled = barBtns.forward.disabled = top;
      barBtns.back.disabled = barBtns.backward.disabled = bottom;
    }
    const gap = 6, lx = x1 + gap + barW <= window.innerWidth - gap ? x1 + gap : Math.max(gap, x0 - gap - barW);   // di kanan objek; kalau tidak muat, di kirinya
    const ty = Math.max(54, Math.min(y0, window.innerHeight - barH - gap));   // di bawah bilah tombol atas, tetap di dalam layar
    bar.style.transform = 'translate(' + Math.round(lx) + 'px,' + Math.round(ty) + 'px)';
  }

  global.UI = {
    layout: layoutLayerBar,
    init: function (opts) {
      panel = opts.panel;
      left = opts.left;
      statusEl = opts.status;
      createLayerBar();
      initCanvas(opts.canvas);
      State.on(render);
      render(State.data);
    },
    setStatus: setStatus
  };
})(window);
