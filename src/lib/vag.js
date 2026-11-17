// Offene Echtzeit-Schnittstelle der VAG (https://start.vag.de/dm/) – keine Anmeldung nötig.
const BASIS = "https://start.vag.de/dm/api/v1";

export async function abfahrten(stationId, { verzoegerung = 0, spanne = 60, limit = 40 } = {}) {
  const u = `${BASIS}/abfahrten/VGN/${stationId}?product=UBahn&timespan=${spanne}&timedelay=${Math.max(0, Math.round(verzoegerung))}&limitcount=${limit}`;
  const r = await fetch(u);
  if (!r.ok) throw new Error(`VAG-Schnittstelle antwortet mit ${r.status}`);
  const d = await r.json();
  return (d.Abfahrten ?? []).map((a) => ({
    linie: a.Linienname,
    richtung: a.Richtung,
    ziel: a.Richtungstext,
    soll: new Date(a.AbfahrtszeitSoll),
    ist: new Date(a.AbfahrtszeitIst ?? a.AbfahrtszeitSoll),
    gleis: a.HaltesteigText ?? "",
    haltepunkt: a.Haltepunkt,
    lat: a.Latitude, lon: a.Longitude,
    fahrt: a.Fahrtnummer,
    prognose: !!a.Prognose,
  })).sort((x, y) => x.ist - y.ist);
}

export const uhrzeit = (d) => d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
export const verspaetung = (a) => Math.round((a.ist - a.soll) / 60000);
export function inMinuten(d, jetzt = new Date()) {
  const m = Math.round((d - jetzt) / 60000);
  return m <= 0 ? "sofort" : `${m} min`;
}
