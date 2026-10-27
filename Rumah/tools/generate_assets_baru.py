"""
Membuat gambar bawaan untuk enam kategori aset baru Rumah Mungil:
aksesoris_pintu, aksesoris_jendela, ruko, papan, papan_menyala, vandal, hiasan.

Jalankan dari folder utama proyek:
    pip install pillow
    python tools/generate_assets_baru.py

Memakai kelas Art dari generate_assets.py (4 piksel asli per 1 satuan canvas, supersampling).
File dengan akhiran _malam.png adalah versi malam (menyala) dan harus berukuran sama dengan versi siangnya.
"""
import math
import os
import random
import sys

from PIL import ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generate_assets import Art, K, c  # noqa: E402

FONTS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
]


def font(units):
    px = max(8, round(units * K))
    for f in FONTS:
        if os.path.exists(f):
            return ImageFont.truetype(f, px)
    return ImageFont.load_default(px)


def fit(s, size, maxw):
    """Kecilkan ukuran huruf sampai teks muat dalam lebar maxw (satuan canvas)."""
    if not maxw:
        return size
    while size > 1.5 and font(size).getlength(s) > maxw * K:
        size -= 0.2
    return size


def text(a, s, cx, cy, size, fill, stroke=None, sw=0, maxw=None):
    """Tulisan rata tengah. size = tinggi huruf (em) dalam satuan canvas; maxw = lebar maksimal."""
    size = fit(s, size, maxw)
    a.d.text((cx * K, cy * K), s, font=font(size), fill=fill, anchor="mm",
             stroke_width=round(sw * K), stroke_fill=stroke)


def soft(a, r):
    """Haluskan tepi (kesan cat semprot)."""
    a.img = a.img.filter(ImageFilter.GaussianBlur(r * K))
    a.d = ImageDraw.Draw(a.img)


def sag(x0, y0, x1, y1, drop, n=24):
    """Titik tali menggantung (parabola) dari (x0,y0) ke (x1,y1)."""
    pts = []
    for i in range(n + 1):
        t = i / n
        pts.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + drop * 4 * t * (1 - t)))
    return pts


def star(cx, cy, ro, ri, rot=-90):
    pts = []
    for i in range(10):
        r = ro if i % 2 == 0 else ri
        ang = math.radians(rot + i * 36)
        pts.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
    return pts


INK = c("#2c2a33")
WOOD, WOOD_D, WOOD_L = c("#b98450"), c("#7d5430"), c("#d6a672")
CREAM = c("#fff4dc")
BRASS, BRASS_D = c("#d9b24a"), c("#a47f22")
IRON = c("#3b3f46")
GLASS = c("#bfe3f5")
LIT = c("#ffd27a")


# =============== AKSESORIS PINTU ===============
def pintu_keset():
    a = Art(22, 4)
    a.rect(0.5, 0.6, 21.5, 3.6, c("#9a4b3c"), r=1.2)
    for i in range(6):
        a.rect(1.2 + i * 3.4, 1.1, 2.6 + i * 3.4, 3.1, c("#e9c27a" if i % 2 else "#c98a4b"), r=0.5)
    a.shade(0.5, 3, 21.5, 3.7, (0, 0, 0, 40))
    a.save("aksesoris_pintu", "pintu_keset.png")


def pintu_karangan():
    a = Art(12, 12)
    a.ellipse(0.8, 0.8, 11.2, 11.2, c("#3f7d45"))
    a.ellipse(2.8, 2.8, 9.2, 9.2, (0, 0, 0, 0))
    rnd = random.Random(2)
    for i in range(18):
        ang = i / 18 * 2 * math.pi
        x, y = 6 + 4.2 * math.cos(ang), 6 + 4.2 * math.sin(ang)
        a.ellipse(x - 1.4, y - 1.1, x + 1.4, y + 1.1, c(rnd.choice(["#4f9a55", "#2f6a38", "#5aa860"])))
    for ang in (30, 110, 200, 290, 340):
        x, y = 6 + 4.2 * math.cos(math.radians(ang)), 6 + 4.2 * math.sin(math.radians(ang))
        a.ellipse(x - 0.7, y - 0.7, x + 0.7, y + 0.7, c("#d6402e"))
    a.poly([(6, 10.2), (3.6, 12), (4.4, 9.4)], c("#d6402e"))
    a.poly([(6, 10.2), (8.4, 12), (7.6, 9.4)], c("#d6402e"))
    a.ellipse(5.2, 9.6, 6.8, 11, c("#a82a1c"))
    a.save("aksesoris_pintu", "pintu_karangan.png")


