# AI Score Metrics

Quellcode von [aiscoremetrics.com](https://aiscoremetrics.com): ein Preis-Leistungs-Rechner für lokale LLM-Hardware. Statische Seite auf Cloudflare Pages, GPU-Preise werden täglich per GitHub Action aktualisiert.

```
public/
  index.html            Die Seite (lädt ihre Daten aus data/)
  data/devices.json     Specs + Fallback-Preise aller Geräte (von Hand gepflegt)
  data/prices.json      Aktuelle GPU-Preise (wird automatisch geschrieben)
  data/benchmarks.json  Community-Benchmarks als Fallback/Snapshot (sonst aus der API)
  admin/benchmarks/     Moderationsseite für Community-Benchmarks (noindex)
  _headers              Cache-Regeln für Cloudflare Pages
  robots.txt, sitemap.xml   für Suchmaschinen
  og-image.png          Vorschaubild für Social Media (Quelle: scripts/og-image.html)
scripts/build-seo.mjs       Baut /en/, Meta-Tags, hreflang, FAQ-JSON-LD, <noscript>-Tabelle und Sitemap
functions/api/[[path]].js   Pages Function für /api/* (nutzt workers/benchmarks-api)
workers/benchmarks-api/     Community-Benchmarks-API (Cloudflare KV), auch als eigener Worker deploybar
scripts/benchmarks-admin.mjs  Benchmarks per Kommandozeile moderieren und exportieren
scripts/update-prices.mjs   Holt Preise von gpuprix.com (Node 20, keine Abhängigkeiten)
data/history.csv        Preisverlauf, eine Zeile pro Gerät und Tag (für spätere Charts)
.github/workflows/update-prices.yml   Täglicher Lauf um 04:17 UTC
```

## Einrichtung (einmalig, ca. 15 Minuten)

### 1. GitHub-Repo anlegen

```bash
cd aiscoremetrics
git init -b main
git add .
git commit -m "AI Score Metrics MVP"
git remote add origin git@github.com:alexxschenk-hub/aiscoremetrics.git
git push -u origin main
```

Ein **öffentliches** Repo hat unbegrenzte Action-Minuten. Ein privates geht auch: Der Job braucht rund 1 Minute pro Tag, das Gratis-Kontingent liegt bei 2.000 Minuten im Monat.

### 2. Repo-Einstellungen

- **Settings → Actions → General → Workflow permissions:** „Read and write permissions“ wählen, damit die Action die neuen Preise committen darf.
- **Settings → Secrets and variables → Actions → Variables:** `SITE_URL` = `https://aiscoremetrics.com` anlegen. Die Adresse wird im User-Agent mitgeschickt, damit der Seitenbetreiber weiß, wer abruft.
- **Actions → „Preise aktualisieren“ → Run workflow:** einmal manuell starten und prüfen, dass der Lauf grün ist.

### 3. Cloudflare Pages verbinden

1. Cloudflare-Dashboard → **Workers & Pages → Create → Pages → Connect to Git**
2. Repo `aiscoremetrics` auswählen
3. Framework preset: **None**, Build command: **leer**, Build output directory: **`public`**
4. Deploy. Die Seite läuft danach unter `aiscoremetrics.pages.dev`.

Jeder Push auf `main`, also auch jeder tägliche Preis-Commit, löst automatisch ein neues Deployment aus (rund 30 Builds im Monat, Gratis-Limit 500).

### 4. Eigene Domain

Pages-Projekt → **Custom domains → Set up a custom domain**.

- **Subdomain** (z. B. `www.aiscoremetrics.com`): beim bisherigen DNS-Anbieter einen CNAME auf `aiscoremetrics.pages.dev` setzen.
- **Hauptdomain** (`aiscoremetrics.com`): Dafür muss das DNS der Domain bei Cloudflare liegen. Die Nameserver werden umgestellt, die Domain bleibt bei deinem Registrar.

### 5. Community-Benchmarks (Cloudflare KV)

Die API läuft als Pages Function (`functions/api/[[path]].js`) und wird mit jedem Push automatisch mitdeployt. Sie braucht einmalig einen KV-Speicher und einen Admin-Key:

1. Cloudflare-Dashboard → **Storage & Databases → KV → Create namespace**, Name z. B. `aiscoremetrics-benchmarks`.
2. Pages-Projekt → **Settings → Bindings → Add → KV namespace**: Variable `BENCHMARKS`, den Namespace von eben auswählen (für Production, optional auch Preview).
3. Pages-Projekt → **Settings → Variables and Secrets → Add**: Typ *Secret*, Name `ADMIN_KEY`, ein langes Zufallspasswort (z. B. `openssl rand -base64 32`).
4. Optional `NOTIFY_WEBHOOK` als Variable: URL, an die bei jeder neuen Einreichung ein POST geht (Discord-/Slack-Webhook oder ntfy.sh-Thema → Push aufs Handy oder per E-Mail weiterleiten).
5. Neu deployen (Deployments → Retry), damit die Bindings greifen.

Bis das eingerichtet ist, antwortet `/api/benchmarks` mit 503. Die Seite zeigt dann nur die Messungen aus `public/data/benchmarks.json`, und das Formular bietet stattdessen an, die Messung als GitHub-Issue zu schicken.

Alternativ lässt sich dieselbe API als eigener Worker betreiben: `workers/benchmarks-api/wrangler.toml` (KV-ID eintragen, `npx wrangler deploy`, `npx wrangler secret put ADMIN_KEY`).

## Lokal arbeiten

```bash
npm run prices   # Preise jetzt holen
npm run dev      # Seite unter http://localhost:3000 ansehen
npm run dev:api  # Seite + Benchmarks-API mit lokalem KV unter http://localhost:8788
                 # (Admin-Key lokal: Datei .dev.vars mit ADMIN_KEY=…, ist in .gitignore)
```

Die Seite lädt ihre Daten per `fetch`. Direkt als Datei geöffnet (`file://`) funktioniert sie deshalb nicht.

## Pflege

- **Info-Seiten** (/methodik/, /faq/, /ueber/ und /en/…): Texte in `content/de/` bzw. `content/en/` bearbeiten, danach `npm run seo`. Das Script erzeugt die Seiten, das FAQ-JSON-LD und die Sitemap.
- **Blog** (/blog/ und /en/blog/): ein Artikel = je eine Datei in `content/blog/de/` und `content/blog/en/`. Die erste Zeile ist ein HTML-Kommentar mit JSON-Metadaten (`key` verbindet DE und EN, außerdem `slug`, `title`, `desc`, `date`, optional `icon`, `icons`, `order`). Kurzlinks im Text: `href="calc:"` (Rechner), `href="advisor:"` (Kaufberater), `href="vs:5090,m5u96,moe120"` (fertiger Vergleich, Modell optional), `href="blog:<key>"` (anderer Artikel). Danach `npm run seo`: erzeugt Übersicht, Artikel mit Meta-, OG- und BlogPosting-Daten und trägt alles in die Sitemap ein.
- **Community-Benchmarks moderieren:** `/admin/benchmarks/` öffnen, Admin-Key eingeben, Einreichungen bestätigen, ablehnen oder freigegebene löschen. Mit ⚠️ markiert sind Werte, die mehr als das Dreifache vom berechneten Wert abweichen. Per Kommandozeile: `BENCH_ADMIN_KEY=… npm run bench -- pending` bzw. `approve|reject|delete <id>`. `npm run bench -- export` schreibt alle freigegebenen Messungen als Sicherung nach `public/data/benchmarks.json`.
  - API: `GET /api/benchmarks[?device=…&model=…]`, `POST /api/benchmarks` (Einreichen), `GET /api/benchmarks/pending` und `POST /api/benchmarks/moderate {id, action}` (beide mit `Authorization: Bearer <ADMIN_KEY>`).
  - Spam-Schutz: höchstens 5 Einreichungen pro IP und Tag (gespeichert wird nur ein Hash aus IP und Datum, 48 h), Honeypot-Feld, Mindest-Ausfüllzeit 3 s, Wertebereich 0,1–500 tok/s, Geräte-ID wird gegen `devices.json` geprüft.
- **Kaufberater:** Ansicht „Berater“ in `public/index.html` (Funktionen `advResults`/`renderAdvisor`). Direktlink: `/#berater` bzw. `/en/#advisor`.

- **Mac-Preise** stehen von Hand in `public/data/devices.json` (Feld `price`, Schätzungen mit `"est": true`).
- **Workstation-Karten:** Feld `"ws": true` blendet sie im Filter „Workstation“ ein.
- **Neue GPU:** Eintrag in `devices.json` ergänzen und `"source": { "gpuprix": "<slug>", "metric": "low" }` setzen. Der Slug ist der letzte Teil der gpuprix-URL, z. B. `geforce-rtx-5080`.
- **`metric`:** `instock` (Standard) = günstigste lieferbare Karte, fällt auf `low` zurück, wenn nichts lieferbar ist. `low` = Tiefstpreis inkl. nicht lieferbarer Angebote, `median3m` = 3-Monats-Median.
- **Manueller Preis:** `"override": { "price": 6000, "note": "Geizhals", "date": "2026-10-10T00:00:00Z" }` in `devices.json` hat Vorrang vor der automatischen Quelle. Zum Zurückschalten das Feld wieder löschen. Aktuell gesetzt für die RTX 5090 (Geizhals) und die RTX PRO 4500 (Amazon), weil gpuprix für Deutschland nur Alternate auswertet.
- **SEO-Teile:** `public/index.html` ist die deutsche Seite und zugleich die Vorlage. `npm run seo` erzeugt daraus `public/en/index.html` (Englisch), Meta-Tags mit hreflang und Canonical je Sprache, die `<noscript>`-Gerätetabelle, das FAQPage-JSON-LD je Sprache und `sitemap.xml`. Die GitHub Action „SEO-Seiten bauen“ macht das bei jedem Push auf `index.html`, `devices.json` oder das Script automatisch. Texte für Titel und Description stehen in `scripts/build-seo.mjs` (META).
- **Preissprung-Schutz:** Ändert sich ein Preis an einem Tag um mehr als das Doppelte, behält das Script den alten Wert und schreibt eine Warnung ins Action-Log.

## Gut zu wissen

- gpuprix hat keine Region Österreich. Die Daten für Deutschland stammen laut Seite von Alternate, also von einem Händler.
- Die robots.txt von gpuprix erlaubt das Abrufen der Produktseiten. Bevor du die Seite monetarisierst, lohnt sich trotzdem eine kurze Anfrage beim Betreiber.
- Sobald du Affiliate-Links oder Werbung einbaust, brauchst du in Österreich ein Impressum (Offenlegung nach Mediengesetz) und eine Datenschutzerklärung.
