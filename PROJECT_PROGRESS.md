# BundleKit — Project Progress

> **Last Updated:** 2026-02-28  
> **Start Command:** `npm run dev` (from project root)

## Current Architecture

BundleKit is a Shopify Remix admin app where:

- Admin owns bundle data and discount orchestration.
- Checkout discount execution is done by one consolidated Shopify automatic discount node.
- Storefront rendering is fully theme-owned via product metafields.
- There is no app proxy dependency and no theme app extension dependency.

| Layer | Current ownership |
| --- | --- |
| Admin app | Remix + Polaris (`app/routes/*`) |
| Persistence | Prisma + PostgreSQL (Supabase; `prisma/schema.prisma`) |
| Discount execution | `extensions/bundle-discount` function |
| Theme integration | `product.metafields.bundle_app.config` |

## Completed Through Phase 5

- Consolidated discount sync to a single per-shop node in `app/utils/settings.server.ts`.
- Product metafield sync rewritten for theme consumption in `app/utils/metafields.server.ts`.
- Collection-aware payload support for MIX_MATCH:
  - collection handles
  - preview subset of product handles
- App proxy removed:
  - deleted `app/routes/api.bundles.tsx`
  - removed `[app_proxy]` from `shopify.app.toml`
- Storefront extension removed:
  - deleted `extensions/bundle-storefront/*`
- Settings page simplified to operational controls:
  - "Re-sync Theme + Discounts" now refreshes both consolidated discount data and product metafields.

## Theme Contract (Current)

- Product metafield: `bundle_app.config` (JSON on PRODUCT)
- Written by: `syncProductMetafield()` and batch helpers in `app/utils/metafields.server.ts`
- Payload contains:
  - bundle identity and discount settings
  - `productHandles` for direct product entries
  - `collections[]` with `handle` and `previewProductHandles`

For full integration and release-readiness details, see:

- `docs/theme-integration-release-readiness.md`

## Key Operational Paths

- Bundle CRUD routes:
  - `app/routes/app.bundles.new.tsx`
  - `app/routes/app.bundles.$id.tsx`
  - `app/routes/app._index.tsx`
- Settings recovery route:
  - `app/routes/app.settings.tsx`
- Webhook-driven sync:
  - `app/routes/webhooks.collections.update.tsx`

## Vercel Setup (Phase 4)

- `vercel.json` — build config (buildCommand, installCommand)
- `docs/vercel-setup.md` — connect project + env vars guide
- `scripts/vercel-env-sync.sh` — sync `.env` → Vercel env vars
- `npm run vercel:link` — link local project to Vercel
- `npm run vercel:env-sync production` — push env vars to production

## Remaining Work (Post-Phase 5)

- Harden automated tests for app + function paths in local CI/dev environments.
- Add docs examples for theme snippet patterns using the new metafield payload.
- Continue Phase 6 reliability verification and release checklist execution.

## Release Validation Signoff

Primary runbook:

- `docs/theme-integration-release-readiness.md`

Per release candidate, record evidence links and outcomes below:

| Date | Version / branch | `npm run validate:ci` | Dev store admin flow | Dev store cart/checkout flow | Recovery re-sync flow | Evidence links |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-02-28 | main | PASS | PASS | PASS | PASS | [Manual evidence checklist](docs/manual-evidence-checklist.md) |
