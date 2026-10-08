# Distributor Map: Shopify-Native Architecture Migration Plan

## Repository

```text
/Users/nikshamin/Desktop/Projects/GitHub/Distributor-Map-App/map-app
```

Current branch:

```text
feat/new-arch
```

## Objective

Replace the current Prisma/PostgreSQL data layer with Shopify-native storage for the store locator while keeping the existing Shopify App Home UI, Theme App Extension, modal constructor, CSV import/export, image support, and storefront search.

The target is a small Shopify app with minimal backend usage:

```text
Shopify App Home
        |
        v
Shopify Admin GraphQL
        |
        v
Shopify Metaobjects / shop metafields
        |
        v
Theme App Extension + local storefront filtering
```

This migration intentionally does not include:

- a separate Next.js store-owner registration system;
- external billing;
- password reset;
- a separate global admin system;
- PostgreSQL as the application data source.

If those features are required later, a persistent database or external identity provider will be needed again.

## Current architecture

The current Prisma schema is in:

```text
prisma/schema.prisma
```

It contains:

- `Shop`;
- `Location`;
- `LocationType`;
- `OpeningHour`;
- `LocationTag`;
- `LocationTagRelation`;
- `LocationProduct`;
- `Settings`;
- `GeocodingCache`.

Current API routes use Prisma directly. Examples:

```text
app/api/admin/locations/route.ts
app/api/admin/locations/[id]/route.ts
app/api/admin/import/confirm/route.ts
app/api/admin/export/locations.csv/route.ts
app/api/storefront/search/route.ts
app/api/storefront/settings/route.ts
```

Current storage dependencies:

```env
DATABASE_URL
DIRECT_DATABASE_URL
```

## Target storage model

### Metaobject definition: `retail_location`

Create one Metaobject entry per store/distributor/retailer/stockist.

Recommended fields:

| Field | Type | Source |
|---|---|---|
| `external_id` | single-line text | Stable migration/import key |
| `name` | single-line text | `Location.name` |
| `slug` | single-line text | `Location.slug` |
| `address_line_1` | single-line text | `Location.addressLine1` |
| `address_line_2` | single-line text | `Location.addressLine2` |
| `city` | single-line text | `Location.city` |
| `state` | single-line text | `Location.state` |
| `postal_code` | single-line text | `Location.postalCode` |
| `country` | single-line text | `Location.country` |
| `country_code` | single-line text | `Location.countryCode` |
| `latitude` | decimal/text | `Location.latitude` |
| `longitude` | decimal/text | `Location.longitude` |
| `phones` | JSON | `Location.phones` |
| `emails` | JSON | `Location.emails` |
| `websites` | JSON | `Location.websites` |
| `description` | multi-line text | `Location.description` |
| `images` | list of file references | `Location.imageUrls` |
| `button_url` | URL | `Location.buttonUrl` |
| `type` | single-line text | `Location.type` |
| `published` | boolean | `Location.published` |
| `opening_hours` | JSON | `OpeningHour[]` |
| `custom_values` | JSON | `Location.customValues` |
| `products` | list of product references | `LocationProduct[]` |
| `tags` | JSON/list | `LocationTagRelation[]` |

### Metaobject definition: `retail_locator_settings`

Use one settings entry per shop.

Recommended fields:

- `map_provider`;
- `map_style`;
- `default_latitude`;
- `default_longitude`;
- `default_zoom`;
- `search_radius`;
- `enable_geolocation`;
- `show_directions`;
- `show_phone`;
- `show_website`;
- `show_opening_hours`;
- `primary_color`;
- `accent_color`;
- `background_color`;
- `text_color`;
- `font_family`;
- `heading_font_size`;
- `body_font_size`;
- `label_font_size`;
- `mobile_heading_font_size`;
- `mobile_body_font_size`;
- `mobile_label_font_size`;
- `button_text_color`;
- `button_font_size`;
- `mobile_button_font_size`;
- `button_radius`;
- `custom_sections` JSON;
- `modal_config` JSON;
- `custom_css` if custom CSS remains supported.

A shop metafield namespace can be used instead of a settings Metaobject, but a settings Metaobject is preferable when the configuration needs versioning or future expansion.

## Shopify permissions

Use the smallest scope set required by the final GraphQL operations. The likely scopes are:

```text
read_metaobjects
write_metaobjects
read_products
write_files
```

Product scopes are only needed if locations keep product references or the App Home imports product associations.

The final scope set must be validated against the Shopify Admin GraphQL operations before deployment.

## Migration phases

### Phase 0: Freeze current behavior

Before changing storage:

1. Export the current PostgreSQL data.
2. Save the export outside the repository.
3. Record the current Prisma migration version.
4. Record the current Shopify app version.
5. Do not remove PostgreSQL credentials.

### Phase 1: Create Metaobject definitions

Create definitions using Shopify Admin GraphQL or a one-time setup script:

```text
retail_location
retail_locator_settings
```

The setup must be idempotent:

```text
if definition exists → validate/update fields
if definition missing → create definition
```

Definitions must be created before importing entries.

### Phase 2: Migrate settings

For each `Shop`:

