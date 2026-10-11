import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
for (const file of ['public/index.html', 'public/en/index.html']) {
  const html = readFileSync(file, 'utf8');
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
  const node = { addEventListener() {} };
  const sandbox = {
    document: { documentElement: { lang: html.includes('<html lang="en">') ? 'en' : 'de' }, querySelector: () => node, addEventListener() {} },
    window: { addEventListener() {} }, localStorage: { getItem: () => null },
  };
  vm.runInNewContext(script.replace('  load();', '  globalThis.modelTest = { MODELS, QUANTS, state, qm, kvCache, calc, memInfo, shownModels, mEx, eciOf, ECI_TOP };'), sandbox);
  const { MODELS, QUANTS, state, qm, kvCache, calc, memInfo, shownModels, mEx, eciOf, ECI_TOP } = sandbox.modelTest;
  const gemma = MODELS.filter(m => m.id.startsWith('gemma4_'));
  assert.equal(gemma.length, 5);
  assert.equal(MODELS.length, 29);
  // Plausibilität aller Modelle: Pflichtfelder, gültige Einsatzzwecke, MoE-Logik
  const USE_IDS = ['coding', 'chat', 'large'];
  for (const m of MODELS) {
    for (const k of ['tp', 'ap', 'gb', 'agb']) assert.ok(Number.isFinite(m[k]) && m[k] > 0, `${m.id}.${k}`);
    assert.ok(m.cache || (Number.isFinite(m.kv) && m.kv > 0), `${m.id}.kv`);
    assert.ok(m.ap <= m.tp && m.agb <= m.gb, `${m.id}: aktiv <= gesamt`);
    assert.ok(m.use.length && m.use.every(u => USE_IDS.includes(u)), `${m.id}.use`);
    if (!m.dense) assert.ok(m.eff === 0.55, `${m.id}: MoE braucht eff`);
  }
  // Neue Modelle: Q4_K_M-Größe aus den GGUF-Dateien, Speicherbedarf = gesamte Parameter
  const q4 = { ministral3: 2.15, l31_8: 4.9, q38_27: 16.5, msmall4: 73.8, glm53flash: 199.7, llama4mav: 242.8, q35_397: 244.1, nemo3ultra: 359.2, mlarge3: 407, dsv41flash: 444.7, dsv4pro: 850, kimik3: 1509 };
  state.quant = 'q4';
  for (const [id, gb] of Object.entries(q4)) close(qm(MODELS.find(m => m.id === id)).gb, gb);
  // Llama 3.1 8B ist die LocalScore-Kalibrierung: RTX 4090 ≈ 123 tok/s Generierung, ≈ 10.313 tok/s Prompt
  { const r = calc({ kind: 'gpu', v: 'nvidia', mem: 24, eta: .6, bw: 1008, etaC: .5, tf: 330, pf: 1 }, MODELS.find(m => m.id === 'l31_8'), 4096);
    assert.ok(Math.abs(r.tg - 123) < 2, `Llama 3.1 8B tg ${r.tg}`); assert.ok(Math.abs(r.pp - 10313) < 1, `Llama 3.1 8B pp ${r.pp}`); }
  assert.equal(new Set(MODELS.map(m => m.id)).size, MODELS.length);
  for (const use of ['coding', 'chat', 'all']) {
    state.use = use;
    assert.equal(shownModels().filter(m => m.id.startsWith('gemma4_')).length, 5);
  }
  const gpu = { kind: 'gpu', v: 'nvidia', mem: 24, eta: .6, bw: 1008, etaC: .5, tf: 330, pf: 1 };
  const expectedKV = { gemma4_e2: .207618048, gemma4_e4: .557842432, gemma4_12: .872415232, gemma4_26: .880803840, gemma4_31: 3.523215360 };
  for (const m of gemma) {
    close(kvCache(m, 32768), expectedKV[m.id]);
    // Past the local window, only global cache storage grows with context.
    close(kvCache(m, 65536) - kvCache(m, 32768), 4 * m.cache.globalLayers * m.cache.globalHeads * m.cache.globalDim * 32768 / 1e9);
    if (m.effective) assert.ok(!mEx(m).includes('MoE'));
    for (const q of QUANTS) {
      state.quant = q.id;
      if (q.id === 'q4_0') close(qm(m).gb, m.qatGb);
      for (const ctx of [4096, 32768, 131072]) {
        const r = calc(gpu, m, ctx), mi = memInfo(gpu, m, ctx);
        close(r.need, mi.need);
        close(r.need, qm(m).gb + kvCache(m, ctx) + 1);
        assert.ok(Number.isFinite(r.tg) && r.tg > 0 && Number.isFinite(r.pp) && r.pp > 0);
        assert.equal(r.fits, mi.state === 'ok');
      }
    }
  }
  const large = gemma.find(m => m.id === 'gemma4_31');
  state.quant = 'q4'; assert.equal(calc(gpu, large, 32768).fits, false);
  state.quant = 'q4_0'; assert.equal(calc(gpu, large, 32768).fits, true);
  const old = MODELS.find(m => m.id === 'moe30');
  close(kvCache(old, 32768), .098 * 32);
  state.quant = 'q4';
  close(qm(MODELS.find(m => m.id === 'gptoss20')).gb, 13);
  assert.ok(html.includes(`${MODELS.length} LLMs`));
  // ECI (Epoch AI): nur echte Epoch-Werte, innerhalb des eigenen Intervalls und unter dem Bestwert
  const withEci = MODELS.filter(m => m.benchmark);
  assert.equal(withEci.length, 19);
  for (const m of withEci) {
    const b = m.benchmark;
    assert.ok(b.score > 0 && b.score < ECI_TOP.score && b.ci[0] <= b.score && b.score <= b.ci[1], `${m.id} ECI`);
    assert.equal(b.maxScore, ECI_TOP.score); assert.equal(b.sourceUrl, 'https://epoch.ai/eci');
  }
  for (const id of ['mlarge3', 'msmall4', 'ministral3', 'gemma4_12']) assert.equal(MODELS.find(m => m.id === id).benchmark, null);
  const k3 = MODELS.find(m => m.id === 'kimik3');
  for (const q of ['q4', 'q5', 'q6', 'q8', 'f16']) { state.quant = q; close(eciOf(k3).adj, k3.benchmark.score); assert.equal(eciOf(k3).est, false); }
  state.quant = 'q2'; close(eciOf(k3).adj, k3.benchmark.score * 0.92); assert.equal(eciOf(k3).est, true);
  state.quant = 'q4';
}
console.log('Gemma models, filters, quantization, KV cache and fit boundaries passed for DE/EN.');
