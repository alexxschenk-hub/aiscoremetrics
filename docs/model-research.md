# Modelle: Quellen und Herleitung

Stand: 12.10.2026. Gilt für die Modelle, die mit dem Kommentar „Weitere Modelle“ im `MODELS`-Array von `public/index.html` stehen (Gemma 4: siehe `gemma4-research.md`).

## Felder

- `tp` / `ap`: Parameter gesamt / aktiv pro Token in Mrd. (Modellkarte). Bei MoE zählt `tp` für den Speicher, `ap` für Prompt-Verarbeitung.
- `gb`: Speicher der Gewichte bei Q4_K_M = Summe der tatsächlichen GGUF-Dateien (ohne `mmproj`/Vision). Gibt es kein Q4_K_M, die Q4_K_XL-Datei von Unsloth; bei Qwen3.5-397B, Nemotron 3 Ultra und Mistral Small 4 liegen beide innerhalb von 1 %.
- `agb`: pro Token gelesene Gewichte. MoE: `gb · ap / tp`. Dicht: `gb` minus Embedding-Tabelle (wird pro Token nur zeilenweise gelesen) – so trifft Llama 3.1 8B die LocalScore-Kalibrierung (RTX 4090 ≈ 123 tok/s).
- `kv`: KV-Cache in GB je 1.024 Tokens = Bytes pro Token · 1.024 / 10⁹, nur Attention-Layer, die mit dem Kontext wachsen.
  - GQA: `Layer · KV-Köpfe · head_dim · 2 (K+V) · 2 Byte`
  - MLA: `Layer · (kv_lora_rank + qk_rope_head_dim) · 2 Byte`
  - Feste Zustände (lineare Attention/KDA, Mamba, Sliding Window) wachsen nicht mit dem Kontext und sind im 1-GB-Overhead enthalten.
- `bpw`: nur wenn die Q4-Datei nicht ≈ 4,85 Bit/Gewicht hat (nativ MXFP4/FP4-trainiert). Andere Quantisierungen skalieren dann von dieser Basis.

## Neue Modelle

| ID | Modell | gesamt / aktiv | Q4-Datei | Quelle Größe | KV-Herleitung | kv |
|---|---|---|---|---|---|---|
| ministral3 | Ministral 3 3B | 3,4B dicht | 2,15 GB | mistralai/Ministral-3-3B-Instruct-2512-GGUF Q4_K_M | 26 L · 8 KV · 128 · 4 B = 106.496 B | 0,109 |
| l31_8 | Llama 3.1 8B | 8B dicht | 4,92 GB | bartowski/Meta-Llama-3.1-8B-Instruct-GGUF Q4_K_M | 32 L · 8 KV · 128 · 4 B = 131.072 B | 0,134 |
| q38_27 | Qwen3.8 27B | 27,8B dicht | 16,46 GB | unsloth/Qwen3.8-27B-GGUF UD-Q4_K_M | 16 Full-Attention-L (von 64) · 4 KV · 256 · 4 B = 65.536 B | 0,067 |
| msmall4 | Mistral Small 4 119B | 119B / 6,5B | 73,76 GB | unsloth/Mistral-Small-4-119B-2603-GGUF UD-Q4_K_M | MLA: 36 L · (256 + 64) · 2 B = 23.040 B | 0,024 |
| glm53flash | GLM-5.3-Flash | 320B / 18B | 199,71 GB | unsloth/GLM-5.3-Flash-GGUF UD-Q4_K_XL | 11 DSA-L (34 linear) · 512 · 2 B ≈ 11.264–12.672 B | 0,012 |
| llama4mav | Llama 4 Maverick | 400B / 17B | 242,77 GB | unsloth/Llama-4-Maverick-17B-128E-Instruct-GGUF Q4_K_M | 48 L · 8 KV · 128 · 4 B = 196.608 B (Chunked Attention ignoriert, konservativ) | 0,201 |
| q35_397 | Qwen3.5 397B-A17B | 397B / 17B | 244,09 GB | unsloth/Qwen3.5-397B-A17B-GGUF Q4_K_M | 15 Full-L (von 60) · 2 KV · 256 · 4 B = 30.720 B | 0,031 |
| nemo3ultra | Nemotron 3 Ultra | 550B / 55B | 359,23 GB | unsloth/NVIDIA-Nemotron-3-Ultra-550B-A55B-GGUF UD-Q4_K_M | 12 Attention-L (48 Mamba) · 2 KV · 128 · 4 B = 12.288 B | 0,013 |
| mlarge3 | Mistral Large 3 | 675B / 41B | 406,99 GB | unsloth/Mistral-Large-3-675B-Instruct-2512-GGUF Q4_K_M | MLA: 61 L · (512 + 64) · 2 B = 70.272 B | 0,072 |
| dsv41flash | DeepSeek V4.1 Flash | 552B (+196B Engram) / 16B Decode | 444,74 GB | vcruz305/DeepSeek-V4.1-Flash-GGUF Q4_K_M (Community) | Modellkarte: 890 B/Token globaler KV (FP4) | 0,0009 |
| dsv4pro | DeepSeek V4 Pro | 1,6T / 49B | 849,68 GB | unsloth/DeepSeek-V4-Pro-0813-GGUF UD-Q4_K_XL (nativ FP4-Experten, Download 865 GB) | Modellkarte: 10 % des KV-Cache von V3.2 (≈ 70 KB/Token) | 0,008 |
| kimik3 | Kimi K3 | 2,8T / 104B | 1.508,67 GB | unsloth/Kimi-K3-GGUF UD-Q4_K_XL (nativ MXFP4-QAT, Download 1,56 TB) | MLA: 24 Gated-MLA-L (69 KDA) · (512 + 64) · 2 B = 27.648 B | 0,028 |

