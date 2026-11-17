// Fußweg über den öffentlichen OSRM-Server des FOSSGIS e.V. (routing.openstreetmap.de)
const ART = {
  "turn": "abbiegen", "new name": "weiter", "depart": "starten", "arrive": "ankommen", "fork": "halten",
  "end of road": "abbiegen", "continue": "weiter", "roundabout": "Kreisverkehr", "notification": "weiter",
};
const WOHIN = {
  "left": "links", "right": "rechts", "slight left": "leicht links", "slight right": "leicht rechts",
  "sharp left": "scharf links", "sharp right": "scharf rechts", "straight": "geradeaus", "uturn": "umkehren",
};

export async function fussweg(von, nach) {
  const u = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${von.lon},${von.lat};${nach.lon},${nach.lat}?steps=true&overview=full&geometries=geojson`;
  const r = await fetch(u);
  if (!r.ok) throw new Error("Fußweg-Dienst nicht erreichbar");
  const d = await r.json();
  if (d.code !== "Ok") throw new Error("Kein Fußweg gefunden");
  const w = d.routes[0];
  // Kurze Namenlos-Stücke zusammenfassen, damit die Anweisungen lesbar bleiben
  const schritte = [];
  for (const s of w.legs[0].steps) {
    const typ = s.maneuver.type, mod = s.maneuver.modifier;
    if (typ === "arrive") continue;
    const letzter = schritte[schritte.length - 1];
    const gleich = letzter && (letzter.strasse === s.name || (!s.name && s.distance < 25));
    if (gleich && typ !== "depart" && (!mod || mod === "straight" || s.distance < 25)) { letzter.meter += s.distance; continue; }
    let text;
    if (typ === "depart") text = s.name ? `Auf ${s.name} starten` : "Vom Ausgang losgehen";
    else if (mod && mod !== "straight") text = `${WOHIN[mod] ?? mod} ${s.name ? `in ${s.name}` : ART[typ] ?? "abbiegen"}`;
    else text = s.name ? `Geradeaus auf ${s.name}` : "Geradeaus weiter";
    schritte.push({ text: text.charAt(0).toUpperCase() + text.slice(1), strasse: s.name, meter: s.distance, mod: typ === "depart" ? "start" : mod ?? "straight" });
  }
  return { meter: w.distance, sekunden: w.duration, linie: w.geometry.coordinates.map(([lon, lat]) => [lat, lon]), schritte };
}

export async function ortssuche(text) {
  const u = `https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&limit=6&lang=de&bbox=10.93,49.38,11.16,49.51`;
  const r = await fetch(u);
  if (!r.ok) return [];
  const d = await r.json();
  const gesehen = new Set();
  return d.features.map((f) => {
    const p = f.properties;
    const name = p.name ?? [p.street, p.housenumber].filter(Boolean).join(" ");
    const zusatz = [p.name ? [p.street, p.housenumber].filter(Boolean).join(" ") : null, p.district ?? p.city].filter(Boolean).join(", ");
    return { art: "ort", id: `ort-${f.geometry.coordinates.join(",")}`, name, text: zusatz, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] };
  }).filter((o) => o.name && !gesehen.has(o.name + o.text) && gesehen.add(o.name + o.text));
}
