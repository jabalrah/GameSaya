#!/usr/bin/env python3
"""Pindai folder assets/ dan tulis assets/manifest.js (daftar PNG per jenis).

Dipanggil otomatis oleh tools/server.py setiap halaman dimuat ulang.
Bisa juga dijalankan manual: python tools/scan_assets.py
(berguna kalau game dibuka langsung lewat dobel klik index.html, tanpa server).
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GROUPS = ['walls', 'windows', 'doors', 'roofs', 'lamps', 'foliage', 'trunks', 'extras',
          'aksesoris_pintu', 'aksesoris_jendela', 'ruko', 'papan', 'papan_menyala', 'vandal', 'hiasan']
EXTS = ('.png', '.webp')


def scan():
    out = {}
    for g in GROUPS:
        folder = os.path.join(ROOT, 'assets', g)
        files = []
        if os.path.isdir(folder):
            for name in sorted(os.listdir(folder), key=str.lower):
                low = name.lower()
                stem = os.path.splitext(low)[0]
                if low.endswith(EXTS) and not stem.endswith('_malam'):
                    files.append('assets/%s/%s' % (g, name))
        out[g] = files
    return out


def write_manifest():
    data = scan()
    path = os.path.join(ROOT, 'assets', 'manifest.js')
    text = '// Dibuat otomatis oleh tools/scan_assets.py. Jangan diedit.\nwindow.ASSET_MANIFEST = %s;\n' % json.dumps(data, indent=1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    return data, text


if __name__ == '__main__':
    data, _ = write_manifest()
    for g in GROUPS:
        print('%-8s %d file' % (g, len(data[g])))
    print('assets/manifest.js diperbarui.')
