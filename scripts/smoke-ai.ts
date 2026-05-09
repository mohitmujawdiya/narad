import { config } from "dotenv";
import path from "node:path";
config({ path: path.resolve(__dirname, "../.env.local"), override: true });

import { perplexityResearch } from "../src/server/services/ai/perplexity";
import { claudeJson } from "../src/server/services/ai/claude";

async function main() {
  console.log("→ Perplexity Sonar smoke test...");
  const r1 = await perplexityResearch({
    prompt: "What is Stripe? One sentence with a citation.",
  });
  console.log(`  ✓ Got ${r1.text.length} chars + ${r1.citations.length} citations in ${r1.meta.latencyMs}ms`);
  console.log(`  First citation: ${r1.citations[0]?.url ?? "(none)"}`);

  console.log("\n→ Claude Sonnet smoke test...");
  const r2 = await claudeJson<{ ok: boolean; greeting: string }>({
    user: 'Return JSON {"ok": true, "greeting": "hello"}.',
    model: "claude-sonnet-4-6",
  });
  console.log(`  ✓ Sonnet returned ok=${r2.data.ok} greeting=${r2.data.greeting} in ${r2.meta.latencyMs}ms`);

  console.log("\n→ Claude Opus smoke test...");
  const r3 = await claudeJson<{ word: string }>({
    user: 'Return JSON {"word": "thunder"}.',
    model: "claude-opus-4-7",
  });
  console.log(`  ✓ Opus returned word=${r3.data.word} in ${r3.meta.latencyMs}ms`);

  console.log("\nAll smoke tests passed.");
}

main().catch((e) => {
  console.error("Smoke test failed:", e);
  process.exit(1);
});
