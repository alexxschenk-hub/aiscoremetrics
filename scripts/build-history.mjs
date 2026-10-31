// Preisverlauf für die Seite /preise/: data/history.csv → public/data/history.json
// Pro Gerät und Tag zählt die letzte Zeile (das Preis-Script schreibt bei Neustarts mehrere).
// Läuft nach jedem Preis-Update (update-prices.mjs) und in build-seo.mjs.
import { readFileSync, writeFileSync } from "node:fs";

export function buildHistory() {
  const csv = readFileSync(new URL("../data/history.csv", import.meta.url), "utf8").trim().split("\n").slice(1);
  const { devices } = JSON.parse(readFileSync(new URL("../public/data/devices.json", import.meta.url), "utf8"));
  const byDev = new Map(), dates = new Set();
  for (const line of csv) {
    const [date, id, price] = line.split(","), p = Number(price);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !(p > 0)) continue;
    dates.add(date);
    if (!byDev.has(id)) byDev.set(id, new Map());
    byDev.get(id).set(date, p);
  }
  const days = [...dates].sort();
  const series = [...byDev].map(([id, m]) => {
    const d = devices.find((x) => x.id === id);
    return d ? { id, name: /\bGB\b/.test(d.name) ? d.name : `${d.name} · ${d.mem} GB`, v: d.v, prices: days.map((x) => m.get(x) ?? null) } : null;
  })
    // nur Geräte mit laufender Erfassung: mind. 2 Werte und ein Wert in den letzten 3 Tagen (z. B. RTX 5090 hat einen manuellen Preis)
    .filter((x) => x && x.prices.filter((p) => p != null).length >= 2 && x.prices.slice(-3).some((p) => p != null))
    .sort((a, b) => a.name.localeCompare(b.name, "de", { numeric: true }));
  const data = { note: "Erzeugt von scripts/build-history.mjs aus data/history.csv. Euro inkl. MwSt., Deutschland.", dates: days, series };
  writeFileSync(new URL("../public/data/history.json", import.meta.url), JSON.stringify(data) + "\n");
  return data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const h = buildHistory();
  console.log(`history.json: ${h.series.length} Geräte, ${h.dates.length} Tage (${h.dates[0]} – ${h.dates.at(-1)})`);
}
