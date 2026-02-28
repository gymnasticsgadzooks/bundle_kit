import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { describe, test, expect } from "vitest";
import { cartLinesDiscountsGenerateRun } from "../src/cart_lines_discounts_generate_run";

function flattenProductCandidates(output) {
  const ops = output?.operations || [];
  const out = [];
  for (const op of ops) {
    const candidates = op?.productDiscountsAdd?.candidates || [];
    for (const c of candidates) out.push(c);
  }
  return out;
}

describe("Default Integration Test", () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const fixturesDir = path.join(__dirname, "fixtures");
  const fixtureFiles = fs
    .readdirSync(fixturesDir)
    .filter((file) => file.endsWith(".json") && !file.includes("fbt-mixmatch-both-expected"))
    .map((file) => path.join(fixturesDir, file));

  // Reproduction fixture: both Mix & Match and FBT should appear when cart has enough for both
  test("runs cart-lines-fbt-mixmatch-both-expected.json (reproduction)", () => {
    const fixtureFile = path.join(fixturesDir, "cart-lines-fbt-mixmatch-both-expected.json");
    const fixture = JSON.parse(fs.readFileSync(fixtureFile, "utf8"));
    const output = cartLinesDiscountsGenerateRun(fixture.payload.input);
    const messages = (output?.operations || []).flatMap((op) =>
      (op?.productDiscountsAdd?.candidates || []).map((c) => c.message)
    );
    expect(messages).toContain("Mix & Match 3 (45%)");
    expect(messages).toContain("FBT - 1 (25%)");
  });

  fixtureFiles.forEach((fixtureFile) => {
    test(`runs ${path.relative(fixturesDir, fixtureFile)}`, () => {
      const fixture = JSON.parse(fs.readFileSync(fixtureFile, "utf8"));
      const fixtureName = path.basename(fixtureFile);
      const output = cartLinesDiscountsGenerateRun(fixture.payload.input);

      expect(output).toEqual(fixture.payload.output);

      const operations = output.operations || [];
      const hasOrderOps = operations.some((operation) => operation.orderDiscountsAdd);
      const hasProductOps = operations.some((operation) => operation.productDiscountsAdd);

      if (fixtureName.includes("fbt-plus-volume") || fixtureName.includes("order-and-volume-partitioned")) {
        expect(hasProductOps).toBe(true);
        expect(hasOrderOps).toBe(false);
      }

      if (fixtureName.includes("volume-blocked-by-bundle-claim")) {
        expect(hasProductOps).toBe(true);
        expect(hasOrderOps).toBe(false);
      }

      // Allocation accuracy: never target more quantity than exists on any cart line.
      // This also detects accidental overlap/stacking across candidates.
      const inputLineQty = new Map(
        (fixture.payload.input?.cart?.lines || []).map((l) => [l.id, l.quantity]),
      );
      const allocatedQty = new Map();
      for (const candidate of flattenProductCandidates(output)) {
        for (const target of candidate.targets || []) {
          const lineId = target?.cartLine?.id;
          const qty = target?.cartLine?.quantity;
          if (!lineId || typeof qty !== "number") continue;
          allocatedQty.set(lineId, (allocatedQty.get(lineId) || 0) + qty);
        }
      }

      for (const [lineId, qty] of allocatedQty.entries()) {
        const available = inputLineQty.get(lineId);
        expect(available).toBeDefined();
        expect(qty).toBeLessThanOrEqual(available);
      }
    });
  });
});
