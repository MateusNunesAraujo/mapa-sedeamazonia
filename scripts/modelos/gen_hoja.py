"""Genera una hoja trifoliada simple (.glb) sin dependencias externas.
Uso: python gen_hoja.py <salida.glb>
Unidades en metros (tamaño real aproximado de Swinglea glutinosa)."""
import json, math, struct, sys

pos, nor, col, idx = [], [], [], []

VERDE = (0.13, 0.42, 0.12)
VERDE_BORDE = (0.09, 0.30, 0.08)
NERVIO = (0.62, 0.78, 0.38)
PECIOLO = (0.30, 0.42, 0.14)


def lerp(a, b, k):
    return tuple(a[i] + (b[i] - a[i]) * k for i in range(3))


def add_grid(points, colors, rows, cols):
    """points[r][c] -> malla de triángulos."""
    base = len(pos)
    for r in range(rows):
        for c in range(cols):
            pos.append(points[r][c])
            col.append(colors[r][c])
            nor.append([0.0, 0.0, 0.0])
    for r in range(rows - 1):
        for c in range(cols - 1):
            a = base + r * cols + c
            b = a + 1
            d = a + cols
            e = d + 1
            idx.extend([a, d, b, b, d, e])


def to_world(x, side, up, yaw, origin):
    cy, sy = math.cos(yaw), math.sin(yaw)
    return [origin[0] + x * cy - side * sy,
            origin[1] + up,
            origin[2] + x * sy + side * cy]


def foliolo(length, width, yaw, origin, n=28, m=12):
    pts, cols = [], []
    for i in range(n + 1):
        t = i / n
        half = width / 2 * math.sin(math.pi * t ** 1.4) ** 0.9  # oblanceolado
        row_p, row_c = [], []
        for j in range(m + 1):
            s = -1 + 2 * j / m
            side = s * half
            up = 0.07 * length * math.sin(math.pi * t) + 0.3 * abs(s) * half
            row_p.append(to_world(length * t, side, up, yaw, origin))
            if abs(s) < 0.1:
                c = NERVIO
            else:
                c = lerp(VERDE, VERDE_BORDE, abs(s) ** 2)
            row_c.append(c)
        pts.append(row_p)
        cols.append(row_c)
    add_grid(pts, cols, n + 1, m + 1)


def tallo(p0, p1, r, sides=10):
    dx, dy, dz = (p1[i] - p0[i] for i in range(3))
    L = math.sqrt(dx * dx + dy * dy + dz * dz)
    yaw = math.atan2(dz, dx)
    pts, cols = [], []
    for i in range(2):
        row_p, row_c = [], []
        for k in range(sides + 1):
            a = 2 * math.pi * k / sides
            row_p.append(to_world(L * i, r * math.cos(a), r * math.sin(a), yaw, p0))
            row_c.append(PECIOLO)
        pts.append(row_p)
        cols.append(row_c)
    add_grid(pts, cols, 2, sides + 1)


# Pecíolo + 3 folíolos que salen de la punta del pecíolo
union = [0.0, 0.0, 0.0]
tallo([-0.05, 0.0, 0.0], union, 0.0018)
foliolo(0.11, 0.045, 0.0, union)                 # folíolo terminal
foliolo(0.045, 0.022, math.radians(60), union)   # lateral
foliolo(0.045, 0.022, math.radians(-60), union)  # lateral

# Normales suavizadas
for k in range(0, len(idx), 3):
    a, b, c = (pos[idx[k + q]] for q in range(3))
    u = [b[i] - a[i] for i in range(3)]
    v = [c[i] - a[i] for i in range(3)]
    n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    for q in range(3):
        acc = nor[idx[k + q]]
        for i in range(3):
            acc[i] += n[i]
for n in nor:
    L = math.sqrt(sum(x * x for x in n)) or 1.0
    for i in range(3):
        n[i] /= L
    if n[1] < 0:  # que miren hacia arriba (material de doble cara)
        for i in range(3):
            n[i] = -n[i]


def pack(fmt, rows):
    return b"".join(struct.pack(fmt, *r) for r in rows)


def pad4(b, fill=b"\x00"):
    return b + fill * ((4 - len(b) % 4) % 4)


chunks = [pack("<3f", pos), pack("<3f", nor), pack("<3f", col),
          struct.pack("<%dH" % len(idx), *idx)]
views, offset, binbuf = [], 0, b""
for i, ch in enumerate(chunks):
    ch = pad4(ch)
    view = {"buffer": 0, "byteOffset": offset, "byteLength": len(ch)}
    view["target"] = 34963 if i == 3 else 34962
    views.append(view)
    binbuf += ch
    offset += len(ch)

mins = [min(p[i] for p in pos) for i in range(3)]
maxs = [max(p[i] for p in pos) for i in range(3)]
gltf = {
    "asset": {"version": "2.0", "generator": "gen_hoja.py"},
    "scene": 0,
    "scenes": [{"nodes": [0]}],
    "nodes": [{"mesh": 0, "name": "HojaTrifoliada"}],
    "meshes": [{"name": "HojaTrifoliada", "primitives": [{
        "attributes": {"POSITION": 0, "NORMAL": 1, "COLOR_0": 2},
        "indices": 3, "material": 0}]}],
    "materials": [{"name": "Hoja", "doubleSided": True, "pbrMetallicRoughness": {
        "baseColorFactor": [1, 1, 1, 1], "metallicFactor": 0.0, "roughnessFactor": 0.55}}],
    "buffers": [{"byteLength": len(binbuf)}],
    "bufferViews": views,
    "accessors": [
        {"bufferView": 0, "componentType": 5126, "count": len(pos), "type": "VEC3", "min": mins, "max": maxs},
        {"bufferView": 1, "componentType": 5126, "count": len(nor), "type": "VEC3"},
        {"bufferView": 2, "componentType": 5126, "count": len(col), "type": "VEC3"},
        {"bufferView": 3, "componentType": 5123, "count": len(idx), "type": "SCALAR"},
    ],
}
jbin = pad4(json.dumps(gltf, separators=(",", ":")).encode(), b" ")
total = 12 + 8 + len(jbin) + 8 + len(binbuf)
with open(sys.argv[1], "wb") as f:
    f.write(struct.pack("<4sII", b"glTF", 2, total))
    f.write(struct.pack("<I4s", len(jbin), b"JSON") + jbin)
    f.write(struct.pack("<I4s", len(binbuf), b"BIN\x00") + binbuf)
print("OK", len(pos), "vertices,", len(idx) // 3, "triangulos,", total, "bytes")
