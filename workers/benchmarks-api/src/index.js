// Community-Benchmarks-API für aiscoremetrics.com
//
// Läuft als Cloudflare Pages Function (functions/api/[[path]].js importiert handle()) oder als
// eigenständiger Worker (wrangler.toml in diesem Ordner). Speicher: Cloudflare KV, Binding BENCHMARKS.
//
//   GET  /api/benchmarks[?device=4090][&model=moe30]   bestätigte Messungen
//   POST /api/benchmarks                               Messung einreichen (landet in der Warteschlange)
//   GET  /api/benchmarks/pending                       Admin: Warteschlange
//   POST /api/benchmarks/moderate {id, action}         Admin: approve | reject | delete
//
// Admin-Endpunkte erwarten "Authorization: Bearer <ADMIN_KEY>" (Secret ADMIN_KEY).
// Optional: ALLOWED_ORIGIN (CORS, Standard "*"), NOTIFY_WEBHOOK (POST bei neuer Einreichung,
// z. B. Discord/Slack/ntfy), SITE_ORIGIN (für die Geräteprüfung im eigenständigen Worker).
//
// KV-Schlüssel:
//   approved          JSON-Array aller bestätigten Messungen (ein Read pro GET)
//   pending:<id>      eingereichte, noch nicht geprüfte Messung
//   rl:<tag>:<hash>   Zähler fürs Rate-Limit; Hash aus IP + Tag, die IP selbst wird nicht gespeichert

export const QUANTS = ["Q2_K", "Q3_K_M", "Q4_0", "Q4_K_M", "Q5_K_M", "Q6_K", "Q8_0", "FP16", "BF16", "FP8", "MXFP4", "NVFP4", "AWQ 4-bit", "GPTQ 4-bit", "MLX 4-bit", "MLX 8-bit", "EXL2/EXL3", "other"];
export const LIMITS = { tpsMin: 0.1, tpsMax: 500, ctxMin: 256, ctxMax: 2097152, ttftMax: 600000, perDay: 5, minFillMs: 3000, maxBody: 4096 };
const PLAUSIBLE = 3;   // Abweichung vom berechneten Wert, ab der eine Einreichung markiert wird (±200 %)
const ID_RE = /^[\w.-]{1,48}$/;

const json = (data, status, env, extra = {}) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", ...cors(env), ...extra }
});
const cors = (env) => ({
  "access-control-allow-origin": env.ALLOWED_ORIGIN || "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
  "access-control-max-age": "86400"
});
// Freitext: Steuerzeichen raus, Leerraum zusammenfassen, Länge begrenzen
const clean = (v, max) => typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
const num = (v) => typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.replace(",", ".")) : NaN;

async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
// Vergleich in konstanter Zeit, damit der Admin-Key nicht zeichenweise erraten werden kann
async function sameKey(a, b) {
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  let d = 0; for (let i = 0; i < x.length; i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}
async function isAdmin(request, env) {
  const h = request.headers.get("authorization") || "";
  return !!env.ADMIN_KEY && h.startsWith("Bearer ") && await sameKey(h.slice(7), env.ADMIN_KEY);
}

async function readApproved(env) { return (await env.BENCHMARKS.get("approved", "json")) || []; }
async function writeApproved(env, list) {
  list.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  await env.BENCHMARKS.put("approved", JSON.stringify(list));
}

// Geräte-IDs gegen devices.json der Seite prüfen; schlägt das Laden fehl, wird nicht geprüft (Moderation fängt es ab)
async function knownDevices(request, env) {
  try {
    const url = new URL("/data/devices.json", env.SITE_ORIGIN || request.url);
    const res = env.ASSETS ? await env.ASSETS.fetch(url) : await fetch(url);
    if (!res.ok) return null;
    return new Set((await res.json()).devices.map((d) => d.id));
  } catch { return null; }
}

// Prüft eine Einreichung; gibt { error } oder { record } zurück
export function validate(body, devices) {
  const err = (field, msg) => ({ error: msg, field });
  if (!body || typeof body !== "object") return err(null, "invalid body");
  const device = String(body.device || ""), model = String(body.model || "");
  if (!ID_RE.test(device) || (devices && !devices.has(device))) return err("device", "unknown device");
  if (!ID_RE.test(model)) return err("model", "unknown model");
  const quantization = String(body.quantization || "");
  if (!QUANTS.includes(quantization)) return err("quantization", "unknown quantization");
  const tps = num(body.tokensPerSecond);
  if (!(tps >= LIMITS.tpsMin && tps <= LIMITS.tpsMax)) return err("tokensPerSecond", `tokensPerSecond must be ${LIMITS.tpsMin}–${LIMITS.tpsMax}`);
  const ctx = num(body.contextLength);
  if (!(Number.isInteger(ctx) && ctx >= LIMITS.ctxMin && ctx <= LIMITS.ctxMax)) return err("contextLength", "invalid contextLength");
  const ttftRaw = body.firstTokenMs, ttft = ttftRaw === "" || ttftRaw == null ? null : num(ttftRaw);
  if (ttft !== null && !(ttft >= 0 && ttft <= LIMITS.ttftMax)) return err("firstTokenMs", "invalid firstTokenMs");
  const software = clean(body.software, 60);
  if (software.length < 2) return err("software", "software required");
  const est = num(body.estimate);
  const estimate = est > 0 && est < 100000 ? Math.round(est * 10) / 10 : null;
  return { record: {
    id: crypto.randomUUID(),
    device, deviceName: clean(body.deviceName, 80) || device,
    model, modelName: clean(body.modelName, 80) || model,
    quantization, contextLength: ctx,
    tokensPerSecond: Math.round(tps * 100) / 100,
    firstTokenMs: ttft === null ? null : Math.round(ttft),
    software, os: clean(body.os, 60) || null, notes: clean(body.notes, 300) || null,
    submittedBy: clean(body.submittedBy, 40) || null,
    submittedAt: new Date().toISOString(),
    status: "pending",
    estimate,   // vom Browser berechneter Wert – nur ein Hinweis für die Moderation
    flagged: estimate ? tps > estimate * PLAUSIBLE || tps < estimate / PLAUSIBLE : false
  } };
}

async function submit(request, env, ctx) {
  const text = await request.text();
  if (text.length > LIMITS.maxBody) return json({ error: "body too large" }, 413, env);
  let body; try { body = JSON.parse(text); } catch { return json({ error: "invalid JSON" }, 400, env); }
  // Honeypot und Zeitfalle: Bots füllen das versteckte Feld aus oder senden sofort. Sie bekommen eine
  // scheinbar erfolgreiche Antwort, gespeichert wird nichts.
  const fill = num(body.fillMs);
  if (body.website || !(fill >= LIMITS.minFillMs)) return json({ ok: true, id: crypto.randomUUID(), status: "pending" }, 202, env);

  const day = new Date().toISOString().slice(0, 10);
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const rlKey = `rl:${day}:${(await sha256(`${ip}|${day}|${env.ADMIN_KEY || ""}`)).slice(0, 32)}`;
  const count = Number(await env.BENCHMARKS.get(rlKey)) || 0;
  if (count >= LIMITS.perDay) return json({ error: "rate limit", retryAfter: "tomorrow" }, 429, env);

  const v = validate(body, await knownDevices(request, env));
  if (v.error) return json(v, 400, env);
  await Promise.all([
    env.BENCHMARKS.put(`pending:${v.record.id}`, JSON.stringify(v.record)),
    env.BENCHMARKS.put(rlKey, String(count + 1), { expirationTtl: 172800 })
  ]);
  if (env.NOTIFY_WEBHOOK) {
    const r = v.record, msg = `Neuer Benchmark${r.flagged ? " ⚠️" : ""}: ${r.deviceName} · ${r.modelName} ${r.quantization} · ${r.tokensPerSecond} tok/s (${r.software})`;
    const p = fetch(env.NOTIFY_WEBHOOK, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: msg, content: msg, benchmark: r }) }).catch(() => {});
    ctx && ctx.waitUntil ? ctx.waitUntil(p) : await p;
  }
  return json({ ok: true, id: v.record.id, status: "pending" }, 202, env);
}

