# Distributor Map: audit and paid Shopify app rebuild

Reviewed: 2026-10-19. Scope: repository inspection only; no live store, billing
account, or production data was accessed. Severity describes launch risk, not a
confirmed incident. This is a proposed commercial architecture, not a claim that
Shopify has approved the app or its pricing. A Shopify-native storage-only
plan (no billing / no PostgreSQL) is **not** sufficient for the paid product
described here. For hosting instructions, see
[self-hosted backend migration](self-hosted-backend-migration.md).

## What exists today

- Shopify embedded App Home extension (`extensions/app-home`), plus a separate
  Next.js dashboard/editor (`app/`) and a Theme App Extension
  (`extensions/store-locator`). The theme block embeds location metaobjects as
  JSON and falls back to a signed app-proxy search endpoint.
- Location create/list/edit/import/export routes use Shopify metaobjects;
  settings and storefront search still use Prisma/PostgreSQL. This is a
  **partial migration**, not an all-Shopify or all-Postgres architecture.
- There is no subscription, trial, entitlement check, or paid-plan state in
  `prisma/schema.prisma`, `app/api/admin/`, or `app/api/storefront/`.
  `APP_ENV` in `lib/config/env.ts` is configuration, not a license check.

## Problems and recommended fixes

| Priority | Finding and evidence | Recommendation |
| --- | --- | --- |
| P0 | No billing or server-side access control. Any installed shop with a valid Shopify ID token can write locations (`app/api/admin/locations/route.ts`); a signed app-proxy request can read published locations (`app/api/storefront/search/route.ts`). | Add one shop-scoped entitlement service and gate **every** paid write, import, export, settings/constructor write, and storefront data path. Authentication proves shop identity, not payment. Keep billing/upgrade pages reachable without an active plan. |
| P0 | The Theme App Extension embeds a public location snapshot directly in Liquid (`extensions/store-locator/blocks/store_locator.liquid`, lines 57-86). `store-locator.js` prefers any parsed array, even `[]`, over proxy search (lines 44-55, 580-606). Blocking only the proxy cannot disable the existing storefront map or hide its data. | For a genuinely enforceable trial, stop embedding the full data snapshot on licensed storefronts and fetch via a signed, server-gated app-proxy endpoint. If a Shopify-hosted public metaobject snapshot remains the product design, accept that server-only gating cannot revoke already-rendered data; choose a limited free tier instead. Never ship a client-side `isPaid` switch as the sole gate. |
| P0 | The Liquid snapshot references a numeric app-scoped metaobject type, `app--427145920513--distributor_location_v2` (`store_locator.liquid`, line 59), whereas the Admin API uses `$app:distributor_location_v2` (`lib/shopify/location-metaobjects.ts`). A new app identity could yield an empty snapshot; since empty arrays bypass proxy fallback, the locator may show no locations. | Remove the hard-coded app ID; resolve the app-owned definition via supported Liquid access or use the signed proxy as the single storefront source. Test on a *second* clean development store and a new app installation. |
| P1 | Location listing fetches only `first: 250` without cursors (`lib/shopify/location-metaobjects.ts`, `LIST_QUERY`); GET pagination occurs **after** that query (`app/api/admin/locations/route.ts`). `findMetaobjectLocation` also scans the same first page, so edit/delete/bulk/import become unreliable above 250 locations. | Implement cursor pagination or a suitable bulk read strategy; use targeted ID/handle lookup for mutations and a paged/queued import with per-row results. Define and test plan quotas separately from API pagination. |
| P1 | Two sources of truth disagree: metaobject CRUD and CSV export vs Prisma settings and storefront proxy search (`app/api/admin/settings/route.ts`, `app/api/storefront/{search,settings}/route.ts`). A new metaobject location may not appear through proxy fallback; settings in the old store may not match the new data model. | Pick one authoritative location/settings model; cut over readers and writers together. Migrate by shop with counts/checksums, preserve exports/rollback, then retire unused tables/routes. Do not drop the database while billing state still needs it. |
| P1 | The Liquid snapshot includes `published` and `productIds` but does not filter drafts before serializing; local search checks name only and does not filter `published` (`store_locator.liquid`, lines 57-85; `store-locator.js`, lines 590-604). The proxy applies `published: true` and can filter product/type (`app/api/storefront/search/route.ts`). | Filter active/published records at the data boundary and make local and server search semantics identical, including city/address/postal/type/product/radius. Add contract tests for draft visibility. |
| P1 | App Home opens the constructor at a URL containing the Shopify ID token (`extensions/app-home/src/pages/SettingsPage.jsx`, `openEditor`; `app/constructor/ConstructorClient.tsx`, URL parsing). Query tokens can leak through browser history, logs, screenshots, or referrers. | Open an embedded authenticated route and acquire a fresh token with App Bridge for each request; if a separate tab is required, exchange a short-lived one-time code server-side, remove it from the URL immediately, and set restrictive referrer/cache headers. |
| P1 | The proxy verifier checks HMAC but not `timestamp` freshness (`lib/shopify/app-proxy.ts`); valid signed URLs can be replayed. No rate limit is visible on storefront search, and a bounding-box search may load an unbounded set into memory (`app/api/storefront/search/route.ts`). | Verify the platform's current signature/canonicalization rules with official fixtures, reject stale timestamps, cap result size/area, add rate limits and cache safely per shop/entitlement. Avoid geocoding for arbitrary unauthenticated searches. |
| P2 | The storefront loads MapLibre JS/CSS from `unpkg.com` at runtime (`extensions/store-locator/assets/store-locator.js`, lines 2-21), while the app dependency declares a different version (`package.json`). | Bundle or pin a reviewed asset, define CSP/CDN strategy, and test storefront load/failure/mobile cases; monitor provider usage, attribution, terms, and cost. |
| P2 | The root Next.js dashboard displays placeholder metrics and "Foundation ready" (`app/page.tsx`), while the App Home extension is the usable UI. `README.md` still describes an extension-only template, despite the Next.js server and database; `render.yaml` still runs Prisma migrations. No first-party tests were found. | Choose one primary merchant navigation surface, remove or replace placeholder pages, document real deploy/data ownership, and add focused unit/integration/end-to-end tests before release. |

