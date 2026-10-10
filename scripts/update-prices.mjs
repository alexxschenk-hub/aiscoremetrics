#!/usr/bin/env node
// Holt aktuelle GPU-Preise von gpuprix.com und schreibt public/data/prices.json.
// Läuft täglich per GitHub Action (.github/workflows/update-prices.yml), lokal mit: node scripts/update-prices.mjs
// Keine Abhängigkeiten, Node >= 20 (globales fetch).

import { readFile, writeFile, appendFile, access } from "node:fs/promises";

const REGION = process.env.PRICE_REGION || "germany";          // gpuprix-Region (Österreich gibt es dort nicht)
const SITE = process.env.SITE_URL || "https://aiscoremetrics.com";      // deine Domain, wird im User-Agent mitgeschickt
const DELAY_MS = 2000;                                            // höflicher Abstand zwischen Abrufen
const MAX_JUMP = 2.0;                                             // Preis darf sich pro Lauf max. verdoppeln/halbieren

const DEVICES_FILE = "public/data/devices.json";
const PRICES_FILE = "public/data/prices.json";
const HISTORY_FILE = "data/history.csv";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round = (n) => Math.round(n);

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
}

async function fetchGpuprix(slug) {
  const url = `https://gpuprix.com/${REGION}/gpus/${slug}`;
  const res = await fetch(url, {
    headers: { "User-Agent": `AIScoreMetricsBot/1.0 (+${SITE}) daily price check`, "Accept": "text/html" },
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} für ${url}`);
  const html = await res.text();
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`Keine Seitendaten gefunden (${url}), Seitenaufbau geändert?`);
  const pp = JSON.parse(m[1])?.props?.pageProps ?? {};
  return {
    url,
    low: Number(pp.regionSeo?.lowestPrice) || null,
    median3m: Number(pp.priceStats?.median3mo) || null,
    currency: pp.regionSeo?.currency || pp.priceStats?.currency || null,
    asOf: pp.lastUpdated ? new Date(Number(pp.lastUpdated)).toISOString() : null
  };
}

async function main() {
  const { devices } = await readJson(DEVICES_FILE, { devices: [] });
  const old = await readJson(PRICES_FILE, { prices: {} });
  const prices = { ...old.prices };
  const today = new Date().toISOString().slice(0, 10);
  const history = [];
  let ok = 0, failed = 0, kept = 0;

  const targets = devices.filter((d) => d.source?.gpuprix);
  for (const d of targets) {
    try {
      const r = await fetchGpuprix(d.source.gpuprix);
      if (r.currency && r.currency !== "EUR") throw new Error(`Währung ${r.currency} statt EUR`);
      const metric = d.source.metric || "low";
      const value = r[metric];
      if (!(value > 0)) throw new Error(`Kein Wert für "${metric}"`);
      const prev = prices[d.id]?.price;
      if (prev && (value > prev * MAX_JUMP || value < prev / MAX_JUMP)) {
        console.log(`::warning::${d.name}: ${prev} → ${round(value)} € verworfen (Sprung > ${MAX_JUMP}×). Bitte manuell prüfen: ${r.url}`);
        kept++;
        continue;
      }
      prices[d.id] = { price: round(value), metric, source: "gpuprix", region: REGION, asOf: r.asOf || new Date().toISOString(), url: r.url };
      history.push(`${today},${d.id},${round(value)},${metric}`);
      console.log(`✓ ${d.name.padEnd(24)} ${String(round(value)).padStart(6)} € (${metric})`);
      ok++;
    } catch (e) {
      console.log(`::warning::${d.name}: ${e.message}. Alter Preis bleibt.`);
      failed++;
    }
    await sleep(DELAY_MS);
  }

  await writeFile(PRICES_FILE, JSON.stringify({ updatedAt: new Date().toISOString(), region: REGION, prices }, null, 2) + "\n");
  try { await access(HISTORY_FILE); } catch { await writeFile(HISTORY_FILE, "date,device,price_eur,metric\n"); }
  if (history.length) await appendFile(HISTORY_FILE, history.join("\n") + "\n");

  console.log(`\n${ok} aktualisiert, ${kept} wegen Preissprung behalten, ${failed} fehlgeschlagen.`);
  if (targets.length && ok === 0 && kept === 0) process.exit(1); // alles kaputt: Action soll rot werden
}

main().catch((e) => { console.error(e); process.exit(1); });