def pintu_nomor():
    a = Art(9, 6)
    a.rect(0.3, 0.3, 8.7, 5.7, BRASS, r=1, line=BRASS_D, lw=0.4)
    text(a, "12", 4.5, 3.1, 4.4, c("#4a3a12"))
    a.save("aksesoris_pintu", "pintu_nomor.png")


def pintu_gagang():
    a = Art(4, 9)
    a.rect(0.8, 0.8, 3.2, 3.4, BRASS_D, r=0.8)
    a.rect(1.4, 1.4, 2.6, 2.6, BRASS, r=0.5)
    a.rect(1.5, 3, 2.5, 8.2, BRASS, r=0.5, line=BRASS_D, lw=0.2)
    a.save("aksesoris_pintu", "pintu_gagang.png")


def pintu_lonceng():
    a = Art(8, 13)
    a.rect(0, 0.2, 8, 1.6, WOOD_D, r=0.5)
    for x in (1.4, 4, 6.6):
        a.line([(x, 1.4), (x, 4.2 + (x == 4) * 1.5)], c("#7a7a82"), 0.25)
    for x, y, h in ((1.4, 4.2, 5), (4, 5.7, 6.4), (6.6, 4.2, 5)):
        a.rect(x - 0.5, y, x + 0.5, y + h, c("#c9ced6"), r=0.45, line=c("#8c929c"), lw=0.15)
    a.ellipse(3.3, 11.6, 4.7, 13, c("#c98a4b"))
    a.save("aksesoris_pintu", "pintu_lonceng.png")


def pintu_kotak_surat():
    a = Art(9, 11)
    a.rect(0.6, 0.6, 8.4, 6.6, c("#d6402e"), r=2.2, line=c("#8f2a1f"), lw=0.35)
    a.rect(1.8, 2.6, 7.2, 3.4, c("#4a1b14"), r=0.3)
    a.rect(3.9, 6.6, 5.1, 10.4, WOOD_D, r=0.3)
    a.rect(0.9, 10.2, 8.1, 10.9, WOOD_D, r=0.3)
    a.save("aksesoris_pintu", "pintu_kotak_surat.png")


# =============== AKSESORIS JENDELA ===============
def jendela_tirai():
    a = Art(16, 20)
    a.rect(0.2, 1.2, 15.8, 2.2, WOOD_D, r=0.5)
    for side in (0, 1):
        x0, x1 = (1.2, 5.6) if side == 0 else (10.4, 14.8)
        a.poly([(x0, 2), (x1, 2), (x1 - 0.4 if side == 0 else x1, 12), (x1 - 0.8 if side == 0 else x1 - 1.2, 18.6),
                (x0 + 0.8 if side == 0 else x0 + 0.4, 18.6), (x0, 12)], c("#f4b6b6"))
        for k in range(4):
            xx = x0 + 0.8 + k * 1.05
            a.line([(xx, 2.4), (xx + (0.2 if side == 0 else -0.2), 18.2)], c("#d98a8a", 150), 0.3)
    a.ellipse(4.6, 9.4, 6.2, 10.8, c("#e9c27a"))
    a.ellipse(9.8, 9.4, 11.4, 10.8, c("#e9c27a"))
    a.save("aksesoris_jendela", "jendela_tirai.png")


def jendela_teralis():
    a = Art(16, 20)
    a.rect(0.4, 0.4, 15.6, 19.6, (0, 0, 0, 0), r=1, line=IRON, lw=0.7)
    for i in range(1, 6):
        a.rect(i * 16 / 6 - 0.25, 0.6, i * 16 / 6 + 0.25, 19.4, IRON)
    for y in (6.6, 13.2):
        a.rect(0.6, y - 0.25, 15.4, y + 0.25, IRON)
    for i in range(3):
        cx = 2.7 + i * 5.3
        a.ellipse(cx - 1.2, 9.2, cx + 1.2, 11.6, (0, 0, 0, 0), line=IRON, lw=0.35)
    a.save("aksesoris_jendela", "jendela_teralis.png")


def jendela_daun():
    a = Art(28, 20)
    for x0 in (0.4, 21.2):
        a.rect(x0, 0.6, x0 + 6.4, 19.4, c("#4f8a6a"), r=0.6, line=c("#2f5a45"), lw=0.4)
        for k in range(7):
            a.rect(x0 + 0.9, 2.2 + k * 2.4, x0 + 5.5, 3.4 + k * 2.4, c("#3d7457"), r=0.2)
        a.shade(x0, 0.6, x0 + 1, 19.4, (255, 255, 255, 40))
    a.save("aksesoris_jendela", "jendela_daun.png")


