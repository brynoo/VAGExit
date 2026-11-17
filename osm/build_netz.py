#!/usr/bin/env python3
"""Netzdaten (Stationen, Linien, Fahrzeiten) aus echten Fahrtverläufen der VAG-Schnittstelle."""
import json, glob, os, re, datetime as dt
HIER = os.path.dirname(os.path.abspath(__file__))
FARBE = {"U1": "#0b63a8", "U2": "#d6001c", "U3": "#11998e"}

def sauber(name):
    fuerth = "Fürth" in name
    n = re.sub(r"\s*\((Nürnberg|Fürth \(Bayern\)|U-Bahn)\)", "", name).strip()
    n = n.replace("Nürnberg Hbf", "Hauptbahnhof").replace("Nürnberg Rothenburger Straße", "Rothenburger Straße")
    n = n.replace("Nürnberg Nordost", "Nordostbahnhof")
    n = re.sub(r"\s*\(U-Bahn\)", "", n)
    n = re.sub(r"str\.$", "straße", n).replace("Str.", "Straße")
    if fuerth and n in ("Hauptbahnhof", "Rathaus", "Klinikum", "Stadthalle", "Hardhöhe"): n = "Fürth " + n
    return n

def t(h, a="Abfahrt"):
    s = h.get(a + "szeitSoll") or h.get("AnkunftszeitSoll") or h.get("AbfahrtszeitSoll")
    return dt.datetime.fromisoformat(s)

stationen, linien = {}, {}
for f in sorted(glob.glob(os.path.join(HIER, "vag", "fahrt_*.json"))):
    d = json.load(open(f))
    v = d["Fahrtverlauf"]
    L, R = d["Linienname"], d["Richtung"]
    for h in v:
        s = stationen.setdefault(h["VGNKennung"], dict(id=h["VGNKennung"], kuerzel=h["VAGKennung"], name=sauber(h["Haltestellenname"]),
                                                       lat=[], lon=[], linien=[], fuerth="Fürth" in h["Haltestellenname"]))
        s["lat"].append(h["Latitude"]); s["lon"].append(h["Longitude"])
        if L not in s["linien"]: s["linien"].append(L)
    zeiten = [max(45, round((t(v[i + 1], "Ankunft") - t(v[i]) ).total_seconds())) for i in range(len(v) - 1)]
    linien.setdefault(L, {})[R] = dict(halte=[h["VGNKennung"] for h in v], zeiten=zeiten, ziel=sauber(v[-1]["Haltestellenname"]))

netz = dict(linien={}, stationen=[])
for L, r in sorted(linien.items()):
    r1, r2 = r["Richtung1"], r["Richtung2"]
    assert r1["halte"] == r2["halte"][::-1], L
    # Mittel aus beiden Richtungen
    z = [round((a + b) / 2) for a, b in zip(r1["zeiten"], r2["zeiten"][::-1])]
    netz["linien"][L] = dict(farbe=FARBE[L], halte=r1["halte"], zeiten=z, ziel1=r1["ziel"], ziel2=r2["ziel"])
for s in stationen.values():
    s["lat"] = round(sum(s["lat"]) / len(s["lat"]), 6); s["lon"] = round(sum(s["lon"]) / len(s["lon"]), 6)
    s["linien"].sort()
    netz["stationen"].append(s)
netz["stationen"].sort(key=lambda s: s["name"])
netz["stand"] = dt.date.today().isoformat()
json.dump(netz, open(os.path.join(HIER, "..", "src", "data", "netz.json"), "w"), ensure_ascii=False, indent=1)
print(len(netz["stationen"]), "Stationen;", {L: (len(v["halte"]), round(sum(v["zeiten"]) / 60, 1)) for L, v in netz["linien"].items()})
print(", ".join(s["name"] for s in netz["stationen"]))
