# BundleKit Theme Integration and Release Readiness

Last validated: 2026-02-27

## Purpose

This document is the executable validation runbook for:

- `/Users/rexhe/.cursor/plans/bundle_kit_rebuild_phases_bf47d1d5.plan.md`
- `/Users/rexhe/.cursor/plans/bundle_app_architecture_review_6f3a3f7b.plan.md`

It defines objective pass/fail gates, commands, and required evidence for release signoff.

## One-Command Local Gate

From repository root:

```bash
npm run validate
```

Strict mode for CI/release branch gating:

```bash
npm run validate:ci
```

### Gate status semantics

- `PASS`: gate completed with expected result.
- `BLOCKED`: gate could not run due to environment/config prerequisites.
- `FAIL`: gate ran and produced incorrect results.

Release signoff requires **zero `FAIL` and zero `BLOCKED`**.

## Validation Matrix (Automation-First)

| Gate | What it proves | Command / method | Required evidence |
| --- | --- | --- | --- |
| ArchitectureRemoval | No app proxy/storefront dependency remains | `npm run validate` (ArchitectureRemoval check) | Console output showing `PASS` |
| AppBuild | App compiles after rebuild changes | `npm run validate` (AppBuild check) | Build completion output |
| Lint | Static quality baseline is enforceable | `npm run validate` (Lint check) | Lint output, or `BLOCKED` reason to be resolved |
| FunctionTests | Function behavior matches fixture expectations | `npm run validate` (FunctionTests check) | Vitest run output with fixture list |
| FunctionUnitTests | Focused function test target runs deterministically | `npm run validate` (FunctionUnitTests check) | Vitest summary |
| DevStoreAdminFlow | Bundle CRUD + sync pipeline updates data in Shopify | Manual flow on `modern-standard-developer-store.myshopify.com` | Screenshots + Admin GraphQL evidence |
| DevStoreCartFlow | ORDER + PRODUCT discount outputs render correctly | Manual cart/checkout validation | Cart/checkout screenshots |
| RecoveryResyncFlow | Re-sync repairs intentionally drifted data | Manual recovery flow from settings | Before/after evidence |

## Function Scenario Coverage (Fixture Expectations)

These scenarios must pass in `extensions/bundle-discount/tests/fixtures`:

- `cart-lines-fbt-plus-volume.json`: verifies ORDER + PRODUCT operations coexist.
- `cart-lines-order-and-volume-partitioned.json`: verifies ORDER-first claiming still leaves eligible quantity for volume.
- `cart-lines-volume-blocked-by-bundle-claim.json`: verifies no-double-dipping blocks a volume candidate that would otherwise qualify.
- Existing baseline fixtures remain mandatory for regression protection.

## Live Dev Store Verification (Required)

Store: `https://modern-standard-developer-store.myshopify.com`

### A) Admin CRUD -> consolidated node + product metafields

1. Create a new active bundle in app admin.
2. Edit the bundle title/discount value.
3. Deactivate then reactivate the bundle.
4. Delete the bundle.
5. After each step, verify:
   - consolidated node metafield reflects all active bundles.
   - affected product `bundle_app.config` metafields are updated or removed.

Evidence:

- Screenshot of each CRUD action success state.
- Admin API response snippet for discount node metafield.
- Admin API response snippet for at least one product metafield per affected product.

### B) Cart/checkout discount correctness

1. Build a cart that should trigger bundle (`ORDER`) and volume (`PRODUCT`) outcomes together.
2. Confirm cart line-level allocations display under item discounts.
3. Confirm cart-level bundle discount appears in order-level discounts.
4. Confirm quantities claimed by bundle logic are not also discounted by volume logic.

Evidence:

- Cart screenshot showing line allocations.
- Cart screenshot showing cart-level discount application.
- Checkout screenshot confirming final totals and labels.

### C) Recovery sync

1. Introduce controlled drift (e.g., deactivate bundle, then reactivate after stale data path).
2. Run Admin Settings -> `Re-sync Theme + Discounts`.
3. Re-verify consolidated node + product metafield correctness.

Evidence:

- Before snapshot (drift present).
- After snapshot (drift resolved).

## Theme Integration Contract (Current)

### Product metafield (theme data source)

- Namespace: `bundle_app`
- Key: `config`
- Type: `json`
- Owner type: `PRODUCT`
- Write path: `syncProductMetafield()` in `app/utils/metafields.server.ts`

Payload is an array of bundle configs containing:

- bundle identity and discount metadata
- `productHandles`
- `collections[]` with `handle` and `previewProductHandles` for MIX_MATCH use cases

### Discount function metafield (execution source)

- Namespace: `bundle_app`
- Key: `config`
- Type: `json`
- Owner type: `DiscountAutomaticApp`
- Write path: `syncConsolidatedDiscountNode()` in `app/utils/settings.server.ts`
- Discount classes: `PRODUCT` + `ORDER`
- Guardrail: payload write rejected above 240000 bytes

## Operational Recovery Paths

- Settings action: `app/routes/app.settings.tsx`
  - `syncAllBundleDiscountNodes()`
  - `syncAllProductMetafields()`
- Webhook path: `app/routes/webhooks.collections.update.tsx`
  - `syncBundlesAffectedByEntity()`

## Release Signoff Template

Use this checklist per release candidate:

- [ ] `npm run validate:ci` completed with all gates `PASS`.
- [ ] Dev store admin CRUD evidence captured.
- [ ] Dev store cart/checkout evidence captured.
- [ ] Recovery re-sync evidence captured.
- [ ] Evidence links added to `PROJECT_PROGRESS.md`.
