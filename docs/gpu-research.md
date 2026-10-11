# GPU-Erweiterung – Quellen und Berechnung

Stand: 11.10.2026. 61 zusätzliche GPU-Varianten; Inventar-Abgleich in [gpu-coverage.json](gpu-coverage.json). Übernommen wurden Identität und technische Zahlen, keine Beschreibungen, Benchmarks oder Implementierung des Wettbewerbers. Pro neuem Gerät stehen Quellenlink, Rechenbasis und Datumsangabe in `public/data/devices.json`.

## Herstellerquellen

- [NVIDIA Desktop-Vergleich](https://www.nvidia.com/en-gb/geforce/graphics-cards/compare/): GeForce RTX 20/30/40/50, Speichervarianten getrennt.
- [NVIDIA RTX 50 Notebooks](https://www.nvidia.com/en-gb/geforce/laptops/50-series/), [RTX 40](https://www.nvidia.com/en-gb/geforce/laptops/40-series/), [RTX 30](https://www.nvidia.com/en-ph/geforce/laptops/30-series/): mobile Chips sind eigene Geräte, keine Desktopkarten mit gleichem Namen.
- [Professionelle Notebook-GPUs](https://www.nvidia.com/en-gb/products/workstations/professional-laptops/compare/): RTX PRO 5000 Blackwell Laptop, 24 GB / 896 GB/s.
- [Intel Arc Desktop B-Serie](https://www.intel.com/content/www/us/en/products/details/discrete-gpus/arc/desktop/b-series.html), [Arc Pro Übersicht](https://www.intel.de/content/www/de/de/ark/products/series/242616/intel-arc-pro-b-series-graphics.html), [B70 Spezifikation](https://www.intel.com/content/www/us/en/products/sku/245797/intel-arc-pro-b70-graphics/specifications.html): sechs Intel-Varianten einschließlich B65/B70.
- [AMD Grafik-Spezifikationen](https://www.amd.com/en/products/specifications/graphics.html), [RX 9070 GRE](https://www.amd.com/en/products/graphics/desktops/radeon/9000-series/amd-radeon-rx-9070-gre.html), [Accelerator-Spezifikationen](https://www.amd.com/en/products/specifications/accelerators.html): Radeon und Instinct MI50 32 GB.
- NVIDIA Server/Workstation: [L40S](https://www.nvidia.com/en-in/data-center/l40s/), [L40](https://images.nvidia.com/content/Solutions/data-center/vgpu-L40-datasheet.pdf), [L4](https://www.nvidia.com/en-us/data-center/l4/), [A10](https://www.nvidia.com/en-us/data-center/products/a10-gpu/), [A100](https://www.nvidia.com/en-us/data-center/a100/), [H100 PCIe](https://www.nvidia.com/content/dam/en-zz/Solutions/gtcs22/data-center/h100/PB-11133-001_v01.pdf), [H100 SXM](https://www.nvidia.com/en-us/data-center/h100/), [RTX A5000](https://www.nvidia.com/en-us/products/workstations/rtx-a5000/), [RTX A6000](https://www.nvidia.com/en-us/products/workstations/rtx-a6000/).
- [NVIDIA Pascal/P40](https://developer.nvidia.com/blog/new-pascal-gpus-accelerate-inference-in-the-data-center/), [GTX 1080 Ti – NVIDIA Developer Forum](https://forums.developer.nvidia.com/t/driver-for-gtx-1080-ti/48605).

## Interpretation

`tf` ist eine theoretische Rechengrenze für das bestehende Roofline-Modell, keine gemessene LLM-Geschwindigkeit. GeForce Ada: sparse INT8 AI TOPS / 4; Blackwell: sparse INT4 AI TOPS / 8. Ampere-GeForce: FP32-Boost-Rechenleistung × 4 als FP16-Tensor-Näherung; Turing × 8. Intel: dense INT8 TOPS / 2 als FP16-XMX-Näherung. Herstellerwerte können gerundet sein. AMD nutzt veröffentlichte FP16-Vektorwerte, RX 9070 GRE den FP16-Matrixwert; dies ist in `computeBasis` dokumentiert. Pascal hat keine Tensor Cores und nutzt ausdrücklich FP32 als Ersatzbasis, keine behauptete Tensor-FP16-Leistung.

Serverdaten verwenden FP16 ohne sparsity. H100 PCIe und H100 SXM sind getrennte Einträge (2.000 bzw. 3.350 GB/s). Alle Werte gelten für eine GPU, ohne Multi-GPU-Skalierung. Notebookwerte sind theoretische Obergrenzen; TGP und Kühlung beeinflussen das Ergebnis.

Die Effizienzannahmen sind von den vorhandenen Herstellergruppen übernommen (NVIDIA η=0,60 / ηC=0,50, AMD η=0,50 / ηC=0,35); Intel startet mit η=0,50 / ηC=0,35. Neue Karten sind nicht einzeln benchmark-kalibriert. Der Hinweis „Tempo geschätzt“ erscheint in der Gerätetabelle. Für Intel und Pascal gibt es keine Bildzeit-Schätzung.

## Preise

Keine US-MSRP als Europreis und keine erfundenen Gebraucht-/Server-/Notebookpreise. Neue Geräte haben zunächst `price: null`; Nutzer können einen Europreis eintragen. Ohne Preis gibt es weder Preis-Leistungs-Score noch günstigste Empfehlung. Desktopkarten bekommen optional den PC-Aufpreis; bei Notebook-/Server-GPUs wird ein eingegebener Preis als kompletter Systempreis behandelt. Bestehende automatische Preisquellen bleiben erhalten. Das Hinzufügen belastbarer Händlerquellen für die neuen Karten ist ein weiterer Datenpflege-Schritt.
