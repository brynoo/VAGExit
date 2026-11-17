#!/usr/bin/env python3
"""Wandelt die OpenStreetMap-Rohdaten (Overpass-JSON) für den Nürnberger Hbf
in ein kompaktes Geometrie-Modul für die 3D-Szene um.
Koordinaten: x = Ost, z = Süd, Meter relativ zum Ursprung (Mitte U-Bahnhof)."""
import json, math, os, zlib

HIER = os.path.dirname(os.path.abspath(__file__))
import sys
SID = int(sys.argv[1])
NETZ = json.load(open(os.path.join(HIER, "..", "src", "data", "netz.json")))
STATION = next(s for s in NETZ["stationen"] if s["id"] == SID)
T = U = json.load(open(os.path.join(HIER, "raw", f"station_{SID}.json")))["elements"]
LAT0, LON0 = STATION["lat"], STATION["lon"]
RADIUS = 310

def P(lat, lon):
    return (round((lon - LON0) * math.cos(math.radians(LAT0)) * 111320, 1),
            round(-(lat - LAT0) * 111132, 1))
def pts(e): return [P(g["lat"], g["lon"]) for g in e.get("geometry", [])]
def lv(s):
    try: return [float(x) for x in str(s).split(";")]
    except Exception: return None
def innen(p, r=RADIUS): return math.hypot(*p) <= r
def area(poly):
    return abs(sum(poly[i][0]*poly[(i+1) % len(poly)][1] - poly[(i+1) % len(poly)][0]*poly[i][1] for i in range(len(poly)))) / 2
def centroid(poly): return (sum(p[0] for p in poly)/len(poly), sum(p[1] for p in poly)/len(poly))
def hull(points):
    ps = sorted(set(points))
    if len(ps) < 3: return ps
    def cross(o, a, b): return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
    lo, up = [], []
    for p in ps:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(ps):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]
def ring(e):
    p = pts(e)
    if len(p) > 3 and p[0] == p[-1]: p = p[:-1]
    return p
def ringe(e):
    """Echte Außenringe eines Multipolygons: Teilstücke an den Endpunkten zusammensetzen."""
    teile = [[P(g["lat"], g["lon"]) for g in m["geometry"]] for m in e.get("members", []) if m.get("role") == "outer" and m.get("geometry")]
    fertig = []
    while teile:
        r = teile.pop(0)
        weiter = True
        while r[0] != r[-1] and weiter:
            weiter = False
            for i, t in enumerate(teile):
                if t[0] == r[-1]: r = r + t[1:]
                elif t[-1] == r[-1]: r = r + t[::-1][1:]
                elif t[-1] == r[0]: r = t[:-1] + r
                elif t[0] == r[0]: r = t[::-1][:-1] + r
                else: continue
                teile.pop(i); weiter = True; break
        if r[0] == r[-1]: r = r[:-1]
        if len(r) >= 3 and area(r) > 15: fertig.append(r)
    return fertig

def puffer(linie, halb):
    """Linie beidseitig um `halb` Meter verbreitern -> Polygon."""
    li, re = [], []
    for i, (x, z) in enumerate(linie):
        a = linie[max(i - 1, 0)]; b = linie[min(i + 1, len(linie) - 1)]
        dx, dz = b[0] - a[0], b[1] - a[1]; l = math.hypot(dx, dz) or 1
        nx, nz = -dz / l * halb, dx / l * halb
        li.append((round(x + nx, 1), round(z + nz, 1))); re.append((round(x - nx, 1), round(z - nz, 1)))
    return li + re[::-1]

def rel_outer(e):
    return hull([P(g["lat"], g["lon"]) for m in e["members"] if m.get("role") == "outer" for g in m.get("geometry", [])])

out = dict(wasser=[], gebaeude=[], strassen=[], tram=[], bahn=[], gruen=[], mauer=[], baeume=[],
           ubahnsteige=[], dbsteige=[], wege=[], treppen=[], raeume=[], aufzuege=[], ugleise=[], eingaenge=[])

