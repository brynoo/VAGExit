import React, { Suspense, lazy, useEffect, useState } from "react";
import { station, ausgaenge, GEO_STATIONEN, LINIEN } from "../lib/netz.js";
import { uhrzeit } from "../lib/vag.js";
import { fussweg } from "../lib/fuss.js";
import { distanz, gehMinuten, himmelsrichtung, meterText } from "../lib/geo.js";
import { Icon, Linie, Laden, USymbol, abbiegeIcon } from "./Teile.jsx";

const Karte = lazy(() => import("./Karte.jsx"));

function Fahrt({ leg, nr }) {
  const [auf, setAuf] = useState(false);
  const delta = Math.round((leg.ab - leg.soll) / 60000);
  return (
    <section className="abschnitt-t" style={{ "--spur": LINIEN[leg.linie].farbe }}>
      <header><span className="t-nr">{nr}</span><h3>{nr === 1 ? "Einsteigen" : "Umsteigen"}</h3>
        {leg.wartezeit != null && <span className="t-neben">{leg.wartezeit} min Übergang</span>}</header>
      <div className="t-fahrt">
        <div className="t-zeit"><strong>{uhrzeit(leg.ab)}</strong>{delta > 0 && <small className="spaet">+{delta}</small>}</div>
        <div className="t-ort"><strong>{station(leg.von).name}</strong>
          <span><Linie name={leg.linie} /> Richtung {leg.zielanzeige}{leg.gleis && <> · <b>Gleis {leg.gleis}</b></>}</span></div>
      </div>
      <button className="t-halte" onClick={() => setAuf(!auf)} aria-expanded={auf}>
        {leg.halte.length - 1} {leg.halte.length === 2 ? "Station" : "Stationen"} · {Math.round(leg.dauer / 60)} min <Icon name="weiter" size={14} style={{ transform: auf ? "rotate(90deg)" : "none" }} />
      </button>
      {auf && <ol className="t-liste">{leg.halte.slice(1, -1).map((id) => <li key={id}>{station(id).name}</li>)}</ol>}
      <div className="t-fahrt">
        <div className="t-zeit"><strong>{uhrzeit(leg.an)}</strong></div>
        <div className="t-ort"><strong>{station(leg.bis).name}</strong></div>
      </div>
    </section>
  );
}

export default function Ticket({ plan, verbindung, onZu, on3D }) {
  const { zielStation, ort } = plan;
  const alle = ausgaenge(zielStation.id);
  const [ausgang, setAusgang] = useState(plan.ausgang ?? null);
  const [weg, setWeg] = useState(null);
  const [wegFehler, setWegFehler] = useState(false);
  const hat3D = GEO_STATIONEN.has(zielStation.id);

  useEffect(() => {
    if (!ort || !ausgang) return;
    let aktuell = true;
    setWeg(null); setWegFehler(false);
    fussweg(ausgang, ort).then((w) => aktuell && setWeg(w)).catch(() => aktuell && setWegFehler(true));
    return () => { aktuell = false; };
  }, [ausgang, ort]);

  const legs = verbindung?.legs ?? [];
  const nrAusgang = legs.length + 1;
  const luft = ort && ausgang ? distanz(ausgang, ort) : 0;
  const ankunftFuss = verbindung && weg ? new Date(verbindung.an.getTime() + (weg.sekunden + 90) * 1000) : null;

  return (
    <div className="blatt ticket-blatt">
      <div className="blatt-kopf rot">
        <button className="rund" onClick={onZu} aria-label="Zurück"><Icon name="zurueck" /></button>
        <div className="kopf-titel">
          <strong>{ort?.name ?? zielStation.name}</strong>
          <small>{verbindung ? `${uhrzeit(verbindung.ab)} – ${uhrzeit(ankunftFuss ?? verbindung.an)} · ab ${station(legs[0].von).name}` : `U ${zielStation.name}`}</small>
        </div>
      </div>
      <div className="blatt-inhalt">
        <article className="ticket">
          {legs.map((l, i) => <Fahrt key={i} leg={l} nr={i + 1} />)}

          <section className="abschnitt-t ausgang-t">
            <header><span className="t-nr">{nrAusgang}</span><h3>Aussteigen und Ausgang</h3></header>
            {ausgang ? (
              <>
                <p className="ausgang-name"><USymbol size={26} /> <span><small>Ausgang</small><strong>{ausgang.name}</strong></span></p>
                <p className="ausgang-meta">
                  {ausgang.seite && <span>liegt im {ausgang.seite}en der Station</span>}
                  {ausgang.aufzug && <span className="marke"><Icon name="aufzug" size={14} /> Aufzug</span>}
                  {ausgang.rolltreppe && <span className="marke"><Icon name="rolltreppe" size={14} /> Rolltreppe</span>}
                </p>
              </>
            ) : <p className="hinweis-leise">Wähle unten den Ausgang, der zu deinem Ziel passt.</p>}
            {hat3D && <button className="knopf zweit" onClick={() => on3D(zielStation.id, ausgang?.id)}><Icon name="wuerfel" size={18} /> Station in 3D ansehen</button>}
            <details className="andere" open={!ausgang}>
              <summary>{ausgang ? `Alle ${alle.length} Ausgänge` : `${alle.length} Ausgänge an ${zielStation.name}`}</summary>
              <ul className="liste dicht">
                {alle.map((a) => (
                  <li key={a.id}><button className={`zeile${ausgang?.id === a.id ? " gewaehlt" : ""}`} onClick={() => setAusgang(a)}>
                    <span className="zeile-text"><strong>{a.name}</strong><small>{a.seite}{a.aufzug ? " · Aufzug" : ""}{a.rolltreppe ? " · Rolltreppe" : ""}{ort ? ` · ${meterText(distanz(a, ort))} zum Ziel` : ""}</small></span>
                  </button></li>
                ))}
              </ul>
            </details>
          </section>

          {ort && ausgang && (
            <section className="abschnitt-t fuss-t">
              <header><span className="t-nr">{nrAusgang + 1}</span><h3>Zu Fuß zum Ziel</h3>
                <span className="t-neben">{weg ? `${meterText(weg.meter)} · ${gehMinuten(weg.meter)} min` : `ca. ${meterText(luft * 1.3)}`}</span></header>
              <Suspense fallback={<div className="karte-flaeche" />}><Karte von={ausgang} nach={ort} linie={weg?.linie} /></Suspense>
              {!weg && !wegFehler && <Laden zeilen={3} />}
              {wegFehler && <p className="hinweis-leise"><Icon name="achtung" size={15} /> Wegbeschreibung gerade nicht abrufbar. Luftlinie: {meterText(luft)} Richtung {himmelsrichtung(ausgang, ort)}.</p>}
              {weg && (
                <ol className="schritte">
                  {weg.schritte.map((s, i) => (
                    <li key={i}><span className="schritt-icon"><Icon name={abbiegeIcon(s.mod)} size={18} /></span><span>{s.text}</span><small>{meterText(s.meter)}</small></li>
                  ))}
                  <li className="ankunft"><span className="schritt-icon"><Icon name="pin" size={18} /></span><span><strong>{ort.name}</strong></span>{ankunftFuss && <small>an {uhrzeit(ankunftFuss)}</small>}</li>
                </ol>
              )}
            </section>
          )}
        </article>
        <p className="fussnote">Fahrzeiten zwischen Stationen sind aus echten VAG-Fahrten gemittelt; die Abfahrt ist Echtzeit. Fußweg: OSRM / OpenStreetMap.</p>
      </div>
    </div>
  );
}