1. Load the current `Settings` row.
2. Convert modal configuration and custom sections to JSON.
3. Create or update the `retail_locator_settings` Metaobject.
4. Store the resulting Metaobject ID in the migration report.

### Phase 3: Migrate locations

For each `Location`:

```text
external_id exists → update matching Metaobject
external_id missing → create Metaobject
```

The migration must be idempotent. Re-running it must not create duplicate locations.

For each location also migrate:

- opening hours into `opening_hours` JSON;
- product references into `products`;
- tags into `tags`;
- custom fields into `custom_values`;
- Shopify File URLs into `images`.

### Phase 4: Rewrite App Home data operations

Replace Prisma calls in the App Home backend flow with Shopify Admin GraphQL operations:

- list Metaobjects;
- create Metaobject;
- update Metaobject;
- delete Metaobject;
- update settings Metaobject;
- manage product references.

The UI should keep its current workflows:

```text
Locations
Add location
Edit location
Publish/unpublish
CSV import
CSV export
Settings
Modal constructor
```

### Phase 5: Rewrite CSV import/export

#### Import

```text
CSV upload
→ preview
→ validation
→ confirmation
→ batched Metaobject create/update
→ progress/result report
```

Required behavior:

- stable `external_id` or slug;
- duplicate detection;
- retry on transient Shopify errors;
- throttling;
- error report per row;
- idempotent re-run;
- no partial duplicate creation.

For large CSV files, use Shopify Bulk Operations where supported.

#### Export

```text
Metaobjects query
→ normalize fields
→ generate CSV in browser or backend
→ download locations.csv
```

Export must include the same columns accepted by import.

### Phase 6: Rewrite storefront data flow

Do not query Shopify Admin API on every search keystroke.

Preferred flow:

```text
Theme page load
→ load one published location snapshot
→ store in browser memory
→ filter/search locally
```

Possible implementations:

1. Render Metaobjects into Liquid JSON.
2. Use Storefront API public-readable Metaobjects.
3. Use App Proxy only for a cached snapshot endpoint.

For the minimal backend goal, Liquid JSON or Storefront API is preferred.

The browser should locally perform:

- name search;
- city search;
- address search;
- postal code search;
- country search;
- type filter;
- product filter;
- radius calculation;
- map viewport filtering.

### Phase 7: Replace geocoding persistence

The current `GeocodingCache` table should not be required after migration.

Options:

- geocode during import and save latitude/longitude in the Metaobject;
- geocode only when a location is created/updated;
- use a hosted geocoder with appropriate rate limits;
- do not geocode on every storefront search.

Coordinates must be stored in the location Metaobject once calculated.

### Phase 8: Verification period

Keep PostgreSQL read-only as a fallback until all checks pass:

- location counts match;
- published counts match;
- coordinates match;
- product references match;
- images load;
- opening hours match;
- modal layout matches;
- custom fields match;
- CSV import/export round-trip works;
- storefront search works without repeated Admin API requests;
- mobile map/list behavior works;
- Theme Editor appearance settings still apply.

### Phase 9: Remove PostgreSQL

Only after the verification period:

1. Remove Prisma reads/writes from runtime routes.
2. Remove database migration/deploy commands.
3. Remove `prisma/` runtime dependency if no longer used.
4. Remove `DATABASE_URL` and `DIRECT_DATABASE_URL` from Render.
5. Remove Neon branch/runtime configuration if no longer needed.
6. Remove database purge cron.
7. Keep a final export/archive according to the data retention policy.

Do not remove the database before this phase.

## Authentication and billing decision

This migration is intended for a Shopify-native app without separate owner registration and without external billing.

If the app keeps:

- email/password owner accounts;
- password reset;
- store memberships;
- internal admin sessions;
- Shopify Billing API;

then some persistent storage is still required and PostgreSQL cannot be removed completely.

If the goal is truly Shopify-native:

```text
Shopify App Home authentication
Shopify Metaobjects
Shopify Files
Shopify Theme Extension
```

then separate Next.js owner accounts and password reset should be removed from the production flow.

## Distribution decision

App Home UI extensions and Shopify Billing/public distribution have platform constraints. Before finalizing the migration, confirm whether the app is:

```text
Custom distribution without Shopify Billing
```

or:

```text
Public distribution with Shopify Billing
```

The selected distribution model affects whether App Home remains the main UI and whether `appSubscriptionCreate` is available.

## Acceptance checklist

- [ ] Metaobject definitions exist.
- [ ] Existing PostgreSQL data exported.
- [ ] Settings migrated.
- [ ] Locations migrated without duplicates.
- [ ] Opening hours migrated.
- [ ] Product references migrated.
- [ ] Tags/custom values migrated.
- [ ] Images migrated or verified.
- [ ] App Home CRUD uses Metaobjects.
- [ ] CSV import uses Metaobjects.
- [ ] CSV export uses Metaobjects.
- [ ] Storefront snapshot/local search works.
- [ ] Radius filtering works.
- [ ] Modal constructor uses Shopify settings data.
- [ ] Theme Editor visual settings work.
- [ ] Rate-limit retries/throttling are implemented.
- [ ] Rollback export exists.
- [ ] Runtime no longer imports Prisma.
- [ ] `DATABASE_URL` and `DIRECT_DATABASE_URL` removed only after verification.
