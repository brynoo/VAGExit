import React, { useEffect, useRef, useState } from "react";
import { station, ausgaenge, LINIEN } from "../lib/netz.js";
import { StationsSzene } from "../three/szene.js";
import { useAbfahrten } from "./Abfahrten.jsx";
import { Icon, Linie } from "./Teile.jsx";
import { inMinuten } from "../lib/vag.js";

export default function Station3D({ id, ausgangId, onZu }) {
  const s = station(id);
  const canvas = useRef(null);
  const szene = useRef(null);
  const [geo, setGeo] = useState(null);
  const [fehler, setFehler] = useState(false);
  const [aktiv, setAktiv] = useState(ausgangId ?? null);
  const [gebaeude, setGebaeude] = useState(true);
  const { liste } = useAbfahrten(id, 15000);

  useEffect(() => {
    fetch(`/geo/${id}.json`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setGeo).catch(() => setFehler(true));
  }, [id]);

  const lokal = (p) => {
    const [lat0, lon0] = geo.mitte;
    return { x: (p.lon - lon0) * Math.cos((lat0 * Math.PI) / 180) * 111320, z: -(p.lat - lat0) * 111132 };
  };

  useEffect(() => {
    if (!geo || !canvas.current) return;
    const sz = new StationsSzene(canvas.current);
    sz.aufbauen({ id: String(id), name: s.name, geo, zugaenge: ausgaenge(id).map((a) => ({ ...a, ...lokal(a) })) });
    sz.hervorheben(aktiv);
    szene.current = sz;
    window.__szene = sz; // für Fehlersuche in der Konsole
    return () => { sz.dispose(); szene.current = null; };
  }, [geo]);

  useEffect(() => { szene.current?.hervorheben(aktiv); }, [aktiv]);
  useEffect(() => { if (szene.current) szene.current.gebaeudeAus = !gebaeude; }, [gebaeude, geo]);
  useEffect(() => {
    if (!geo || !liste || !szene.current) return;
    const hier = lokal(s);
    szene.current.setAbfahrten(liste.map((d) => {
      // Richtung zur nächsten Station dieser Fahrt (an der Endstation: weg von der vorigen)
      const h = LINIEN[d.linie]?.halte ?? [], i = h.indexOf(id), schritt = d.richtung === "Richtung1" ? 1 : -1;
      let dx = 0, dz = 0;
      const naechste = station(h[i + schritt]), vorige = station(h[i - schritt]);
      if (naechste) { const n = lokal(naechste); dx = n.x - hier.x; dz = n.z - hier.z; }
      else if (vorige) { const v = lokal(vorige); dx = hier.x - v.x; dz = hier.z - v.z; }
      return { linie: d.linie, ziel: d.ziel, ist: d.ist.getTime(), haltepunkt: d.haltepunkt, dx, dz, kopf: !vorige, ...lokal(d) };
    }));
  }, [liste, geo]);

  const naechste = liste?.[0];
  return (
    <div className="blatt drei">
      <div className="blatt-kopf rot">
        <button className="rund" onClick={onZu} aria-label="Zurück"><Icon name="zurueck" /></button>
        <div className="kopf-titel"><strong>{s.name}</strong><small>3D-Ansicht · Züge nach Echtzeit-Abfahrten</small></div>
      </div>
      <div className="drei-flaeche">
        {!geo && !fehler && <p className="drei-status">Lade Stationsmodell …</p>}
        {fehler && <p className="drei-status">Das 3D-Modell konnte nicht geladen werden.</p>}
        <canvas ref={canvas} />
        {liste?.length > 0 && (
          <ul className="drei-tafel" aria-label="Nächste Abfahrten">
            {liste.slice(0, 4).map((a) => (
              <li key={a.fahrt + a.haltepunkt}><Linie name={a.linie} klein /><span>{a.ziel}</span><small>Gl. {a.gleis}</small><b>{inMinuten(a.ist)}</b></li>
            ))}
          </ul>
        )}
        <button className={`drei-schalter${gebaeude ? "" : " aus"}`} onClick={() => setGebaeude(!gebaeude)} aria-pressed={!gebaeude}>
          {gebaeude ? "Gebäude ausblenden" : "Gebäude einblenden"}
        </button>
        <p className="drei-hinweis">Ziehen zum Drehen, mit zwei Fingern zoomen. Die Station liegt unter der durchsichtigen Straßenebene.</p>
      </div>
      <div className="drei-leiste">
        <div className="chips" role="group" aria-label="Ausgang hervorheben">
          {ausgaenge(id).map((a) => (
            <button key={a.id} className={aktiv === a.id ? "an" : ""} onClick={() => setAktiv(aktiv === a.id ? null : a.id)}>{a.name}</button>
          ))}
        </div>
        <p className="fussnote">{naechste ? <><span className="puls" /> Nächste Abfahrt: {naechste.linie} Richtung {naechste.ziel}, Gleis {naechste.gleis}</> : "Warte auf Abfahrtsdaten …"} · Geometrie © OpenStreetMap-Mitwirkende, Ebenenhöhen geschätzt.</p>
      </div>
    </div>
  );
}