def jendela_kanopi():
    a = Art(20, 7)
    for i in range(5):
        col = c("#d6402e") if i % 2 == 0 else c("#fff4dc")
        x0 = i * 4
        a.poly([(x0 + 0.6, 0.4), (x0 + 4.6, 0.4), (x0 + 4, 5), (x0, 5)], col)
        a.ellipse(x0, 4.2, x0 + 4, 6.6, col)
    a.rect(0.4, 0, 19.6, 0.9, c("#7a2a20"), r=0.3)
    a.save("aksesoris_jendela", "jendela_kanopi.png")


def jendela_pot():
    a = Art(12, 9)
    a.poly([(3, 5.6), (9, 5.6), (8.2, 8.8), (3.8, 8.8)], c("#c9703f"))
    a.rect(2.6, 4.8, 9.4, 6.2, c("#b85f30"), r=0.4)
    for x, y, rr in ((6, 2.4, 2.2), (4, 3.4, 1.7), (8, 3.4, 1.7)):
        a.ellipse(x - rr, y - rr, x + rr, y + rr, c("#4f9a55"))
    a.ellipse(5.2, 1.4, 6.8, 2.8, c("#ec7fa0"))
    a.save("aksesoris_jendela", "jendela_pot.png")


def jendela_kucing():
    a = Art(11, 10)
    o, od = c("#e8a35a"), c("#c47c34")
    a.line([(7.6, 8.8), (10, 7.6), (10.2, 5.2)], o, 1.3)
    a.ellipse(1.8, 3.8, 8.4, 9.8, o)
    a.ellipse(2.4, 0.6, 7, 5, o)
    a.poly([(2.5, 2), (2.8, 0), (4.4, 1.2)], o)
    a.poly([(6.9, 2), (6.6, 0), (5, 1.2)], o)
    for xx in (3.3, 5.3):
        a.ellipse(xx, 2.4, xx + 0.9, 3.4, INK)
    a.ellipse(4.2, 3.5, 4.8, 4, c("#e07a7a"))
    for y in (5.2, 6.4):
        a.line([(2.2, y), (6.6, y)], od, 0.35)
    a.rect(2.2, 8.8, 4, 9.9, c("#f7e3c8"), r=0.5)
    a.rect(5.2, 8.8, 7, 9.9, c("#f7e3c8"), r=0.5)
    a.save("aksesoris_jendela", "jendela_kucing.png")


# =============== RUKO (72 lebar) ===============
def window_pane(a, x, y, w, h, lit):
    a.rect(x, y, x + w, y + h, c("#f6f0e4"), r=0.8)
    gx0, gy0, gx1, gy1 = x + 1.2, y + 1.2, x + w - 1.2, y + h - 1.2
    a.rect(gx0, gy0, gx1, gy1, LIT if lit else GLASS, r=0.3)
    if not lit:
        a.poly([(gx0, gy1), (gx0 + 3, gy0), (gx0 + 5.2, gy0), (gx0 + 2.2, gy1)], (255, 255, 255, 110))
    a.rect(x + w / 2 - 0.3, gy0, x + w / 2 + 0.3, gy1, c("#f6f0e4"))
    a.rect(gx0, y + h / 2 - 0.3, gx1, y + h / 2 + 0.3, c("#f6f0e4"))


