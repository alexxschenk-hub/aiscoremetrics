// Tests für die Community-Benchmarks-API mit einem KV-Ersatz im Speicher (ohne Cloudflare)
import assert from "node:assert/strict";
import { handle } from "../workers/benchmarks-api/src/index.js";

function memKV() {
  const m = new Map();
  return {
    m,
    async get(k, type) { const v = m.get(k); return v == null ? null : type === "json" ? JSON.parse(v) : v; },
    async put(k, v) { m.set(k, v); },
    async delete(k) { m.delete(k); },
    async list({ prefix }) { return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; }
  };
}
const devices = { devices: [{ id: "4090" }, { id: "m5u" }] };
const env = { BENCHMARKS: memKV(), ADMIN_KEY: "secret-key", ASSETS: { fetch: async () => new Response(JSON.stringify(devices)) } };
const call = async (method, path, body, headers = {}) => {
  const res = await handle(new Request(`https://example.test${path}`, { method, body: body && JSON.stringify(body), headers: { "cf-connecting-ip": "1.2.3.4", ...headers } }), env);
  return { status: res.status, data: await res.json().catch(() => null) };
};
const admin = { authorization: "Bearer secret-key" };
const good = { device: "4090", deviceName: "GeForce RTX 4090 · 24 GB", model: "moe30", modelName: "Qwen3 30B", quantization: "Q4_K_M", contextLength: 32768,
  tokensPerSecond: 42.5, firstTokenMs: 850, software: "llama.cpp b4567", os: "Linux 6.8", notes: "stock <b>clocks</b>", submittedBy: "", estimate: 40, fillMs: 9000, website: "" };

// ohne KV-Binding: 503
assert.equal((await handle(new Request("https://example.test/api/benchmarks"), {})).status, 503);

// Einreichen → Warteschlange, öffentlich noch nicht sichtbar
let r = await call("POST", "/api/benchmarks", good);
assert.equal(r.status, 202); const id = r.data.id;
assert.equal((await call("GET", "/api/benchmarks")).data.benchmarks.length, 0);
const rec = JSON.parse(env.BENCHMARKS.m.get(`pending:${id}`));
assert.equal(rec.notes, "stock  b clocks /b".replace(/\s+/g, " "));   // spitze Klammern entfernt
assert.equal(rec.submittedBy, null); assert.equal(rec.flagged, false); assert.equal(rec.status, "pending");

// Validierung
for (const [patch, field] of [[{ tokensPerSecond: 0 }, "tokensPerSecond"], [{ tokensPerSecond: 900 }, "tokensPerSecond"], [{ device: "rtx9999" }, "device"],
  [{ quantization: "Q1" }, "quantization"], [{ contextLength: 12.5 }, "contextLength"], [{ software: "" }, "software"], [{ firstTokenMs: -1 }, "firstTokenMs"]]) {
  r = await call("POST", "/api/benchmarks", { ...good, ...patch });
  assert.equal(r.status, 400, field); assert.equal(r.data.field, field);
}
// Plausibilität: mehr als das Dreifache der Schätzung → markiert, aber angenommen
r = await call("POST", "/api/benchmarks", { ...good, tokensPerSecond: 200 });
assert.equal(JSON.parse(env.BENCHMARKS.m.get(`pending:${r.data.id}`)).flagged, true);

// Honeypot und Zeitfalle: scheinbar ok, nichts gespeichert
const before = env.BENCHMARKS.m.size;
assert.equal((await call("POST", "/api/benchmarks", { ...good, website: "http://spam" })).status, 202);
assert.equal((await call("POST", "/api/benchmarks", { ...good, fillMs: 500 })).status, 202);
assert.equal(env.BENCHMARKS.m.size, before);

// Rate-Limit: 5 pro IP und Tag (2 bereits gültig eingereicht, abgelehnte zählen nicht)
for (let i = 0; i < 3; i++) assert.equal((await call("POST", "/api/benchmarks", good)).status, 202);
assert.equal((await call("POST", "/api/benchmarks", good)).status, 429);
assert.equal((await call("POST", "/api/benchmarks", good, { "cf-connecting-ip": "5.6.7.8" })).status, 202);
assert.ok(![...env.BENCHMARKS.m.keys()].some((k) => k.includes("1.2.3.4")), "IP darf nicht im Klartext gespeichert werden");

// Admin: ohne/mit falschem Key abgelehnt
assert.equal((await call("GET", "/api/benchmarks/pending")).status, 401);
assert.equal((await call("GET", "/api/benchmarks/pending", null, { authorization: "Bearer nope" })).status, 401);
r = await call("GET", "/api/benchmarks/pending", null, admin);
assert.equal(r.status, 200); assert.equal(r.data.pending.length, 6);

// Freigeben → öffentlich sichtbar, ohne Moderationsfelder; Filter nach Gerät/Modell
assert.equal((await call("POST", "/api/benchmarks/moderate", { id, action: "approve" }, admin)).status, 200);
r = await call("GET", "/api/benchmarks");
assert.equal(r.data.benchmarks.length, 1); assert.equal(r.data.benchmarks[0].status, "approved");
assert.equal(r.data.benchmarks[0].flagged, undefined); assert.equal(r.data.benchmarks[0].estimate, undefined);
assert.equal((await call("GET", "/api/benchmarks?device=4090&model=moe30")).data.benchmarks.length, 1);
assert.equal((await call("GET", "/api/benchmarks?device=m5u")).data.benchmarks.length, 0);
assert.equal((await call("POST", "/api/benchmarks/moderate", { id, action: "approve" }, admin)).status, 404);

// Ablehnen und Löschen
const other = (await call("GET", "/api/benchmarks/pending", null, admin)).data.pending[0].id;
assert.equal((await call("POST", "/api/benchmarks/moderate", { id: other, action: "reject" }, admin)).status, 200);
assert.equal(env.BENCHMARKS.m.has(`pending:${other}`), false);
assert.equal((await call("POST", "/api/benchmarks/moderate", { id, action: "delete" }, admin)).status, 200);
assert.equal((await call("GET", "/api/benchmarks")).data.benchmarks.length, 0);
assert.equal((await call("POST", "/api/benchmarks/moderate", { id, action: "nuke" }, admin)).status, 400);

console.log("test-benchmarks-api: alle Tests bestanden");
