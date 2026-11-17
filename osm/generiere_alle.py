#!/usr/bin/env python3
"""Erzeugt die 3D-Geometrie für ALLE U-Bahnhöfe vollautomatisch aus OpenStreetMap.

    python3 osm/generiere_alle.py            # alle Stationen (bereits geladene werden übersprungen)
    python3 osm/generiere_alle.py 510 704    # nur bestimmte VGN-IDs
    python3 osm/generiere_alle.py --neu      # Rohdaten neu laden

Je Station: Overpass-Abfrage (fetch_station.py) -> Umrechnung in lokale Meter (build_geo.py)
-> public/geo/<id>.json. Die Liste der fertigen Stationen landet in src/data/geo_stationen.json,
die App zeigt die 3D-Ansicht dann automatisch an. Danach: npm run build
"""
import json, os, subprocess, sys, time
HIER = os.path.dirname(os.path.abspath(__file__))
WURZEL = os.path.join(HIER, "..")
netz = json.load(open(os.path.join(WURZEL, "src", "data", "netz.json")))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
neu = "--neu" in sys.argv
ids = [int(a) for a in args] or [s["id"] for s in netz["stationen"]]
name = {s["id"]: s["name"] for s in netz["stationen"]}
LISTE = os.path.join(WURZEL, "src", "data", "geo_stationen.json")
fertig = set(json.load(open(LISTE))) if os.path.exists(LISTE) else set()
bericht = []

for n, sid in enumerate(ids, 1):
    roh = os.path.join(HIER, "raw", f"station_{sid}.json")
    if neu and os.path.exists(roh): os.remove(roh)
    geladen = os.path.exists(roh) and os.path.getsize(roh) > 50000
    print(f"[{n}/{len(ids)}] {name[sid]}", flush=True)
    if not geladen:
        subprocess.run([sys.executable, os.path.join(HIER, "fetch_station.py"), str(sid)])
        time.sleep(4)  # öffentlichen Overpass-Server schonen
    if not (os.path.exists(roh) and os.path.getsize(roh) > 50000):
        bericht.append((name[sid], "FEHLER: keine OSM-Daten geladen")); continue
    r = subprocess.run([sys.executable, os.path.join(HIER, "build_geo.py"), str(sid)], capture_output=True, text=True)
    ziel = os.path.join(WURZEL, "public", "geo", f"{sid}.json")
    if r.returncode != 0 or not os.path.exists(ziel):
        bericht.append((name[sid], "FEHLER beim Umrechnen: " + r.stderr.strip()[-200:])); continue
    g = json.load(open(ziel))
    hinweis = []
    if not g["ubahnsteige"]: hinweis.append("kein Bahnsteig in OSM (keine Züge/Tafeln)")
    if not g["treppen"]: hinweis.append("keine Treppen mit Ebenen")
    if not g["ugleise"]: hinweis.append("keine Gleise")
    bericht.append((name[sid], f"{len(g['gebaeude'])} Gebäude, {len(g['ubahnsteige'])} Bahnsteige, {len(g['treppen'])} Treppen, "
                    f"{len(g['wege'])} Gänge, {os.path.getsize(ziel) // 1024} KB" + (" | " + "; ".join(hinweis) if hinweis else "")))
    fertig.add(sid)
    json.dump(sorted(fertig), open(LISTE, "w"))

print("\n=== Bericht ===")
for nm, text in bericht: print(f"{nm:28s} {text}")
print(f"\n{len(fertig)} von {len(netz['stationen'])} Stationen haben ein 3D-Modell. Jetzt: npm run build")
