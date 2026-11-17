import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// ------------------------------------------------------------------
// Farben
// ------------------------------------------------------------------
const F = {
  himmel: 0xeef1f4,
  boden: 0xe6e0d6,
  strasse: 0xb9b6b0,
  sandstein: 0xd8b98f,
  putzA: 0xe4d6c0,
  putzB: 0xd9c4a8,
  putzC: 0xcfd3d6,
  dach: 0xa9543c,
  dachGrau: 0x6f7780,
  glas: 0x7fa6c4,
  gruen: 0x9cc57f,
  baum: 0x5f9a56,
  beton: 0xc9ccd0,
  betonDunkel: 0x8d949c,
  gleis: 0x4d5560,
  bahnsteig: 0xdfe3e7,
  leit: 0xf7f7f2,
  uBlau: 0x0f4c9c,
  vagRot: 0xd4021d,
  highlight: 0xff8a00,
  glasBoden: 0x9cc4ea,
  kante: 0x3f7fc4,
};
const LINIENFARBE = { U1: "#0a67b2", U2: "#e2001a", U3: "#1aa39c" }; // nach Netzplan abgenommen

const mat = (color, o = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...o });
const rad = THREE.MathUtils.degToRad;

function box(b, h, t, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(b, h, t), m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

// Satteldach: First läuft entlang X (Länge b), Spannweite t
function satteldach(b, t, h, m) {
  const s = new THREE.Shape();
  s.moveTo(-t / 2, 0); s.lineTo(t / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: b, bevelEnabled: false });
  g.translate(0, 0, -b / 2);
  g.rotateY(Math.PI / 2);
  const o = new THREE.Mesh(g, m);
  o.castShadow = true;
  return o;
}

function kanten(mesh, farbe = F.kante, opacity = 0.55) {
  const l = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color: farbe, transparent: true, opacity })
  );
  l.position.copy(mesh.position);
  l.rotation.copy(mesh.rotation);
  return l;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------
// Beschriftungen
// ------------------------------------------------------------------
let LABEL_K = 1; // wird in resize() gesetzt: im Hochformat kleinere Schilder
function beschriftung(text, stil = "zugang") {
  const fs = 46, pad = stil === "ort" ? 8 : 22;
  const font = `${stil === "ort" ? "italic 500" : "600"} ${fs}px "Inter","Helvetica Neue",Arial,sans-serif`;
  const mess = document.createElement("canvas").getContext("2d");
  mess.font = font;
  const breite = Math.ceil(mess.measureText(text).width) + pad * 2;
  const hoehe = Math.ceil(fs + pad * 1.4 + (stil === "ort" ? 10 : 0));
  const c = document.createElement("canvas");
  c.width = breite; c.height = hoehe;
  const g = c.getContext("2d");
  g.font = font;
  g.textBaseline = "middle";
  if (stil === "ort") {
    g.lineWidth = 9; g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineJoin = "round";
    g.strokeText(text, pad, hoehe / 2);
    g.fillStyle = "#4a3f33";
    g.fillText(text, pad, hoehe / 2);
  } else {
    const an = stil === "aktiv";
    g.fillStyle = an ? "#ff8a00" : "rgba(255,255,255,0.94)";
    g.beginPath(); g.roundRect(1.5, 1.5, breite - 3, hoehe - 3, 16); g.fill();
    g.strokeStyle = an ? "#b35f00" : "rgba(30,38,50,0.22)";
    g.lineWidth = 3; g.stroke();
    g.fillStyle = an ? "#fff" : "#1e2632";
    g.fillText(text, pad, hoehe / 2 + 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, depthTest: false, transparent: true, sizeAttenuation: false,
  }));
  const skala = stil === "aktiv" ? 0.00036 : stil === "ort" ? 0.00026 : 0.00023;
  sp.userData.basis = [breite * skala, hoehe * skala];
  sp.scale.set(breite * skala * LABEL_K, hoehe * skala * LABEL_K, 1);
  sp.renderOrder = stil === "aktiv" ? 12 : stil === "ort" ? 9 : 10;
  return sp;
}
const kurz = (name) => {
  let t = name.split(" (")[0].trim();
  if (t.length > 28) t = t.slice(0, 27).trimEnd() + "…";
  return t;
};

// ------------------------------------------------------------------
// Low-Poly-Gebäude
// ------------------------------------------------------------------
function fensterBaender(g, b, h, t, etage = 6.5) {
  const m = mat(0x56697c, { roughness: 0.35, metalness: 0.2 });
  for (let y = 4.2; y < h - 1.5; y += etage) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(b + 0.5, 2.3, t + 0.5), m);
    band.position.y = y;
    g.add(band);
  }
}

function hausMitDach(b, t, h, wand, dachFarbe = F.dach, dachAnteil = 0.3) {
  const g = new THREE.Group();
  g.add(box(b, h, t, mat(wand), 0, h / 2, 0));
  fensterBaender(g, b, h, t);
  const laengs = b >= t;
  const d = satteldach(laengs ? b : t, (laengs ? t : b) + 1.5, Math.min(b, t) * dachAnteil, mat(dachFarbe));
  d.position.y = h;
  if (!laengs) d.rotation.y = Math.PI / 2;
  g.add(d);
  return g;
}

function baum(rnd) {
  const g = new THREE.Group();
  const h = 9 + rnd() * 6;
  g.add(box(1.4, h * 0.45, 1.4, mat(0x7a5a3c), 0, h * 0.22, 0));
  const k = new THREE.Mesh(new THREE.IcosahedronGeometry(4.5 + rnd() * 2.2, 0), mat(rnd() > 0.5 ? F.baum : 0x74ad63));
  k.position.y = h * 0.75;
  k.castShadow = true;
  g.add(k);
  return g;
}

