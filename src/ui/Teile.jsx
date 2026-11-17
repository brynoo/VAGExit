import React from "react";
import { LINIEN } from "../lib/netz.js";

const P = {
  tausch: "M7 4v13m0 0-3-3m3 3 3-3M17 20V7m0 0-3 3m3-3 3 3",
  uhr: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  pin: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.500C5 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  fuss: "M13 5.500a1.500 1.500 0 1 0 0-3 1.500 1.500 0 0 0 0 3ZM9 21l2-6-2.500-2.500L10 8l3 1 2 3 3 1M8 10l2-2M13 15l2 6",
  aufzug: "M5 3h14v18H5zM9 9l3-3 3 3M9 15l3 3 3-3",
  rolltreppe: "M3 19h5l8-12h5M14 4.500a1.500 1.500 0 1 0 0-3 1.500 1.500 0 0 0 0 3Z",
  zurueck: "M15 5l-7 7 7 7",
  weiter: "M9 5l7 7-7 7",
  suche: "M21 21l-4.500-4.500M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  x: "M6 6l12 12M18 6 6 18",
  wuerfel: "M12 3 4 7.500v9L12 21l8-4.500v-9L12 3Zm0 9 8-4.500M12 12 4 7.500M12 12v9",
  zug: "M7 3h10a2 2 0 0 1 2 2v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2ZM5 11h14M9 15h.01M15 15h.01M8 18l-2 3M16 18l2 3",
  liste: "M8 6h13M8 12h13M8 18h13M3.500 6h.01M3.500 12h.01M3.500 18h.01",
  route: "M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8 17h6a4 4 0 0 0 0-8h-4a2 2 0 0 1 0-4h6",
  info: "M12 11v6M12 7.500h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  links: "M19 19v-6a4 4 0 0 0-4-4H5m0 0 4-4M5 9l4 4",
  rechts: "M5 19v-6a4 4 0 0 1 4-4h10m0 0-4-4m4 4-4 4",
  gerade: "M12 20V5m0 0-5 5m5-5 5 5",
  start: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  achtung: "M12 9v4m0 3.500h.01M10.300 4 2.600 17.500A2 2 0 0 0 4.300 20.500h15.400a2 2 0 0 0 1.700-3L13.700 4a2 2 0 0 0-3.400 0Z",
};
export function Icon({ name, size = 20, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.900" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={P[name]} />
    </svg>
  );
}
export const abbiegeIcon = (mod) => (mod === "start" ? "start" : /left/.test(mod) ? "links" : /right/.test(mod) ? "rechts" : "gerade");

export function Linie({ name, klein }) {
  return <span className={`linie${klein ? " linie-klein" : ""}`} style={{ background: LINIEN[name]?.farbe ?? "#555" }}>{name}</span>;
}
export function USymbol({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="U-Bahn" role="img">
      <rect width="24" height="24" rx="3" fill="#0b63a8" />
      <path d="M7 5v8.200c0 3.300 2 5.300 5 5.300s5-2 5-5.300V5h-3.200v8.300c0 1.500-.600 2.300-1.800 2.300s-1.800-.800-1.800-2.300V5z" fill="#fff" />
    </svg>
  );
}
export function Laden({ zeilen = 3 }) {
  return <div className="skelett" aria-busy="true" aria-label="Lädt">{Array.from({ length: zeilen }, (_, i) => <div key={i} className="skelett-zeile" />)}</div>;
}
