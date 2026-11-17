import React, { useEffect, useMemo, useState } from "react";
import { ZIELE, station, route, planeZuOrt, naechsteStationen, besterAusgang } from "../lib/netz.js";
import { verbindungen } from "../lib/verbindung.js";
import { uhrzeit } from "../lib/vag.js";
import { gehMinuten } from "../lib/geo.js";
import { Icon, Linie, Laden, USymbol } from "./Teile.jsx";
import Suche from "./Suche.jsx";

const SCHNELL = ZIELE.filter((z) => z.gruppe === "schnell");
const SEHEN = ZIELE.filter((z) => z.gruppe === "sehen").map((z) => {
  const { s } = naechsteStationen(z, 1)[0];
  const { d } = besterAusgang(s.id, z);
  return { ...z, station: s, minuten: gehMinuten(d * 1.3) };
});

function startzeit(zeit) {
  if (zeit === "jetzt") return new Date();
  const [h, m] = zeit.split(":").map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0);
  if (d < new Date(Date.now() - 5 * 60000)) d.setDate(d.getDate() + 1);
  return d;
}

export default function Planer({ zustand, setZustand, onTicket }) {
  const { von, nach, zeit } = zustand;
  const [suche, setSuche] = useState(null); // "von" | "nach"
  const [ergebnis, setErgebnis] = useState(null);
  const [laedt, setLaedt] = useState(false);
  const [datenschutz, setDatenschutz] = useState(false);

  const plan = useMemo(() => {
    if (!von || !nach) return null;
    if (nach.art === "station") {
      const r = route(von.id, nach.id);
      return r && { route: r, zielStation: station(nach.id), ausgang: null, ort: null };
    }
    const p = planeZuOrt(von.id, nach);
    return p && { route: p.route, zielStation: p.zielStation, ausgang: p.ausgang, ort: nach, luftlinie: p.luftlinie };
  }, [von, nach]);

  useEffect(() => {
    if (!plan) { setErgebnis(null); return; }
    if (!plan.route.legs.length) { setErgebnis([]); return; }
    let aktuell = true;
    setLaedt(true);
    verbindungen(plan.route, startzeit(zeit)).then((v) => { if (aktuell) { setErgebnis(v); setLaedt(false); } });
    return () => { aktuell = false; };
  }, [plan, zeit]);

  const setze = (teil) => setZustand((z) => ({ ...z, ...teil }));
  const tauschbar = von && nach?.art === "station";

  return (
    <div className="seite">
      <section className="planer">
        <div className="felder">
          <button className="feld" onClick={() => setSuche("von")}>
            <span className="feld-punkt start" />
            <span className="feld-text"><small>Von</small><strong>{von?.name ?? "Startstation wählen"}</strong></span>
          </button>
          <button className="feld" onClick={() => setSuche("nach")}>
            <span className="feld-punkt ziel" />
            <span className="feld-text"><small>Nach</small><strong className={nach ? "" : "leer"}>{nach?.name ?? "Station, Ort oder Adresse"}</strong></span>
          </button>
          <button className="tausch" disabled={!tauschbar} aria-label="Start und Ziel tauschen"
            onClick={() => setze({ von: { art: "station", id: nach.id, name: nach.name }, nach: { art: "station", ...von } })}>
            <Icon name="tausch" />
          </button>
        </div>
        <div className="zeitwahl" role="group" aria-label="Abfahrtszeit">
          <button className={zeit === "jetzt" ? "an" : ""} onClick={() => setze({ zeit: "jetzt" })}>Jetzt</button>
          <label className={zeit !== "jetzt" ? "an" : ""}>
            <Icon name="uhr" size={16} /> Abfahrt
            <input type="time" value={zeit === "jetzt" ? uhrzeit(new Date()) : zeit} onChange={(e) => e.target.value && setze({ zeit: e.target.value })} />
          </label>
        </div>
      </section>

      {!nach && (
        <>
          <section>
            <h2 className="abschnitt">Schnell hin</h2>
            <div className="schnell">
              {SCHNELL.map((z) => (
                <button key={z.id} onClick={() => setze({ nach: { art: "ziel", ...z } })}>
                  <strong>{z.name}</strong><small>{z.text}</small>
                </button>
              ))}
            </div>
          </section>
          <section>
            <h2 className="abschnitt">Sehenswürdigkeiten</h2>
            <ul className="liste">
              {SEHEN.map((z) => (
                <li key={z.id}><button className="zeile" onClick={() => setze({ nach: { art: "ziel", ...z } })}>
                  <span className="zeile-icon ort"><Icon name="pin" size={18} /></span>
                  <span className="zeile-text"><strong>{z.name}</strong><small>{z.text}</small></span>
                  <span className="zeile-meta"><USymbol size={14} /> {z.station.name}<br />{z.minuten} min zu Fuß</span>
                </button></li>
              ))}
            </ul>
          </section>
        </>
      )}

      {nach && plan && (
        <section>
          <div className="ergebnis-kopf">
            <h2 className="abschnitt">Verbindungen</h2>
            <button className="text-knopf" onClick={() => setze({ nach: null })}>Ziel ändern</button>
          </div>
          {plan.ort && (
            <p className="ziel-info">
              <USymbol size={16} /> Aussteigen an <strong>{plan.zielStation.name}</strong>, Ausgang <strong>{plan.ausgang.name}</strong>, dann etwa {gehMinuten(plan.luftlinie * 1.3)} min zu Fuß.
            </p>
          )}
          {laedt && <Laden zeilen={3} />}
          {!laedt && ergebnis?.length === 0 && (
            <button className="karte verbindung" onClick={() => onTicket({ plan, verbindung: null })}>
              <div><strong>Du bist schon an der richtigen Station.</strong><small>Ausgang und Fußweg anzeigen</small></div>
              <Icon name="weiter" />
            </button>
          )}
          {!laedt && ergebnis?.map((v, i) => (
            <button key={i} className="karte verbindung" onClick={() => onTicket({ plan, verbindung: v })}>
              <div className="v-zeiten">
                <strong>{uhrzeit(v.ab)}</strong><span className="v-strich" /><strong>{uhrzeit(v.an)}</strong>
                <span className="v-dauer">{Math.round((v.an - v.ab) / 60000)} min</span>
              </div>
              <div className="v-linien">
                {v.legs.map((l, j) => <React.Fragment key={j}>{j > 0 && <Icon name="weiter" size={14} />}<Linie name={l.linie} /></React.Fragment>)}
                <span className="v-text">
                  {v.legs.length === 1 ? "ohne Umstieg" : `Umstieg ${station(v.legs[1].von).name}`}
                  {v.legs[0].gleis && ` · Gleis ${v.legs[0].gleis}`}
                </span>
              </div>
              {!v.echtzeit && <div className="v-warn"><Icon name="achtung" size={15} /> Echtzeit gerade nicht erreichbar – Zeiten geschätzt</div>}
              {v.echtzeit && i === 0 && <div className="v-live"><span className="puls" /> Echtzeit der VAG</div>}
            </button>
          ))}
        </section>
      )}
      {nach && !plan && <p className="hinweis-leise">Für dieses Ziel wurde keine U-Bahn-Verbindung gefunden.</p>}

      <p className="fussnote">
        Inoffizielle Demo, kein Angebot der VAG. Nur U-Bahn (U1, U2, U3). Abfahrten: offene VAG-Schnittstelle.
        Zugänge und Karten: © OpenStreetMap-Mitwirkende.{" "}
        <button type="button" className="fuss-link" onClick={() => setDatenschutz(true)}>Datenschutz</button>
      </p>

      {datenschutz && (
        <div className="blatt" role="dialog" aria-label="Datenschutz">
          <div className="blatt-kopf">
            <button className="rund" onClick={() => setDatenschutz(false)} aria-label="Schließen"><Icon name="zurueck" /></button>
            <div className="kopf-titel"><strong>Datenschutz</strong></div>
          </div>
          <div className="blatt-inhalt datenschutz">
            <p>Diese Seite ist ein privates Übungsprojekt und setzt <strong>keine Cookies</strong>.</p>
            <p>
              Beim Öffnen wird einmal je Sitzung festgehalten, aus welchem <strong>Netz</strong> und welcher
              <strong> Stadt</strong> der Aufruf kam, dazu Gerätetyp und aufgerufene Seite. Die IP-Adresse wird
              dafür einmal abgefragt und <strong>nicht gespeichert</strong> – weder hier noch sonstwo. Es entsteht
              kein Profil, und einzelne Personen lassen sich daraus nicht erkennen.
            </p>
            <p>
              Beim Benutzen werden außerdem Anfragen an die Fahrplan-Schnittstelle der VAG, an den Fußweg-Dienst
              OSRM (FOSSGIS e.V.), an die Adresssuche Photon (komoot) und an die Kartenkacheln von OpenStreetMap
              gestellt. Diese Dienste sehen dabei die IP-Adresse des Geräts.
            </p>
            <p>
              Zusätzlich zählt Vercel Web Analytics die Seitenaufrufe. Auch das läuft ohne Cookies
              und ohne Wiedererkennung einzelner Besucher.
            </p>
            <p>Fragen dazu gern an den Betreiber dieser Seite.</p>
          </div>
        </div>
      )}

      {suche && (
        <Suche titel={suche === "von" ? "Startstation" : "Ziel"} nurStationen={suche === "von"} onZu={() => setSuche(null)}
          onWahl={(w) => { setze(suche === "von" ? { von: w } : { nach: w }); setSuche(null); }} />
      )}
    </div>
  );
}