function baueGebaeude(d, rnd) {
  const g = new THREE.Group();
  const putz = [F.putzA, F.putzB, F.putzC, F.sandstein][Math.floor(rnd() * 4)];

  switch (d.typ) {
    case "block":
      g.add(hausMitDach(d.b, d.t, d.h, d.farbe ?? putz));
      break;

    case "halle": {
      g.add(box(d.b, d.h, d.t, mat(F.putzC), 0, d.h / 2, 0));
      fensterBaender(g, d.b, d.h, d.t, 9);
      const dd = satteldach(d.b, d.t + 2, d.t * 0.14, mat(F.dachGrau));
      dd.position.y = d.h;
      g.add(dd);
      break;
    }

    case "hochhaus": {
      g.add(box(d.b, d.h, d.t, mat(0xd7dbde), 0, d.h / 2, 0));
      fensterBaender(g, d.b, d.h, d.t, 4.6);
      g.add(box(d.b * 0.5, 4, d.t * 0.7, mat(F.betonDunkel), 0, d.h + 2, 0));
      break;
    }

    case "parkhaus": {
      const m1 = mat(F.beton), m2 = mat(0x4b535c);
      for (let y = 0, i = 0; y < d.h; y += 3, i++) {
        g.add(box(d.b - (i % 2 ? 2 : 0), 3, d.t - (i % 2 ? 2 : 0), i % 2 ? m2 : m1, 0, y + 1.5, 0));
      }
      break;
    }

    case "bahnhof": {
      // Empfangsgebäude: langer Sandsteinbau, Mittelportal, zwei Eckpavillons
      const stein = mat(F.sandstein), dm = mat(0x6d7f77);
      g.add(box(d.b, d.h * 0.78, d.t, stein, 0, d.h * 0.39, 0));
      fensterBaender(g, d.b, d.h * 0.78, d.t, 8);
      const hd = satteldach(d.b, d.t + 2, d.t * 0.2, dm); hd.position.y = d.h * 0.78; g.add(hd);
      // Mittelbau mit großem Bogenfenster
      g.add(box(d.b * 0.2, d.h * 1.15, d.t + 8, stein, 0, d.h * 0.575, 0));
      const md = satteldach(d.t + 10, d.b * 0.2 + 2, d.h * 0.32, dm);
      md.position.y = d.h * 1.15; md.rotation.y = Math.PI / 2; g.add(md);
      g.add(box(d.b * 0.11, d.h * 0.7, 1, mat(F.glas, { roughness: 0.2 }), 0, d.h * 0.45, -(d.t / 2 + 4.3)));
      for (const s of [-1, 1]) {
        g.add(box(d.b * 0.1, d.h, d.t + 5, stein, s * d.b * 0.45, d.h / 2, 0));
        const pd = new THREE.Mesh(new THREE.ConeGeometry(d.b * 0.085, d.h * 0.4, 4), dm);
        pd.rotation.y = Math.PI / 4; pd.position.set(s * d.b * 0.45, d.h * 1.2, 0); pd.castShadow = true;
        g.add(pd);
      }
      break;
    }

    case "gleise": {
      g.add(box(d.b, 0.6, d.t, mat(0x8b8a86), 0, 0.3, 0));
      const dm = mat(0xe9ecee);
      for (let z = -d.t / 2 + 12; z < d.t / 2 - 4; z += 18) {
        g.add(box(d.b * 0.8, 0.8, 9, dm, 0, 9, z));
        for (let x = -d.b * 0.36; x <= d.b * 0.36; x += d.b * 0.18) g.add(box(0.9, 9, 0.9, mat(F.betonDunkel), x, 4.5, z));
      }
      break;
    }

    case "kirche": {
      const stein = mat(F.sandstein);
      g.add(box(d.b, d.h, d.t, stein, 0, d.h / 2, 0));
      const dd = satteldach(d.b, d.t + 1.5, d.t * 0.62, mat(F.dach)); dd.position.y = d.h; g.add(dd);
      const tb = d.t * 0.5, th = d.h * 2.5;
      g.add(box(tb, th, tb, stein, -d.b / 2 - tb / 2 + 1, th / 2, 0));
      const sp = new THREE.Mesh(new THREE.ConeGeometry(tb * 0.78, th * 0.6, 4), mat(0x5e7a72));
      sp.rotation.y = Math.PI / 4; sp.position.set(-d.b / 2 - tb / 2 + 1, th * 1.3, 0); sp.castShadow = true;
      g.add(sp);
      break;
    }

    case "turm": {
      const farbe = d.farbe ?? F.sandstein;
      if (d.rund) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(d.b / 2, d.b / 2 * 1.08, d.h, 10), mat(farbe));
        c.position.y = d.h / 2; c.castShadow = true; g.add(c);
        const kr = new THREE.Mesh(new THREE.CylinderGeometry(d.b / 2 * 1.15, d.b / 2, 3, 10), mat(farbe));
        kr.position.y = d.h + 1.5; g.add(kr);
        const hut = new THREE.Mesh(new THREE.ConeGeometry(d.b / 2 * 1.18, d.h * 0.42, 10), mat(F.dach));
        hut.position.y = d.h + 3 + d.h * 0.21; hut.castShadow = true; g.add(hut);
      } else {
        g.add(box(d.b, d.h, d.b, mat(farbe), 0, d.h / 2, 0));
        g.add(box(d.b * 0.5, d.h * 0.3, d.b + 0.4, mat(0x40464d), 0, d.h * 0.15, 0)); // Tordurchgang
        const hut = new THREE.Mesh(new THREE.ConeGeometry(d.b * 0.78, d.h * 0.5, 4), mat(F.dach));
        hut.rotation.y = Math.PI / 4; hut.position.y = d.h * 1.25; hut.castShadow = true; g.add(hut);
        if (d.uhr) {
          const u = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.6, 12), mat(0x2b3138));
          u.rotation.x = Math.PI / 2; u.position.set(0, d.h * 0.78, d.b / 2 + 0.2); g.add(u);
        }
      }
      break;
    }

    case "kuppel": {
      const stein = mat(F.sandstein);
      if (d.sockel) {
        g.add(box(d.r * 2.6, d.h * 0.7, d.r * 1.3, stein, 0, d.h * 0.35, 0));
        g.add(box(d.r * 1.3, d.h * 0.7, d.r * 2.6, stein, 0, d.h * 0.35, 0));
      }
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(d.r, d.r, d.h, 12), d.sockel ? stein : mat(F.putzC));
      tr.position.y = d.h / 2; tr.castShadow = true; g.add(tr);
      const k = new THREE.Mesh(
        new THREE.SphereGeometry(d.r * 0.98, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2),
        mat(d.sockel ? 0x6f9488 : 0xb9c2c9, { roughness: 0.5 })
      );
      k.position.y = d.h; k.castShadow = true; g.add(k);
      break;
    }

    case "mauer": {
      g.add(box(d.b, d.h, d.t, mat(F.sandstein), 0, d.h / 2, 0));
      const dd = satteldach(d.t, d.b + 3, 4, mat(F.dach)); dd.position.y = d.h; dd.rotation.y = Math.PI / 2; g.add(dd);
      break;
    }

    case "park": {
      const p = box(d.b, 0.5, d.t, mat(F.gruen), 0, 0.25, 0); p.castShadow = false; g.add(p);
      const n = Math.round((d.b * d.t) / 1500);
      for (let i = 0; i < n; i++) {
        const b = baum(rnd);
        b.position.set((rnd() - 0.5) * d.b * 0.85, 0, (rnd() - 0.5) * d.t * 0.85);
        g.add(b);
      }
      break;
    }

    case "terminal": {
      g.add(box(d.b, d.h, d.t, mat(0xdfe6ea), 0, d.h / 2, 0));
      g.add(box(d.b - 6, d.h * 0.62, 1.2, mat(F.glas, { roughness: 0.15, metalness: 0.3 }), 0, d.h * 0.45, d.t / 2 + 0.4));
      g.add(box(d.b + 14, 2.2, d.t + 22, mat(0xf4f6f7), 0, d.h + 1.1, 5)); // auskragendes Dach
      for (let x = -d.b / 2 + 12; x < d.b / 2; x += 34) g.add(box(1.6, d.h, 1.6, mat(F.betonDunkel), x, d.h / 2, d.t / 2 + 12));
      // Fluggastbrücken zum Vorfeld
      for (const x of [-d.b * 0.28, 0, d.b * 0.28]) g.add(box(7, 6, 46, mat(0xcdd5da), x, 9, -d.t / 2 - 22));
      break;
    }

    case "tower": {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 6, d.h, 8), mat(0xe2e6e9));
      s.position.y = d.h / 2; s.castShadow = true; g.add(s);
      const k = new THREE.Mesh(new THREE.CylinderGeometry(10, 7, 8, 8), mat(F.glas, { roughness: 0.2, metalness: 0.3 }));
      k.position.y = d.h + 4; k.castShadow = true; g.add(k);
      const dk = new THREE.Mesh(new THREE.CylinderGeometry(10.8, 10.8, 1.5, 8), mat(0xf4f6f7));
      dk.position.y = d.h + 8.7; g.add(dk);
      break;
    }

    case "vorfeld": {
      const p = box(d.b, 0.4, d.t, mat(0xcfd2d4), 0, 0.2, 0); p.castShadow = false; g.add(p);
      break;
    }

    case "flugzeug": {
      const w = mat(0xf7f8f9, { roughness: 0.4 });
      const r = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 46, 8), w);
      r.rotation.z = Math.PI / 2; r.position.y = 7; r.castShadow = true; g.add(r);
      const nase = new THREE.Mesh(new THREE.ConeGeometry(3.6, 9, 8), w);
      nase.rotation.z = -Math.PI / 2; nase.position.set(27.5, 7, 0); g.add(nase);
      const heck = new THREE.Mesh(new THREE.ConeGeometry(3.6, 12, 8), w);
      heck.rotation.z = Math.PI / 2; heck.position.set(-29, 7.6, 0); g.add(heck);
      g.add(box(11, 1, 54, w, 0, 5.8, 0));
      g.add(box(6, 0.8, 20, w, -27, 8.5, 0));
      g.add(box(8, 11, 0.9, mat(F.vagRot), -28, 13.5, 0));
      for (const s of [-1, 1]) {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 7, 8), mat(0x8d949c));
        t.rotation.z = Math.PI / 2; t.position.set(3, 4, s * 12); g.add(t);
      }
      break;
    }
  }

  g.position.set(d.x, 0, d.z);
  g.rotation.y = rad(d.winkel ?? 0);
  return g;
}

function liveTafel() {
  const c = document.createElement("canvas");
  c.width = 640; c.height = 256;
  const g = c.getContext("2d");
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const zeichne = (zeilen) => {
    g.fillStyle = "#06122b"; g.fillRect(0, 0, 640, 256);
    g.textBaseline = "middle"; g.textAlign = "left";
    if (!zeilen.length) {
      g.fillStyle = "#7f93ad"; g.font = '500 30px "Helvetica Neue",Arial,sans-serif';
      g.fillText("Keine Abfahrt in Kürze", 24, 128);
    }
    zeilen.slice(0, 3).forEach((z, i) => {
      const y = 46 + i * 82;
      g.fillStyle = LINIENFARBE[z.linie] ?? "#0f4c9c";
      g.beginPath(); g.roundRect(18, y - 28, 74, 56, 8); g.fill();
      g.fillStyle = "#fff"; g.font = 'bold 36px "Helvetica Neue",Arial,sans-serif';
      g.fillText(z.linie, 30, y + 2);
      g.fillStyle = "#ffffff";
      g.font = `600 ${z.ziel.length > 16 ? 30 : 38}px "Helvetica Neue",Arial,sans-serif`;
      g.fillText(z.ziel.slice(0, 20), 108, y + 2);
      g.textAlign = "right"; g.font = 'bold 38px "Helvetica Neue",Arial,sans-serif';
      g.fillText(z.min, 622, y + 2); g.textAlign = "left";
    });
    tex.needsUpdate = true;
  };
  zeichne([]);
  const gruppe = new THREE.Group();
  const rahmen = mat(0x1b2330, { roughness: 0.5 });
  const anzeige = new THREE.MeshBasicMaterial({ map: tex });
  const tafel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.36, 0.22), [rahmen, rahmen, rahmen, rahmen, anzeige, anzeige]);
  tafel.position.y = 3.35;
  gruppe.add(tafel);
  const stahl = mat(0x7d8894, { metalness: 0.5 });
  gruppe.add(box(0.16, 4.3, 0.16, stahl, 2.1, 2.15, 0));   // Mast
  gruppe.add(box(2.3, 0.12, 0.12, stahl, 1.0, 4.24, 0));   // Ausleger
  for (const sx of [-0.9, 0.9]) gruppe.add(box(0.05, 0.25, 0.05, stahl, sx, 4.12, 0));
  return { gruppe, zeichne };
}

