# Manual Dev Store Evidence Checklist

> **Store:** `modern-standard-developer-store.myshopify.com`  
> **Purpose:** Capture evidence for release signoff per `docs/theme-integration-release-readiness.md`

## Prerequisites

- [ ] `npm run dev` running (app + tunnel active)
- [ ] App installed on dev store via Partner Dashboard
- [ ] Logged into Shopify admin for `modern-standard-developer-store`

---

## A) Admin CRUD → consolidated node + product metafields

### 1. Create bundle

- [ ] Navigate to app → Bundles → New bundle
- [ ] Create a new active bundle with products/collections
- [ ] Save successfully

**Evidence:**

- [ ] Screenshot: Bundle created success state
- [ ] Admin API: Discount node metafield reflects new bundle
- [ ] Admin API: Product `bundle_app.config` metafield updated

### 2. Edit bundle

- [ ] Edit the bundle title or discount value
- [ ] Save successfully

**Evidence:**

- [ ] Screenshot: Bundle edited success state
- [ ] Consolidated node metafield updated
- [ ] Product metafields updated

### 3. Deactivate bundle

- [ ] Deactivate the bundle
- [ ] Verify consolidated node no longer includes it
- [ ] Verify product metafields updated/removed

**Evidence:**

- [ ] Screenshot: Bundle deactivated
- [ ] Admin API: Discount node metafield excludes deactivated bundle

### 4. Reactivate bundle

- [ ] Reactivate the bundle
- [ ] Verify consolidated node includes it again
- [ ] Verify product metafields restored

**Evidence:**

- [ ] Screenshot: Bundle reactivated

### 5. Delete bundle

- [ ] Delete the bundle
- [ ] Verify consolidated node updated
- [ ] Verify product metafields removed

**Evidence:**

- [ ] Screenshot: Bundle deleted success state

---

## B) Cart/checkout discount correctness

- [ ] Build cart that triggers bundle (ORDER) and volume (PRODUCT) outcomes
- [ ] Confirm line-level allocations display under item discounts
- [ ] Confirm cart-level bundle discount appears in order-level discounts
- [ ] Confirm quantities claimed by bundle logic are not double-discounted by volume

**Evidence:**

- [ ] Screenshot: Cart with line allocations
- [ ] Screenshot: Cart-level discount application
- [ ] Screenshot: Checkout final totals and labels

---

## C) Recovery re-sync flow

- [ ] Introduce controlled drift (e.g., deactivate bundle, then reactivate after stale path)
- [ ] Go to Admin Settings → "Re-sync Theme + Discounts"
- [ ] Re-verify consolidated node + product metafield correctness

**Evidence:**

- [ ] Screenshot: Before (drift present)
- [ ] Screenshot: After (drift resolved)

---

## Signoff

| Flow | Status | Notes |
| --- | --- | --- |
| Admin CRUD | _PENDING_ | |
| Cart/checkout | _PENDING_ | |
| Recovery re-sync | _PENDING_ | |

When complete, update `PROJECT_PROGRESS.md` release signoff table with evidence links.
