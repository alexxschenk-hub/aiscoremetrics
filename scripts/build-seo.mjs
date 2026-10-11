// Schreibt die statischen SEO-Teile in public/index.html (Node 20, keine Abhängigkeiten):
//   1. <noscript>-Tabelle mit allen Geräten aus public/data/devices.json
//   2. FAQPage-JSON-LD aus dem deutschen FAQ-Block (div.seo[data-seo="de"])
// Ersetzt jeweils den Bereich zwischen den Marker-Kommentaren, kann also beliebig oft laufen.
// Aufruf: npm run seo   (nach Änderungen an devices.json oder am FAQ-Text)
// Preise stehen bewusst nicht in der Tabelle: sie ändern sich täglich per GitHub Action
// und wären im statischen HTML sofort veraltet.
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../public/", import.meta.url);
const htmlUrl = new URL("index.html", root);
let html = await readFile(htmlUrl, "utf8");
const { devices } = JSON.parse(await readFile(new URL("data/devices.json", root), "utf8"));

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const VENDOR = { nvidia: "NVIDIA", amd: "AMD", apple: "Apple" };
const KIND = { gpu: "Grafikkarte", mbp: "MacBook Pro", studio: "Mac Studio", mini: "Mac mini", minipc: "Mini-PC" };
const ORDER = ["nvidia", "amd", "apple"];

function replaceBetween(src, name, body) {
  const re = new RegExp(`(<!-- ${name}:start[^>]*-->)[\\s\\S]*?(\\s*<!-- ${name}:end -->)`);
  if (!re.test(src)) throw new Error(`Marker ${name}:start/end fehlen in index.html`);
  return src.replace(re, (_, a, b) => `${a}\n${body}${b}`);
}

// 1. Geräte-Tabelle
const label = (d) => {
  const name = /\bGB\b/.test(d.name) ? d.name : `${d.name} · ${d.mem} GB`;
  const full = d.v === "apple" ? `${KIND[d.kind]} ${name}` : name;
  return d.ws ? `${full} (Workstation)` : full;
};
const sorted = [...devices].sort((a, b) =>
  ORDER.indexOf(a.v) - ORDER.indexOf(b.v) || a.kind.localeCompare(b.kind) || a.mem - b.mem || a.name.localeCompare(b.name, "de", { numeric: true }));
const rows = sorted.map((d) =>
  `        <tr><td>${esc(label(d))}</td><td>${VENDOR[d.v]}</td><td>${KIND[d.kind]}</td><td class="num">${d.mem}</td><td class="num">${d.bw.toLocaleString("de-AT")}</td></tr>`).join("\n");
const noscript = `  <noscript>
    <div class="noscript-devs">
      <h2>Geräte im Vergleich / Devices compared</h2>
      <p class="hint">Der Rechner braucht JavaScript. Hier die Hardware-Daten aller ${devices.length} Geräte als Tabelle. / The calculator needs JavaScript. Below are the specs of all ${devices.length} devices.</p>
      <div class="tablebox"><table>
        <thead><tr><th>Gerät / Device</th><th>Hersteller / Vendor</th><th>Typ / Type</th><th class="num">Speicher / Memory (GB)</th><th class="num">Bandbreite / Bandwidth (GB/s)</th></tr></thead>
        <tbody>
${rows}
        </tbody>
      </table></div>
    </div>
  </noscript>`;
html = replaceBetween(html, "noscript", noscript);

// 2. FAQPage-JSON-LD aus dem deutschen FAQ
const de = html.match(/<div class="seo" data-seo="de"[\s\S]*?<div class="faq">([\s\S]*?)<\/div>/);
if (!de) throw new Error('FAQ-Block in div.seo[data-seo="de"] nicht gefunden');
const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
const faq = [...de[1].matchAll(/<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)].map(([, q, a]) => ({
  "@type": "Question", name: strip(q), acceptedAnswer: { "@type": "Answer", text: strip(a) }
}));
if (!faq.length) throw new Error("Keine FAQ-Einträge (h3 + p) gefunden");
const ld = { "@context": "https://schema.org", "@type": "FAQPage", inLanguage: "de", mainEntity: faq };
const json = JSON.stringify(ld, null, 2).replace(/<\//g, "<\\/");
html = replaceBetween(html, "faq-jsonld", `  <script type="application/ld+json">\n${json}\n  </script>`);

await writeFile(htmlUrl, html);
console.log(`index.html aktualisiert: ${devices.length} Geräte in <noscript>, ${faq.length} FAQ-Einträge im JSON-LD.`);
