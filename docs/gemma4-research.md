# Gemma 4 hardware inputs

Verified on 2026-10-11. Five core sizes are represented: E2B, E4B, 12B,
26B-A4B and 31B. Base and instruction-tuned checkpoints share a hardware entry.
This calculator estimates single-sequence text generation, not model quality.

## Parameters and weight files

| Size | Total text parameters (B) | Effective / active (B) | Q4_K_M weights (GB) | Official QAT Q4_0 weights (GB) | Context limit |
| --- | ---: | ---: | ---: | ---: | ---: |
| E2B | 5.1 | 2.3 | 3.462680032 | 3.349516256 | 131072 |
| E4B | 8.0 | 4.5 | 5.405170144 | 5.154941280 | 131072 |
| 12B | 11.95 | 11.95 | 7.381383680 | 6.975879296 | 262144 |
| 26B-A4B | 25.2 | 3.8 | 17.035039872 | 14.439363584 | 262144 |
| 31B | 30.7 | 30.7 | 19.598489952 | 17.651001568 | 262144 |

Parameter counts and context limits: [Google model card](https://ai.google.dev/gemma/docs/core/model_card_4).
E2B/E4B use per-layer embeddings: their effective counts must not be used
as total resident weights. 26B-A4B activates a subset of its experts.

Q4_K_M sizes are actual file bytes divided by 1e9, not Google's rounded
memory table (which uses different assumptions and formats):

- [E2B Q4_K_M](https://huggingface.co/bartowski/google_gemma-4-E2B-it-GGUF)
- [E4B Q4_K_M](https://huggingface.co/bartowski/google_gemma-4-E4B-it-GGUF)
- [12B Q4_K_M](https://huggingface.co/SoAIHQ/gemma-4-12B-it-GGUF)
- [26B-A4B Q4_K_M](https://huggingface.co/bartowski/google_gemma-4-26B-A4B-it-GGUF)
- [31B Q4_K_M](https://huggingface.co/bartowski/google_gemma-4-31B-it-GGUF)

Q4_K_M repository revisions inspected:

| Size | Repository | Revision |
| --- | --- | --- |
| E2B | `bartowski/google_gemma-4-E2B-it-GGUF` | `81012ba3538e061d5ee003f11f25335b17f82e2d` |
| E4B | `bartowski/google_gemma-4-E4B-it-GGUF` | `029e94146666900b08caf49a3b47b413dfa8ec66` |
| 12B | `SoAIHQ/gemma-4-12B-it-GGUF` | `7f8820dac502a17413b422db5d4708520feeb7e7` |
| 26B-A4B | `bartowski/google_gemma-4-26B-A4B-it-GGUF` | `10f3b41bcf8d3047f4e136e7197ffc2dd1654c9d` |
| 31B | `bartowski/google_gemma-4-31B-it-GGUF` | `619aca7589c72be65dd968de8602ad23d68b5c14` |

Q4_0 uses Google's actual text GGUF files, excluding `mmproj`:

- [E2B QAT](https://huggingface.co/google/gemma-4-E2B-it-qat-q4_0-gguf/tree/675cff42a74c774d6cb76f76d8eacb49b48c9b93)
- [E4B QAT](https://huggingface.co/google/gemma-4-E4B-it-qat-q4_0-gguf/tree/4b4a2c1d584be7264f87aac328a1bc739ce81b6c)
- [12B QAT](https://huggingface.co/google/gemma-4-12B-it-qat-q4_0-gguf/tree/29d097773436b69ff9feafd636ab4cf873786537)
- [26B-A4B QAT](https://huggingface.co/google/gemma-4-26B-A4B-it-qat-q4_0-gguf/tree/d1c082be9cf3c8a514acf63b8761f4b41935842e)
- [31B QAT](https://huggingface.co/google/gemma-4-31B-it-qat-q4_0-gguf/tree/59dde24573e7e61570dba08b18a2e1fe246955ed)

## KV cache derivation

Official text configurations:
[E2B](https://huggingface.co/google/gemma-4-E2B-it/blob/main/config.json),
[E4B](https://huggingface.co/google/gemma-4-E4B-it/blob/main/config.json),
[12B](https://huggingface.co/google/gemma-4-12B-it/blob/main/config.json),
[26B-A4B](https://huggingface.co/google/gemma-4-26B-A4B-it/blob/main/config.json),
[31B](https://huggingface.co/google/gemma-4-31B-it/blob/main/config.json).

| Size | Unshared local / global layers | Local / global KV heads | Local / global head dimension | Sliding window |
| --- | --- | --- | --- | ---: |
| E2B | 12 / 3 | 1 / 1 | 256 / 512 | 512 |
| E4B | 20 / 4 | 2 / 2 | 256 / 512 | 512 |
| 12B | 40 / 8 | 8 / 1 | 256 / 512 | 1024 |
| 26B-A4B | 25 / 5 | 8 / 2 | 256 / 512 | 1024 |
| 31B | 50 / 10 | 16 / 4 | 256 / 512 | 1024 |

For token count C: `KV bytes = 2 (K,V) × 2 (FP16 bytes) ×
(globalLayers × globalHeads × globalDim × C +
localLayers × localHeads × localDim × min(C, window))`.
Shared tail layers (20 for E2B, 18 for E4B) do not allocate another cache.
Despite shared K/V projection weights in larger models, keys undergo RoPE
and values do not; both cache tensors are counted. See the
[Transformers implementation](https://github.com/huggingface/transformers/blob/main/src/transformers/models/gemma4/modeling_gemma4.py).
This assumes an optimized bounded local cache; backend allocation and prefill
buffers may require more memory. The calculator retains its separate 1 GB
runtime reserve.

## Estimates and variants

Active bytes read use `Q4_K_M file size × active/effective parameters ÷ total
parameters`; dense models use the full file size. This is an approximation,
not measured Gemma throughput. MoE retains the site's 0.55 routing-efficiency
factor. Q4_0 uses its own file size; other precisions retain estimated bit scaling.

[Google's overview](https://ai.google.dev/gemma/docs/core) also lists QAT serving
formats, mobile-specialized E2B/E4B weights and MTP assistant checkpoints.
These are not independent core LLM sizes. The text-only estimate excludes
image/audio projection or encoder files, mobile-specific quantization schemes
and additional MTP draft weights/speedups. The image-generation tab remains
for diffusion models; Gemma's image understanding does not generate images.
