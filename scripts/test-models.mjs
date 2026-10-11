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
    localStorage: { getItem: () => null },
  };
  vm.runInNewContext(script.replace('  load();', '  globalThis.modelTest = { MODELS, QUANTS, state, qm, kvCache, calc, memInfo, shownModels, mEx };'), sandbox);
  const { MODELS, QUANTS, state, qm, kvCache, calc, memInfo, shownModels, mEx } = sandbox.modelTest;
  const gemma = MODELS.filter(m => m.id.startsWith('gemma4_'));
  assert.equal(gemma.length, 5);
  assert.equal(MODELS.length, 17);
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
  assert.ok(html.includes('17 LLMs'));
}
console.log('Gemma models, filters, quantization, KV cache and fit boundaries passed for DE/EN.');
