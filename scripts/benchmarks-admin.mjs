// Community-Benchmarks moderieren, ohne Browser:
//   BENCH_ADMIN_KEY=… npm run bench -- pending
//   BENCH_ADMIN_KEY=… npm run bench -- approve <id> | reject <id> | delete <id>
//   npm run bench -- export        schreibt alle freigegebenen Messungen nach public/data/benchmarks.json
// API-Adresse: BENCH_API (Standard https://aiscoremetrics.com/api/benchmarks)
import { readFileSync, writeFileSync } from "node:fs";

const API = (process.env.BENCH_API || "https://aiscoremetrics.com/api/benchmarks").replace(/\/+$/, "");
const KEY = process.env.BENCH_ADMIN_KEY || "";
const [cmd, id] = process.argv.slice(2);

async function req(path, opts = {}) {
  const res = await fetch(API + path, { ...opts, headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${data.error || res.statusText}`);
  return data;
}
const line = (b) => `${b.id}  ${b.flagged ? "⚠️ " : ""}${b.deviceName} · ${b.modelName} ${b.quantization} · ${b.tokensPerSecond} tok/s`
  + `${b.estimate ? ` (berechnet ${b.estimate})` : ""} · ${b.software}${b.notes ? ` · „${b.notes}“` : ""} · ${b.submittedBy || "Anonym"}`;

try {
  if (cmd === "pending") {
    const { pending } = await req("/pending");
    console.log(pending.length ? pending.map(line).join("\n") : "Keine offenen Einreichungen.");
  } else if (["approve", "reject", "delete"].includes(cmd) && id) {
    const r = await req("/moderate", { method: "POST", body: JSON.stringify({ id, action: cmd }) });
    console.log(`${r.id}: ${r.status}`);
  } else if (cmd === "export") {
    const { benchmarks } = await req("");
    const file = new URL("../public/data/benchmarks.json", import.meta.url);
    const cur = JSON.parse(readFileSync(file, "utf8"));
    writeFileSync(file, JSON.stringify({ note: cur.note, benchmarks }, null, 2) + "\n");
    console.log(`${benchmarks.length} Benchmarks nach public/data/benchmarks.json geschrieben.`);
  } else {
    console.log("Verwendung: npm run bench -- pending | approve <id> | reject <id> | delete <id> | export");
    process.exit(1);
  }
} catch (e) {
  console.error(`Fehler: ${e.message}`);
  process.exit(1);
}
