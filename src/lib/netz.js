import netz from "../data/netz.json";
import ausgaengeRoh from "../data/ausgaenge.json";
import ziele from "../data/ziele.json";
import geoListe from "../data/geo_stationen.json";
import { distanz } from "./geo.js";

export const LINIEN = netz.linien;
export const STATIONEN = netz.stationen;
export const ZIELE = ziele;
export const DATENSTAND = netz.stand;
export const GEO_STATIONEN = new Set(geoListe); // Stationen mit 3D-Modell (osm/generiere_alle.py)
const nachId = new Map(STATIONEN.map((s) => [s.id, s]));
export const station = (id) => nachId.get(Number(id));

export function ausgaenge(id) {
  const liste = ausgaengeRoh[String(id)] ?? [];
  if (liste.length) return liste;
  const s = station(id);
  return [{ id: `${id}-0`, name: "Ausgang", seite: "", strasse: "", lat: s.lat, lon: s.lon, aufzug: false, rolltreppe: false, ungenau: true }];
}

const UMSTIEG = 240; // Sekunden Fußweg beim Umsteigen

// Kürzeste Verbindung: Dijkstra über Zustände (Station, Linie)
export function route(vonId, nachId_) {
  vonId = Number(vonId); nachId_ = Number(nachId_);
  if (vonId === nachId_) return { legs: [], dauer: 0 };
  const key = (s, l) => `${s}|${l}`;
  const dist = new Map(), vor = new Map(), offen = [];
  for (const l of station(vonId).linien) { dist.set(key(vonId, l), 0); offen.push([0, vonId, l]); }
  let ende = null;
  while (offen.length) {
    offen.sort((a, b) => a[0] - b[0]);
    const [d, s, l] = offen.shift();
    if (d > (dist.get(key(s, l)) ?? Infinity)) continue;
    if (s === nachId_) { ende = key(s, l); break; }
    const L = LINIEN[l], i = L.halte.indexOf(s);
    const nachbarn = [];
    if (i > 0) nachbarn.push([L.halte[i - 1], l, L.zeiten[i - 1]]);
    if (i < L.halte.length - 1) nachbarn.push([L.halte[i + 1], l, L.zeiten[i]]);
    for (const l2 of station(s).linien) if (l2 !== l) nachbarn.push([s, l2, UMSTIEG]);
    for (const [s2, l2, w] of nachbarn) {
      const k = key(s2, l2), nd = d + w;
      if (nd < (dist.get(k) ?? Infinity)) { dist.set(k, nd); vor.set(k, key(s, l)); offen.push([nd, s2, l2]); }
    }
  }
  if (!ende) return null;
  const pfad = [];
  for (let k = ende; k; k = vor.get(k)) pfad.unshift(k.split("|"));
  const legs = [];
  for (const [sid, l] of pfad) {
    const s = Number(sid), letztes = legs[legs.length - 1];
    if (letztes && letztes.linie === l) letztes.halte.push(s);
    else legs.push({ linie: l, halte: [s] });
  }
  const fertig = legs.filter((g) => g.halte.length > 1).map((g) => beinDaten(g.linie, g.halte[0], g.halte[g.halte.length - 1]));
  return { legs: fertig, dauer: fertig.reduce((a, g) => a + g.dauer, 0) + (fertig.length - 1) * UMSTIEG };
}

function beinDaten(linie, von, bis) {
  const L = LINIEN[linie], a = L.halte.indexOf(von), b = L.halte.indexOf(bis);
  const vorwaerts = b > a, lo = Math.min(a, b), hi = Math.max(a, b);
  const halte = L.halte.slice(lo, hi + 1);
  if (!vorwaerts) halte.reverse();
  const dauer = L.zeiten.slice(lo, hi).reduce((x, y) => x + y, 0);
  // Linien, die dieselbe Strecke genauso fahren (U2/U3 auf der Stammstrecke)
  const linien = Object.keys(LINIEN).filter((n) => {
    const h = LINIEN[n].halte, x = h.indexOf(von), y = h.indexOf(bis);
    return x >= 0 && y >= 0 && Math.abs(y - x) === hi - lo;
  });
  return { linie, linien, von, bis, halte, dauer, richtung: vorwaerts ? "Richtung1" : "Richtung2", ziel: vorwaerts ? L.ziel1 : L.ziel2 };
}

const norm = (t) => t.toLowerCase().replace(/fürth|nürnberg|[^a-zäöüß]/g, "").slice(0, 7);
// Fährt ein Zug mit dieser Zielanzeige mindestens bis zur gewünschten Station?
export function faehrtBis(linie, richtung, zieltext, bisId) {
  const L = LINIEN[linie];
  if (!L) return false;
  const n = norm(zieltext);
  const endIdx = L.halte.findIndex((id) => norm(station(id).name) === n || norm(station(id).name).startsWith(n) || n.startsWith(norm(station(id).name)));
  if (endIdx < 0) return true; // unbekannte Zielanzeige: nicht ausschließen
  const b = L.halte.indexOf(Number(bisId));
  return richtung === "Richtung1" ? endIdx >= b : endIdx <= b;
}

export function naechsteStationen(ort, n = 3) {
  return [...STATIONEN].map((s) => ({ s, d: distanz(ort, s) })).sort((a, b) => a.d - b.d).slice(0, n);
}
export function besterAusgang(stationId, ort) {
  return ausgaenge(stationId).map((a) => ({ a, d: distanz(a, ort) })).sort((x, y) => x.d - y.d)[0];
}
// Beste Zielstation für einen Ort: Fahrzeit + Fußweg
export function planeZuOrt(vonId, ort) {
  let best = null;
  for (const { s } of naechsteStationen(ort, 4)) {
    const r = s.id === Number(vonId) ? { legs: [], dauer: 0 } : route(vonId, s.id);
    if (!r) continue;
    const { a, d } = besterAusgang(s.id, ort);
    const gesamt = r.dauer + (d * 1.3) / 1.25;
    if (!best || gesamt < best.gesamt) best = { gesamt, route: r, zielStation: s, ausgang: a, luftlinie: d };
  }
  return best;
}
