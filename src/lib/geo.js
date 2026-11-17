// Kleine Geo-Helfer (Entfernungen in Metern)
export function distanz(a, b) {
  const kx = Math.cos((a.lat * Math.PI) / 180) * 111320;
  return Math.hypot((a.lon - b.lon) * kx, (a.lat - b.lat) * 111132);
}
const RICHTUNGEN = ["Norden", "Nordosten", "Osten", "Südosten", "Süden", "Südwesten", "Westen", "Nordwesten"];
export function himmelsrichtung(von, nach) {
  const kx = Math.cos((von.lat * Math.PI) / 180);
  const w = (Math.atan2((nach.lon - von.lon) * kx, nach.lat - von.lat) * 180) / Math.PI;
  return RICHTUNGEN[Math.floor(((w + 360 + 22.5) % 360) / 45)];
}
export const gehMinuten = (meter) => Math.max(1, Math.round(meter / 75)); // ca. 4,5 km/h
export function meterText(m) {
  return m < 950 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}
