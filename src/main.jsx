import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(<App />);

// Optionale lokale Zusatzmodule (nicht im Repo), z.B. Statistik. Fehlen sie, passiert nichts.
Object.values(import.meta.glob("./lib/lokal/*.js", { eager: true })).forEach((m) => m.default?.());
