# Discount validation plan (cart function)

This repository uses the Shopify Function in `extensions/bundle-discount` to emit cart discount operations.

## Priority + allocation rules (current behavior)

- **Phase ordering**
  - **Phase 1 (non-volume)**: `FBT`, `MIX_MATCH`, `CLASSIC`
  - **Phase 2 (volume)**: `VOLUME`
  - Volume deals only apply to **remaining** cart quantities after Phase 1 reserves quantities.

- **Within a phase**
  - Bundles are sorted by **descending** `priority` (missing = 0).
  - Ties are broken by **descending** estimated savings (fixed amount uses `discountValue`; percentage/fixed price estimate uses cart prices).
  - Each bundle is applied **repeatedly** while it can still match (e.g. Mix&Match “any 3” can apply twice if 6 eligible units remain).

- **No stacking (quantity claiming)**
  - Once a cart line quantity is reserved by one candidate, it is not available to other candidates (across all bundles/phases).

## Automated tests (cart fixtures)

Fixtures live in `extensions/bundle-discount/tests/fixtures/*.json` and are executed by `extensions/bundle-discount/tests/default.test.js`.

### Combination matrix covered

- **FBT + Volume**
  - `cart-lines-fbt-plus-volume.json`
  - `cart-lines-volume-blocked-by-bundle-claim.json`
- **FBT + Mix&Match (priority competition)**
  - `cart-lines-fbt-vs-mixmatch-priority-mixmatch-wins.json`
  - `cart-lines-fbt-vs-mixmatch-priority-fbt-wins.json`
- **Mix&Match + Volume**
  - `cart-lines-mixmatch-plus-volume.json`
- **FBT + Mix&Match + Volume**
  - `cart-lines-fbt-mixmatch-volume-priority.json`
- **Savings tiebreak within same priority**
  - `cart-lines-classic-tiebreak-savings.json`

### Allocation accuracy invariant

The test runner also asserts that, across all emitted product candidates:

- For each `cartLine.id`, the **sum of targeted quantities** across candidates is **≤ input cart line quantity**.

This catches accidental overlap/stacking or over-allocation bugs early.

## Running tests

From `extensions/bundle-discount`:

- `npm run test:unit`

