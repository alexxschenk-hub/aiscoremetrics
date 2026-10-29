// Cloudflare Pages Function für /api/* – die eigentliche Logik liegt in workers/benchmarks-api/src/index.js,
// damit dieselbe API auch als eigenständiger Worker deploybar ist.
// Benötigt im Pages-Projekt: KV-Binding BENCHMARKS und Secret ADMIN_KEY (siehe README).
import { handle } from "../../workers/benchmarks-api/src/index.js";

export const onRequest = (context) => handle(context.request, context.env, context);
