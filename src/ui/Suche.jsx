import React, { useEffect, useMemo, useRef, useState } from "react";
import { STATIONEN, ZIELE } from "../lib/netz.js";
import { ortssuche } from "../lib/fuss.js";
import { Icon, Linie, USymbol } from "./Teile.jsx";

const fold = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");

// Vollbild-Suche: Stationen, Schnellziele und (optional) freie Adressen
export default function Suche({ titel, nurStationen, onWahl: wahl, onZu: zu }) {
  // Tastatur schließen und Seitenposition zurücksetzen, bevor das Blatt verschwindet
  const raus = () => { document.activeElement?.blur?.(); window.scrollTo(0, 0); };
  const onWahl = (w) => { raus(); wahl(w); };
  const onZu = () => { raus(); zu(); };
  const [text, setText] = useState("");
  const [orte, setOrte] = useState([]);
  const [sucht, setSucht] = useState(false);
  const feld = useRef(null);
  useEffect(() => { feld.current?.focus(); }, []);

  const q = fold(text.trim());
  const stationen = useMemo(() => STATIONEN.filter((s) => !q || fold(s.name).includes(q)), [q]);
  const ziele = useMemo(() => (nurStationen ? [] : ZIELE.filter((z) => !q || fold(z.name).includes(q))), [q, nurStationen]);

  useEffect(() => {
    if (nurStationen || q.length < 3) { setOrte([]); return; }
    let aktuell = true;
    setSucht(true);
    const t = setTimeout(() => {
      ortssuche(text.trim()).then((o) => aktuell && setOrte(o)).catch(() => aktuell && setOrte([])).finally(() => aktuell && setSucht(false));
    }, 350);
    return () => { aktuell = false; clearTimeout(t); };
  }, [text, nurStationen]);

  return (
    <div className="blatt" role="dialog" aria-label={titel}>
      <div className="blatt-kopf">
        <button className="rund" onClick={onZu} aria-label="Schließen"><Icon name="zurueck" /></button>
        <div className="suchfeld">
          <Icon name="suche" size={18} />
          <input ref={feld} value={text} onChange={(e) => setText(e.target.value)} placeholder={nurStationen ? "Station suchen" : "Station, Ort oder Adresse"} enterKeyHint="search" autoComplete="off" autoCorrect="off" />
          {text && <button className="rund klein" onClick={() => setText("")} aria-label="Eingabe löschen"><Icon name="x" size={16} /></button>}
        </div>
      </div>
      <div className="blatt-inhalt">
        {ziele.length > 0 && (
          <section>
            <h3 className="gruppe">Orte und Sehenswürdigkeiten</h3>
            <ul className="liste">
              {ziele.map((z) => (
                <li key={z.id}><button className="zeile" onClick={() => onWahl({ art: "ziel", ...z })}>
                  <span className="zeile-icon ort"><Icon name="pin" size={18} /></span>
                  <span className="zeile-text"><strong>{z.name}</strong><small>{z.text}</small></span>
                </button></li>
              ))}
            </ul>
          </section>
        )}
        {orte.length > 0 && (
          <section>
            <h3 className="gruppe">Adressen</h3>
            <ul className="liste">
              {orte.map((o) => (
                <li key={o.id}><button className="zeile" onClick={() => onWahl(o)}>
                  <span className="zeile-icon ort"><Icon name="pin" size={18} /></span>
                  <span className="zeile-text"><strong>{o.name}</strong><small>{o.text}</small></span>
                </button></li>
              ))}
            </ul>
          </section>
        )}
        {sucht && <p className="hinweis-leise">Suche Adressen …</p>}
        <section>
          <h3 className="gruppe">U-Bahn-Stationen</h3>
          {stationen.length === 0 && <p className="hinweis-leise">Keine Station mit „{text}“. Prüfe die Schreibweise oder suche nach einer Adresse.</p>}
          <ul className="liste">
            {stationen.map((s) => (
              <li key={s.id}><button className="zeile" onClick={() => onWahl({ art: "station", id: s.id, name: s.name, lat: s.lat, lon: s.lon })}>
                <span className="zeile-icon"><USymbol /></span>
                <span className="zeile-text"><strong>{s.name}</strong></span>
                <span className="zeile-linien">{s.linien.map((l) => <Linie key={l} name={l} klein />)}</span>
              </button></li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