// Zug nach Vorbild G1: 4 Wagen, 75,9 x 2,9 x 3,5 m
function wagenkasten(laenge, B, unten, oben) {
  // Querschnitt: unten leicht eingezogen, oben mit Dachrundung
  const h = B / 2, q = new THREE.Shape();
  q.moveTo(-h + 0.12, unten); q.lineTo(h - 0.12, unten); q.lineTo(h, unten + 0.45);
  q.lineTo(h, oben - 0.55); q.quadraticCurveTo(h, oben - 0.12, h - 0.5, oben);
  q.lineTo(-h + 0.5, oben); q.quadraticCurveTo(-h, oben - 0.12, -h, oben - 0.55);
  q.lineTo(-h, unten + 0.45); q.closePath();
  const geo = new THREE.ExtrudeGeometry(q, { depth: laenge, bevelEnabled: false, curveSegments: 4 });
  geo.translate(0, 0, -laenge / 2);
  geo.rotateY(Math.PI / 2); // Extrusionsachse -> Fahrtrichtung (x)
  return geo;
}
function zug(laenge) {
  const g = new THREE.Group();
  const weiss = mat(0xf7f7f5, { roughness: 0.4, flatShading: false }), rot = mat(F.vagRot, { roughness: 0.45 });
  const glas = mat(0x121a24, { roughness: 0.12, metalness: 0.5 }), dunkel = mat(0x262b31), grau = mat(0x8d949c, { metalness: 0.4 });
  const dach = mat(0xd2d6da), stahl = mat(0x5b636b, { metalness: 0.7, roughness: 0.35 });
  const licht = new THREE.MeshBasicMaterial({ color: 0xfff6d8 }), ziel = new THREE.MeshBasicMaterial({ color: 0xffb400 });
  const innen = new THREE.MeshBasicMaterial({ color: 0xfff1c9 });
  const wagen = 4, fuge = 0.75, Lc = (laenge - (wagen - 1) * fuge) / wagen, B = 2.9, U = 0.95, O = 3.55;
  for (let i = 0; i < wagen; i++) {
    const w = new THREE.Group();
    const kasten = new THREE.Mesh(wagenkasten(Lc, B, U, O), weiss);
    kasten.castShadow = true;
    w.add(kasten);
    w.add(box(Lc - 0.6, 0.5, B - 0.5, dunkel, 0, 0.7, 0));              // Unterflur
    for (const x of [-Lc * 0.12, Lc * 0.14]) w.add(box(2.2, 0.42, B - 0.8, grau, x, 0.66, 0)); // Gerätekästen
    w.add(box(Lc - 0.9, 0.9, B + 0.03, glas, 0, 2.55, 0));              // Fensterband
    w.add(box(Lc - 1.1, 0.5, B - 0.1, innen, 0, 2.62, 0));              // Innenbeleuchtung schimmert durch
    w.add(box(Lc, 0.13, B + 0.04, rot, 0, 3.12, 0));                    // rote Linie über den Fenstern
    w.add(box(Lc, 0.1, B + 0.04, grau, 0, 1.0, 0));                     // Schürzenkante
    for (const x of [-Lc * 0.25, Lc * 0.25]) w.add(box(2.4, 0.26, 1.7, dach, x, O + 0.1, 0)); // Klimageräte
    for (const x of [-Lc * 0.31, 0, Lc * 0.31]) {                        // Doppeltüren
      w.add(box(1.4, 2.08, B + 0.06, rot, x, 2.02, 0));
      for (const dxT of [-0.35, 0.35]) w.add(box(0.5, 0.95, B + 0.09, glas, x + dxT, 2.5, 0));
      w.add(box(0.03, 2.08, B + 0.08, dunkel, x, 2.02, 0));             // Türspalt
      w.add(box(1.4, 0.06, B + 0.1, grau, x, 0.98, 0));                 // Trittkante
    }
    // seitliche Zielanzeige
    for (const sz of [-1, 1]) { const a = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.2, 0.03), ziel); a.position.set(Lc * 0.16, 3.0, sz * (B / 2 + 0.03)); w.add(a); }
    // Drehgestelle mit Rädern
    for (const x of [-Lc * 0.33, Lc * 0.33]) {
      w.add(box(2.7, 0.3, B - 0.9, stahl, x, 0.42, 0));
      for (const rx of [-0.95, 0.95]) for (const rz of [-0.75, 0.75]) {
        const rad = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 12), stahl);
        rad.rotation.x = Math.PI / 2; rad.position.set(x + rx, 0.42, rz); w.add(rad);
      }
    }
    // Stirnfront an den Zugenden: schwarze Maske, schräge Scheibe, Lichter, Kupplung
    for (const [ende, sx] of [[0, -1], [wagen - 1, 1]]) {
      if (i !== ende) continue;
      const e = sx * Lc / 2;
      w.add(box(0.35, 1.25, B - 0.2, dunkel, e + sx * 0.17, 1.6, 0));                 // untere Maske
      const scheibe = box(0.12, 1.5, B - 0.5, glas, e + sx * 0.02, 2.75, 0); scheibe.rotation.z = sx * 0.2; w.add(scheibe);
      w.add(box(0.5, 0.18, B - 0.4, weiss, e - sx * 0.12, O - 0.1, 0));               // Dachabschluss
      w.add(box(0.3, 0.16, B - 0.6, rot, e + sx * 0.22, 1.05, 0));                    // roter Stoßfänger
      for (const sz of [-1, 1]) {
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.42), licht); l.position.set(e + sx * 0.36, 1.45, sz * 0.95); w.add(l);
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.2), new THREE.MeshBasicMaterial({ color: 0xd4021d })); r.position.set(e + sx * 0.36, 1.28, sz * 0.95); w.add(r);
      }
      const anz = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 1.5), ziel); anz.position.set(e - sx * 0.12, 3.32, 0); anz.rotation.z = sx * 0.2; w.add(anz);
      w.add(box(0.6, 0.25, 0.3, stahl, e + sx * 0.45, 0.7, 0));                       // Kupplung
    }
    w.position.x = -laenge / 2 + Lc / 2 + i * (Lc + fuge);
    w.userData.x0 = w.position.x;
    (g.userData.wagen ??= []).push(w);
    g.add(w);
    if (i < wagen - 1) w.add(box(fuge + 0.15, 2.3, B - 0.5, dunkel, Lc / 2 + fuge / 2, 2.15, 0)); // Faltenbalg
  }
  return g;
}

// Stationsschild, weiss auf blau
function stationsschild(name) {
  const c = document.createElement("canvas");
  c.width = 768; c.height = 112;
  const x = c.getContext("2d");
  x.fillStyle = "#0b3f7a"; x.fillRect(0, 0, 768, 112);
  x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle";
  let fs = 62; x.font = `700 ${fs}px "Helvetica Neue",Arial,sans-serif`;
  while (x.measureText(name).width > 720 && fs > 30) { fs -= 4; x.font = `700 ${fs}px "Helvetica Neue",Arial,sans-serif`; }
  x.fillText(name, 384, 60);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const rand = mat(0x0b3f7a), bild = new THREE.MeshBasicMaterial({ map: tex });
  const g = new THREE.Group();
  const tafel = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.64, 0.12), [rand, rand, rand, rand, bild, bild]);
  tafel.position.y = 2.75;
  g.add(tafel);
  for (const sx of [-1, 1]) g.add(box(0.1, 2.5, 0.1, mat(0x8e9aa6, { metalness: 0.5 }), sx * 1.9, 1.25, 0));
  return g;
}

function uSchild() {
  const g = new THREE.Group();
  g.add(box(0.7, 12, 0.7, mat(0x8e9aa6, { metalness: 0.4 }), 0, 6, 0));
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d");
  x.fillStyle = "#0f4c9c"; x.fillRect(0, 0, 128, 128);
  x.fillStyle = "#fff"; x.font = "bold 108px Helvetica,Arial,sans-serif";
  x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("U", 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const blau = new THREE.MeshStandardMaterial({ color: F.uBlau });
  const bild = new THREE.MeshBasicMaterial({ map: tex });
  const s = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 0.7), [blau, blau, blau, blau, bild, bild]);
  s.position.y = 14; s.castShadow = true;
  g.add(s);
  return g;
}

// ------------------------------------------------------------------
// Aufbau aus OpenStreetMap-Geometrie (station.geo)
// ------------------------------------------------------------------
const EBENEN_Y = { "1": 6.5, "0": 0, "-1": -5.5, "-2": -11, "-3": -18, "-4": -25, "-5": -30 };
const ly = (l) => EBENEN_Y[String(l)] ?? l * 6;

// Polygon als liegende Flaeche oder extrudierter Koerper (Unterkante bei y)
function flaeche(poly, y, material, hoehe = 0, skala = 1) {
  let pts = poly;
  if (skala !== 1) {
    const cx = poly.reduce((a, q) => a + q[0], 0) / poly.length;
    const cz = poly.reduce((a, q) => a + q[1], 0) / poly.length;
    pts = poly.map(([x, z]) => [cx + (x - cx) * skala, cz + (z - cz) * skala]);
  }
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = hoehe
    ? new THREE.ExtrudeGeometry(shape, { depth: hoehe, bevelEnabled: false })
    : new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, material);
  m.position.y = y;
  return m;
}

// Viele Linienzuege in ein Band-Mesh (Strassen, Gaenge, Gleise)
function baender(linien, breite, y, material) {
  const pos = [];
  for (const l of linien) {
    const p = l.p ?? l, b = (l.b ?? breite) / 2;
    for (let i = 0; i < p.length - 1; i++) {
      const [x1, z1] = p[i], [x2, z2] = p[i + 1];
      const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
      if (len < 0.05) continue;
      const nx = (-dz / len) * b, nz = (dx / len) * b;
      // an den Enden etwas verlängern, damit Knicke geschlossen wirken
      const ex = (dx / len) * b * 0.6, ez = (dz / len) * b * 0.6;
      const a = [x1 - ex + nx, y, z1 - ez + nz], bb = [x1 - ex - nx, y, z1 - ez - nz];
      const c = [x2 + ex + nx, y, z2 + ez + nz], d = [x2 + ex - nx, y, z2 + ez - nz];
      pos.push(...a, ...c, ...bb, ...bb, ...c, ...d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, material);
}

function mitte(poly) {
  return [poly.reduce((a, q) => a + q[0], 0) / poly.length, poly.reduce((a, q) => a + q[1], 0) / poly.length];
}
function polyFlaeche(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % poly.length];
    a += x1 * z2 - x2 * z1;
  }
  return Math.abs(a) / 2;
}
// Längsachse eines Polygons: die zwei am weitesten entfernten Punkte
function achse(poly) {
  let best = [0, poly[0], poly[0]];
  for (const a of poly) for (const b of poly) {
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (d > best[0]) best = [d, a, b];
  }
  const [laenge, a, b] = best;
  const dx = (b[0] - a[0]) / laenge, dz = (b[1] - a[1]) / laenge;
  const [cx, cz] = mitte(poly);
  const halb = Math.max(...poly.map(([x, z]) => Math.abs((x - cx) * -dz + (z - cz) * dx)));
  return { laenge, winkel: Math.atan2(-dz, dx), cx, cz, halb };
}