def awning(a, x0, x1, y, h, c1, c2):
    n = int((x1 - x0) // 6)
    wd = (x1 - x0) / n
    for i in range(n):
        col = c1 if i % 2 == 0 else c2
        xa = x0 + i * wd
        a.poly([(xa, y), (xa + wd, y), (xa + wd + 0.6, y + h), (xa - 0.6, y + h)], col)
        a.ellipse(xa - 0.6, y + h - 1.6, xa + wd + 0.6, y + h + 1.6, col)


def ruko(name, style, wall, trim, sign, signbg, signfg, awn=None, floors=1, lit=False):
    shop_h, up_h = 38, 28
    if style == "warung":
        shop_h, floors = 36, 0
    top = 10 if style == "warung" else 6
    H = top + floors * up_h + shop_h
    a = Art(72, H)
    d = a.d
    dark = tuple(max(0, v - 38) for v in wall[:3]) + (255,)
    a.rect(0, top - 1 if style != "warung" else 8, 72, H, wall)
    if style == "warung":
        for i in range(0, 72, 6):
            a.rect(i + 0.2, 9, i + 5.8, H, c("#c99b63") if (i // 6) % 2 else c("#bf9159"))
            a.rect(i + 5.4, 9, i + 6, H, c("#8c6338", 120))
        a.poly([(-1, 11), (6, 1), (66, 1), (73, 11)], c("#b9533b"), line=c("#8f2f21"), lw=0.5)
        for i in range(1, 8):
            a.line([(i * 9 - 1, 1.4), (i * 9 - 3.2, 10.4)], c("#8f2f21", 160), 0.4)
        a.rect(-1, 10, 73, 12, c("#8f2f21"))
    else:
        # parapet atas
        a.rect(0, 0, 72, top, dark)
        a.rect(-0.5, 0, 72.5, 1.8, trim, r=0.4)
        for fl in range(floors):
            y0 = top + fl * up_h
            a.rect(0, y0, 72, y0 + 1.4, trim)
            if style == "glassband":
                a.rect(4, y0 + 5, 68, y0 + up_h - 4, c("#4b5560"), r=1)
                for k in range(4):
                    x = 5 + k * 15.5
                    a.rect(x, y0 + 6, x + 14.5, y0 + up_h - 5, LIT if lit else c("#9fd0e6"), r=0.5)
                    if not lit:
                        a.poly([(x, y0 + up_h - 5), (x + 4, y0 + 6), (x + 6.4, y0 + 6), (x + 2.4, y0 + up_h - 5)], (255, 255, 255, 90))
            else:
                window_pane(a, 10, y0 + 5, 18, 18, lit)
                window_pane(a, 44, y0 + 5, 18, 18, lit)
                a.rect(7, y0 + up_h - 4, 31, y0 + up_h - 2.6, trim)
                a.rect(41, y0 + up_h - 4, 65, y0 + up_h - 2.6, trim)
    sy = top + floors * up_h
    # pita papan nama + etalase
    if style != "warung":
        a.rect(0, sy, 72, sy + 1.4, trim)
    a.rect(4, sy + 2.2, 68, sy + 10.2, signbg, r=1.2, line=trim, lw=0.5)
    text(a, sign, 36, sy + 6.3, 6.4, signfg, maxw=56)
    if awn:
        awning(a, 3, 69, sy + 10.4, 4.4, awn[0], awn[1])
    gy0 = sy + 16
    a.rect(4, gy0, 40, H - 3.5, c("#6f4a30"), r=0.6)
    a.rect(5.2, gy0 + 1.2, 38.8, H - 4.7, LIT if lit else c("#a8cfe0"), r=0.4)
    if lit:
        a.shade(5.2, gy0 + 1.2, 38.8, gy0 + 6, (255, 255, 255, 70))
        for sx, col in ((8, "#d6402e"), (16, "#4f9a55"), (24, "#4a78ad"), (32, "#e8a35a")):
            a.rect(sx, H - 11, sx + 5, H - 4.7, c(col), r=0.5)
        a.rect(5.2, H - 11.4, 38.8, H - 10.6, c("#a47f22"))
    else:
        a.poly([(6, H - 4.7), (13, gy0 + 1.2), (17, gy0 + 1.2), (10, H - 4.7)], (255, 255, 255, 100))
        for sx, col in ((8, "#c47a5a"), (16, "#7aa86a"), (24, "#6a8cba"), (32, "#d6a060")):
            a.rect(sx, H - 11, sx + 5, H - 4.7, c(col, 150), r=0.5)
    # pintu kaca
    a.rect(46, gy0, 66, H - 1, c("#6f4a30"), r=0.6)
    a.rect(47.2, gy0 + 1.2, 64.8, H - 1.8, LIT if lit else GLASS, r=0.4)
    a.rect(55.4, gy0 + 1.2, 56.6, H - 1.8, c("#6f4a30"))
    a.ellipse(53.4, H / 2 + gy0 / 2 - 1, 54.4, H / 2 + gy0 / 2 + 1.4, BRASS)
    a.ellipse(57.6, H / 2 + gy0 / 2 - 1, 58.6, H / 2 + gy0 / 2 + 1.4, BRASS)
    # tapak dasar + bayangan sisi
    a.rect(0, H - 3, 72, H, dark)
    a.shade(0, 0, 1.4, H, (0, 0, 0, 26))
    a.shade(70.6, 0, 72, H, (0, 0, 0, 40))
    a.save("ruko", name + ("_malam" if lit else "") + ".png")


def make_ruko():
    for lit in (False, True):
        ruko("ruko_klasik", "classic", c("#efe0c0"), c("#b9533b"), "TOKO", c("#b9533b"), CREAM,
             awn=(c("#d6402e"), c("#fff4dc")), floors=1, lit=lit)
        ruko("ruko_modern", "glassband", c("#cfd4da"), c("#59616b"), "BUTIK", c("#2f3640"), c("#f4e3b0"),
             awn=None, floors=2, lit=lit)
        ruko("ruko_kopi", "classic", c("#a9c9a4"), c("#3f6b4a"), "KOPI", c("#3f2a1c"), c("#f4e3b0"),
             awn=(c("#3f6b4a"), c("#f4f1e6")), floors=1, lit=lit)
        ruko("ruko_warung", "warung", c("#c99b63"), c("#7d5430"), "WARUNG", c("#d6402e"), CREAM,
             awn=(c("#e8a35a"), c("#fff4dc")), floors=0, lit=lit)


# =============== PAPAN ===============
def plank(a, x0, y0, x1, y1, base=WOOD):
    a.rect(x0, y0, x1, y1, WOOD_D, r=1.2)
    a.rect(x0 + 0.5, y0 + 0.5, x1 - 0.5, y1 - 0.5, base, r=0.9)
    for k in range(1, 3):
        y = y0 + (y1 - y0) * k / 3
        a.line([(x0 + 1, y), (x1 - 1, y)], c("#a97b46", 140), 0.25)


def hang_ropes(a, xs, ytop, ybot):
    for x in xs:
        a.line([(x, ytop), (x, ybot)], c("#6a5a3e"), 0.4)
        a.ellipse(x - 0.5, ybot - 0.4, x + 0.5, ybot + 0.6, c("#6a5a3e"))


def papan_toko():
    a = Art(40, 15)
    hang_ropes(a, (6, 34), 0, 3.4)
    plank(a, 0.5, 3, 39.5, 14.5)
    text(a, "TOKO", 20, 8.9, 7.4, c("#fff0d0"), stroke=c("#5a3a1c"), sw=0.45, maxw=28)
    a.save("papan", "papan_toko.png")


def papan_warung(lit=False):
    a = Art(56, 17)
    hang_ropes(a, (7, 49), 0, 3.4)
    a.rect(0.5, 3, 55.5, 16.5, c("#7a2a20"), r=1.5)
    a.rect(1.3, 3.8, 54.7, 15.7, c("#ffd978" if lit else "#f0b23c"), r=1.2)
    a.rect(2.4, 4.9, 53.6, 14.6, c("#d6402e"), r=0.9)
    text(a, "WARUNG MAKAN", 28, 9.9, 5.6, c("#fff8d8" if lit else "#fff0c8"), maxw=46)
    a.save("papan_menyala", "papan_warung" + ("_malam" if lit else "") + ".png")


def papan_buka(name, word, col):
    a = Art(18, 12)
    hang_ropes(a, (5, 13), 0, 2.4)
    plank(a, 0.5, 2, 17.5, 11.5, base=c(col))
    text(a, word, 9, 7, 4.6, CREAM, stroke=c("#3a2a1a"), sw=0.3, maxw=13.5)
    a.save("papan", name)


def papan_menu():
    a = Art(18, 30)
    a.poly([(3, 7), (5.2, 7), (3, 29.6), (1.2, 29.6)], WOOD_D)
    a.poly([(13, 7), (15.2, 7), (16.8, 29.6), (15, 29.6)], WOOD_D)
    a.rect(1.8, 0.6, 16.2, 21, WOOD, r=1.2, line=WOOD_D, lw=0.5)
    a.rect(3, 1.8, 15, 19.8, c("#2f3a35"), r=0.6)
    text(a, "MENU", 9, 5.6, 4.4, c("#f5f1e6"), maxw=10)
    for i, w in enumerate((9.5, 8, 9, 7)):
        y = 9.4 + i * 2.7
        a.line([(4.2, y), (4.2 + w, y)], c("#f5f1e6", 190), 0.4)
        a.ellipse(12.8, y - 0.5, 13.8, y + 0.5, c("#f0b23c"))
    a.rect(2.6, 20.6, 15.4, 22.4, WOOD_D, r=0.4)
    a.line([(4.2, 29.4), (13.8, 29.4)], (0, 0, 0, 0), 0.1)
    a.save("papan", "papan_menu.png")


def papan_neon(lit=False):
    a = Art(30, 12)
    a.rect(0.4, 0.4, 29.6, 11.6, c("#1e1c2a"), r=2, line=c("#3a3850"), lw=0.5)
    tube = c("#ff5fa8") if lit else c("#a37a92")
    core = c("#ffe3f1") if lit else c("#c9a8bb")
    a.d.text((15 * K, 6.2 * K), "OPEN", font=font(6.8), fill=core, anchor="mm",
             stroke_width=round(0.55 * K), stroke_fill=tube)
    for p in (1.5, 28.5):
        a.line([(p, 1.6), (p, 10.4)], tube, 0.3)
    a.save("papan_menyala", "papan_neon" + ("_malam" if lit else "") + ".png")


def papan_nama():
    a = Art(44, 12)
    a.rect(0.4, 0.8, 43.6, 11.4, WOOD_D, r=1.6)
    a.rect(1.2, 1.6, 42.8, 10.6, c("#e8dcc0"), r=1.2)
    text(a, "RUMAH MUNGIL", 22, 6.3, 5, c("#5a3a1c"), maxw=37)
    for x in (2.4, 41.6):
        a.ellipse(x - 0.5, 5.8, x + 0.5, 6.8, c("#7a7a82"))
    a.save("papan", "papan_nama.png")


def make_papan():
    papan_toko()
    papan_warung(False)
    papan_warung(True)
    papan_buka("papan_buka.png", "BUKA", "#4f8a6a")
    papan_buka("papan_tutup.png", "TUTUP", "#b9533b")
    papan_menu()
    papan_neon(False)
    papan_neon(True)
    papan_nama()


# =============== VANDAL (grafiti) ===============
def drip(a, x, y, h, col):
    a.rect(x - 0.45, y, x + 0.45, y + h, col, r=0.45)
    a.ellipse(x - 0.8, y + h - 0.8, x + 0.8, y + h + 0.8, col)


def vandal_bintang():
    a = Art(24, 26)
    a.poly(star(12, 11.5, 11, 4.8), INK)
    a.poly(star(12, 11.5, 9, 3.7), c("#ffd23a"))
    a.poly(star(12, 11.8, 5, 2), c("#fff2a8"))
    drip(a, 7.4, 17.5, 4.2, INK)
    drip(a, 15.2, 16.5, 7, c("#ffd23a"))
    soft(a, 0.12)
    a.save("vandal", "vandal_bintang.png")


def vandal_hati():
    a = Art(24, 22)
    for col, k, off in ((INK, 1.0, 0), (c("#ff5fa8"), 0.82, 0.3)):
        r = 5.6 * k
        a.ellipse(12 - 5.4 - r + 5.4 * 0, 7 - r + off, 12 - 5.4 + r + 5.4 * 0, 7 + r + off, col)
        a.ellipse(12 + 5.4 - r, 7 - r + off, 12 + 5.4 + r, 7 + r + off, col)
        a.poly([(12 - 10.4 * k - (1 - k) * 0, 9 + off), (12 + 10.4 * k, 9 + off), (12, 19.4 + off)], col)
    a.ellipse(5.6, 3.6, 8.6, 6.2, (255, 255, 255, 150))
    drip(a, 9, 15, 5, c("#ff5fa8"))
    drip(a, 15.6, 13, 7, INK)
    soft(a, 0.12)
    a.save("vandal", "vandal_hati.png")


def vandal_keren():
    a = Art(44, 17)
    a.d.text((23 * K, 9.4 * K), "KEREN", font=font(12), fill=INK, anchor="mm", stroke_width=round(1.5 * K), stroke_fill=INK)
    a.d.text((22 * K, 8.4 * K), "KEREN", font=font(12), fill=c("#3ec5e0"), anchor="mm", stroke_width=round(0.9 * K), stroke_fill=c("#fff7d0"))
    a.d.text((22 * K, 8.2 * K), "KEREN", font=font(12), fill=c("#3ec5e0"), anchor="mm")
    drip(a, 11, 12.4, 3.2, c("#3ec5e0"))
    drip(a, 30.4, 12.4, 3.8, c("#3ec5e0"))
    soft(a, 0.1)
    a.save("vandal", "vandal_keren.png")


def vandal_tag():
    a = Art(36, 18)
    pts = []
    for i in range(0, 241):
        t = i / 240
        ph = 2 * math.pi * 3.2 * t
        x = 3 + 28 * t - 3.4 * math.sin(ph)
        y = 8.6 + 4.8 * math.cos(ph) * (0.55 + 0.45 * math.sin(math.pi * t))
        pts.append((x, y))
    a.line(pts, c("#fff7d0"), 2.6)
    a.line(pts, c("#e8453c"), 1.4)
    sw = [(3, 15.4), (18, 13.6), (33, 16)]
    a.line(sw, c("#fff7d0"), 1.8)
    a.line(sw, c("#e8453c"), 0.8)
    a.poly([(28, 4.6), (29.4, 1.2), (31, 3.6), (32.6, 1.2), (34, 4.6)], c("#ffd23a"), line=INK, lw=0.3)
    soft(a, 0.12)
    a.save("vandal", "vandal_tag.png")


def vandal_smiley():
    a = Art(20, 22)
    a.ellipse(1, 1, 19, 19, INK)
    a.ellipse(2.2, 2.2, 17.8, 17.8, c("#ffd23a"))
    a.ellipse(5.6, 6.2, 8.2, 10.2, INK)
    a.ellipse(11.8, 6.2, 14.4, 10.2, INK)
    a.d.arc([5 * K, 6 * K, 15 * K, 15.6 * K], 20, 160, fill=INK, width=round(1.1 * K))
    drip(a, 6.4, 17.4, 3.6, c("#ffd23a"))
    soft(a, 0.12)
    a.save("vandal", "vandal_smiley.png")


def vandal_cipratan():
    a = Art(32, 26)
    rnd = random.Random(9)
    cols = ["#ff5fa8", "#3ec5e0", "#ffd23a", "#7ad05a", "#8a5cf0"]
    for i in range(34):
        ang = rnd.uniform(0, 2 * math.pi)
        dist = abs(rnd.gauss(0, 6.4))
        x, y = 16 + dist * math.cos(ang) * 1.2, 11 + dist * math.sin(ang) * 0.9
        r = rnd.uniform(0.6, 2.9) * (1.2 - dist / 14)
        r = max(0.5, r)
        a.ellipse(x - r, y - r, x + r, y + r, c(cols[i % 5]))
    a.ellipse(11, 6.5, 21, 15.5, c("#3ec5e0"))
    a.ellipse(13.4, 8.4, 19, 13.6, c("#ffd23a"))
    for x, col in ((11.5, "#3ec5e0"), (17, "#ff5fa8"), (21, "#ffd23a")):
        drip(a, x, 15, rnd.uniform(3.5, 8), c(col))
    soft(a, 0.14)
    a.save("vandal", "vandal_cipratan.png")


# =============== HIASAN ===============
def garland(name, cols, w=60, h=15, flags=11):
    a = Art(w, h)
    pts = sag(1, 1.2, w - 1, 1.2, 6)
    a.line(pts, c("#5a4a34"), 0.4)
    for i in range(flags):
        t = (i + 0.5) / flags
        x = 1 + (w - 2) * t
        y = 1.2 + 6 * 4 * t * (1 - t)
        fw = (w - 2) / flags * 0.86
        col = c(cols[i % len(cols)])
        a.poly([(x - fw / 2, y), (x + fw / 2, y), (x, y + fw * 1.25)], col,
               line=c("#c9c3b8") if cols[i % len(cols)].lower() in ("#ffffff", "#fff8f0") else None, lw=0.2)
    a.save("hiasan", name)


def hiasan_lampion(lit=False):
    a = Art(11, 21)
    a.line([(5.5, 0), (5.5, 2.6)], c("#5a4a34"), 0.4)
    a.rect(3.2, 2.2, 7.8, 3.6, c("#d9b24a"), r=0.5)
    body = c("#ff6a3d") if lit else c("#d6402e")
    a.ellipse(0.8, 3, 10.2, 14.4, body)
    if lit:
        a.ellipse(2.8, 4.8, 8.2, 12.6, c("#ffd27a"))
    for x in (3.2, 5.5, 7.8):
        a.line([(x, 3.6), (x, 13.6)], c("#8f2a1f", 140), 0.3)
    a.rect(3.2, 13.6, 7.8, 15, c("#d9b24a"), r=0.5)
    for x in (4.2, 5.5, 6.8):
        a.line([(x, 15), (x, 20.2)], c("#e8a640"), 0.5)
    a.ellipse(4.6, 19.6, 6.4, 21, c("#e8a640"))
    a.save("hiasan", "hiasan_lampion" + ("_malam" if lit else "") + ".png")


def hiasan_lampu_hias(lit=False):
    a = Art(60, 12)
    pts = sag(1, 1, 59, 1, 5)
    a.line(pts, c("#2c2a33"), 0.35)
    cols = ["#ffd27a", "#ffb4d0", "#a8e4ff", "#c8f0a0"]
    for i in range(14):
        t = (i + 0.5) / 14
        x, y = 1 + 58 * t, 1 + 5 * 4 * t * (1 - t)
        col = cols[i % 4]
        a.rect(x - 0.4, y, x + 0.4, y + 1, c("#2c2a33"))
        if lit:
            a.ellipse(x - 1.7, y + 0.6, x + 1.7, y + 4.4, c(col))
            a.ellipse(x - 0.7, y + 1.2, x + 0.7, y + 2.6, c("#ffffff", 220))
        else:
            a.ellipse(x - 1.2, y + 0.6, x + 1.2, y + 3.8, c(col, 170))
    a.save("hiasan", "hiasan_lampu_hias" + ("_malam" if lit else "") + ".png")


def hiasan_pot():
    a = Art(18, 28)
    rnd = random.Random(4)
    for ang, ln in ((-70, 11), (-40, 15), (-15, 17), (10, 15), (35, 12), (62, 9), (-92, 9)):
        r = math.radians(ang - 90 + 0) + math.pi
        ex, ey = 9 + ln * 0.55 * math.sin(math.radians(ang)), 17 - ln * math.cos(math.radians(ang)) * 0.95
        a.line([(9, 17), (ex, ey)], c("#2f6a38"), 0.5)
        a.ellipse(ex - 3.2, ey - 2.6, ex + 3.2, ey + 2.6, c(rnd.choice(["#4f9a55", "#3f8a48", "#5aa860"])))
    a.poly([(3, 17), (15, 17), (13.4, 27.6), (4.6, 27.6)], c("#c9703f"))
    a.rect(2.2, 16, 15.8, 19, c("#b85f30"), r=0.8)
    a.save("hiasan", "hiasan_pot.png")


def hiasan_bangku():
    a = Art(34, 19)
    for x in (3, 29):
        a.rect(x - 0.6, 7.6, x + 0.6, 18.4, IRON)
        a.rect(x - 1.4, 17.6, x + 1.4, 18.6, IRON)
    for y in (0.6, 3.2, 5.8):
        a.rect(1.2, y, 32.8, y + 2, WOOD, r=0.6, line=WOOD_D, lw=0.25)
    for y in (9.4, 12):
        a.rect(0.4, y, 33.6, y + 2, WOOD_L, r=0.6, line=WOOD_D, lw=0.25)
    a.rect(0.4, 11, 33.6, 11.5, (0, 0, 0, 40))
    a.save("hiasan", "hiasan_bangku.png")


def hiasan_gantung():
    a = Art(14, 25)
    for x in (2.6, 11.4):
        a.line([(7, 0), (x, 8.4)], c("#6a5a3e"), 0.35)
    a.poly([(1.6, 8.4), (12.4, 8.4), (10.6, 13.6), (3.4, 13.6)], c("#8a6a42"), line=WOOD_D, lw=0.3)
    for y in (10, 12):
        a.line([(2.4, y), (11.6, y)], c("#6a4a2a", 140), 0.25)
    rnd = random.Random(6)
    for i in range(9):
        x0 = 2 + i * 1.25
        ln = rnd.uniform(5, 11)
        a.poly([(x0, 9), (x0 + 1.4, 9), (x0 + 0.7 + rnd.uniform(-1.4, 1.4), 9 + ln)],
               c(rnd.choice(["#4f9a55", "#3f8a48", "#5aa860"])))
    a.ellipse(2, 6.4, 12, 10.4, c("#4f9a55"))
    a.ellipse(5.6, 5.6, 8.4, 7.4, c("#ec7fa0"))
    a.save("hiasan", "hiasan_gantung.png")


def make_hiasan():
    garland("hiasan_bendera.png", ["#d6402e", "#ffffff"])
    garland("hiasan_bunting.png", ["#e8453c", "#ffd23a", "#3ec5e0", "#7ad05a", "#ff5fa8"], w=56, h=14, flags=10)
    hiasan_lampion(False)
    hiasan_lampion(True)
    hiasan_lampu_hias(False)
    hiasan_lampu_hias(True)
    hiasan_pot()
    hiasan_bangku()
    hiasan_gantung()


if __name__ == "__main__":
    for f in (pintu_keset, pintu_karangan, pintu_nomor, pintu_gagang, pintu_lonceng, pintu_kotak_surat,
              jendela_tirai, jendela_teralis, jendela_daun, jendela_kanopi, jendela_pot, jendela_kucing,
              make_ruko, make_papan,
              vandal_bintang, vandal_hati, vandal_keren, vandal_tag, vandal_smiley, vandal_cipratan,
              make_hiasan):
        f()
    print("Selesai.")
