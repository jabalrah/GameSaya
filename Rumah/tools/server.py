#!/usr/bin/env python3
"""Server lokal Rumah Mungil. Daftar aset dipindai ulang setiap halaman dimuat ulang,
jadi PNG baru di assets/<jenis>/ langsung muncul setelah refresh (F5)."""
import functools
import http.server
import os
import sys
import threading
import webbrowser

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scan_assets

ROOT = scan_assets.ROOT


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split('?')[0] == '/assets/manifest.js':
            _, text = scan_assets.write_manifest()
            body = text.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/javascript; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')  # PNG yang diganti langsung terbaca
        super().end_headers()

    def log_message(self, *args):
        pass


def open_server(start):
    """Coba port start, start+1, ... sampai ada yang kosong (mis. server lama masih jalan di 8000)."""
    handler = functools.partial(Handler, directory=ROOT)
    for port in range(start, start + 20):
        try:
            return port, http.server.ThreadingHTTPServer(('', port), handler)
        except OSError:
            print('Port %d sedang dipakai, mencoba port berikutnya...' % port)
    raise SystemExit('Tidak ada port kosong. Tutup jendela server lama, lalu coba lagi.')


if __name__ == '__main__':
    scan_assets.write_manifest()
    port, srv = open_server(int(sys.argv[1]) if len(sys.argv) > 1 else 8000)
    url = 'http://localhost:%d' % port
    print('Rumah Mungil jalan di %s  (tutup jendela ini atau Ctrl+C untuk berhenti)' % url)
    threading.Timer(0.5, webbrowser.open, [url]).start()   # browser dibuka setelah server siap
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