// Treppe zwischen zwei Punkten auf unterschiedlicher Höhe
// Gemeinsame Materialien für Geländer (einmal anlegen, überall wiederverwenden)
const GELAENDER = {
  stahl: mat(0x9aa3ab, { metalness: 0.7, roughness: 0.3 }),
  gummi: mat(0x15181c, { roughness: 0.7 }),
  wange: mat(0xb9bec3, { metalness: 0.4, roughness: 0.45 }),
  glas: new THREE.MeshStandardMaterial({ color: 0xa9d3e6, roughness: 0.1, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
  kamm: mat(0xd9b400, { roughness: 0.6 }),
};

// Treppe oder Rolltreppe zwischen zwei Punkten
function treppeZwischen(oben, unten, yOben, yUnten, material, roll = false) {
  const dx = unten[0] - oben[0], dz = unten[1] - oben[1];
  const hoehe = Math.max(yOben - yUnten, 0.5), strecke = Math.max(Math.hypot(dx, dz), 1);
  const g = new THREE.Group();
  g.position.set(oben[0], yOben, oben[1]);
  g.rotation.y = Math.atan2(dx, dz);
  // Bauteil zwischen zwei Profilpunkten (z = Laufrichtung, y = Höhe), `ab` Meter über der Lauflinie
  const teil = (b, h, m, x, ab, z1, y1, z2, y2) => {
    const l = Math.hypot(z2 - z1, y2 - y1);
    const t = new THREE.Mesh(new THREE.BoxGeometry(b, h, l), m);
    t.position.set(x, (y1 + y2) / 2 + ab, (z1 + z2) / 2);
    t.rotation.x = Math.atan2(y1 - y2, z2 - z1);
    g.add(t);
  };

  if (roll) {
    // Rolltreppe: 30° Neigung, flache Ein- und Ausläufe; ist der Weg länger, verlängert sich der obere Einlauf
    const breite = 1.2, schraegLauf = hoehe / Math.tan(Math.PI / 6);
    const ein = Math.max(1.3, (strecke - schraegLauf) / 2), z1 = ein, z2 = ein + schraegLauf, zEnde = z2 + ein;
    const abschnitte = [[0, 0, z1, 0], [z1, 0, z2, -hoehe], [z2, -hoehe, zEnde, -hoehe]];
    for (const [a, ya, b, yb] of abschnitte) {
      teil(breite - 0.22, 0.1, material, 0, -0.02, a, ya, b, yb);                 // Stufenband
      teil(breite + 0.25, 0.75, GELAENDER.wange, 0, -0.45, a, ya, b, yb);         // Verkleidung
      for (const s of [-1, 1]) {
        const x = s * breite / 2;
        teil(0.16, 0.34, GELAENDER.wange, x, 0.08, a, ya, b, yb);                 // Sockel
        teil(0.025, 0.7, GELAENDER.glas, x, 0.6, a, ya, b, yb);                   // Glas
        teil(0.09, 0.07, GELAENDER.gummi, x, 0.98, a, ya, b, yb);                 // Handlauf
      }
    }
    const rippen = Math.min(70, Math.round(schraegLauf / 0.4));
    for (let i = 0; i <= rippen; i++) {
      const k = i / rippen;
      const r = new THREE.Mesh(new THREE.BoxGeometry(breite - 0.22, 0.2, 0.04), GELAENDER.gummi);
      r.position.set(0, -hoehe * k - 0.04, z1 + schraegLauf * k); g.add(r);       // senkrechte Stufenkanten
    }
    for (const [z, y] of [[0.25, 0], [zEnde - 0.25, -hoehe]]) g.add(box(breite - 0.22, 0.03, 0.14, GELAENDER.kamm, 0, y + 0.045, z));
    g.userData = { breite, start: z1 - 0.3, ende: zEnde };
    for (const s of [-1, 1]) for (const [z, y] of [[0, 0], [zEnde, -hoehe]]) {
      const kopf = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.09, 12, 1, false, 0, Math.PI), GELAENDER.gummi);
      kopf.rotation.z = Math.PI / 2; kopf.rotation.y = z ? 0 : Math.PI; kopf.position.set(s * breite / 2, y + 0.52, z); g.add(kopf);
    }
    return g;
  }

  // Feste Treppe: Stufen 16–17 cm hoch und 30 cm tief; höchstens 16 Stufen je Lauf, dazwischen Podeste.
  const breite = 2.6, n = Math.max(3, Math.round(hoehe / 0.165)), st = hoehe / n;
  const laeufe = Math.ceil(n / 16), podeste = laeufe - 1;
  let auf = 0.3, podest = 1.4;
  let rest = strecke - n * auf - podeste * podest;
  if (rest < 0) { podest = Math.max(0.9, podest + rest / Math.max(podeste, 1)); rest = strecke - n * auf - podeste * podest; }
  if (rest < 0) { auf = Math.max(0.24, (strecke - podeste * podest) / n); rest = 0; }
  const kopfPodest = Math.min(rest, 6); // überschüssige Länge wird oberes Podest
  // Profil aufbauen
  const prof = new THREE.Shape(); prof.moveTo(0, 0);
  const gelaender = []; // Segmente [z1,y1,z2,y2] für Handläufe
  let z = kopfPodest, y = 0, stufe = 0;
  if (kopfPodest > 0.05) { prof.lineTo(z, 0); gelaender.push([0, 0, z, 0]); }
  const kanten = [];
  for (let l = 0; l < laeufe; l++) {
    const k = Math.min(16, n - stufe), zA = z, yA = y;
    for (let i = 0; i < k; i++) { z += auf; prof.lineTo(z, y); y -= st; prof.lineTo(z, y); }
    stufe += k;
    gelaender.push([zA, yA, z, y]);
    kanten.push([zA + auf, yA], [z, y + st]);   // erste und letzte Stufe: Kontraststreifen
    if (l < laeufe - 1) { const zp = z; z += podest; prof.lineTo(z, y); gelaender.push([zp, y, z, y]); }
  }
  const zEnde = z;
  g.userData = { breite, start: kopfPodest + 0.05, ende: zEnde };
  // Unterseite: schräge Laufplatte
  prof.lineTo(zEnde, y - 0.3); prof.lineTo(kopfPodest, -0.3 - st); prof.lineTo(0, -0.3); prof.closePath();
  const geo = new THREE.ExtrudeGeometry(prof, { depth: breite, bevelEnabled: false });
  geo.rotateY(-Math.PI / 2); geo.translate(breite / 2, 0, 0);
  const koerper = new THREE.Mesh(geo, material);
  koerper.castShadow = true; koerper.receiveShadow = true;
  g.add(koerper);
  const streifen = mat(0xf2c200, { roughness: 0.7 });
  for (const [kz, ky] of kanten) g.add(box(breite - 0.1, 0.012, 0.06, streifen, 0, ky + 0.008, kz - 0.04));
  // Brüstung aus Glas mit Edelstahl-Handlauf auf beiden Seiten, Mittelhandlauf
  for (const [a, ya, b, yb] of gelaender) {
    for (const s of [-1, 1]) {
      const x = s * (breite / 2 + 0.03);
      teil(0.08, 0.34, GELAENDER.wange, x, -0.05, a, ya, b, yb);       // Wange
      teil(0.02, 0.8, GELAENDER.glas, x, 0.52, a, ya, b, yb);          // Glasfüllung
      teil(0.055, 0.055, GELAENDER.stahl, x, 0.98, a, ya, b, yb);      // Handlauf
      for (const [pz, py] of [[a, ya], [b, yb]]) g.add(box(0.05, 1.0, 0.05, GELAENDER.stahl, x, py + 0.5, pz));
    }
    teil(0.05, 0.05, GELAENDER.stahl, 0, 0.95, a, ya, b, yb);           // Mittelhandlauf
    for (const [pz, py] of [[a, ya], [b, yb]]) g.add(box(0.04, 0.95, 0.04, GELAENDER.stahl, 0, py + 0.47, pz));
  }
  return g;
}

// Sitzbank: Stahlrohr + Drahtgitter
function sitzbank(laenge = 2.4) {
  const g = new THREE.Group();
  const gitter = mat(0x6f7b85, { metalness: 0.6, roughness: 0.4 }), rohr = GELAENDER.stahl;
  g.add(box(laenge, 0.05, 0.46, gitter, 0, 0.46, 0));                 // Sitzfläche
  for (let x = -laenge / 2 + 0.15; x < laenge / 2; x += 0.3) g.add(box(0.03, 0.06, 0.46, rohr, x, 0.47, 0)); // Gitterstäbe
  const lehne = box(laenge, 0.4, 0.04, gitter, 0, 0.82, -0.25); lehne.rotation.x = -0.14; g.add(lehne);
  g.add(box(laenge + 0.06, 0.05, 0.05, rohr, 0, 1.03, -0.28));        // Lehnenoberkante
  for (const x of [-laenge / 2 + 0.2, laenge / 2 - 0.2]) {
    g.add(box(0.06, 0.46, 0.06, rohr, x, 0.23, 0.18));
    g.add(box(0.06, 1.03, 0.06, rohr, x, 0.515, -0.24));
    g.add(box(0.06, 0.05, 0.5, rohr, x, 0.03, -0.03));                // Fuß
    g.add(box(0.05, 0.05, 0.44, rohr, x, 0.66, -0.02));               // Armlehne
  }
  for (const x of [-laenge / 3 / 2, laenge / 3 / 2]) g.add(box(0.03, 0.2, 0.44, rohr, x, 0.56, -0.02)); // Sitzteiler
  return g;
}

// OSM liefert Gleise in kurzen Stuecken -> zu Pfaden verketten.
// An Weichen gewinnt das Stueck, das am geradesten weitergeht.
function gleisPfade(ugleise) {
  const stuecke = ugleise.filter((g) => g.p.length > 1).map((g) => ({ p: g.p, level: g.level, frei: true }));
  const nah = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.6;
  const richtung = (a, b) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
  const verlaengere = (pts, lv) => {
    for (;;) {
      const ende = pts[pts.length - 1], r = richtung(pts[pts.length - 2], ende);
      let best = null, bw = 0.64; // cos(50°): nichts anhängen, was scharf abknickt
      for (const st of stuecke) {
        if (!st.frei) continue;
        for (const rev of [false, true]) {
          const q = rev ? [...st.p].reverse() : st.p;
          if (!nah(q[0], ende)) continue;
          const r2 = richtung(q[0], q[1]), c = r[0] * r2[0] + r[1] * r2[1];
          if (c > bw) { bw = c; best = { st, q }; }
        }
      }
      if (!best) return;
      best.st.frei = false;
      for (let i = 1; i < best.q.length; i++) { pts.push(best.q[i]); lv.push(best.st.level); }
    }
  };
  const pfade = [];
  for (const st of stuecke) {
    if (!st.frei) continue;
    st.frei = false;
    const pts = [...st.p], lv = st.p.slice(1).map(() => st.level);
    verlaengere(pts, lv);
    pts.reverse(); lv.reverse();
    verlaengere(pts, lv);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    pfade.push({ pts, lv, cum, laenge: cum[cum.length - 1] });
  }
  return pfade;
}
// Punkt und Fahrtrichtung bei Bogenlänge s (über die Enden hinaus geradeaus verlängert)
function pfadPunkt(pf, s) {
  const n = pf.pts.length;
  let i = 1;
  if (s <= 0) i = 1; else if (s >= pf.laenge) i = n - 1; else while (pf.cum[i] < s) i++;
  const a = pf.pts[i - 1], b = pf.pts[i], l = pf.cum[i] - pf.cum[i - 1] || 1;
  const tx = (b[0] - a[0]) / l, tz = (b[1] - a[1]) / l, d = s - pf.cum[i - 1];
  return { x: a[0] + tx * d, z: a[1] + tz * d, tx, tz };
}
// Nächster Punkt des Pfads zu (x, z): Bogenlänge, Abstand und Ebene des Gleisstücks
function pfadProjektion(pf, x, z) {
  let best = { d: Infinity, s: 0, level: null };
  for (let i = 1; i < pf.pts.length; i++) {
    const a = pf.pts[i - 1], b = pf.pts[i], l = pf.cum[i] - pf.cum[i - 1];
    if (l < 0.01) continue;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * (b[0] - a[0]) + (z - a[1]) * (b[1] - a[1])) / (l * l)));
    const d = Math.hypot(x - (a[0] + (b[0] - a[0]) * t), z - (a[1] + (b[1] - a[1]) * t));
    if (d < best.d) best = { d, s: pf.cum[i - 1] + t * l, level: pf.lv[i - 1] };
  }
  return best;
}