Additional data-consistency check: `locationValues()` writes empty optional fields
and defaults when updating (`lib/shopify/location-metaobjects.ts`), while the edit
route merges a parsed location with a narrow update schema. Verify round trips
for opening hours, tags, product IDs, images, and custom fields before any
destructive migration or mass editing.

## Paid-product decision

**Recommended:** a publicly distributed Shopify app with Shopify-supported
recurring app billing and an explicit trial (proposed: 14 days; price and
duration are product decisions). Do not charge through an external checkout
unless Shopify's current distribution/payment rules explicitly allow it.
Confirm current App Home extension eligibility for the chosen distribution
model in Shopify's documentation/Partner Dashboard *before* committing to
that surface; keep the authenticated Next.js admin as a fallback. Do not
assume the current app configuration or extension-only template can simply
be converted into an approved public paid listing.

Alternative: if this is **only** an internal/custom app for a fixed merchant,
skip public billing and use a server-side allowlist of verified shop IDs.
That is not a paid multi-merchant launch. Do not infer "dev store" from a
`*.myshopify.com` name, query parameter, local `APP_ENV`, or hostname.

### Entitlement policy (choose and document before implementation)

| State | Admin | Storefront |
| --- | --- | --- |
| Verified development/test store | Full features without a real charge, only when Shopify/Partner metadata or test-billing mode confirms eligibility; never rely on a merchant-supplied flag. | Fully functional for testing. |
| Trialing | Full features through the authoritative Shopify billing trial end date. | Fully functional. |
| Active paid subscription | Full features subject to the purchased tier/quota. | Fully functional. |
| Pending approval / past due / canceled / expired / uninstalled | Billing, help, and data-export/recovery access per retention policy; writes blocked. Reconcile ambiguous billing states instead of guessing. | Decide explicitly: either hide the locator and return no private location payload, or retain a documented small free tier. Show a safe empty/upgrade state, not a broken map. |

