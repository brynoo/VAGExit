import React, { useState } from "react";
import { STATIONEN, station, ausgaenge, GEO_STATIONEN } from "../lib/netz.js";
import { Icon, Linie, USymbol } from "./Teile.jsx";
import { Abfahrtsliste } from "./Abfahrten.jsx";

const fold = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function Stationsliste({ onWahl }) {
  const [text, setText] = useState("");
  const liste = STATIONEN.filter((s) => fold(s.name).includes(fold(text.trim())));
  return (
    <div className="seite">
      <div className="suchfeld frei">
        <Icon name="suche" size={18} />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Station suchen" autoComplete="off" />
      </div>
      {liste.length === 0 && <p className="hinweis-leise">Keine Station mit „{text}“.</p>}
      <ul className="liste">
        {liste.map((s) => (
          <li key={s.id}><button className="zeile" onClick={() => onWahl(s.id)}>
            <span className="zeile-icon"><USymbol /></span>
            <span className="zeile-text"><strong>{s.name}</strong><small>{ausgaenge(s.id).length} Ausgänge{GEO_STATIONEN.has(s.id) ? " · 3D-Ansicht" : ""}</small></span>
            <span className="zeile-linien">{s.linien.map((l) => <Linie key={l} name={l} klein />)}</span>
          </button></li>
        ))}
      </ul>
    </div>
  );
}

export function StationDetail({ id, onZu, on3D, onHin }) {
  const s = station(id);
  const [reiter, setReiter] = useState("abfahrten");
  return (
    <div className="blatt">
      <div className="blatt-kopf rot">
        <button className="rund" onClick={onZu} aria-label="Zurück"><Icon name="zurueck" /></button>
        <div className="kopf-titel"><strong>{s.name}</strong><small>{s.linien.join(" · ")}</small></div>
      </div>
      <div className="blatt-inhalt">
        <div className="aktionen">
          <button className="knopf" onClick={() => onHin(s)}><Icon name="route" size={18} /> Hierhin fahren</button>
          {GEO_STATIONEN.has(s.id) && <button className="knopf zweit" onClick={() => on3D(s.id)}><Icon name="wuerfel" size={18} /> 3D-Ansicht</button>}
        </div>
        <div className="reiter" role="tablist">
          <button role="tab" aria-selected={reiter === "abfahrten"} onClick={() => setReiter("abfahrten")}>Abfahrten</button>
          <button role="tab" aria-selected={reiter === "ausgaenge"} onClick={() => setReiter("ausgaenge")}>Ausgänge</button>
        </div>
        {reiter === "abfahrten" ? <Abfahrtsliste stationId={s.id} /> : (
          <ul className="liste dicht">
            {ausgaenge(s.id).map((a) => (
              <li key={a.id}><div className="zeile statisch">
                <span className="zeile-icon"><USymbol size={18} /></span>
                <span className="zeile-text"><strong>{a.name}</strong><small>{a.seite && `${a.seite}seite`}{a.aufzug ? " · Aufzug" : ""}{a.rolltreppe ? " · Rolltreppe" : ""}</small></span>
              </div></li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