// Blickdichte Roehre ab dem Portal, damit der Zug darin verschwindet
function tunnel(pf, s0, sinn, portal, y) {
  const g = new THREE.Group();
  const dunkel = mat(0x1b1f25, { roughness: 1 }), innen = new THREE.MeshBasicMaterial({ color: 0x05070a }), beton = mat(0xa9aeb4);
  const LAENGE = 42, SCHRITT = 6, B = 4.6, H = 4.9;
  for (let a = 0; a < LAENGE; a += SCHRITT) {
    const q = pfadPunkt(pf, s0 + sinn * (portal + a + SCHRITT / 2));
    const seg = new THREE.Group();
    seg.position.set(q.x, y, q.z);
    seg.rotation.y = Math.atan2(-q.tz, q.tx);
    seg.add(box(SCHRITT + 0.6, 0.4, B, dunkel, 0, H, 0));                 // Decke
    for (const sz of [-1, 1]) seg.add(box(SCHRITT + 0.6, H, 0.4, dunkel, 0, H / 2, sz * B / 2)); // Wände
    seg.add(box(SCHRITT + 0.6, 0.2, B, dunkel, 0, -0.1, 0));              // Sohle
    g.add(seg);
  }
  // Portalrahmen und schwarze Öffnung
  const q = pfadPunkt(pf, s0 + sinn * portal);
  const tor = new THREE.Group();
  tor.position.set(q.x, y, q.z);
  tor.rotation.y = Math.atan2(-q.tz, q.tx);
  tor.add(box(0.7, 0.9, B + 1.6, beton, 0, H + 0.45, 0));
  for (const sz of [-1, 1]) tor.add(box(0.7, H + 0.9, 0.8, beton, 0, (H + 0.9) / 2, sz * (B / 2 + 0.4)));
  const loch = new THREE.Mesh(new THREE.PlaneGeometry(B, H), innen);
  loch.rotation.y = Math.PI / 2;
  loch.position.set(sinn * 1.2, H / 2, 0);   // knapp hinter dem Rahmen
  loch.material.side = THREE.DoubleSide;
  tor.add(loch);
  // Ende der Röhre verschließen
  const e = pfadPunkt(pf, s0 + sinn * (portal + LAENGE));
  const ende = new THREE.Mesh(new THREE.PlaneGeometry(B, H), innen);
  ende.position.set(e.x, y + H / 2, e.z);
  ende.rotation.y = Math.atan2(-e.tz, e.tx) + Math.PI / 2;
  g.add(tor, ende);
  return g;
}

// Ueberlappende Flaechen per Stencil nur einmal zeichnen - spart das Flimmern an Kreuzungen.
// Echtes CSG waere sauberer, ist mir fuer den Zweck aber zu teuer.
let STENCIL_NR = 0;
const neueGruppe = () => (STENCIL_NR = (STENCIL_NR % 250) + 1);
function vereinigt(m, nr = neueGruppe()) {
  m.stencilWrite = true;
  m.stencilRef = nr;
  m.stencilFunc = THREE.NotEqualStencilFunc;
  m.stencilZPass = THREE.ReplaceStencilOp;
  return m;
}

// Gleis zwischen zwei Bogenlaengen
function gleisAbschnitt(pf, von, bis, y) {
  const g = new THREE.Group();
  const pts = [];
  for (let s = von; s <= bis + 0.01; s += 2.5) { const q = pfadPunkt(pf, s); pts.push([q.x, q.z, q.tx, q.tz]); }
  const linie = (versatz) => pts.map(([x, z, tx, tz]) => [x - tz * versatz, z + tx * versatz]);
  g.add(baender([{ p: linie(0) }], 3.3, y, mat(F.gleis, { side: THREE.DoubleSide })));
  const schiene = mat(0xb9c0c7, { metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide });
  for (const v of [-0.72, 0.72]) g.add(baender([{ p: linie(v) }], 0.16, y + 0.12, schiene));
  const schwelle = mat(0x6b5a48);
  for (let i = 0; i < pts.length; i++) {
    const [x, z, tx, tz] = pts[i];
    const sw = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 2.5), schwelle);
    sw.position.set(x, y + 0.05, z);
    sw.rotation.y = Math.atan2(-tz, tx);
    g.add(sw);
  }
  return g;
}

// Glasaufzug mit sichtbarer Kabine
function aufzugModell(a, yo, yu) {
  const g = new THREE.Group();
  g.position.set(a.x, 0, a.z);
  const B = 2.3, kopf = 3.1, oben = yo + kopf;
  const stahl = mat(0x8a949e, { metalness: 0.6, roughness: 0.35 });
  const glas = new THREE.MeshStandardMaterial({ color: 0x9fd0e6, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.14, oben - yu, 0.14, stahl, sx * B / 2, (oben + yu) / 2, sz * B / 2));
  for (let y = yu; y <= oben + 0.01; y += (oben - yu) / Math.max(2, Math.round((oben - yu) / 3))) {
    for (const s of [-1, 1]) {
      g.add(box(B, 0.1, 0.1, stahl, 0, y, s * B / 2));
      g.add(box(0.1, 0.1, B, stahl, s * B / 2, y, 0));
    }
  }
  for (const s of [-1, 1]) {
    const w1 = new THREE.Mesh(new THREE.PlaneGeometry(B, oben - yu), glas); w1.position.set(0, (oben + yu) / 2, s * B / 2); g.add(w1);
    const w2 = new THREE.Mesh(new THREE.PlaneGeometry(B, oben - yu), glas); w2.position.set(s * B / 2, (oben + yu) / 2, 0); w2.rotation.y = Math.PI / 2; g.add(w2);
  }
  g.add(box(B + 0.5, 0.16, B + 0.5, mat(0xdfe3e6), 0, oben + 0.08, 0));      // Dach
  g.add(box(B + 0.06, 0.34, B + 0.06, mat(F.uBlau), 0, oben - 0.3, 0));      // blaues Band am Kopf
  // Kabine
  const k = new THREE.Group();
  const kb = B - 0.5, kh = 2.3;
  k.add(box(kb, 0.12, kb, stahl, 0, 0.06, 0));
  k.add(box(kb, 0.12, kb, stahl, 0, kh, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.add(box(0.08, kh, 0.08, stahl, sx * kb / 2, kh / 2, sz * kb / 2));
  const kglas = new THREE.MeshStandardMaterial({ color: 0xcfeaf5, roughness: 0.1, transparent: true, opacity: 0.3, depthWrite: false });
  const kk = new THREE.Mesh(new THREE.BoxGeometry(kb - 0.1, kh - 0.2, kb - 0.1), kglas); kk.position.y = kh / 2; k.add(kk);
  k.add(box(0.9, 1.05, 0.06, mat(0x3b4650), 0, 0.6, kb / 2));                 // Brüstung an der Türseite
  const lampe = new THREE.Mesh(new THREE.BoxGeometry(kb * 0.6, 0.05, kb * 0.6), new THREE.MeshBasicMaterial({ color: 0xfff4cf }));
  lampe.position.y = kh - 0.1; k.add(lampe);
  k.position.y = yu;
  g.add(k);
  return { gruppe: g, kabine: k, yu, yo, start: (a.x * 7 + a.z * 13) % 16 };
}

// Bahnsteig-Moeblierung, lokal: x laengs, z quer.
// Anzeiger und Schilder haengen quer, sonst liest man sie von der Seite nicht.
function bahnsteigAusstattung(a, name, hindernisse = []) {
  const g = new THREE.Group();
  const tafeln = [];
  // frei = kein Treppenfuß, keine Rolltreppe, kein Aufzug in der Nähe
  const frei = (x, z, rx, rz) => !hindernisse.some(([hx, hz]) => Math.abs(hx - x) < rx && Math.abs(hz - z) < rz);
  const platz = (x, z, rx, rz) => { for (const dxv of [0, 5, -5, 10, -10, 15, -15]) if (Math.abs(x + dxv) < a.laenge / 2 - 3 && frei(x + dxv, z, rx, rz)) return x + dxv; return null; };
  for (const x of [-a.laenge * 0.22, a.laenge * 0.24]) {
    const t = liveTafel();
    const px = platz(x, 0, 2.4, 2.6);
    t.gruppe.rotation.y = Math.PI / 2;
    t.gruppe.position.set(px ?? x, 0, 0);
    t.gruppe.visible = px !== null;
    g.add(t.gruppe);
    tafeln.push(t);
  }
  for (const x of [-a.laenge * 0.4, -a.laenge * 0.05, a.laenge * 0.4]) {
    const px = platz(x, 0, 1.6, 2.6);
    if (px === null) continue;
    const sch = stationsschild(name);
    sch.rotation.y = Math.PI / 2;
    sch.position.set(px, 0, 0);
    g.add(sch);
  }
  if (a.halb > 2.4) {
    for (let x = -a.laenge / 2 + 9; x <= a.laenge / 2 - 9; x += 12) {
      if (!frei(x, 0, 2.2, 2.4)) continue; // keine Stütze in Treppen, Rolltreppen oder Aufzügen
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.6, 8), mat(F.beton));
      st.position.set(x, 1.8, 0);
      g.add(st);
    }
  }
  const versatz = a.halb > 2.6 ? 0.34 : 0;
  for (const x of [-a.laenge * 0.31, -a.laenge * 0.13, a.laenge * 0.1, a.laenge * 0.31]) {
    const px = platz(x, 0, 2.6, 2.4);
    if (px === null) continue;
    const b1 = sitzbank(); b1.position.set(px, 0, versatz); g.add(b1);
    if (versatz) { const b2 = sitzbank(); b2.rotation.y = Math.PI; b2.position.set(px, 0, -versatz); g.add(b2); }
  }
  for (const x of [-a.laenge * 0.18, a.laenge * 0.19]) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.75, 10), mat(0x4a525a, { metalness: 0.5 }));
    if (frei(x, 0.9, 1.6, 1.6)) { m.position.set(x, 0.38, 0.9); g.add(m); }
  }
  // weiße Sicherheitslinie an beiden Kanten
  for (const sz of [-1, 1]) g.add(box(a.laenge - 2, 0.02, 0.12, mat(0xffffff), 0, 0.012, sz * (a.halb - 0.55)));
  g.userData.tafeln = tafeln;
  return g;
}