Start billing only after merchant approval according to the selected Shopify
billing flow. Never start a fresh trial on every reinstall. On reinstall,
reconcile Shopify's authoritative subscription state and the shop's trial
history. Decide how canceled trials, plan changes, charge declines and
development-to-live transitions behave. Prefer Shopify-managed pricing if
supported for this app/distribution; otherwise implement the supported
recurring subscription flow server-side with a trial period and redirect for
approval. **Do not run two billing systems simultaneously.** Verify exact API
versions, trial fields, eligibility, and review requirements against current
Shopify docs during implementation, not assumptions in this audit.

## Target architecture

```text
Shopify Admin / App Bridge
    -> verified ID token -> backend auth + shop context
    -> entitlement guard -> admin CRUD/import/settings/upgrade
                         -> Shopify Admin GraphQL (metaobjects, files)
                         -> shop-scoped database (billing/installation/jobs)

Theme App Extension (UI/assets only)
    -> signed app proxy -> entitlement guard -> published location read model
                                            -> bounded/paginated search response

Shopify billing + lifecycle webhooks
    -> HMAC verification -> idempotent queue/handler -> reconcile Shopify state
                                           -> entitlement/installation cache
```

- **Ownership:** Shopify metaobjects are the merchant's canonical location
  records if the native migration is completed. Keep a small shop-scoped
  database for installation IDs, encrypted offline tokens if needed, billing
  history/trial eligibility, webhook dedupe, sync cursors and import jobs.
  Alternatively keep locations in Postgres and drop the redundant metaobject
  writes, but commit to one source of truth. Never trust a storefront-supplied
  shop ID for an Admin write.
- **Entitlement:** one `requireEntitlement(shopId, capability)` at the backend
  boundary, not duplicated boolean checks in each UI. Reconcile with
  Shopify's subscription status on install, admin open, webhook and bounded
  cache expiry; fail closed for paid writes when state is unknown. Version
  entitlement/cache keys by shop and tier. Test webhook retries, out-of-order
  delivery and app uninstall. Do not rely solely on a webhook arriving.
- **Storefront:** signed, timestamp-checked proxy requests with per-shop
  bounded queries and an entitlement-aware cache. Return only fields needed
  to render published locations; do not expose draft/contact fields
  unintentionally. Paginate/chunk for large inventories, avoiding a full
  snapshot on every page load. Data already emitted in HTML or cached by a
  browser cannot be retroactively revoked.
- **Security/operations:** preserve existing Shopify authentication, add
  billing and proxy replay tests, shop isolation and rate limits, privacy/data
  deletion handling as required for the intended distribution, structured
  logs without tokens, backup/restore, monitoring, and app-review documentation.

## Rebuild sequence and exit criteria

1. **Product/distribution spike:** confirm public distribution, App Home
   support, Shopify billing mode, pricing/trial policy, quotas, and desired
   post-expiry storefront behavior in a test app/store. Exit: written decision
   and a successful end-to-end test charge/trial in Shopify test mode.
2. **Stabilize existing behavior:** add fixtures for proxy signatures, draft
   visibility, multiple shops, >250 locations, CSV idempotency, and settings
   round trips. Exit: regression suite runs in CI; export/backup exists.
3. **Unify data paths:** remove hard-coded app metaobject ID, choose the
   canonical data source, paginate imports/listing, migrate settings and
   locations with verification per shop. Exit: Admin, theme, and proxy show
   identical published data on two fresh stores.
4. **Build billing/entitlements:** add persistent shop/billing state, supported
   Shopify subscription approval + trial, reconciliation/webhooks and a
   server-side development-store exemption. Exit: tests cover trial expiry,
   reinstall, canceled/declined subscription, duplicate/out-of-order
   webhooks and dev-store-to-live transition.
5. **Enforce access end to end:** gate all paid admin routes and the proxy,
   replace the public Liquid full-data snapshot for revocable access, implement
   upgrade/empty states. Exit: expired shops cannot write or fetch full
   storefront data by calling APIs directly or by loading the theme block.
6. **Release safely:** test desktop/mobile/theme editor, performance at target
   location counts, accessibility, privacy requests and uninstall/reinstall.
   Deploy behind a controlled rollout; monitor billing mismatches, proxy
   failures and map errors; retain a reversible data export until parity is
   proven. Exit: app listing/review requirements met and rollback rehearsed.

This document is an audit and implementation plan, not a migration script.
Avoid removing the current database, old routes or merchant data until
parity, billing state and recovery have been verified.
