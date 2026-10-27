"""
Membuat semua aset gambar halus (bukan pixel-art) untuk Rumah Mungil.

Jalankan dari folder utama proyek:
    pip install pillow
    python tools/generate_assets.py

Setiap gambar dibuat 4 piksel asli per 1 satuan canvas (UNIT) lalu dihaluskan
(supersampling), jadi tetap tajam di layar besar tapi file-nya kecil (beberapa KB).
Kamu boleh mengganti PNG/WebP di assets/ dengan gambarmu sendiri: ukuran bebas,
cukup atur lebar tampil lewat `w` di js/assets.js (lihat README.md).
"""
import os
import random

from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets")
UNIT = 4      # piksel asli per satuan canvas
SS = 4        # supersampling
K = UNIT * SS


def c(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


class Art:
    """Kanvas gambar dalam satuan canvas (bukan piksel)."""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.img = Image.new("RGBA", (round(w * K), round(h * K)), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.img)

    def _b(self, x0, y0, x1, y1):
        return [x0 * K, y0 * K, x1 * K, y1 * K]

    def rect(self, x0, y0, x1, y1, fill, r=0, line=None, lw=0):
        self.d.rounded_rectangle(self._b(x0, y0, x1, y1), r * K, fill=fill,
                                 outline=line, width=round(lw * K))

    def ellipse(self, x0, y0, x1, y1, fill, line=None, lw=0):
        self.d.ellipse(self._b(x0, y0, x1, y1), fill=fill, outline=line, width=round(lw * K))

    def poly(self, pts, fill, line=None, lw=0):
        P = [(x * K, y * K) for x, y in pts]
        self.d.polygon(P, fill=fill)
        if line:
            self.d.line(P + [P[0]], fill=line, width=round(lw * K), joint="curve")

    def pie_top(self, x0, y0, x1, y1, fill):
        """Setengah lingkaran bagian atas dari elips di kotak itu."""
        self.d.pieslice(self._b(x0, y0, x1, y1), 180, 360, fill=fill)

    def line(self, pts, fill, lw):
        self.d.line([(x * K, y * K) for x, y in pts], fill=fill, width=round(lw * K), joint="curve")

    def shade(self, x0, y0, x1, y1, rgba):
        """Lapisan warna transparan di atas gambar (untuk bayangan/sorotan)."""
        ov = Image.new("RGBA", self.img.size, (0, 0, 0, 0))
        ImageDraw.Draw(ov).rectangle(self._b(x0, y0, x1, y1), fill=rgba)
        self.img = Image.alpha_composite(self.img, ov)
        self.d = ImageDraw.Draw(self.img)

    def save(self, folder, name):
        out = self.img.resize((round(self.w * UNIT), round(self.h * UNIT)), Image.LANCZOS)
        path = os.path.join(ROOT, folder)
        os.makedirs(path, exist_ok=True)
        out.save(os.path.join(path, name), optimize=True)


# ---------- dinding 72x40 ----------
def edge(a):
    a.shade(0, 0, 1.2, a.h, (0, 0, 0, 26))
    a.shade(a.w - 1.2, 0, a.w, a.h, (0, 0, 0, 38))
    a.shade(0, a.h - 1.5, a.w, a.h, (0, 0, 0, 22))


def wall_brick():
    a, rnd = Art(72, 40), random.Random(3)
    a.rect(0, 0, 72, 40, c("#e2c3ae"))
    for r in range(8):
        off = 6 if r % 2 else 0
        x = -off
        while x < 72:
            a.rect(x + 0.6, r * 5 + 0.6, x + 11.4, r * 5 + 4.4,
                   c(rnd.choice(["#b9533b", "#c2614a", "#ad4a35", "#b85a40"])), r=0.9)
            x += 12
    edge(a); a.save("walls", "wall_brick.png")


def wall_wood():
    a, rnd = Art(72, 40), random.Random(5)
    for i in range(5):
        y = i * 8
        a.rect(0, y, 72, y + 8, c(rnd.choice(["#c99b63", "#bf9159", "#d1a66e"])))
        a.rect(0, y + 7.2, 72, y + 8, c("#8c6338"))
        for _ in range(4):
            gx, gy = rnd.uniform(2, 60), y + rnd.uniform(1.5, 6)
            a.line([(gx, gy), (gx + rnd.uniform(6, 14), gy)], c("#a97b46", 140), 0.35)
    edge(a); a.save("walls", "wall_wood.png")


def wall_plaster():
    a, rnd = Art(72, 40), random.Random(7)
    a.rect(0, 0, 72, 40, c("#f2e6cb"))
    for _ in range(90):
        x, y, r = rnd.uniform(0, 72), rnd.uniform(0, 40), rnd.uniform(0.2, 0.6)
        a.ellipse(x, y, x + r, y + r, c("#d9c9a4", 120))
    a.shade(0, 28, 72, 40, (160, 130, 90, 28))
    edge(a); a.save("walls", "wall_plaster.png")


def wall_stone():
    a, rnd = Art(72, 40), random.Random(11)
    a.rect(0, 0, 72, 40, c("#6e747b"))
    for r in range(4):
        x = -rnd.uniform(0, 8)
        while x < 72:
            w = rnd.uniform(11, 19)
            a.rect(x + 0.7, r * 10 + 0.7, x + w - 0.7, r * 10 + 9.3,
                   c(rnd.choice(["#9298a0", "#8a9098", "#9ba1a8", "#848a92"])), r=2.2)
            x += w
    edge(a); a.save("walls", "wall_stone.png")


# ---------- jendela 16x20 ----------
FRAME, WOOD, GLASS = c("#f6f0e4"), c("#6a4b35"), c("#bfe3f5")


def sill(a):
    a.rect(0, 18, 16, 20, c("#7a5a3d"), r=0.6)


def window_square():
    a = Art(16, 20)
    a.rect(1, 2, 15, 18.2, FRAME, r=1, line=WOOD, lw=0.9)
    a.rect(2.6, 3.6, 13.4, 16.6, GLASS, r=0.4)
    a.rect(2.6, 3.6, 13.4, 8, c("#ffffff", 70))
    a.rect(7.5, 3.6, 8.5, 16.6, FRAME); a.rect(2.6, 9.6, 13.4, 10.6, FRAME)
    sill(a); a.save("windows", "window_square.png")


def window_arch():
    a = Art(16, 20)
    a.pie_top(1, 1.5, 15, 15.5, WOOD); a.rect(1, 8.5, 15, 18.2, WOOD)
    a.pie_top(1.8, 2.3, 14.2, 14.7, FRAME); a.rect(1.8, 8.5, 14.2, 17.4, FRAME)
    a.pie_top(3, 3.5, 13, 13.5, GLASS); a.rect(3, 8.5, 13, 16.2, GLASS)
    a.rect(7.5, 3.5, 8.5, 16.2, FRAME); a.rect(3, 9.6, 13, 10.6, FRAME)
    sill(a); a.save("windows", "window_arch.png")


def window_round():
    a = Art(16, 20)
    a.ellipse(1, 3, 15, 17, WOOD); a.ellipse(1.9, 3.9, 14.1, 16.1, FRAME)
    a.ellipse(3.2, 5.2, 12.8, 14.8, GLASS)
    a.rect(7.5, 5.2, 8.5, 14.8, FRAME); a.rect(3.2, 9.5, 12.8, 10.5, FRAME)
    a.rect(2, 17, 14, 19, c("#7a5a3d"), r=0.6); a.save("windows", "window_round.png")


def window_shutter():
    a = Art(16, 20)
    for x0 in (0, 13):
        a.rect(x0, 2.5, x0 + 3, 18, c("#5e8a64"), r=0.5, line=c("#3f6445"), lw=0.4)
        for y in range(4, 17, 2):
            a.line([(x0 + 0.5, y), (x0 + 2.5, y)], c("#3f6445"), 0.35)
    a.rect(3.2, 2.5, 12.8, 18, FRAME, r=0.8, line=WOOD, lw=0.8)
    a.rect(4.4, 3.8, 11.6, 16.4, GLASS, r=0.3)
    a.rect(7.6, 3.8, 8.4, 16.4, FRAME); a.rect(4.4, 9.6, 11.6, 10.4, FRAME)
    sill(a); a.save("windows", "window_shutter.png")


# ---------- pintu 20x32 ----------
def door_body(a, base, dark, light, arch=False):
    if arch:
        a.pie_top(0, 0, 20, 20, c(dark)); a.rect(0, 10, 20, 32, c(dark))
        a.pie_top(1, 1, 19, 19, c(base)); a.rect(1, 10, 19, 32, c(base))
    else:
        a.rect(0, 0, 20, 32, c(dark), r=1.2); a.rect(1, 1, 19, 32, c(base), r=0.8)


def door_wood():
    a = Art(20, 32); door_body(a, "#9a6a43", "#4d321f", "")
    for y in (4, 18):
        a.rect(4, y, 16, y + 11, c("#8a5a38"), r=1, line=c("#6f4527"), lw=0.5)
    a.ellipse(14.6, 17, 17, 19.4, c("#f0c24b")); a.save("doors", "door_wood.png")


def door_blue():
    a = Art(20, 32); door_body(a, "#4f7fae", "#27425f", "")
    for y in (4, 18):
        a.rect(4, y, 16, y + 11, c("#4474a1"), r=1, line=c("#2f5780"), lw=0.5)
    a.ellipse(14.6, 17, 17, 19.4, c("#f0c24b")); a.save("doors", "door_blue.png")


def door_arch():
    a = Art(20, 32); door_body(a, "#a8744a", "#4d321f", "", arch=True)
    a.pie_top(5, 5, 15, 15, c("#bfe3f5")); a.rect(5, 10, 15, 15, c("#bfe3f5"))
    a.rect(9.6, 5, 10.4, 15, c("#f6f0e4")); a.rect(4, 17, 16, 30, c("#96653f"), r=1)
    a.ellipse(14.6, 20, 17, 22.4, c("#f0c24b")); a.save("doors", "door_arch.png")


def door_glass():
    a = Art(20, 32)
    a.rect(0, 0, 20, 32, c("#4b3c30"), r=1.2); a.rect(1.4, 1.4, 18.6, 32, c("#f6f0e4"), r=0.8)
    a.rect(3, 3, 17, 29, c("#bfe3f5"), r=0.5)
    a.shade(3, 3, 17, 12, (255, 255, 255, 60))
    a.rect(9.6, 3, 10.4, 29, c("#f6f0e4")); a.rect(3, 15.6, 17, 16.4, c("#f6f0e4"))
    a.rect(12.4, 15, 13.4, 22, c("#6b6264"), r=0.5); a.save("doors", "door_glass.png")


# ---------- atap ----------
def gable(name, h, main, dark, hi):
    a = Art(88, h)
    a.poly([(0, h), (44, 0.5), (88, h)], c(dark))
    a.poly([(2.4, h - 0.6), (44, 3), (85.6, h - 0.6)], c(main))
    for i in range(1, 5):
        y = i * (h - 4) / 5 + 2
        a.line([(44 - (44 - 2.4) * (y - 3) / (h - 3.6), y), (44 + (44 - 2.4) * (y - 3) / (h - 3.6), y)],
               c(dark, 110), 0.5)
    a.poly([(44, 3), (85.6, h - 0.6), (80, h - 0.6), (44, 6)], c(hi, 60))
    a.rect(0, h - 2, 88, h, c(dark)); a.save("roofs", name)


def roof_flat():
    a = Art(88, 12)
    a.rect(0, 0, 88, 12, c("#5e5a64"), r=1.5); a.rect(0, 0, 88, 5, c("#8a8690"), r=1.5)
    a.rect(0, 9, 88, 12, c("#48444e")); a.save("roofs", "roof_flat.png")


def roof_garden():
    a, rnd = Art(88, 18), random.Random(2)
    a.rect(0, 8, 88, 18, c("#6b4b34"), r=1.5); a.rect(0, 14, 88, 18, c("#53392a"))
    x = 0
    while x < 88:
        a.ellipse(x - 1, 2.5 + rnd.uniform(-1, 1), x + 6, 10, c(rnd.choice(["#79b45c", "#6aa650", "#86c168"])))
        if rnd.random() < 0.3:
            a.ellipse(x + 2, 1, x + 4, 3, c(rnd.choice(["#f4c542", "#ff8fa3", "#ffffff"])))
        x += 5
    a.save("roofs", "roof_garden.png")


def roof_thatch():
    a, rnd = Art(88, 29), random.Random(9)
    a.poly([(0, 29), (44, 0.5), (88, 29)], c("#a77f3e"))
    a.poly([(2, 28), (44, 3), (86, 28)], c("#d3a95b"))
    for _ in range(70):
        x, y = rnd.uniform(8, 80), rnd.uniform(6, 26)
        if abs(x - 44) < (y - 3) * 1.6:
            a.line([(x, y), (x - 1.5, y + 3.5)], c("#a77f3e", 170), 0.45)
    a.rect(0, 26, 88, 29, c("#a77f3e"), r=1); a.save("roofs", "roof_thatch.png")


# ---------- tambahan ----------
def extra_chimney():
    a = Art(12, 24)
    a.rect(1, 3, 11, 24, c("#a9462f")); a.rect(0, 0, 12, 4, c("#7b3222"), r=0.8)
    for y in (8, 13, 18):
        a.line([(1, y), (11, y)], c("#e2c3ae", 160), 0.5)
    a.shade(8, 3, 11, 24, (0, 0, 0, 30)); a.save("extras", "extra_chimney.png")


def extra_flowerbox():
    a, rnd = Art(18, 8), random.Random(4)
    a.rect(0, 3.5, 18, 8, c("#7a5a3a"), r=1); a.rect(0, 3.5, 18, 5, c("#94704a"), r=1)
    for x in range(1, 17, 3):
        a.ellipse(x, 1.2, x + 3, 4.2, c("#4f9a56"))
        a.ellipse(x + 0.6, 0, x + 2.4, 1.8 + 0.6, c(rnd.choice(["#ff8fa3", "#f4c542", "#e05a5a"])))
    a.save("extras", "extra_flowerbox.png")


def extra_plant():
    a = Art(14, 20)
    for x0, y0, x1, y1 in [(1, 3, 6, 12), (8, 2, 13, 11), (4, 0, 10, 10), (2, 7, 7, 14), (7, 7, 12, 14)]:
        a.ellipse(x0, y0, x1, y1, c("#4f9a56", 235), line=c("#3a7a41"), lw=0.3)
    a.poly([(3, 12.5), (11, 12.5), (10, 20), (4, 20)], c("#c4683f"))
    a.rect(2.5, 11.8, 11.5, 13.8, c("#d27a52"), r=0.6); a.save("extras", "extra_plant.png")


IRON = c("#3b3f46")


def lamp_lantern():
    """Lampu lentera 10x18. Dua file: lamp_lantern.png (mati) dan lamp_lantern_malam.png (menyala)."""
    for lit in (False, True):
        a = Art(10, 18)
        a.rect(4.4, 0, 5.6, 3, IRON)
        a.poly([(1.5, 5), (5, 2.5), (8.5, 5)], IRON)
        a.rect(2, 5, 8, 14, c("#fff0a8") if lit else c("#efe3bd"), r=0.8, line=IRON, lw=0.6)
        if lit:
            a.ellipse(3.6, 7, 6.4, 12, c("#fffbe4"))
        else:
            a.shade(2.6, 6, 4.2, 12, (255, 255, 255, 90))
        a.line([(5, 5), (5, 14)], IRON, 0.3)
        a.rect(1.5, 14, 8.5, 16, IRON, r=0.6)
        a.rect(4, 16, 6, 18, IRON)
        a.save("lamps", "lamp_lantern_malam.png" if lit else "lamp_lantern.png")


def lamp_globe():
    """Lampu bulat 12x20 (tangkai bawah untuk dipasang di tiang)."""
    for lit in (False, True):
        a = Art(12, 20)
        a.ellipse(0.5, 0.5, 11.5, 11.5, c("#ffe79a") if lit else c("#f5f1e4"), line=IRON, lw=0.5)
        if lit:
            a.ellipse(3, 3, 9, 9, c("#fffbe4"))
        else:
            a.ellipse(2.8, 2.4, 6, 5.6, c("#ffffff", 150))
        a.rect(3.5, 11, 8.5, 13.5, IRON, r=0.8)
        a.rect(5, 13.5, 7, 20, IRON)
        a.save("lamps", "lamp_globe_malam.png" if lit else "lamp_globe.png")


GREEN_D, GREEN_M = c("#3a7a41"), c("#4f9a56")


def foliage_crown():
    """Tajuk pohon bulat 40x34 (animasi bergoyang di game)."""
    a = Art(40, 34)
    for e in [(2, 10, 22, 32), (18, 10, 38, 32), (8, 2, 32, 26), (0, 16, 16, 32), (24, 16, 40, 32), (12, 12, 28, 32)]:
        a.ellipse(*e, GREEN_M, line=GREEN_D, lw=0.4)
    for e in [(8, 5, 22, 15), (22, 12, 32, 20), (4, 18, 14, 26)]:
        a.ellipse(*e, c("#6fbf6d", 170))
    a.save("foliage", "foliage_crown.png")


def foliage_pine():
    a = Art(28, 40)
    for pts, col in [([(14, 18), (28, 40), (0, 40)], "#2f6f4a"), ([(14, 9), (25, 27), (3, 27)], "#3f8458"),
                     ([(14, 0), (22, 14), (6, 14)], "#52a06a")]:
        a.poly(pts, c(col), line=GREEN_D, lw=0.4)
    a.save("foliage", "foliage_pine.png")


def foliage_bush():
    a = Art(26, 16)
    for e in [(0, 6, 12, 16), (14, 6, 26, 16), (7, 2, 19, 16), (4, 8, 22, 16)]:
        a.ellipse(*e, GREEN_M, line=GREEN_D, lw=0.4)
    a.ellipse(5, 4, 13, 9, c("#6fbf6d", 170))
    for x, y in [(7, 10), (15, 8), (19, 12)]:
        a.ellipse(x - 0.8, y - 0.8, x + 0.8, y + 0.8, c("#e0566b"))
    a.save("foliage", "foliage_bush.png")


def _blades(a, h, spec):
    cols = [c("#5fae4e"), c("#4a9a45"), c("#76c05a")]
    for i, (bx, tx, ty) in enumerate(spec):
        a.poly([(bx - 1, h), (bx + 1, h), (tx, ty)], cols[i % 3])


def foliage_grass():
    a = Art(16, 12)
    _blades(a, 12, [(2, 0, 3), (4.5, 4, 0), (7, 7, 2), (9.5, 11, 0.5), (12, 13, 3), (14, 16, 5)])
    a.save("foliage", "foliage_grass.png")


def foliage_tallgrass():
    a = Art(12, 22)
    _blades(a, 22, [(2, 0, 8), (4, 3, 2), (6, 6, 0), (8, 9, 3), (10, 12, 9)])
    a.save("foliage", "foliage_tallgrass.png")


def trunk_oak():
    a = Art(10, 36)
    a.poly([(3, 14), (0, 9), (1.5, 8), (4, 12)], c("#7a5236"), line=c("#5a3a24"), lw=0.3)
    a.poly([(7, 18), (10, 13), (8.5, 12), (6.5, 16)], c("#7a5236"), line=c("#5a3a24"), lw=0.3)
    a.poly([(1.5, 36), (8.5, 36), (7, 6), (3, 6)], c("#7a5236"), line=c("#5a3a24"), lw=0.4)
    for y in (12, 20, 28):
        a.line([(3.4, y), (4.6, y + 2)], c("#5a3a24"), 0.3)
    a.save("trunks", "trunk_oak.png")


def trunk_pine():
    a = Art(6, 44)
    a.poly([(1.2, 44), (4.8, 44), (4, 0), (2, 0)], c("#6b4a33"), line=c("#4e3424"), lw=0.3)
    for y in (8, 18, 28, 38):
        a.line([(2.2, y), (3.8, y)], c("#4e3424"), 0.3)
    a.save("trunks", "trunk_pine.png")


def extra_awning():
    a = Art(28, 10)
    n = 7
    for i in range(n):
        col = c("#d8473a") if i % 2 == 0 else c("#fbf5ea")
        t0, t1 = 2 + i * 24 / n, 2 + (i + 1) * 24 / n
        b0, b1 = i * 4, (i + 1) * 4
        a.poly([(t0, 0), (t1, 0), (b1, 8), (b0, 8)], col)
        a.ellipse(b0, 6.2, b1, 9.8, col)
    a.rect(1.5, 0, 26.5, 1.4, c("#7b3222"), r=0.5); a.save("extras", "extra_awning.png")


if __name__ == "__main__":
    for f in (wall_brick, wall_wood, wall_plaster, wall_stone,
              window_square, window_arch, window_round, window_shutter,
              door_wood, door_blue, door_arch, door_glass,
              roof_flat, roof_garden, roof_thatch,
              extra_chimney, extra_flowerbox, extra_plant, extra_awning,
              lamp_lantern, lamp_globe,
              foliage_crown, foliage_pine, foliage_bush, foliage_grass, foliage_tallgrass,
              trunk_oak, trunk_pine):
        f()
    gable("roof_gable_red.png", 32, "#c24a34", "#8f2f21", "#ffffff")
    gable("roof_gable_blue.png", 26, "#4a78ad", "#2c5384", "#ffffff")
    print("Selesai.")