# ---------- Umfeld ----------
BREITE = dict(primary=14, secondary=12, secondary_link=7, tertiary=9, residential=7,
              unclassified=7, living_street=6, pedestrian=8, service=3.5)
for e in U:
    t = e.get("tags", {})
    if "building" in t:
        poly = ring(e) if e["type"] == "way" else rel_outer(e)
        if len(poly) < 3 or area(poly) < 20 or not innen(centroid(poly)): continue
        b = t["building"]
        try: h = float(str(t.get("height", "")).replace("m", "").strip())
        except ValueError: h = None
        if h is None:
            try: h = float(t["building:levels"]) * 3.5 + 2
            except (KeyError, ValueError):
                h = dict(church=20, train_station=16, parking=12, roof=5, kiosk=4, service=4).get(b, 13 + zlib.crc32(str(e["id"]).encode()) % 7)
        out["gebaeude"].append(dict(p=poly, h=round(h, 1), name=t.get("name"), art=b, dach=t.get("roof:shape")))
    elif t.get("highway") in BREITE:
        if t.get("tunnel") == "yes" or t.get("area") == "yes": continue
        p = [q for q in pts(e)]
        if any(innen(q) for q in p): out["strassen"].append(dict(p=p, b=BREITE[t["highway"]], fuss=t["highway"] == "pedestrian"))
    elif t.get("railway") == "tram":
        p = pts(e)
        if any(innen(q) for q in p): out["tram"].append(p)
    elif t.get("railway") == "rail":
        if t.get("tunnel") == "yes": continue
        p = pts(e)
        if any(innen(q) for q in p): out["bahn"].append(p)
    elif t.get("leisure") in ("park", "garden") or t.get("landuse") in ("grass", "village_green"):
        poly = ring(e)
        if len(poly) >= 3 and innen(centroid(poly)): out["gruen"].append(poly)
    elif t.get("natural") == "water":
        poly = ring(e) if e["type"] == "way" else rel_outer(e)
        if len(poly) >= 3: out["wasser"].append(poly)
    elif t.get("barrier") == "city_wall" or t.get("historic") == "city_wall":
        p = pts(e)
        if any(innen(q) for q in p): out["mauer"].append(p)
    elif t.get("natural") == "tree" and e["type"] == "node":
        p = P(e["lat"], e["lon"])
        if innen(p): out["baeume"].append(p)

# ---------- U-Bahn / Innenraum ----------
tief = {}
for e in T:
    t = e.get("tags", {})
    if t.get("highway") in ("footway", "corridor") and t.get("level"):
        for l in lv(t["level"]) or []:
            tief.setdefault(l, []).extend(pts(e))
def dmin(p, liste): return min((math.hypot(p[0]-q[0], p[1]-q[1]) for q in liste), default=1e9)

