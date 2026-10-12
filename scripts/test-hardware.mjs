import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const { devices } = JSON.parse(readFileSync('public/data/devices.json', 'utf8'));
const { mapping } = JSON.parse(readFileSync('docs/gpu-coverage.json', 'utf8'));
assert.equal(Object.keys(mapping).length, 82);
assert.equal(devices.length, 124);
assert.equal(new Set(devices.map(d => d.id)).size, devices.length);
for (const id of Object.values(mapping)) assert.ok(devices.find(d => d.id === id), `Missing ${id}`);
for (const d of devices) for (const key of ['mem','bw','tf','eta','etaC','pf']) assert.ok(Number.isFinite(d[key]) && d[key] > 0, `${d.id}: ${key}`);
for (const file of ['public/index.html', 'public/en/index.html']) {
 const html = readFileSync(file, 'utf8');
 const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
 const node = { addEventListener() {} };
 const sandbox = { devices, document: { documentElement: { lang: file.includes('/en/') ? 'en' : 'de' }, querySelector: () => node, addEventListener() {} }, window: { addEventListener() {} }, localStorage: { getItem: () => null } };
 vm.runInNewContext(script.replace('  load();', '  DEVICES = globalThis.devices; globalThis.hardwareTest = { state, MODELS, QUANTS, sysPrice, evaluate, calc, sysWatts, yearCost, listPrice };'), sandbox);
 const { state, MODELS, QUANTS, sysPrice, evaluate, calc, sysWatts, yearCost, listPrice } = sandbox.hardwareTest;
 // Währung: Euro = price; Dollar = priceUsd (Listenpreis) oder Euro ohne 19 % MwSt. zum EZB-Kurs umgerechnet
 { const mac = devices.find(d => d.id === 'm5u80x96'), gpu = devices.find(d => d.id === '4090');
   assert.equal(mac.price, 8029); assert.equal(mac.priceUsd, 6799);
   // Stichproben Apple AT/US (Konfigurationsseiten, 12.10.2026)
   for (const [id, eur, usd] of [['m5u96', 6599, 5499], ['m5max36', 2999, 2499], ['m5max48', 3989, 3399], ['m5max64', 4429, 3799], ['m5max', 6189, 5399], ['m5u256', 12429, 10799]]) {
     const x = devices.find(d => d.id === id); assert.equal(x.price, eur, id); assert.equal(x.priceUsd, usd, id); }
   state.currency = 'USD'; state.base = true; state.baseCostUsd = 1200;
   assert.equal(listPrice(mac), 6799); assert.equal(sysPrice(mac), 6799);
   assert.equal(listPrice(gpu), Math.round(gpu.price / 1.19 * 1.1181)); assert.equal(sysPrice(gpu), listPrice(gpu) + 1200);
   state.currency = 'EUR'; assert.equal(listPrice(mac), 8029); }
 // Leistungsaufnahme: jedes Gerät hat TDP; GPUs = TDP + 150 W (Laptop + 60 W), Macs/Mini-PCs eigener Systemwert
 for (const d of devices) {
   assert.ok(d.tdp >= 50 && d.tdp <= 1000, `${d.id}: tdp`);
   if (d.kind === 'gpu') { assert.equal(d.sysW, undefined, `${d.id}: GPU ohne sysW`); assert.equal(sysWatts(d), d.tdp + (d.formFactor === 'laptop' ? 60 : 150)); }
   else { assert.ok(d.sysW > 0 && d.sysW <= d.tdp, `${d.id}: sysW`); assert.equal(sysWatts(d), d.sysW); }
 }
 state.elPrice = 0.25;
 { const g = devices.find(d => d.id === '4090'); assert.equal(sysWatts(g), 600); assert.ok(Math.abs(yearCost(g, 8) - 600 * 8 * 365 * 0.25 / 1000) < 1e-9); }
 state.base = true; state.baseCost = 1300;
 // GB10-Geräte (DGX Spark, Surface): gemeinsamer Speicher, kein PC-Basispreis, gpt-oss-120b passt nur mit 128 GB
 { const big = devices.find(d => d.id === 'dgx-spark-128'), small = devices.find(d => d.id === 'dgx-spark-64'), surf = devices.find(d => d.id === 'surface-rtx-spark');
   const oss = MODELS.find(m => m.id === 'moe120'); state.quant = 'q4';
   assert.equal(sysPrice(big), big.price); assert.equal(sysPrice(surf), surf.price);
   assert.equal(calc(big, oss, 32768).fits, true); assert.equal(calc(surf, oss, 32768).fits, true); assert.equal(calc(small, oss, 32768).fits, false); }
 const laptop = devices.find(d => d.formFactor === 'laptop'), server = devices.find(d => d.formFactor === 'server'), sxm = devices.find(d => d.formFactor === 'sxm'), intel = devices.find(d => d.v === 'intel');
 for (const d of [laptop, server, sxm, intel]) assert.equal(sysPrice(d), null);
 state.prices[intel.id] = 1000; assert.equal(sysPrice(intel), 2300);
 for (const d of [laptop,server,sxm]) { state.prices[d.id] = 6000; assert.equal(sysPrice(d),6000); }
 const priced = devices.find(d => d.price > 0);
 state.prices[priced.id] = null; assert.equal(sysPrice(priced), null);
 state.prices = {};
 const rows = evaluate().rows;
 for (const r of rows.filter(r => r.d.price == null)) { assert.equal(r.sp,null); assert.equal(r.raw,0); assert.equal(r.score,0); }
 for (const quant of QUANTS) {
  state.quant = quant.id;
  for (const d of devices) for (const m of MODELS) for (const ctx of [4096,32768,131072]) {
   const c = calc(d,m,ctx);
   for (const key of ['need','tg','pp']) assert.ok(Number.isFinite(c[key]) && c[key] > 0,`${d.id}/${m.id}/${quant.id}/${ctx}: ${key}`);
  }
 }
 assert.ok(html.includes('Intel'));
}
console.log('82 GPU variants covered; unique hardware, all model/quant/context computations and missing/system price handling passed for DE/EN.');
