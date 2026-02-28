/* eslint-env node */
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { describe, test } from "vitest";
import { cartLinesDiscountsGenerateRun } from "../src/cart_lines_discounts_generate_run";

process.env.BUNDLE_KIT_DEBUG = process.env.BUNDLE_KIT_DEBUG || "1";

function flattenProductCandidates(output) {
  const ops = output?.operations || [];
  const out = [];
  for (const op of ops) {
    const candidates = op?.productDiscountsAdd?.candidates || [];
    for (const c of candidates) out.push(c);
  }
  return out;
}

function summarize(output) {
  const candidates = flattenProductCandidates(output);
  return {
    operationCount: output?.operations?.length || 0,
    productCandidateCount: candidates.length,
    productMessages: candidates.map((c) => c.message),
    allocations: candidates.map((c) => ({
      message: c.message,
      targets: (c.targets || []).map((t) => ({
        lineId: t?.cartLine?.id,
        quantity: t?.cartLine?.quantity,
      })),
      value: c.value,
    })),
  };
}

describe("Debug scenarios runner (no assertions)", () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const fixturesDir = path.join(__dirname, "fixtures");
  const fixtureFiles = fs
    .readdirSync(fixturesDir)
    .filter((file) => file.endsWith(".json"))
    .sort();

  const only = process.env.BUNDLE_KIT_DEBUG_ONLY || "";

  fixtureFiles.forEach((file) => {
    if (only && !file.includes(only)) return;

    test(`debug ${file}`, () => {
      const fixturePath = path.join(fixturesDir, file);
      const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
      const input = fixture?.payload?.input;
      if (!input) return;

      process.env.BUNDLE_KIT_DEBUG_RUN_ID = `fixture:${file}`;
      const output = cartLinesDiscountsGenerateRun(input);
      const summary = summarize(output);

      // Intentionally prints for quick inspection while also driving debug logs.
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ fixture: file, summary }, null, 2));
    });
  });
});

