/* Versioned, validated comparison links. No browser preferences are exported. */
(() => {
  const numeric = (n, max) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max;
  function validate(input, catalog) {
    if (!input || input.v !== 1 || !Array.isArray(input.devices) || input.devices.length !== 2) return null;
    const ids = input.devices;
    if (ids[0] === ids[1] || ids.some(id => typeof id !== 'string' || !catalog.devices.some(d => d.id === id))) return null;
    if (!catalog.models.some(m => m.id === input.model) || !catalog.quants.some(q => q.id === input.quant)) return null;
    if (!Number.isInteger(input.ctx) || input.ctx < 0 || input.ctx >= catalog.contexts.length || !Number.isInteger(input.prompt) || input.prompt < 0 || input.prompt >= catalog.prompts.length) return null;
    if (!numeric(input.ram, 4096) || !numeric(input.baseCost, 1000000) || typeof input.base !== 'boolean' || typeof input.wired !== 'boolean' || typeof input.showPrices !== 'boolean') return null;
    if (!catalog.uses.some(u => u.id === input.use) || !catalog.images.some(i => i.id === input.image)) return null;
    const model = catalog.models.find(m => m.id === input.model);
    if (input.use !== 'all' && !model.use.includes(input.use)) return null;
    const prices = {};
    for (const id of ids) {
      const price = input.prices?.[id];
      if (price !== null && !numeric(price, 100000000)) return null;
      prices[id] = price;
    }
    // Optional (abwärtskompatibel): Modell je Gerät und Strompreis
    const cmpMode = input.cmpMode ?? 'same';
    if (!['same', 'best', 'manual'].includes(cmpMode)) return null;
    let models;
    if (cmpMode === 'manual') {
      if (!Array.isArray(input.models) || input.models.length !== 2) return null;
      for (const id of input.models) { const m = catalog.models.find(x => x.id === id); if (!m || (input.use !== 'all' && !m.use.includes(input.use))) return null; }
      models = [...input.models];
    }
    if (input.elPrice !== undefined && !numeric(input.elPrice, 5)) return null;
    const out = { v: 1, devices: [...ids], model: input.model, use: input.use, image: input.image, quant: input.quant, ctx: input.ctx, prompt: input.prompt, ram: input.ram, baseCost: input.baseCost, base: input.base, wired: input.wired, showPrices: input.showPrices, prices, cmpMode };
    if (models) out.models = models;
    if (input.elPrice !== undefined) out.elPrice = input.elPrice;
    return out;
  }
  function decode(hash, catalog) {
    if (!hash.startsWith('#compare=')) return null;
    try { if (hash.length > 8000) return null; return validate(JSON.parse(decodeURIComponent(hash.slice(9))), catalog); } catch { return null; }
  }
  const encode = scenario => '#compare=' + encodeURIComponent(JSON.stringify(scenario));
  const difference = (a, b) => Number.isFinite(a) && Number.isFinite(b) ? { amount: Math.abs(a - b), winner: a === b ? null : a < b ? 0 : 1 } : null;
  globalThis.AIScenario = { validate, encode, decode, difference };
})();