// Loch im Boden: schreibt nur Stencil, der Boden wird dort uebersprungen
function loch(breite, laenge, nr, order) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(breite, laenge), new THREE.MeshBasicMaterial({
    colorWrite: false, depthWrite: false, transparent: true, side: THREE.DoubleSide,
    stencilWrite: true, stencilRef: nr, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp,
  }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = order;
  return m;
}

// Prellbock am Gleisende eines Kopfbahnhofs
function prellbock(pf, s, y) {
  const q = pfadPunkt(pf, s), g = new THREE.Group();
  g.position.set(q.x, y, q.z);
  g.rotation.y = Math.atan2(-q.tz, q.tx);
  const rot = mat(F.vagRot), stahl = mat(0x4f565d, { metalness: 0.6 });
  g.add(box(0.5, 1.0, 2.6, stahl, 0, 0.6, 0));
  g.add(box(0.3, 0.5, 2.9, rot, 0, 1.25, 0));
  for (const sz of [-0.72, 0.72]) { const st = box(1.6, 0.18, 0.18, stahl, -0.7, 0.55, sz); st.rotation.z = 0.5; g.add(st); }
  const lampe = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  lampe.position.set(0, 1.7, 0); g.add(lampe);
  return g;
}

function imPolygon(x, z, poly) {
  let drin = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) drin = !drin;
  }
  return drin;
}

const WANDFARBEN = [0xe4d6c0, 0xd9c4a8, 0xd8b98f, 0xcfd3d6, 0xe8dccb, 0xc9b79c];

