#!/usr/bin/env python3
"""Zugänge aller U-Bahnhöfe aus OSM (raw/transit.json): subway_entrance-Knoten und
obere Treppenenden, je Station gruppiert, mit Straßennamen per Nominatim-Reverse."""
import json, math, os, subprocess, time, urllib.parse
HIER = os.path.dirname(os.path.abspath(__file__))
T = json.load(open(os.path.join(HIER, "raw", "transit.json")))["elements"]
netz = json.load(open(os.path.join(HIER, "..", "src", "data", "netz.json")))
CACHE = os.path.join(HIER, "raw", "reverse_cache.json")
cache = json.load(open(CACHE)) if os.path.exists(CACHE) else {}

def dist(a, b):
    kx = math.cos(math.radians(a[0])) * 111320
    return math.hypot((a[1] - b[1]) * kx, (a[0] - b[0]) * 111132)
def lv(s):
    try: return [float(x) for x in str(s).split(";")]
    except Exception: return None

kand = []  # (lat, lon, name, rolli, quelle)
for e in T:
    t = e.get("tags", {})
    if t.get("railway") == "subway_entrance":
        kand.append(dict(lat=e["lat"], lon=e["lon"], name=t.get("name"), ref=t.get("ref"), rolli=t.get("wheelchair") == "yes", q="eingang"))
tief = {}
for e in T:
    t = e.get("tags", {})
    if t.get("highway") in ("footway", "corridor") and t.get("level"):
        for l in lv(t["level"]) or []:
            tief.setdefault(l, []).extend((g["lat"], g["lon"]) for g in e["geometry"])
for e in T:
    t = e.get("tags", {})
    L = lv(t.get("level")) if t.get("highway") == "steps" else None
    if not L or max(L) != 0 or min(L) >= 0: continue
    a = (e["geometry"][0]["lat"], e["geometry"][0]["lon"]); b = (e["geometry"][-1]["lat"], e["geometry"][-1]["lon"])
    inc = t.get("incline")
    if inc == "up": top = b
    elif inc == "down": top = a
    else:
        lo = tief.get(min(L), [])
        da = min((dist(a, p) for p in lo), default=0); db = min((dist(b, p) for p in lo), default=0)
        top = a if da > db else b
    kand.append(dict(lat=top[0], lon=top[1], name=None, ref=None, rolli=False, q="treppe", roll=bool(t.get("conveying"))))
for e in T:
    t = e.get("tags", {})
    L = lv(t.get("level")) if t.get("highway") == "elevator" else None
    if L and max(L) == 0 and min(L) < 0 and e["type"] == "node":
        kand.append(dict(lat=e["lat"], lon=e["lon"], name="Aufzug", ref=None, rolli=True, q="aufzug"))

def reverse(lat, lon):
    k = f"{lat:.5f},{lon:.5f}"
    if k not in cache:
        url = "https://nominatim.openstreetmap.org/reverse?" + urllib.parse.urlencode(dict(lat=lat, lon=lon, format="json", zoom=17, addressdetails=1))
        r = subprocess.run(["curl", "-sS", "-m", "30", "-A", "ausgangsfinder-demo/1.0", url], capture_output=True, text=True)
        try:
            a = json.loads(r.stdout).get("address", {})
            cache[k] = a.get("road") or a.get("pedestrian") or a.get("square") or a.get("footway") or ""
        except Exception: cache[k] = ""
        json.dump(cache, open(CACHE, "w"), ensure_ascii=False)
        time.sleep(1.05)
    return cache[k]

RICHT = ["Nord", "Nordost", "Ost", "Südost", "Süd", "Südwest", "West", "Nordwest"]
aus = {}
for s in netz["stationen"]:
    c = (s["lat"], s["lon"])
    # nur Kandidaten, die dieser Station am nächsten liegen
    nah = [k for k in kand if dist(c, (k["lat"], k["lon"])) < 300 and
           min(netz["stationen"], key=lambda o: dist((o["lat"], o["lon"]), (k["lat"], k["lon"])))["id"] == s["id"]]
    gruppen = []
    for k in sorted(nah, key=lambda k: {"eingang": 0, "aufzug": 1, "treppe": 2}[k["q"]]):
        for g in gruppen:
            if dist((g["lat"], g["lon"]), (k["lat"], k["lon"])) < 22:
                g["rolli"] = g["rolli"] or k["rolli"]; g["roll"] = g.get("roll") or k.get("roll", False)
                if k["q"] == "aufzug": g["aufzug"] = True
                break
        else:
            gruppen.append(dict(lat=k["lat"], lon=k["lon"], osm=k["name"], ref=k["ref"], rolli=k["rolli"], roll=k.get("roll", False), aufzug=k["q"] == "aufzug"))
    liste = []
    for g in gruppen:
        dy = (g["lat"] - c[0]) * 111132; dx = (g["lon"] - c[1]) * math.cos(math.radians(c[0])) * 111320
        r = RICHT[int(((math.degrees(math.atan2(dx, dy)) + 360 + 22.5) % 360) // 45)]
        strasse = reverse(g["lat"], g["lon"])
        osm = g["osm"] if g["osm"] and g["osm"].lower() not in (s["name"].lower(), "hauptbahnhof", "aufzug") and not g["osm"].startswith("U ") else None
        if g["aufzug"] and not osm: name = f"Aufzug {strasse}".strip()
        else: name = osm or strasse or f"Ausgang {r}"
        liste.append(dict(name=name, seite=r, strasse=strasse, lat=round(g["lat"], 6), lon=round(g["lon"], 6),
                          aufzug=bool(g["aufzug"] or g["rolli"]), rolltreppe=bool(g["roll"])))
    # gleiche Namen durch Himmelsrichtung unterscheiden
    namen = {}
    for a in liste: namen.setdefault(a["name"], []).append(a)
    for n, gl in namen.items():
        if len(gl) > 1:
            for a in gl: a["name"] = f"{n} ({a['seite']})"
    namen = {}
    for a in liste: namen.setdefault(a["name"], []).append(a)
    for n, gl in namen.items():
        for i, a in enumerate(gl[1:], 2): a["name"] = f"{n} {i}"
    for i, a in enumerate(liste): a["id"] = f"{s['id']}-{i}"
    aus[str(s["id"])] = liste
    print(f"{s['name']:28s} {len(liste):2d}  " + " | ".join(a["name"] for a in liste)[:150]); 
json.dump(aus, open(os.path.join(HIER, "..", "src", "data", "ausgaenge.json"), "w"), ensure_ascii=False, indent=0)
print("ohne Zugänge:", [s["name"] for s in netz["stationen"] if not aus[str(s["id"])]])
