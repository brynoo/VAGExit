#!/usr/bin/env python3
"""Lädt OSM-Rohdaten (Umfeld + Innenraum) für einzelne Stationen: fetch_station.py <VGN-ID> ..."""
import json, os, subprocess, sys, time
HIER = os.path.dirname(os.path.abspath(__file__))
os.makedirs(os.path.join(HIER, "raw"), exist_ok=True)
netz = json.load(open(os.path.join(HIER, "..", "src", "data", "netz.json")))
ST = {s["id"]: s for s in netz["stationen"]}
HOSTS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]
for sid in map(int, sys.argv[1:]):
    s = ST[sid]
    ziel = os.path.join(HIER, "raw", f"station_{sid}.json")
    if os.path.exists(ziel) and os.path.getsize(ziel) > 50000: print("vorhanden", s["name"]); continue
    B = f"({s['lat']-0.0030:.5f},{s['lon']-0.0046:.5f},{s['lat']+0.0030:.5f},{s['lon']+0.0046:.5f})"
    q = f"""[out:json][timeout:120];
(
  way["building"]{B}; relation["building"]{B};
  way["highway"~"^(primary|secondary|tertiary|residential|pedestrian|unclassified|living_street|service|primary_link|secondary_link|tertiary_link)$"]{B};
  way["railway"~"^(tram|rail|subway)$"]{B};
  way["leisure"~"^(park|garden)$"]{B}; way["landuse"~"^(grass|village_green)$"]{B};
  way["natural"="water"]{B}; relation["natural"="water"]{B};
  way["barrier"="city_wall"]{B}; way["historic"="city_wall"]{B};
  node["natural"="tree"]{B};
  node["railway"="subway_entrance"]{B};
  nwr["railway"="platform"]{B};
  way["highway"="steps"]{B};
  way["highway"~"^(footway|corridor)$"]["level"]{B};
  nwr["highway"="elevator"]{B};
  way["indoor"~"^(room|area|corridor)$"]{B};
);
out body geom;"""
    open(ziel + ".q", "w").write(q)
    warte = 10
    for v in range(10):
        host = HOSTS[v % 2]
        subprocess.run(["curl", "-sS", "-m", "150", "-A", "ausgangsfinder-demo/1.0", "--data-urlencode", "data@" + ziel + ".q", host, "-o", ziel + ".tmp"])
        try:
            d = json.load(open(ziel + ".tmp"))
            if len(d.get("elements", [])) > 50:
                os.replace(ziel + ".tmp", ziel); os.remove(ziel + ".q"); print("ok", s["name"], len(d["elements"])); sys.stdout.flush(); break
        except Exception: pass
        print("  erneut", s["name"], v + 1); sys.stdout.flush(); time.sleep(warte); warte = min(warte * 2, 80)
    else: print("FEHLER", s["name"])
    time.sleep(5)
