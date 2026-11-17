import React, { useEffect, useState } from "react";
import { abfahrten, inMinuten, uhrzeit, verspaetung } from "../lib/vag.js";
import { Icon, Linie, Laden } from "./Teile.jsx";

export function useAbfahrten(stationId, intervall = 20000) {
  const [daten, setDaten] = useState({ liste: null, fehler: null, stand: null });
  useEffect(() => {
    if (!stationId) return;
    let aktuell = true;
    setDaten({ liste: null, fehler: null, stand: null });
    const lade = () => abfahrten(stationId, { spanne: 45, limit: 30 })
      .then((l) => aktuell && setDaten({ liste: l, fehler: null, stand: new Date() }))
      .catch((e) => aktuell && setDaten((d) => ({ ...d, fehler: e.message })));
    lade();
    const t = setInterval(lade, intervall);
    return () => { aktuell = false; clearInterval(t); };
  }, [stationId, intervall]);
  return daten;
}

export function Abfahrtsliste({ stationId, max = 12 }) {
  const { liste, fehler, stand } = useAbfahrten(stationId);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 10000); return () => clearInterval(t); }, []);
  if (!liste && !fehler) return <Laden zeilen={5} />;
  if (!liste) return <p className="hinweis-leise"><Icon name="achtung" size={15} /> Abfahrten gerade nicht abrufbar ({fehler}). Wird automatisch erneut versucht.</p>;
  if (!liste.length) return <p className="hinweis-leise">In den nächsten 45 Minuten fährt hier keine U-Bahn.</p>;
  return (
    <>
      <ul className="tafel">
        {liste.slice(0, max).map((a) => {
          const v = verspaetung(a);
          return (
            <li key={a.fahrt + a.haltepunkt}>
              <Linie name={a.linie} />
              <span className="tafel-ziel">{a.ziel}<small>Gleis {a.gleis} · {uhrzeit(a.soll)}{v > 0 && <b className="spaet"> +{v}</b>}</small></span>
              <strong className="tafel-min">{inMinuten(a.ist)}</strong>
            </li>
          );
        })}
      </ul>
      <p className="fussnote"><span className="puls" /> Echtzeit der VAG, Stand {stand && uhrzeit(stand)}</p>
    </>
  );
}
