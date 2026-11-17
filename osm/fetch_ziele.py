#!/usr/bin/env python3
"""Koordinaten der Schnellziele über Nominatim (OpenStreetMap) nachschlagen."""
import json, os, subprocess, time, urllib.parse
HIER = os.path.dirname(os.path.abspath(__file__))
ZIELE = [
  # id, Anzeigename, Suchbegriff, Gruppe, Kurzbeschreibung
  ("hbf", "Hauptbahnhof", "Nürnberg Hauptbahnhof", "schnell", "Fern- und Regionalzüge, S-Bahn"),
  ("innenstadt", "Innenstadt", "Hauptmarkt, Nürnberg", "schnell", "Hauptmarkt, mitten in der Altstadt"),
  ("flughafen", "Flughafen", "Albrecht Dürer Airport Nürnberg Terminal", "schnell", "Terminal, Abflug und Ankunft"),
  ("messe", "Messe", "NürnbergMesse Eingang Mitte", "schnell", "NürnbergMesse, Eingang Mitte"),
  ("frauenkirche", "Frauenkirche", "Frauenkirche, Hauptmarkt, Nürnberg", "sehen", "Gotische Kirche am Hauptmarkt, Männleinlaufen um 12 Uhr"),
  ("brunnen", "Schöner Brunnen", "Schöner Brunnen, Nürnberg", "sehen", "Goldener Brunnen am Hauptmarkt"),
  ("burg", "Kaiserburg", "Kaiserburg Nürnberg", "sehen", "Wahrzeichen über der Altstadt"),
  ("lorenz", "Lorenzkirche", "St. Lorenz, Nürnberg", "sehen", "Große gotische Kirche in der Fußgängerzone"),
  ("sebald", "Sebalduskirche", "St. Sebald, Nürnberg", "sehen", "Älteste Pfarrkirche der Stadt"),
  ("duerer", "Albrecht-Dürer-Haus", "Albrecht-Dürer-Haus, Nürnberg", "sehen", "Wohnhaus des Malers unterhalb der Burg"),
  ("gnm", "Germanisches Nationalmuseum", "Germanisches Nationalmuseum, Nürnberg", "sehen", "Größtes kulturgeschichtliches Museum im deutschen Sprachraum"),
  ("handwerkerhof", "Handwerkerhof", "Handwerkerhof, Nürnberg", "sehen", "Kleine Fachwerkgasse am Königstor"),
  ("weissgerber", "Weißgerbergasse", "Weißgerbergasse, Nürnberg", "sehen", "Fachwerkhäuser, schönste Gasse der Altstadt"),
  ("henkersteg", "Henkersteg", "Henkersteg, Nürnberg", "sehen", "Holzbrücke über die Pegnitz"),
  ("spielzeug", "Spielzeugmuseum", "Spielzeugmuseum, Nürnberg", "sehen", "Spielzeug aus sechs Jahrhunderten"),
  ("dbmuseum", "DB Museum", "DB Museum, Nürnberg", "sehen", "Eisenbahngeschichte, Adler-Lokomotive"),
  ("neuesmuseum", "Neues Museum", "Neues Museum Nürnberg", "sehen", "Kunst und Design der Gegenwart"),
  ("memorium", "Memorium Nürnberger Prozesse", "Memorium Nürnberger Prozesse", "sehen", "Saal 600 im Justizpalast"),
  ("oper", "Opernhaus", "Opernhaus, Nürnberg", "sehen", "Staatstheater Nürnberg"),
  ("woehrdersee", "Wöhrder See", "Wöhrder See, Nürnberg", "sehen", "Stadtsee mit Uferweg und Strand"),
]
aus = []
for zid, name, such, gruppe, text in ZIELE:
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(dict(q=such, format="json", limit=1, viewbox="10.93,49.51,11.16,49.38", bounded=1))
    r = subprocess.run(["curl", "-sS", "-m", "30", "-A", "ausgangsfinder-demo/1.0", url], capture_output=True, text=True)
    try:
        t = json.loads(r.stdout)[0]
        aus.append(dict(id=zid, name=name, gruppe=gruppe, text=text, lat=round(float(t["lat"]), 6), lon=round(float(t["lon"]), 6)))
        print("ok ", name, t["lat"], t["lon"], "|", t["display_name"][:70])
    except Exception as e:
        print("FEHLT", name, r.stdout[:80])
    time.sleep(1.1)
json.dump(aus, open(os.path.join(HIER, "..", "src", "data", "ziele.json"), "w"), ensure_ascii=False, indent=1)
