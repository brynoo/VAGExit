import React, { Suspense, lazy, useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import { station } from "./lib/netz.js";
import { Icon, USymbol, Laden } from "./ui/Teile.jsx";
import Planer from "./ui/Planer.jsx";
import Ticket from "./ui/Ticket.jsx";
import Suche from "./ui/Suche.jsx";
import { Abfahrtsliste } from "./ui/Abfahrten.jsx";
import { Stationsliste, StationDetail } from "./ui/Stationen.jsx";

const Station3D = lazy(() => import("./ui/Station3D.jsx"));
const HBF = { art: "station", id: 510, name: "Hauptbahnhof" };

export default function App() {
  const [tab, setTab] = useState("plan");
  const [plan, setPlan] = useState({ von: HBF, nach: null, zeit: "jetzt" });
  const [ticket, setTicket] = useState(null);
  const [detail, setDetail] = useState(null);
  const [drei, setDrei] = useState(null);
  const [tafel, setTafel] = useState(510);
  const [tafelSuche, setTafelSuche] = useState(false);

  // iOS scrollt das Dokument, wenn die Tastatur aufgeht, und setzt es beim Schließen nicht zurück.
  useEffect(() => {
    const zurueck = () => setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) { window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; } }, 60);
    document.addEventListener("focusout", zurueck);
    window.visualViewport?.addEventListener("resize", zurueck);
    return () => { document.removeEventListener("focusout", zurueck); window.visualViewport?.removeEventListener("resize", zurueck); };
  }, []);

  return (
    <div className="app">
      <header className="kopf">
        <USymbol size={26} />
        <h1>Ausgangsfinder <span>Nürnberg</span></h1>
      </header>

      <main>
        {tab === "plan" && <Planer zustand={plan} setZustand={setPlan} onTicket={setTicket} />}
        {tab === "abfahrten" && (
          <div className="seite">
            <button className="feld allein" onClick={() => setTafelSuche(true)}>
              <span className="feld-text"><small>Abfahrten ab</small><strong>{station(tafel).name}</strong></span>
              <Icon name="suche" size={18} />
            </button>
            <Abfahrtsliste stationId={tafel} max={20} />
          </div>
        )}
        {tab === "stationen" && <Stationsliste onWahl={setDetail} />}
      </main>

      <nav className="tabs" aria-label="Hauptnavigation">
        {[["plan", "route", "Verbindung"], ["abfahrten", "zug", "Abfahrten"], ["stationen", "liste", "Stationen"]].map(([id, icon, text]) => (
          <button key={id} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}><Icon name={icon} size={22} />{text}</button>
        ))}
      </nav>

      {tafelSuche && <Suche titel="Station" nurStationen onZu={() => setTafelSuche(false)} onWahl={(w) => { setTafel(w.id); setTafelSuche(false); }} />}
      {detail && <StationDetail id={detail} onZu={() => setDetail(null)} on3D={(id) => setDrei({ id })}
        onHin={(s) => { setPlan((p) => ({ ...p, nach: { art: "station", id: s.id, name: s.name, lat: s.lat, lon: s.lon } })); setDetail(null); setTab("plan"); }} />}
      {ticket && <Ticket {...ticket} onZu={() => setTicket(null)} on3D={(id, ausgangId) => setDrei({ id, ausgangId })} />}
      <Analytics />
      {drei && <Suspense fallback={<div className="blatt"><Laden zeilen={6} /></div>}><Station3D {...drei} onZu={() => setDrei(null)} /></Suspense>}
    </div>
  );
}