for e in T:
    t = e.get("tags", {})
    L = lv(t.get("level")) if t.get("level") else None
    if t.get("railway") == "platform" and e["type"] != "node":
        rg = ringe(e) if e["type"] == "relation" else [ring(e)]
        rg = [r for r in rg if len(r) >= 3 and area(r) > 15]
        if not rg:
            # Bahnsteig nur als Linie (Bahnsteigkante) oder offener Ring erfasst: Fläche ersatzweise bilden
            roh = pts(e) if e["type"] == "way" else [P(g["lat"], g["lon"]) for m in e.get("members", []) for g in m.get("geometry", [])]
            h = hull(roh)
            if len(h) >= 3 and area(h) > 40: rg = [h]
            elif len(roh) >= 2: rg = [puffer(roh, 2.2)]
        if not rg: continue
        alle = [q for r in rg for q in r]
        fremd = t.get("train") == "yes" or t.get("tram") == "yes" or t.get("bus") == "yes" or t.get("light_rail") == "yes"
        ubahn = t.get("subway") == "yes" or (not fremd and L and L[0] != 0 and innen(centroid(alle), 150))
        if ubahn:
            # jeder Ring ist ein eigener Bahnsteig (Seitenbahnsteige liegen oft in einer Relation)
            for r in rg:
                if innen(centroid(r), 220): out["ubahnsteige"].append(dict(p=r, level=(L or lv(t.get("layer")) or [-2])[0]))
        elif e["type"] == "relation" and L and innen(centroid(alle), 420):
            for r in rg: out["dbsteige"].append(dict(p=r, ref=t.get("ref")))
    elif e["type"] == "way" and t.get("railway") == "platform" and t.get("level") == "1":
        out["dbsteige"].append(dict(p=hull(pts(e)), ref=t.get("ref")))
    elif e["type"] == "way" and t.get("railway") == "subway":
        l = (L or lv(t.get("layer")) or [-3])[0]
        out["ugleise"].append(dict(p=pts(e), level=l))
    elif e["type"] == "way" and t.get("highway") == "steps" and L and len(set(L)) > 1 and (min(L) < 0 or innen(pts(e)[0], 130)):
        p = pts(e)
        hi, lo = max(L), min(L)
        inc = t.get("incline")
        if inc == "up": p = p[::-1]
        elif inc != "down":
            # ohne incline-Tag: das Ende näher an Wegen der unteren Ebene ist unten
            if dmin(p[0], tief.get(lo, [])) < dmin(p[-1], tief.get(lo, [])): p = p[::-1]
        if innen(p[0], 260) and max(L) <= 2:
            out["treppen"].append(dict(p=p, oben=hi, unten=lo, roll=bool(t.get("conveying"))))
    elif e["type"] == "way" and t.get("highway") in ("footway", "corridor") and L and (max(L) < 0 or (max(L) in (1, 2) and innen(pts(e)[0], 110))):
        p = pts(e)
        if innen(p[0], 260): out["wege"].append(dict(p=p, level=max(L)))
    elif e["type"] == "way" and t.get("indoor") in ("room", "area", "corridor") and L and max(L) < 0 and "highway" not in t:
        poly = ring(e)
        if len(poly) >= 3 and innen(centroid(poly), 260):
            out["raeume"].append(dict(p=poly, level=max(L), name=t.get("name"), art=t.get("indoor")))
    elif t.get("highway") == "elevator" and L and len(set(L)) > 1 and max(L) <= 2:
        p = P(e["lat"], e["lon"]) if e["type"] == "node" else centroid(pts(e))
        if innen(p, 230): out["aufzuege"].append(dict(x=round(p[0], 1), z=round(p[1], 1), oben=max(L), unten=min(L)))
    elif t.get("railway") == "subway_entrance" and e["type"] == "node":
        p = P(e["lat"], e["lon"])
        if innen(p, 260): out["eingaenge"].append(dict(x=p[0], z=p[1], name=t.get("name"), rolli=t.get("wheelchair")))

gesehen, einzeln = set(), []
for b in out["gebaeude"]:
    c = centroid(b["p"]); k = (round(c[0]), round(c[1]), round(area(b["p"]) / 10))
    if k in gesehen: continue
    gesehen.add(k); einzeln.append(b)
out["gebaeude"] = einzeln
out["quelle"] = "© OpenStreetMap-Mitwirkende, ODbL 1.0"
out["mitte"] = [LAT0, LON0]
ziel = os.path.join(HIER, "..", "public", "geo", f"{SID}.json")
with open(ziel, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
print(STATION["name"], {k: len(v) for k, v in out.items() if isinstance(v, list)}, os.path.getsize(ziel) // 1024, "KB")
for s in out["ubahnsteige"]: print("U-Bahnsteig Ebene", s["level"], "Mitte", [round(c) for c in centroid(s["p"])])
