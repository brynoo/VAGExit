import { LINIEN, faehrtBis } from "./netz.js";
import { abfahrten } from "./vag.js";

const UMSTIEG_MIN = 150; // Sekunden, die man zum Umsteigen mindestens braucht

function passt(dep, leg) {
  if (!leg.linien.includes(dep.linie)) return false;
  const h = LINIEN[dep.linie].halte;
  const richtung = h.indexOf(leg.bis) > h.indexOf(leg.von) ? "Richtung1" : "Richtung2";
  return dep.richtung === richtung && faehrtBis(dep.linie, richtung, dep.ziel, leg.bis);
}

// Baut aus einer berechneten Route konkrete Verbindungen mit Echtzeit-Abfahrten.
export async function verbindungen(route, startZeit, anzahl = 4) {
  const legs = route.legs;
  if (!legs.length) return [];
  const jetzt = new Date();
  const verz = Math.max(0, (startZeit - jetzt) / 60000);
  try {
    const erste = (await abfahrten(legs[0].von, { verzoegerung: verz, spanne: 70 }))
      .filter((d) => d.ist >= new Date(startZeit.getTime() - 20000) && passt(d, legs[0]))
      .slice(0, anzahl);
    if (!erste.length) throw new Error("Keine passenden Abfahrten gefunden");
    // Abfahrten an den Umsteigestationen einmal laden
    const umstieg = [];
    let fruehest = new Date(erste[0].ist.getTime() + legs[0].dauer * 1000);
    for (let i = 1; i < legs.length; i++) {
      umstieg[i] = await abfahrten(legs[i].von, { verzoegerung: Math.max(0, (fruehest - jetzt) / 60000 - 1), spanne: 90, limit: 60 });
      fruehest = new Date(fruehest.getTime() + (UMSTIEG_MIN + legs[i].dauer) * 1000);
    }
    const ergebnis = [];
    for (const dep of erste) {
      const teile = [{ ...legs[0], linie: dep.linie, ab: dep.ist, soll: dep.soll, an: new Date(dep.ist.getTime() + legs[0].dauer * 1000), gleis: dep.gleis, zielanzeige: dep.ziel, prognose: dep.prognose }];
      let ok = true;
      for (let i = 1; i < legs.length; i++) {
        const an = teile[i - 1].an;
        const d = umstieg[i].find((x) => x.ist >= new Date(an.getTime() + UMSTIEG_MIN * 1000) && passt(x, legs[i]));
        if (!d) { ok = false; break; }
        teile.push({ ...legs[i], linie: d.linie, ab: d.ist, soll: d.soll, an: new Date(d.ist.getTime() + legs[i].dauer * 1000), gleis: d.gleis, zielanzeige: d.ziel, prognose: d.prognose, wartezeit: Math.round((d.ist - an) / 60000) });
      }
      if (ok) ergebnis.push({ ab: teile[0].ab, an: teile[teile.length - 1].an, legs: teile, echtzeit: true });
    }
    if (!ergebnis.length) throw new Error("Kein Anschluss gefunden");
    return ergebnis;
  } catch (fehler) {
    // Ohne Echtzeit: reine Fahrzeit aus dem Netz, klar als Schätzung markiert
    let t = startZeit;
    const teile = legs.map((leg, i) => {
      const ab = i === 0 ? t : new Date(t.getTime() + 240000);
      const an = new Date(ab.getTime() + leg.dauer * 1000);
      t = an;
      return { ...leg, ab, soll: ab, an, gleis: "", zielanzeige: leg.ziel, prognose: false };
    });
    return [{ ab: teile[0].ab, an: t, legs: teile, echtzeit: false, fehler: fehler.message }];
  }
}
