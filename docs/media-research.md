# Bild- und Videomodelle (Einsatzzweck „Image & Video“)

Stand: 13.10.2026. Zeiten sind auf eine RTX 4090 normiert (`ref`). Messungen auf anderen Karten werden über den Rechenindex umgerechnet: tf · etaC · pf · Herstellerfaktor, RTX 4090 = 165, RTX 5090 = 209,5. `gb` ist der Spitzenbedarf im typischen ComfyUI-Setup, der Textencoder ist nach dem Encodieren ausgelagert.

| Modell | Parameter | Setup | gb | ref (s) | Quelle |
|---|---|---|---|---|---|
| SDXL | 3,5B | FP16, 30 Schritte, 1024² | 8 | 4,5 | bisherige Kalibrierung |
| FLUX.2 klein 4B | 4B | BF16, 4 Schritte | 10 | 1 (Schätzung) | localaimaster.com/tools/image-model-vram-calculator |
| FLUX.2 klein 9B | 9B | FP8, 4 Schritte | 11,5 | 2 (Schätzung) | dto. |
| Z-Image Turbo | 6B | BF16, 8 Schritte | 14,5 | 3 (Schätzung) | dto. |
| Qwen-Image | 20B | FP8, 20 Schritte | 23 | 25 (Schätzung) | dto. |
| FLUX.2 dev | 32B | GGUF Q4_K_S, 28 Schritte | 22,5 | 56 (Schätzung) | dto. |
| FLUX.1 schnell / dev | 12B | FP8, 4 / 28 Schritte | 14 | 2,2 / 14 | insiderllm.com/guides/flux-locally-complete-guide |
| HiDream-I1 Dev / Full | 17B | FP8, 28 / 50 Schritte | 21 | 20 / 74 (gemessen auf RTX 4090) | instasd.com HiDream-Benchmark |
| LTX-Video 2B | 2B | 768×512, 5 s | 10 | 7 (gemessen auf RTX 4090) | dev.to „RTX 5090 vs 4090 for video gen“ |
| CogVideoX 5B | 5B | FP8, 6 s | 18 | 190 | dto. |
| HunyuanVideo 1.5 | 8,3B | FP8, 720p, 5 s | 22 | 230 | dto. |
| Wan 2.2 A14B | 27B MoE, 14B aktiv | FP8, 720p, 5 s | 16 | 160 | dto. |
| Wan 2.2 TI2V 5B | 5B | FP16, 720p, 5 s | 12 | 540 (Herstellerangabe „unter 9 min“, Original-Skript) | localaimaster.com/blog/wan-vram-requirements-by-gpu |
| LTX-2.5 22B (mit Audio) | 22B | INT8 distilled, 720p, 5 s | 22,7 | 39 (aus RTX 5090: 4 s in rund 25 s) | runaihome.com LTX-2.5-Guide |
| MiniMax H3 (mit Audio) | 33,1B | NVFP4 bzw. INT8, 480p, 10 s, 10 Schritte | 28 | 222 (aus RTX 5090: 175 s, Spitze 26,3 GiB) | ai-muninn.com, comfyui-wiki.com |

## Bewusst nicht enthalten

- **MiniMax Hailuo 02 und Image-01:** nur per API verfügbar. Lokal läuft nur H3, die Gewichte sind seit 3.8.2026 offen.
- **Wan 2.7:** Die Quellen widersprechen sich, ob es offene Gewichte gibt.
- **SD 3.5 und Mochi:** keine belastbaren Zeitmessungen gefunden.

## Grenzen

- Die Werte für Macs und AMD sind nur über den Herstellerfaktor hochgerechnet und daher besonders unsicher.
- FP8 und NVFP4 gibt es auf Macs nicht. Dort laufen die Modelle in BF16 oder als GGUF.