Architekturdaten aus den jeweiligen `config.json` (bzw. `params.json` bei Mistral Large 3) der Original-Repos auf Hugging Face, Gesamt-/Aktivparameter aus den Modellkarten.

## Einsatzzwecke

- **Chat & Assistenz:** Allzweck-/Instruct-Modelle (Ministral 3, Llama 3.1/4, Qwen3.8, Qwen3.5-397B, Mistral Small 4/Large 3, Nemotron 3 Ultra).
- **Agentic Coding:** Modelle mit Coding-/Agent-Schwerpunkt laut Modellkarte (Qwen3.8 27B, Mistral Small 4 – ersetzt Devstral, GLM-5.3-Flash, DeepSeek V4.1 Flash).
- **Große Modelle:** alles ab ca. 70 GB.

## Hinweise

- DeepSeek V4 Pro (850 GB) und Kimi K3 (1,5 TB) passen auf kein Gerät im Rechner, auch nicht mit Q2_K. Sie sind als Referenz drin.
- DeepSeek V4.1 Flash: Die Q4-Datei enthält die 196B Engram-Parameter, die nur per Token-Lookup gelesen werden. Prompt-Verarbeitung ist mit 16B aktiv konservativ gerechnet (Prefill laut Modellkarte 8B).
- Mistral Large 3: 673B Sprachmodell + 2,5B Vision-Encoder; die GGUF-Größe ist ohne Vision-Teil.

## Intelligenz-Score (ECI)

- Quelle: Epoch Capabilities Index, CSV `https://epoch.ai/data/eci_scores.csv`, Stand 11.10.2026. Bestwert: Claude Opus 5.5 = 167,33.
- Im Code: `ECI` in `public/index.html` (Wert, 90-%-Intervall, Modellname bei Epoch). Nur Modelle mit eigenem Epoch-Eintrag bekommen einen Wert; die übrigen zeigen „kein ECI-Wert“ (Mistral Large 3, Mistral Small 4, Ministral 3 3B, Gemma 4 E2B/E4B/12B, Devstral Small 24B, Qwen3-Coder 30B-A3B, GLM-4.5-Air, Qwen3.5 122B-A10B). Der alte „Ministral 3B“ (2024) bei Epoch ist ein anderes Modell als Ministral 3 3B.
- DeepSeek V4 Pro: Epoch-Eintrag „DeepSeek V4 Pro 0813“ (155,3), passend zur verwendeten 0813-GGUF; die April-Preview steht bei 149,1.
- Quantisierung: Epoch bewertet in voller Präzision. Ab Q4 wird der Epoch-Wert unverändert gezeigt (Verlust liegt innerhalb des Intervalls), Q3_K_M × 0,96 und Q2_K × 0,92 als markierte Schätzung.
- Aktualisieren: CSV laden, Werte in `ECI` ersetzen, `ECI_TOP` auf den neuen Bestwert setzen, `npm run seo && npm test`.
