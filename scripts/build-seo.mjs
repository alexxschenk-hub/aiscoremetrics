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
import { readFileSync } from "node:fs";

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
    ogTitle: "GPU-Vergleich auf AI Score Metrics – welche Hardware für lokale LLMs?",
    ogDesc: `${devices.length} Geräte, ${modelCount} LLMs: Tokens/s, VRAM-Bedarf, Speicherauslastung und Preis-Leistung für lokale KI im Vergleich.`,
    ogAlt: "AI Score Metrics – Hardware-Vergleich für lokale LLMs",
    locale: "de_DE", altLocale: "en_US",
    app: "Rechner für lokale LLM-Hardware: NVIDIA-, AMD- und Intel-Grafikkarten, Apple-Macs und Mini-PCs nach VRAM, Speicherbandbreite, Tokens pro Sekunde, Wartezeit und Preis-Leistung."
  },
  en: {
    title: "Best GPU for Local LLMs? Tokens/s & VRAM Hardware Calculator | AI Score Metrics",
    desc: "Free calculator: does your LLM fit in memory and how fast will it run? Compare NVIDIA, AMD and Intel graphics cards, Mac Studio, Mac mini and Ryzen AI Max – tokens/s, VRAM, time to first token, image times and value for money.",
    ogTitle: "GPU comparison on AI Score Metrics – which hardware for local LLMs?",
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
// FAQPage-JSON-LD aus einem FAQ-Fragment (h3 = Frage, p = Antwort)
function faqJson(fragment, lang) {
  const faq = [...fragment.matchAll(/<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)].map(([, q, a]) => ({
    "@type": "Question", name: strip(q), acceptedAnswer: { "@type": "Answer", text: strip(a) } }));
  if (!faq.length) throw new Error(`Keine FAQ-Einträge (h3 + p) für ${lang}`);
  const ld = { "@context": "https://schema.org", "@type": "FAQPage", inLanguage: lang, mainEntity: faq };
  return { count: faq.length, html: `<script type="application/ld+json">\n${JSON.stringify(ld, null, 2).replace(/<\//g, "<\\/")}\n</script>` };
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

// Info-Unterseiten (eigene URLs für Suchmaschinen), Inhalte aus content/<lang>/<datei>.html
const contentDir = new URL("../content/", import.meta.url);
const PAGES = [
  { key: "methodology", icons: ["🧮", "📐", "🚀", "🔬", "📅"],
    de: { slug: "methodik", file: "methodik", title: "Methodik", desc: "Wie AI Score Metrics Speicherbedarf, Tokens/s, Wartezeiten, Score und Preise berechnet – mit allen Annahmen, der Kalibrierung und dem Datenstand." },
    en: { slug: "en/methodology", file: "methodology", title: "Methodology", desc: "How AI Score Metrics calculates memory needs, tokens/s, wait times, score and prices – with all assumptions, calibration and data sources." } },
  { key: "faq", icons: ["❓"],
    de: { slug: "faq", file: "faq", title: "Häufige Fragen", desc: "Welche GPU für lokale LLMs? Wie viel VRAM brauche ich? Was bedeutet Bandbreite? Antworten auf häufige Fragen zu lokaler KI-Hardware." },
    en: { slug: "en/faq", file: "faq", title: "Frequently asked questions", desc: "Which GPU for local LLMs? How much VRAM do I need? What does bandwidth mean? Answers to common questions about local AI hardware." } },
  { key: "about", icons: ["ℹ️", "🧮"],
    de: { slug: "ueber", file: "ueber", title: "Über AI Score Metrics", desc: "AI Score Metrics ist ein kostenloser Rechner für lokale LLM-Hardware: Grafikkarten, Macs und Mini-PCs nach Speicher, Tempo und Preis-Leistung." },
    en: { slug: "en/about", file: "about", title: "About AI Score Metrics", desc: "AI Score Metrics is a free calculator for local LLM hardware: graphics cards, Macs and mini PCs by memory, speed and value for money." } }
];
const UI = {
  de: { back: "← Zurück zum Rechner", toc: "Inhalt", calc: "Rechner", data: "Datenstand", dataId: "datenstand", nav: "Info-Seiten" },
  en: { back: "← Back to the calculator", toc: "Contents", calc: "Calculator", data: "Data sources", dataId: "data-as-of", nav: "Info pages" }
};
const pageUrl = (slug) => `${SITE}/${slug}/`;
const slugify = (t) => strip(t).toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const pageOf = (key, lang) => PAGES.find((p) => p.key === key)[lang];

function footNav(lang, current) {
  const u = UI[lang], link = (href, text, cur) => `<a href="${href}"${cur ? ' aria-current="page"' : ""}>${esc(text)}</a>`;
  const m = pageOf("methodology", lang);
  return `    <nav class="foot-nav" aria-label="${u.nav}">
      ${current ? link(lang === "de" ? "/" : "/en/", u.calc, false) : ""}${PAGES.map((p) => link(`/${p[lang].slug}/`, p[lang].title.replace(/^Über AI Score Metrics$/, "Über").replace(/^About AI Score Metrics$/, "About").replace(/^Frequently asked questions$/, "FAQ").replace(/^Häufige Fragen$/, "FAQ"), current === p.key)).join("")}${link(`/${m.slug}/#${u.dataId}`, u.data, false)}
    </nav>`;
}

function subPage(pg, lang) {
  const P = pg[lang], other = pg[lang === "de" ? "en" : "de"], u = UI[lang];
  let body = readFileSync(new URL(`${lang}/${P.file}.html`, contentDir), "utf8");
  const sections = [];
  body = body.replace(/<section>\s*<h2>([\s\S]*?)<\/h2>/g, (_, h) => {
    const id = slugify(h), ico = pg.icons[sections.length] || "📄"; sections.push({ id, h: strip(h) });
    return `<section class="panel" id="${id}"><h2 class="sec-h"><span class="sec-ico" aria-hidden="true">${ico}</span><span>${h}</span></h2>`;
  });
  const faq = pg.key === "faq" ? faqJson(body, lang).html : "";
  const toc = sections.length > 2 ? `<nav class="toc" aria-label="${u.toc}"><span class="lab">${u.toc}</span>${sections.map((x) => `<a href="#${x.id}">${esc(x.h)}</a>`).join("")}</nav>` : "";
  const urls = { de: pageUrl(pg.de.slug), en: pageUrl(pg.en.slug) };
  const title = `${P.title} | AI Score Metrics`;
  const head = html.slice(0, html.indexOf("<!-- meta:start")).replace(/<html lang="[a-z]+">/, `<html lang="${lang}">`);
  const assets = html.slice(html.indexOf("<!-- meta:end -->") + "<!-- meta:end -->".length, html.indexOf("</head>"));
  const wrapCls = pg.key === "methodology" ? "method" : "seo";
  return `${head}<title>${esc(title)}</title>
<meta name="description" content="${attr(P.desc)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${urls[lang]}">
<link rel="alternate" hreflang="de" href="${urls.de}">
<link rel="alternate" hreflang="en" href="${urls.en}">
<link rel="alternate" hreflang="x-default" href="${urls.en}">
<meta property="og:type" content="article">
<meta property="og:url" content="${urls[lang]}">
<meta property="og:site_name" content="AI Score Metrics">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(P.desc)}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
${faq}${assets}<style>
/* Info-Unterseiten */
.page-top { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; }
.back-btn { display: inline-flex; align-items: center; gap: 6px; font: 700 14px var(--f-display); letter-spacing: .03em; text-decoration: none; color: var(--surface); background: var(--accent); padding: 9px 16px; border-radius: 99px; }
.back-btn:hover { filter: brightness(1.08); }
.toc { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.toc .lab { margin-right: 4px; }
.toc a { font: 600 13px var(--f-body); color: var(--ink); text-decoration: none; padding: 5px 12px; border: 1px solid var(--line); border-radius: 99px; background: var(--surface); }
.toc a:hover { border-color: var(--accent); color: var(--accent); }
.page-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; border-top: 0; padding-top: 0; }
.page-body section.panel { scroll-margin-top: 16px; }
.page-body .faq { display: grid; gap: 6px; }
.page-body .faq h3 { margin: 12px 0 0; padding-top: 12px; border-top: 1px solid var(--line); }
.page-body .faq h3:first-child { border-top: 0; padding-top: 0; margin-top: 0; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="toprow">
      <div class="eyebrow">AI Score Metrics</div>
      <div class="header-actions">
        <button class="theme-toggle" id="theme-toggle" type="button" role="switch" aria-checked="false" aria-label="Dark mode">
          <span class="theme-label">Dark Mode</span><span class="theme-track" aria-hidden="true"><span class="theme-thumb"></span></span>
        </button>
      <div class="seg small" id="lang" role="group" aria-label="Sprache / Language">
        <a href="/${pg.de.slug}/" data-id="de" hreflang="de" lang="de"${lang === "de" ? ' aria-current="page"' : ""}>DE</a><a href="/${pg.en.slug}/" data-id="en" hreflang="en" lang="en"${lang === "en" ? ' aria-current="page"' : ""}>EN</a>
      </div>
      </div>
    </div>
    <h1>${esc(P.title)}</h1>
    <div class="page-top"><a class="back-btn" href="${lang === "de" ? "/" : "/en/"}">${esc(u.back)}</a>${toc}</div>
  </header>
  <main class="page-body ${wrapCls}">
${body}
  </main>
  <footer class="site-footer">
${footNav(lang, pg.key)}
  </footer>
</div>
<script>
// Datum der letzten Preisaktualisierung (Methodik → Datenstand)
(() => { const el = document.querySelectorAll("[data-updated]"); if (!el.length) return;
  fetch("/data/prices.json", { cache: "no-cache" }).then((r) => r.json()).then((p) => { if (!p.updatedAt) return;
    const t = new Date(p.updatedAt).toLocaleDateString(${JSON.stringify(lang === "de" ? "de-AT" : "en-GB")}, { day: "numeric", month: "long", year: "numeric" });
    el.forEach((e) => { e.textContent = t; }); }).catch(() => {}); })();
</script>
</body>
</html>
`;
}

function page(lang) {
  let out = html;
  out = out.replace(/<html lang="[a-z]+">/, `<html lang="${lang}">`);
  out = replaceBetween(out, "meta", metaBlock(lang));
  out = replaceBetween(out, "footnav", footNav(lang, null));
  out = fillStatic(out, lang);
  return { out };
}

const de = page("de"), en = page("en");
await writeFile(htmlUrl, de.out);
const { mkdir } = await import("node:fs/promises");
await mkdir(new URL("en/", root), { recursive: true });
await writeFile(new URL("en/index.html", root), en.out);
for (const pg of PAGES) for (const lang of ["de", "en"]) {
  await mkdir(new URL(`${pg[lang].slug}/`, root), { recursive: true });
  await writeFile(new URL(`${pg[lang].slug}/index.html`, root), subPage(pg, lang));
}

const today = new Date().toISOString().slice(0, 10);
const entry = (loc, de, en, freq) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${freq}</changefreq>
    <xhtml:link rel="alternate" hreflang="de" href="${de}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${en}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${en}"/>
  </url>`;
const entries = [entry(URLS.de, URLS.de, URLS.en, "daily"), entry(URLS.en, URLS.de, URLS.en, "daily")];
for (const pg of PAGES) { const d = pageUrl(pg.de.slug), e = pageUrl(pg.en.slug); entries.push(entry(d, d, e, "weekly"), entry(e, d, e, "weekly")); }
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join("\n")}
</urlset>
`;
await writeFile(new URL("sitemap.xml", root), sitemap);
console.log(`Seiten geschrieben: / und /en/ (${devices.length} Geräte in <noscript>, ${modelCount} LLMs), ${PAGES.length * 2} Info-Seiten, sitemap.xml mit ${entries.length} URLs.`);
