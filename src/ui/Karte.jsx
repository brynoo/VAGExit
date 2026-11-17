import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const punkt = (klasse, text) => L.divIcon({ className: "", html: `<span class="kartenpunkt ${klasse}">${text}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] });

// Karte für die letzten Meter: Ausgang → Ziel
export default function Karte({ von, nach, linie }) {
  const el = useRef(null);
  useEffect(() => {
    const karte = L.map(el.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(karte);
    const pfad = linie?.length ? linie : [[von.lat, von.lon], [nach.lat, nach.lon]];
    L.polyline(pfad, { color: "#fff", weight: 9, opacity: 0.9 }).addTo(karte);
    L.polyline(pfad, { color: "#e3000f", weight: 5, dashArray: linie?.length ? null : "2 10", lineCap: "round" }).addTo(karte);
    L.marker([von.lat, von.lon], { icon: punkt("u", "U") }).addTo(karte);
    L.marker([nach.lat, nach.lon], { icon: punkt("ziel", "") }).addTo(karte);
    karte.fitBounds(L.latLngBounds(pfad).pad(0.25));
    return () => karte.remove();
  }, [von, nach, linie]);
  return <div ref={el} className="karte-flaeche" aria-label="Karte des Fußwegs" />;
}