function baueGeoWelt(welt, station, zugangsObjekte) {
  const geo = station.geo;
  const rnd = mulberry32(4711);
  const R = 330;
  const ober = new THREE.Group(); // Gebäude, Bäume, Mauern: lassen sich ausblenden
  welt.add(ober);
  const bodenNr = neueGruppe();

  // ---- Oberfläche ----
  const boden = new THREE.Mesh(
    new THREE.CircleGeometry(R * 1.15, 64),
    vereinigt(new THREE.MeshStandardMaterial({ color: F.boden, roughness: 1, transparent: true, opacity: 0.2, depthWrite: false }), bodenNr)
  );
  boden.rotation.x = -Math.PI / 2;
  boden.receiveShadow = true;
  boden.renderOrder = 2;
  welt.add(boden);

  const durchsichtig = (color, opacity) =>
    new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });

  // Straßen und Fußgängerzonen teilen sich eine Stencil-Gruppe: wo sie sich kreuzen, wird nur einmal gezeichnet
  const strassenNr = neueGruppe();
  const fahr = baender(geo.strassen.filter((s) => !s.fuss), 8, 0.12, vereinigt(durchsichtig(F.strasse, 0.38), strassenNr));
  const fuss = baender(geo.strassen.filter((s) => s.fuss), 8, 0.12, vereinigt(durchsichtig(0xd9cdb8, 0.4), strassenNr));
  fahr.renderOrder = 3; fuss.renderOrder = 3.1;
  welt.add(fahr, fuss);
  const tram = baender(geo.tram, 1.1, 0.24, vereinigt(durchsichtig(0x8a1f8f, 0.75)));
  const bahn = baender(geo.bahn, 1.4, 0.34, vereinigt(durchsichtig(0x5a6068, 0.8)));
  tram.renderOrder = 4; bahn.renderOrder = 4.1;
  welt.add(tram, bahn);

  for (const g of geo.gruen) {
    const m = flaeche(g, 0.1, mat(F.gruen), 0.4);
    m.receiveShadow = true;
    ober.add(m);
    const n = Math.min(14, Math.round(polyFlaeche(g) / 500));
    const [cx, cz] = mitte(g);
    for (let i = 0; i < n; i++) {
      const q = g[Math.floor(rnd() * g.length)], t = 0.15 + rnd() * 0.7;
      const b = baum(rnd);
      b.position.set(cx + (q[0] - cx) * t, 0.4, cz + (q[1] - cz) * t);
      ober.add(b);
    }
  }
  for (const w of geo.wasser ?? []) { const m = flaeche(w, 0.12, mat(0x9cc9e8, { roughness: 0.3 }), 0.2); ober.add(m); }
  for (const [x, z] of geo.baeume) { const b = baum(rnd); b.position.set(x, 0, z); ober.add(b); }

  // Stadtmauer
  const mauerMat = mat(F.sandstein);
  for (const l of geo.mauer) {
    for (let i = 0; i < l.length - 1; i++) {
      const [x1, z1] = l[i], [x2, z2] = l[i + 1];
      const len = Math.hypot(x2 - x1, z2 - z1);
      if (len < 0.5) continue;
      const w = box(len + 1, 8, 2.6, mauerMat, (x1 + x2) / 2, 4, (z1 + z2) / 2);
      w.rotation.y = Math.atan2(-(z2 - z1), x2 - x1);
      ober.add(w);
    }
  }

  // Bahnsteige der DB (oberirdisch)
  for (const s of geo.dbsteige) if (s.p.length >= 3) ober.add(flaeche(s.p, 0.3, mat(0xd6d9dc), 1.0));

  // Gebäude aus echten Grundrissen
  const dachRot = mat(F.dach), dachGrau = mat(F.dachGrau);
  let gebNr = 0;
  const dachHoehen = [];
  for (const b of geo.gebaeude) {
    const [cx, cz] = mitte(b.p);
    const name = b.name ?? "";
    const istTurm = /turm/i.test(name) || (name.length > 0 && name.length <= 4 && b.h >= 15);
    const istBahnhof = b.art === "train_station" && /Hauptbahnhof/.test(name);
    let h = istTurm && /turm/i.test(name) ? 34 : b.h;
    if (istBahnhof) h = 19;
    h += (gebNr++ % 11) * 0.04; // gleich hohe Nachbarn bekommen nie exakt dieselbe Dachhöhe

    let wand;
    if (istBahnhof) wand = new THREE.MeshStandardMaterial({ color: F.sandstein, roughness: 0.85, flatShading: true, transparent: true, opacity: 0.55 });
    else if (b.art === "roof") wand = mat(0xe3e6e8);
    else if (b.art === "parking" || b.art === "train_station") wand = mat(F.beton);
    else if (b.art === "church" || istTurm) wand = mat(F.sandstein);
    else wand = mat(WANDFARBEN[Math.floor(rnd() * WANDFARBEN.length)]);

    dachHoehen.push({ p: b.p, h: h + (istBahnhof ? 2.6 : 1.2) });
    const koerper = flaeche(b.p, 0, wand, h, 0.988);
    koerper.castShadow = !istBahnhof;
    koerper.receiveShadow = true;
    if (istBahnhof) koerper.renderOrder = 6;
    ober.add(koerper);

    if (istTurm) {
      const r = Math.sqrt(polyFlaeche(b.p) / Math.PI);
      const hut = new THREE.Mesh(new THREE.ConeGeometry(r * 1.12, h * 0.45, 10), dachRot);
      hut.position.set(cx, h + h * 0.225, cz);
      hut.castShadow = true;
      ober.add(hut);
    } else if (!istBahnhof) {
      const flach = b.dach === "flat" || b.art === "roof" || b.art === "train_station" || b.art === "parking" || b.art === "office" || b.art === "hotel" || h > 24;
      const kappe = flach
        ? flaeche(b.p, h, dachGrau, 0.7, 0.93)
        : flaeche(b.p, h, dachRot, Math.min(4.5, 1.5 + Math.sqrt(polyFlaeche(b.p)) * 0.07), 0.8);
      kappe.castShadow = true;
      ober.add(kappe);
    } else {
      ober.add(flaeche(b.p, h, new THREE.MeshStandardMaterial({ color: 0x6d7f77, flatShading: true, transparent: true, opacity: 0.5 }), 2.5, 0.92));
    }

    const zeigen = istBahnhof || /turm/i.test(name) || (name.length > 4 && polyFlaeche(b.p) > 900);
    if (zeigen) {
      const l = beschriftung(name.replace("Nürnberg ", ""), "ort");
      l.position.set(cx, h + (istTurm ? h * 0.5 : 6) + 6, cz);
      ober.add(l);
    }
  }

  // ---- Untergrund: keine Wände, nur Böden, Treppen, Bahnsteige ----
  const glasBoden = (farbe, op) => new THREE.MeshStandardMaterial({
    color: farbe, roughness: 0.3, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide,
  });
  const jeEbene = {}, ebenenNr = {};
  for (const w of geo.wege) (jeEbene[w.level] ??= []).push(w);
  const nrFuer = (level) => (ebenenNr[level] ??= neueGruppe());
  for (const r of geo.raeume) {
    const laden = r.art === "room";
    const m = flaeche(r.p, ly(r.level) + 0.06, vereinigt(glasBoden(laden ? 0xf0c98a : F.glasBoden, laden ? 0.5 : 0.35), nrFuer(r.level)));
    m.renderOrder = 1;
    welt.add(m, kanten(m, laden ? 0xb9853a : F.kante, 0.5));
    if (r.name === "VAG Kundencenter") {
      const l = beschriftung(r.name, "ort");
      const [cx, cz] = mitte(r.p);
      l.position.set(cx, ly(r.level) + 5, cz);
      welt.add(l);
    }
  }
  for (const [level, wege] of Object.entries(jeEbene)) {
    const b = baender(wege, Number(level) <= -3 ? 3 : 5, ly(level) + 0.06, vereinigt(glasBoden(F.glasBoden, 0.55), nrFuer(level)));
    b.renderOrder = 1.5; // nach den Räumen: wo schon ein Raum liegt, wird der Gang nicht doppelt gezeichnet
    welt.add(b);
  }

  // ---- Bahnsteige und Gleise ----
  // OSM-Bahnsteige sind oft nur Kantenstreifen und liegen dann mitten im Gleis.
  // Also nur Lage/Laenge/Ebene von dort nehmen und die Flaeche selbst aus den Gleisen bauen.
  const KANTE = 1.62; // halbe Wagenbreite + Spalt
  const roh = geo.ubahnsteige.map((s) => ({ a: achse(s.p), p: s.p, level: s.level, y: ly(s.level) }));
  const pfade = gleisPfade(geo.ugleise);
  const abschnitte = [];
  for (const r of roh) {
    let kand = pfade.map((pf) => ({ pf, m: pfadProjektion(pf, r.a.cx, r.a.cz) })).filter((k) => k.m.d <= r.a.halb + 7);
    const genau = kand.filter((k) => k.m.level === r.level);
    if (genau.length) kand = genau;
    for (const { pf, m } of kand) {
      const schon = abschnitte.find((x) => x.pfad === pf && Math.abs(x.s0 - m.s) < 40);
      if (schon) { schon.roh.push(r); continue; }
      abschnitte.push({ pfad: pf, s0: m.s, level: r.level, roh: [r], plattformen: [], zug: null });
    }
  }
  const klemme = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const laengeVon = (...abs) => klemme(Math.max(...abs.flatMap((x) => x.roh.map((r) => r.a.laenge))), 60, 125);
  // Punkte entlang eines Gleises, seitlich um `ab` Meter zu einem Zielpunkt hin versetzt
  const kante = (x, len, ziel, ab) => {
    const pts = [];
    for (let s = x.s0 - len / 2; s <= x.s0 + len / 2 + 0.01; s += 4) {
      const q = pfadPunkt(x.pfad, s);
      const seite = Math.sign((ziel[0] - q.x) * -q.tz + (ziel[1] - q.z) * q.tx) || 1;
      pts.push([q.x - q.tz * seite * ab, q.z + q.tx * seite * ab]);
    }
    return pts;
  };
  const ringAus = (A, B) => {
    const d1 = Math.hypot(A[0][0] - B[0][0], A[0][1] - B[0][1]), d2 = Math.hypot(A[0][0] - B[B.length - 1][0], A[0][1] - B[B.length - 1][1]);
    return A.concat(d1 < d2 ? [...B].reverse() : B);
  };
  const plattformen = [];
  const baue = (ring, a, level, y) => {
    const platte = flaeche(ring, y - 1.25, mat(F.bahnsteig), 1.25);
    platte.receiveShadow = true;
    welt.add(platte, kanten(platte, F.kante, 0.5));
    // Hindernisse auf diesem Bahnsteig in dessen lokalem Koordinatensystem
    const c = Math.cos(a.winkel), sn = Math.sin(a.winkel), hind = [];
    const lokal = (x, z) => [(x - a.cx) * c - (z - a.cz) * sn, (x - a.cx) * sn + (z - a.cz) * c];
    for (const t of geo.treppen) {
      if (Math.abs(ly(t.unten) - y) > 0.7 && Math.abs(ly(t.oben) - y) > 0.7) continue;
      const p0 = t.p[0], p1 = t.p[t.p.length - 1], n = Math.max(2, Math.ceil(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 1.5));
      for (let i = 0; i <= n; i++) hind.push(lokal(p0[0] + ((p1[0] - p0[0]) * i) / n, p0[1] + ((p1[1] - p0[1]) * i) / n));
    }
    for (const e of geo.aufzuege) if (ly(e.unten) <= y + 0.7 && ly(e.oben) >= y - 0.7) hind.push(lokal(e.x, e.z));
    const g = bahnsteigAusstattung(a, station.name ?? "", hind);
    g.position.set(a.cx, y, a.cz);
    g.rotation.y = a.winkel;
    welt.add(g);
    const pl = { a, g, tafeln: g.userData.tafeln, level, y };
    plattformen.push(pl);
    return pl;
  };
  // 1) Mittelbahnsteige: zwei parallele Gleise derselben Ebene mit einem OSM-Bahnsteig dazwischen
  const paare = [];
  for (let i = 0; i < abschnitte.length; i++) for (let j = i + 1; j < abschnitte.length; j++) {
    const A = abschnitte[i], B = abschnitte[j];
    if (A.level !== B.level) continue;
    const t = pfadPunkt(A.pfad, A.s0), m = pfadProjektion(B.pfad, t.x, t.z), q = pfadPunkt(B.pfad, m.s);
    if (m.d < 5.5 || m.d > 30 || Math.abs(t.tx * q.tx + t.tz * q.tz) < 0.9) continue;
    const mx = (t.x + q.x) / 2, mz = (t.z + q.z) / 2;
    if (![...A.roh, ...B.roh].some((r) => Math.hypot(r.a.cx - mx, r.a.cz - mz) < m.d / 2 + 3 + r.a.laenge * 0.25)) continue;
    paare.push({ A, B, d: m.d, sB: m.s, mx, mz, t });
  }
  paare.sort((x, y) => x.d - y.d);
  const vergeben = new Set();
  for (const { A, B, d, sB, mx, mz, t } of paare) {
    if (vergeben.has(A) || vergeben.has(B)) continue;
    vergeben.add(A); vergeben.add(B);
    const len = laengeVon(A, B);
    B.s0 = sB; // beide Züge halten auf gleicher Höhe
    const ring = ringAus(kante(A, len, [mx, mz], KANTE), kante(B, len, [mx, mz], KANTE));
    const pl = baue(ring, { cx: mx, cz: mz, winkel: Math.atan2(-t.tz, t.tx), laenge: len, halb: d / 2 - KANTE }, A.level, A.roh[0].y);
    A.plattformen = [pl]; B.plattformen = [pl]; A.len = B.len = len;
  }
  // 2) Seitenbahnsteige: Gleis mit Bahnsteig nur auf einer Seite
  for (const A of abschnitte) {
    if (vergeben.has(A)) continue;
    const r = A.roh[0], len = laengeVon(A), t = pfadPunkt(A.pfad, A.s0);
    let seite = Math.sign((r.a.cx - t.x) * -t.tz + (r.a.cz - t.z) * t.tx) || 1;
    const breite = klemme(r.a.halb * 2, 3.6, 8);
    const ziel = [t.x - t.tz * seite * 20, t.z + t.tx * seite * 20];
    const ring = ringAus(kante(A, len, ziel, KANTE), kante(A, len, ziel, KANTE + breite));
    const ab = KANTE + breite / 2;
    const pl = baue(ring, { cx: t.x - t.tz * seite * ab, cz: t.z + t.tx * seite * ab, winkel: Math.atan2(-t.tz, t.tx), laenge: len, halb: breite / 2 }, A.level, r.y);
    A.plattformen = [pl]; A.len = len;
  }
  // 3) Bahnsteige ohne erkennbares Gleis: OSM-Fläche unverändert
  for (const r of roh) {
    if (abschnitte.some((x) => x.roh.includes(r))) continue;
    baue(r.p, r.a, r.level, r.y);
  }
  // Gleise nur zwischen den Tunnelportalen
  for (const A of abschnitte) {
    A.portal = A.len / 2 + 14;
    const y = A.plattformen[0].y - 1.3;
    A.y = y + 0.2;
    const L = A.pfad.laenge;
    welt.add(gleisAbschnitt(A.pfad, Math.max(0, A.s0 - A.portal - 3), Math.min(L, A.s0 + A.portal + 3), y));
    A.sackgasse = 0;
    for (const sinn of [-1, 1]) {
      const sp = A.s0 + sinn * A.portal;
      if (sp > 8 && sp < L - 8) welt.add(tunnel(A.pfad, A.s0, sinn, A.portal, y));
      else { A.sackgasse = sinn; welt.add(prellbock(A.pfad, sinn < 0 ? 0 : L, y)); } // Gleis endet hier: Kopfbahnhof
    }
  }

  // Öffnung im Boden der Ebene L: Rechteck ab (x,z), gedreht um `drehung`, von z=von bis z=bis
  const oeffnung = (x, z, drehung, breite, von, bis, L) => {
    const setze = (nr, yy, order) => {
      const h = new THREE.Group();
      h.position.set(x, yy, z); h.rotation.y = drehung;
      const m = loch(breite, bis - von, nr, order); m.position.z = (von + bis) / 2;
      h.add(m); welt.add(h);
    };
    if (L === 0) { setze(bodenNr, 0.02, 1.9); setze(strassenNr, 0.14, 2.9); }
    else if (ebenenNr[L] !== undefined) setze(ebenenNr[L], ly(L) + 0.08, 0.9);
  };

  // TODO: Aufzugskabine faehrt nach Timer, nicht nach echter Nutzung
  const aufzuege = [];
  for (const a of geo.aufzuege) {
    const m = aufzugModell(a, ly(a.oben), ly(a.unten));
    welt.add(m.gruppe);
    aufzuege.push(m);
    for (const L of Object.keys(EBENEN_Y).map(Number)) {
      if (L <= a.unten || L > a.oben) continue;
      oeffnung(a.x, a.z, 0, 2.8, -1.4, 1.4, L);
    }
  }

  // Treppen – die, die an der Oberfläche enden, gehören zu einem Zugang
  const stufe = mat(0xb4b8bc), rolltreppe = mat(0x3d444c, { metalness: 0.5, roughness: 0.45 });
  const zuZugang = new Map(station.zugaenge.map((z) => [z.id, []]));
  for (const t of geo.treppen) {
    const oben = t.p[0], unten = t.p[t.p.length - 1];
    let m = t.roll ? rolltreppe : stufe;
    const boden = t.oben === 0 ? oben : t.unten === 0 ? unten : null;
    if (boden) {
      let naechster = null, dist = 22;
      for (const z of station.zugaenge) {
        const d = Math.hypot(z.x - boden[0], z.z - boden[1]);
        if (d < dist) { dist = d; naechster = z; }
      }
      if (naechster) {
        m = m.clone();
        m.userData.grund = m.color.getHex();
        zuZugang.get(naechster.id).push(m);
      }
    }
    const tg = treppeZwischen(oben, unten, ly(t.oben), ly(t.unten), m, t.roll);
    welt.add(tg);
    // Deckenöffnung in jeder Ebene, die die Treppe durchstößt (oberes Ende und alles dazwischen)
    for (const L of Object.keys(EBENEN_Y).map(Number)) {
      if (L <= t.unten || L > t.oben) continue;
      oeffnung(oben[0], oben[1], tg.rotation.y, tg.userData.breite + 0.5, tg.userData.start, tg.userData.ende, L);
    }
  }

  // Marker je Zugang
  for (const zg of station.zugaenge) {
    const gruppe = new THREE.Group();
    // Liegt der Zugang in einem Gebäude, stehen Schild und Markierung auf dessen Dach statt darin
    const haus = dachHoehen.find((d) => imPolygon(zg.x, zg.z, d.p));
    gruppe.position.set(zg.x, haus ? haus.h : 0, zg.z);
    const schild = uSchild();
    schild.scale.setScalar(0.42);
    schild.position.set(3.5, 0, 0);
    gruppe.add(schild);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(9, 12, 40),
      new THREE.MeshBasicMaterial({ color: F.highlight, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.5;
    ring.renderOrder = 5;
    gruppe.add(ring);

    const pfeil = new THREE.Mesh(new THREE.ConeGeometry(5, 12, 4), mat(F.highlight, { emissive: 0x703000 }));
    pfeil.rotation.x = Math.PI;
    pfeil.position.y = 34;
    pfeil.visible = false;
    gruppe.add(pfeil);

    const label = beschriftung(kurz(zg.name));
    label.position.set(0, 12, 0);
    gruppe.add(label);

    welt.add(gruppe);
    zugangsObjekte.set(zg.id, { mats: zuZugang.get(zg.id), gaenge: [], ring, pfeil, label, daten: zg, pfeilY: 34, labelY: 12 });
  }
  return { R, plattformen, abschnitte, aufzuege, ober };
}

// ------------------------------------------------------------------
// Szene
// ------------------------------------------------------------------
export class StationsSzene {
  constructor(canvas) {
    this.canvas = canvas;
    // logarithmischer Tiefenpuffer: kein Flimmern mehr zwischen dicht übereinanderliegenden Flächen
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, stencil: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(F.himmel);
    this.scene.fog = new THREE.Fog(F.himmel, 700, 1900);

    this.camera = new THREE.PerspectiveCamera(40, 1, 1, 3000);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.62; // auch von schräg unten in die Station schauen
    this.controls.minDistance = 12;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b0a4, 1.05));
    const sonne = new THREE.DirectionalLight(0xfff1dc, 1.6);
    sonne.position.set(-180, 300, 160);
    sonne.castShadow = true;
    sonne.shadow.mapSize.set(2048, 2048);
    const d = 380;
    Object.assign(sonne.shadow.camera, { left: -d, right: d, top: d, bottom: -d, near: 1, far: 1000 });
    sonne.shadow.bias = -0.0005;
    this.scene.add(sonne);

    this.welt = new THREE.Group();
    this.scene.add(this.welt);
    this.zugangsObjekte = new Map();
    this.uhr = new THREE.Clock();
    this.aktiv = null;

    this.beobachter = new ResizeObserver(() => this.resize());
    this.beobachter.observe(canvas.parentElement);
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  resize() {
    const el = this.canvas.parentElement;
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // Schilder haben feste Bildschirmgröße relativ zur Höhe – im Hochformat verkleinern
    LABEL_K = Math.min(1, Math.max(0.42, (w / h) * 0.72));
    this.schmal = w < 560;
    this.welt?.traverse((o) => {
      if (o.isSprite && o.userData.basis) o.scale.set(o.userData.basis[0] * LABEL_K, o.userData.basis[1] * LABEL_K, 1);
    });
    this.zeigeLabels();
  }

  // Auf schmalen Bildschirmen nur das Schild des gewählten Ausgangs zeigen
  zeigeLabels() {
    for (const [id, o] of this.zugangsObjekte ?? []) o.label.visible = !this.schmal || id === this.aktiv;
  }

  leeren() {
    this.welt.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      }
    });
    this.welt.clear();
    this.zugangsObjekte.clear();
    this.zuordnung = {};
    this.aktiv = null;
  }

  aufbauen(station) {
    this.leeren();
    this.station = station;
    const { R, plattformen, abschnitte, aufzuege, ober } = baueGeoWelt(this.welt, station, this.zugangsObjekte);
    this.plattformen = plattformen;
    this.abschnitte = abschnitte;
    this.aufzuege = aufzuege;
    this.ober = ober;
    this.gleise = {};
    this.abfahrten = [];
    const n = Math.max(plattformen.length, 1);
    const cx = plattformen.reduce((t, p) => t + p.a.cx, 0) / n, cz = plattformen.reduce((t, p) => t + p.a.cz, 0) / n;
    this.controls.target.set(cx, -10, cz);
    this.camera.position.set(cx + 50, 150, cz + 130);
    this.controls.maxDistance = R * 3;
    this.controls.update();
    return;
  }

  hervorheben(zugangId) {
    this.aktiv = zugangId;
    for (const [id, o] of this.zugangsObjekte) {
      const an = id === zugangId;
      for (const m of o.mats) {
        m.color.set(an ? F.highlight : m.userData.grund);
        m.emissive.set(an ? 0x5a2c00 : 0x000000);
      }
      for (const m of o.gaenge) {
        m.color.set(an ? F.highlight : F.glasBoden);
        m.opacity = an ? 0.9 : 0.5;
      }
      o.ring.material.opacity = an ? 0.85 : 0;
      o.pfeil.visible = an;
      const neu = beschriftung(kurz(o.daten.name), an ? "aktiv" : "zugang");
      o.label.material.map.dispose();
      o.label.material.map = neu.material.map;
      o.label.material.needsUpdate = true;
      o.label.scale.copy(neu.scale);
      o.label.userData.basis = neu.userData.basis;
      o.label.renderOrder = neu.renderOrder;
      o.label.position.y = o.labelY + (an ? 6 : 0);
      neu.material.dispose();
    }
    this.zeigeLabels();
  }

  // abf: [{linie, ziel, ist: Date, haltepunkt, x, z}] – Position des Haltepunkts in lokalen Metern
  setAbfahrten(abf) {
    this.abfahrten = abf;
    const A = this.abschnitte ?? [];
    if (!A.length) { for (const d of abf) d.plattform = this.plattformen?.[0]; return this.aktualisiereTafeln(); }
    // Jedes Gleis bekommt seinen eigenen Abschnitt (den naechsten freien).
    // Bei zwei Ebenen uebereinander: gleiche Fahrtrichtung -> gleiche Ebene.
    const neu = [...new Set(abf.map((d) => d.haltepunkt))].filter((h) => !this.gleise[h]).sort();
    for (const h of neu) {
      const d = abf.find((x) => x.haltepunkt === h);
      const belegt = new Set(Object.values(this.gleise));
      const bewertet = A.map((x) => ({ x, e: pfadProjektion(x.pfad, d.x, d.z).d })).sort((p, q) => p.e - q.e);
      let kand = bewertet.filter((k) => !belegt.has(k.x) && k.e <= bewertet[0].e + 6);
      if (!kand.length) kand = bewertet.filter((k) => !belegt.has(k.x));
      if (!kand.length) kand = bewertet;
      const kopf = (v) => Math.sign(Math.abs(v.dx) > Math.abs(v.dz) ? v.dx : v.dz);
      const gleicheRichtung = Object.entries(this.gleise).filter(([h2]) => { const o = abf.find((y) => y.haltepunkt === h2); return o && kopf(o) === kopf(d); }).map(([, g]) => g.plattformen[0]?.level);
      const best = (kand.find((k) => gleicheRichtung.includes(k.x.plattformen[0]?.level)) ?? kand[0]).x;
      if (!best.zug) { best.zug = zug(Math.min(best.plattformen[0].a.laenge * 0.85, 75.9)); best.zug.visible = false; this.welt.add(best.zug); }
      this.gleise[h] = best;
    }
    for (const d of abf) {
      const gl = this.gleise[d.haltepunkt];
      if (!gl) continue;
      d.plattform = gl.plattformen[0];
      // Fahrtrichtung: entlang des Gleises in Richtung der nächsten Station
      const t = pfadPunkt(gl.pfad, gl.s0);
      d.sinn = t.tx * d.dx + t.tz * d.dz >= 0 ? 1 : -1;
    }
    this.aktualisiereTafeln();
  }

  aktualisiereTafeln() {
    const jetzt = Date.now();
    for (const p of this.plattformen ?? []) {
      const zeilen = this.abfahrten.filter((d) => d.plattform === p && d.ist - jetzt > -15000).slice(0, 3).map((d) => {
        const m = Math.round((d.ist - jetzt) / 60000);
        return { linie: d.linie, ziel: d.ziel, min: m <= 0 ? "sofort" : `${m} min` };
      });
      const sig = JSON.stringify(zeilen);
      if (sig !== p.sig) { p.sig = sig; p.tafeln.forEach((t) => t.zeichne(zeilen)); }
    }
  }

  bewegeZuege() {
    const jetzt = Date.now();
    for (const [hp, gl] of Object.entries(this.gleise ?? {})) {
      const d = this.abfahrten.find((x) => x.haltepunkt === hp && x.ist - jetzt > -16000);
      const dt = d ? (d.ist - jetzt) / 1000 : Infinity;
      const weit = gl.portal + 130;
      let versatz;
      if (d && (d.kopf || gl.sackgasse)) {
        // Endstation: rein, ~2,5 min stehen, in dieselbe Richtung wieder raus.
        if (dt > 200) { gl.zug.visible = false; continue; }
        if (dt > 165) versatz = weit * Math.pow(1 - (200 - dt) / 35, 3);
        else if (dt > 0) versatz = 0;
        else versatz = weit * Math.pow(-dt / 16, 3);
      } else {
        if (dt > 55) { gl.zug.visible = false; continue; }
        if (dt > 20) versatz = -weit * Math.pow(1 - (55 - dt) / 35, 3);   // einfahren und bremsen
        else if (dt > 0) versatz = 0;                                     // steht am Bahnsteig
        else versatz = weit * Math.pow(-dt / 16, 3);                      // anfahren
      }
      gl.zug.visible = true;
      for (const w of gl.zug.userData.wagen) {
        const q = pfadPunkt(gl.pfad, gl.s0 + d.sinn * versatz + w.userData.x0);
        w.position.set(q.x, gl.y, q.z);
        w.rotation.y = Math.atan2(-q.tz, q.tx);
        w.visible = Math.abs(d.sinn * versatz + w.userData.x0) < gl.portal + 13;
      }
    }
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.beobachter?.disconnect();
    this.leeren();
    this.controls.dispose();
    this.renderer.dispose();
  }

  tick() {
    const t = this.uhr.getElapsedTime();
    this.bewegeZuege();
    // Gebäude verschwinden auf Wunsch und sobald die Kamera unter die Straßenebene taucht
    if (this.ober) this.ober.visible = !this.gebaeudeAus && this.camera.position.y > 1.5;
    for (const a of this.aufzuege ?? []) {
      const ph = (t + a.start) % 16;  // unten warten, hochfahren, oben warten, runterfahren
      const k = ph < 3 ? 0 : ph < 7 ? (ph - 3) / 4 : ph < 11 ? 1 : 1 - (ph - 11) / 5;
      a.kabine.position.y = a.yu + (a.yo - a.yu) * k * k * (3 - 2 * k);
    }
    if (Math.floor(t) !== this.letzteSekunde) { this.letzteSekunde = Math.floor(t); if (this.letzteSekunde % 5 === 0) this.aktualisiereTafeln(); }
    const o = this.aktiv && this.zugangsObjekte.get(this.aktiv);
    if (o) {
      const p = (Math.sin(t * 3) + 1) / 2;
      o.ring.scale.setScalar(1 + p * 0.3);
      o.ring.material.opacity = 0.9 - p * 0.5;
      o.pfeil.position.y = o.pfeilY + Math.sin(t * 3) * 4;
      o.pfeil.rotation.y = t * 1.5;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