async function list(url, env) {
  const device = url.searchParams.get("device"), model = url.searchParams.get("model");
  const out = (await readApproved(env)).filter((b) => (!device || b.device === device) && (!model || b.model === model)).map(({ estimate, flagged, ...b }) => b);
  return json({ benchmarks: out }, 200, env, { "cache-control": "public, max-age=300" });
}

async function pending(env) {
  const keys = []; let cursor;
  do { const r = await env.BENCHMARKS.list({ prefix: "pending:", cursor }); keys.push(...r.keys); cursor = r.list_complete ? null : r.cursor; } while (cursor && keys.length < 500);
  const items = (await Promise.all(keys.map((k) => env.BENCHMARKS.get(k.name, "json")))).filter(Boolean);
  items.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  return json({ pending: items, approved: await readApproved(env) }, 200, env, { "cache-control": "no-store" });
}

async function moderate(request, env) {
  let body; try { body = await request.json(); } catch { return json({ error: "invalid JSON" }, 400, env); }
  const { id, action } = body || {};
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/.test(id)) return json({ error: "invalid id" }, 400, env);
  if (action === "approve") {
    const rec = await env.BENCHMARKS.get(`pending:${id}`, "json");
    if (!rec) return json({ error: "not found" }, 404, env);
    const all = (await readApproved(env)).filter((b) => b.id !== id);
    all.push({ ...rec, status: "approved", approvedAt: new Date().toISOString() });
    await writeApproved(env, all);
    await env.BENCHMARKS.delete(`pending:${id}`);
    return json({ ok: true, id, status: "approved" }, 200, env);
  }
  if (action === "reject") {
    await env.BENCHMARKS.delete(`pending:${id}`);
    return json({ ok: true, id, status: "rejected" }, 200, env);
  }
  if (action === "delete") {
    const all = await readApproved(env), rest = all.filter((b) => b.id !== id);
    if (rest.length === all.length) return json({ error: "not found" }, 404, env);
    await writeApproved(env, rest);
    return json({ ok: true, id, status: "deleted" }, 200, env);
  }
  return json({ error: "action must be approve, reject or delete" }, 400, env);
}

export async function handle(request, env, ctx) {
  const url = new URL(request.url), path = url.pathname.replace(/\/+$/, "");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env) });
  if (!path.startsWith("/api/benchmarks")) return json({ error: "not found" }, 404, env);
  if (!env.BENCHMARKS) return json({ error: "storage not configured" }, 503, env);
  try {
    if (path === "/api/benchmarks") {
      if (request.method === "GET") return await list(url, env);
      if (request.method === "POST") return await submit(request, env, ctx);
    } else if (path === "/api/benchmarks/pending" || path === "/api/benchmarks/moderate") {
      if (!await isAdmin(request, env)) return json({ error: "unauthorized" }, 401, env);
      if (path.endsWith("/pending") && request.method === "GET") return await pending(env);
      if (path.endsWith("/moderate") && request.method === "POST") return await moderate(request, env);
    } else return json({ error: "not found" }, 404, env);
    return json({ error: "method not allowed" }, 405, env);
  } catch (e) {
    return json({ error: "internal error" }, 500, env);
  }
}

export default { fetch: handle };
