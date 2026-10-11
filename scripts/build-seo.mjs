// Schreibt die statischen SEO-Teile (Node 20, keine Abhängigkeiten):
//   1. <noscript>-Tabelle mit allen Geräten aus public/data/devices.json
//   2. Meta-Tags, hreflang, Canonical, Open Graph und WebApplication-JSON-LD je Sprache
//   3. FAQPage-JSON-LD je Sprache aus div.seo[data-seo="de"|"en"]
//   4. Vorbefüllte Texte (Titelzeile, Einleitung) für Leser und Crawler ohne JavaScript
//   5. public/en/index.html als englische Seite und public/sitemap.xml mit beiden Sprachen
// Quelle ist public/index.html (deutsche Seite = Vorlage).
// Ersetzt jeweils den Bereich zwischen den Marker-Kommentaren, kann also beliebig oft laufen.
// Aufruf: npm run seo   (nach Änderungen an devices.json oder am FAQ-Text)
// Preise stehen bewusst nicht in der Tabelle: sie ändern sich täglich per GitHub Action
// und wären im statischen HTML sofort veraltet.
import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../public/", import.meta.url);
const htmlUrl = new URL("index.html", root);
let html = await readFile(htmlUrl, "utf8");
const { devices } = JSON.parse(await readFile(new URL("data/devices.json", root), "utf8"));
// Anzahl der LLMs aus dem MODELS-Array im Skript (für Beschreibungstexte)
const modelBlock = html.match(/const MODELS = \[([\s\S]*?)\n  \];/);
if (!modelBlock) throw new Error("MODELS-Array in index.html nicht gefunden");
const modelCount = (modelBlock[1].match(/\{ id: "/g) || []).length;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const VENDOR = { nvidia: "NVIDIA", amd: "AMD", intel: "Intel", apple: "Apple" };
const KIND = { gpu: "Grafikkarte", mbp: "MacBook Pro", studio: "Mac Studio", mini: "Mac mini", minipc: "Mini-PC" };
const ORDER = ["nvidia", "amd", "intel", "apple"];

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
  `        <tr><td>${esc(label(d))}</td><td>${VENDOR[d.v]}</td><td>${d.formFactor === "laptop" ? "Notebook-GPU" : d.formFactor === "sxm" ? "Server · SXM" : d.formFactor === "server" ? "Server · PCIe" : KIND[d.kind]}</td><td class="num">${d.mem}</td><td class="num">${d.bw.toLocaleString("de-AT")}</td></tr>`).join("\n");
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

// 2.–5. Sprachseiten
const SITE = "https://aiscoremetrics.com";
const URLS = { de: `${SITE}/`, en: `${SITE}/en/` };
const META = {
  de: {
    title: "Welche GPU für lokale LLMs? Hardware-Rechner für Tokens/s & VRAM | AI Score Metrics",
    desc: "Kostenloser Rechner: Passt dein LLM in den Speicher und wie schnell läuft es? NVIDIA-, AMD- und Intel-Grafikkarten, Mac Studio, Mac mini und Ryzen AI Max im Vergleich – Tokens/s, VRAM, erster Token, Bildzeiten und Preis-Leistung.",
    ogTitle: "AI Score Metrics – Welche GPU oder welcher Mac für lokale LLMs?",
    ogDesc: `${devices.length} Geräte, ${modelCount} LLMs: Tokens/s, VRAM-Bedarf, Speicherauslastung und Preis-Leistung für lokale KI im Vergleich.`,
    ogAlt: "AI Score Metrics – Hardware-Vergleich für lokale LLMs",
    locale: "de_DE", altLocale: "en_US",
    app: "Rechner für lokale LLM-Hardware: NVIDIA-, AMD- und Intel-Grafikkarten, Apple-Macs und Mini-PCs nach VRAM, Speicherbandbreite, Tokens pro Sekunde, Wartezeit und Preis-Leistung."
  },
  en: {
    title: "Best GPU for Local LLMs? Tokens/s & VRAM Hardware Calculator | AI Score Metrics",
    desc: "Free calculator: does your LLM fit in memory and how fast will it run? Compare NVIDIA, AMD and Intel graphics cards, Mac Studio, Mac mini and Ryzen AI Max – tokens/s, VRAM, time to first token, image times and value for money.",
    ogTitle: "AI Score Metrics – Which GPU or Mac for local LLMs?",
    ogDesc: `${devices.length} devices, ${modelCount} LLMs: tokens/s, VRAM needs, memory usage and value for money for local AI, side by side.`,
    ogAlt: "AI Score Metrics – hardware comparison for local LLMs",
    locale: "en_US", altLocale: "de_DE",
    app: "Calculator for local LLM hardware: NVIDIA, AMD and Intel graphics cards, Apple Macs and mini PCs by VRAM, memory bandwidth, tokens per second, wait time and value for money."
  }
};
const attr = (s) => esc(s);
function metaBlock(lang) {
  const m = META[lang];
  const app = { "@context": "https://schema.org", "@type": "WebApplication", name: "AI Score Metrics", url: URLS[lang],
    description: m.app, applicationCategory: "UtilitiesApplication", operatingSystem: "Any", browserRequirements: "Requires JavaScript",
    inLanguage: lang, isAccessibleForFree: true, image: `${SITE}/og-image.png`, offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" } };
  return `<title>${esc(m.title)}</title>
<meta name="description" content="${attr(m.desc)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="msvalidate.01" content="2C9532B8A584350EA03F5A1340330146">
<link rel="canonical" href="${URLS[lang]}">
<link rel="alternate" hreflang="de" href="${URLS.de}">
<link rel="alternate" hreflang="en" href="${URLS.en}">
<link rel="alternate" hreflang="x-default" href="${URLS.en}">
<meta property="og:type" content="website">
<meta property="og:url" content="${URLS[lang]}">
<meta property="og:site_name" content="AI Score Metrics">
<meta property="og:title" content="${attr(m.ogTitle)}">
<meta property="og:description" content="${attr(m.ogDesc)}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${attr(m.ogAlt)}">
<meta property="og:locale" content="${m.locale}">
<meta property="og:locale:alternate" content="${m.altLocale}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${attr(m.ogTitle)}">
<meta name="twitter:description" content="${attr(m.ogDesc)}">
<meta name="twitter:image" content="${SITE}/og-image.png">
<script type="application/ld+json">
${JSON.stringify(app, null, 2).replace(/<\//g, "<\\/")}
</script>`;
}

const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
function faqJson(src, lang) {
  const block = src.match(new RegExp(`<div class="seo" data-seo="${lang}"[\\s\\S]*?<div class="faq">([\\s\\S]*?)<\\/div>`));
  if (!block) throw new Error(`FAQ-Block in div.seo[data-seo="${lang}"] nicht gefunden`);
  const faq = [...block[1].matchAll(/<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)].map(([, q, a]) => ({
    "@type": "Question", name: strip(q), acceptedAnswer: { "@type": "Answer", text: strip(a) } }));
  if (!faq.length) throw new Error(`Keine FAQ-Einträge (h3 + p) für ${lang}`);
  const ld = { "@context": "https://schema.org", "@type": "FAQPage", inLanguage: lang, mainEntity: faq };
  return { count: faq.length, html: `  <script type="application/ld+json">\n${JSON.stringify(ld, null, 2).replace(/<\//g, "<\\/")}\n  </script>` };
}

// Texte aus dem T-Objekt im Skript (erste Fundstelle = de, zweite = en)
function tString(src, key, lang) {
  const all = [...src.matchAll(new RegExp(`\\n\\s+${key}: "((?:[^"\\\\]|\\\\.)*)"`, "g"))].map((m) => JSON.parse(`"${m[1]}"`));
  if (all.length < 2) throw new Error(`Text ${key} nicht in beiden Sprachen gefunden`);
  return all[lang === "de" ? 0 : 1];
}
function fillStatic(src, lang) {
  for (const key of ["eyebrow", "h1sub", "lede"]) {
    const re = new RegExp(`(<[a-z0-9]+ class="[^"]*" data-i="${key}">)[\\s\\S]*?(</(?:div|span|p)>)`);
    if (!re.test(src)) throw new Error(`Element data-i="${key}" fehlt`);
    src = src.replace(re, (_, a, b) => `${a}${esc(tString(src, key, lang))}${b}`);
  }
  return src;
}

function page(lang) {
  let out = html;
  out = out.replace(/<html lang="[a-z]+">/, `<html lang="${lang}">`);
  out = replaceBetween(out, "meta", metaBlock(lang));
  const faq = faqJson(out, lang);
  out = replaceBetween(out, "faq-jsonld", faq.html);
  out = out.replace(/<div class="seo" data-seo="(de|en)" lang="\1"( hidden)?>/g, (_, l) => `<div class="seo" data-seo="${l}" lang="${l}"${l === lang ? "" : " hidden"}>`);
  out = fillStatic(out, lang);
  return { out, faqs: faq.count };
}

const de = page("de"), en = page("en");
await writeFile(htmlUrl, de.out);
const { mkdir } = await import("node:fs/promises");
await mkdir(new URL("en/", root), { recursive: true });
await writeFile(new URL("en/index.html", root), en.out);

const today = new Date().toISOString().slice(0, 10);
const alt = `\n    <xhtml:link rel="alternate" hreflang="de" href="${URLS.de}"/>\n    <xhtml:link rel="alternate" hreflang="en" href="${URLS.en}"/>\n    <xhtml:link rel="alternate" hreflang="x-default" href="${URLS.en}"/>`;
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${URLS.de}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>${alt}
  </url>
  <url>
    <loc>${URLS.en}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>${alt}
  </url>
</urlset>
`;
await writeFile(new URL("sitemap.xml", root), sitemap);
console.log(`Seiten geschrieben: / (de, ${de.faqs} FAQ) und /en/ (en, ${en.faqs} FAQ), ${devices.length} Geräte in <noscript>, ${modelCount} LLMs, sitemap.xml mit hreflang.`);
