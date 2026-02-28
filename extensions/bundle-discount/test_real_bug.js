import { cartLinesDiscountsGenerateRun } from './src/cart_lines_discounts_generate_run.ts';

// Exact scenario from user screenshot
const scenario = {
  cart: {
    lines: [
      { id: "gid://shopify/CartLine/1", quantity: 1, cost: { subtotalAmount: { amount: "1025.00" } }, merchandise: { __typename: "ProductVariant", id: "gid://shopify/ProductVariant/oxygen", product: { id: "gid://shopify/Product/10238996152452", handle: "the-collection-snowboard-oxygen" } } },
      { id: "gid://shopify/CartLine/2", quantity: 1, cost: { subtotalAmount: { amount: "749.95" } }, merchandise: { __typename: "ProductVariant", id: "gid://shopify/ProductVariant/liquid", product: { id: "gid://shopify/Product/10238996250756", handle: "the-collection-snowboard-liquid" } } },
      { id: "gid://shopify/CartLine/3", quantity: 1, cost: { subtotalAmount: { amount: "949.95" } }, merchandise: { __typename: "ProductVariant", id: "gid://shopify/ProductVariant/multi", product: { id: "gid://shopify/Product/10238996021380", handle: "the-inventory-not-tracked-snowboard" } } },
      { id: "gid://shopify/CartLine/4", quantity: 1, cost: { subtotalAmount: { amount: "629.95" } }, merchandise: { __typename: "ProductVariant", id: "gid://shopify/ProductVariant/multi2", product: { id: "gid://shopify/Product/10238996415092", handle: "the-multi-managed-snowboard" } } },
    ]
  },
  discount: {
    discountClasses: ["ORDER", "PRODUCT"],
    metafield: {
      value: JSON.stringify([
        { id: "bundle-mix", title: "Mix & Match 3 (45%)", type: "MIX_MATCH", priority: 30, discountType: "PERCENTAGE", discountValue: 45, targetQuantity: 3, items: [{ productId: "gid://shopify/Product/10238996152452", requiredQuantity: 1 }, { productId: "gid://shopify/Product/10238996250756", requiredQuantity: 1 }, { productId: "gid://shopify/Product/10238996021380", requiredQuantity: 1 }, { productId: "gid://shopify/Product/10238996415092", requiredQuantity: 1 }] },
        { id: "bundle-fbt", title: "FBT - 1 (25%)", type: "FBT", priority: 0, discountType: "PERCENTAGE", discountValue: 25, items: [{ productId: "gid://shopify/Product/10238996152452", requiredQuantity: 1 }, { productId: "gid://shopify/Product/10238996021380", requiredQuantity: 1 }, { productId: "gid://shopify/Product/10238996415092", requiredQuantity: 1 }] }
      ])
    }
  },
  shop: { localTime: { date: "2026-02-28" } }
};

const output = cartLinesDiscountsGenerateRun(scenario);
console.log("=== REAL BUG SCENARIO OUTPUT ===");
console.log(JSON.stringify(output, null, 2));

// Analyze the output
const candidates = output.operations?.flatMap(op => op.productDiscountsAdd?.candidates || op.orderDiscountsAdd?.candidates || []) || [];
console.log("\n=== CANDIDATES ANALYSIS ===");
console.log(`Total candidates: ${candidates.length}`);
candidates.forEach((c, i) => {
  console.log(`\nCandidate ${i + 1}: ${c.message}`);
  console.log(`  Targets: ${JSON.stringify(c.targets)}`);
  console.log(`  Value: ${JSON.stringify(c.value)}`);
});
