import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const { devices } = JSON.parse(readFileSync('public/data/devices.json', 'utf8'));
const { mapping } = JSON.parse(readFileSync('docs/gpu-coverage.json', 'utf8'));
assert.equal(Object.keys(mapping).length, 82);
assert.equal(devices.length, 121);
assert.equal(new Set(devices.map(d => d.id)).size, devices.length);
for (const id of Object.values(mapping)) assert.ok(devices.find(d => d.id === id), `Missing ${id}`);
for (const d of devices) for (const key of ['mem','bw','tf','eta','etaC','pf']) assert.ok(Number.isFinite(d[key]) && d[key] > 0, `${d.id}: ${key}`);
for (const file of ['public/index.html', 'public/en/index.html']) {
 const html = readFileSync(file, 'utf8');
 const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
 const node = { addEventListener() {} };
 const sandbox = { devices, document: { documentElement: { lang: file.includes('/en/') ? 'en' : 'de' }, querySelector: () => node, addEventListener() {} }, window: { addEventListener() {} }, localStorage: { getItem: () => null } };
 vm.runInNewContext(script.replace('  load();', '  DEVICES = globalThis.devices; globalThis.hardwareTest = { state, MODELS, QUANTS, sysPrice, evaluate, calc };'), sandbox);
 const { state, MODELS, QUANTS, sysPrice, evaluate, calc } = sandbox.hardwareTest;
 state.base = true; state.baseCost = 1300;
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
