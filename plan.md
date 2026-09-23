# Distributor Map Shopify App — Implementation Plan

## 1. Product goal

Build a production-ready, multi-tenant Shopify embedded app for managing physical retail locations, distributors, dealers, retailers, and stockists, then displaying published locations on a merchant storefront through a Shopify Theme App Extension.

The product concept is informed by the store-locator workflow of [Stockist](https://stockist.co/), but the implementation, UI, database schema, APIs, and architecture will be original.

Primary user journeys:

1. A merchant installs the app from Shopify.
2. The merchant creates, imports, geocodes, edits, and publishes locations.
3. The merchant optionally associates Shopify products with locations.
4. The merchant configures map, search, display, and brand settings.
5. The merchant adds the Store Locator block to a theme.
6. A customer searches by city, postal code, address, country, or current location.
7. The storefront returns nearby published locations, distances, opening status, and enabled contact actions.

---

## 2. Current repository state

The repository currently has no application scaffold. Existing configuration files are:

- `env.example`
- Local `.env` file, which must remain uncommitted and must never be copied into documentation or source control.

The current environment file uses these names:

- `SHOPIFY_CLIENT_ID`
- `SHOPIFY_SECRET`
- `SHOPIFY_APP_URL`
- `SCOPES`
- `DATABASE_URL`
- `DIRECT_DATABASE_URL`
- `WEBHOOK_SECRET`

The implementation should either retain these names or introduce a documented migration to clearer names such as `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, and `SHOPIFY_WEBHOOK_SECRET`. Do not print, commit, or expose any local secret values. Because credentials may have been exposed during setup, rotate the Shopify secret before production use.

---

## 3. Recommended architecture

### Application

- Next.js App Router with TypeScript.
- Node.js runtime for Shopify OAuth, webhooks, admin APIs, and database access.
- React for admin screens.
- Shopify App Bridge for embedded navigation, session token handling, toast notifications, and resource pickers.
- Polaris web components or the project’s selected Polaris React-compatible approach for admin UI. Keep the implementation consistent rather than mixing incompatible Polaris packages.
- Zod for request, form, CSV, and environment validation.

### Persistence

- Neon PostgreSQL as the application-owned source of truth for locations.
- Prisma ORM and committed migrations.
- `DATABASE_URL` for pooled runtime connections.
- `DIRECT_DATABASE_URL` for Prisma migrations and administrative tasks.
- No SQLite.
- No location storage in Shopify metafields.
- No browser localStorage as a location database.

### External services

- Shopify OAuth and Admin API for merchant identity, shop identification, product lookup, and lifecycle events.
- Mapbox for maps, geocoding, reverse geocoding where required, and map tiles.
- Render for production web hosting.
- Optional PostGIS adoption after baseline query patterns are confirmed; initial distance filtering can use indexed latitude/longitude bounds plus a server-side Haversine calculation.

### Tenant boundary

Every application-owned record is scoped to a `Shop`. The authenticated Shopify session is the only source of tenant identity. Never accept a client-supplied `shopId` as authorization.

---

## 4. Bootstrap and project structure

### Initial setup

1. Initialize a Shopify app using Shopify CLI with a TypeScript-compatible Next.js application structure.
2. Configure the app URL, OAuth redirect URLs, embedded-app settings, scopes, and webhook subscriptions.
3. Add TypeScript, ESLint, formatting, Zod, Prisma, Shopify API/App Bridge dependencies, Mapbox client dependencies, CSV parsing, and test tooling.
4. Create the Theme App Extension with Shopify CLI.
5. Add a Render service definition and development documentation.
6. Update `env.example` with all required variables and safe placeholder values.
7. Add `.gitignore` rules for `.env`, `.env.*` except `.env.example`, build output, Prisma generated artifacts, and private uploads.

### Planned directories

```text
app/
  (embedded)/
    page.tsx                    # dashboard
    locations/page.tsx          # location index
    locations/new/page.tsx      # create form
    locations/[id]/page.tsx     # edit form
    products/page.tsx           # product lookup/management
    map/page.tsx                # admin map
    settings/page.tsx           # settings
  api/
    admin/
    storefront/
    webhooks/
  auth/
components/
  admin/
  storefront/
lib/
  auth/
  db/
  shopify/
  mapbox/
  security/
  validation/
prisma/
  schema.prisma
  migrations/
  seed.ts
public/
extensions/
  store-locator/
    blocks/store-locator.liquid
    assets/store-locator.js
    assets/store-locator.css
    shopify.extension.toml
scripts/
tests/
render.yaml
README.md
env.example
```

The exact directories may follow the generated Shopify CLI scaffold, but responsibilities must remain separated between authentication, tenant-aware services, APIs, admin UI, storefront assets, and database access.

---

## 5. Environment configuration

Extend `env.example` with:

```text
SHOPIFY_CLIENT_ID=
SHOPIFY_SECRET=
SHOPIFY_APP_URL=
SCOPES=read_products,write_products
SHOPIFY_WEBHOOK_SECRET=

DATABASE_URL=
DIRECT_DATABASE_URL=

MAPBOX_ACCESS_TOKEN=
SESSION_SECRET=
TOKEN_ENCRYPTION_KEY=

APP_ENV=development
RENDER_EXTERNAL_URL=
```

Implementation requirements:

- Validate all required environment variables at startup with Zod.
- Keep Mapbox server credentials server-side.
- Use a restricted public Mapbox token only for browser map rendering if required; never expose a secret token.
- Encrypt Shopify offline access tokens before writing them to PostgreSQL. Use a dedicated encryption key and authenticated encryption such as AES-GCM.
- Do not use the webhook secret as the database encryption key.
- Do not commit `.env`.

---

## 6. Database design

Create Prisma models for the following entities.

### Shop

- `id`
- `shopifyDomain` unique
- `shopifyShopId` indexed
- `accessTokenEncrypted`
- `createdAt`
- `updatedAt`

### Location

- `id`
- `shopId`
- `name`
- `slug`
- `addressLine1`
- `addressLine2`
- `city`
- `state`
- `postalCode`
- `country`
- `countryCode`
- `latitude`
- `longitude`
- `phone`
- `email`
- `website`
- `description`
- `type`
- `published`
- `createdAt`
- `updatedAt`

Use a tenant-scoped unique constraint for `(shopId, slug)`.

### LocationType

Configurable per shop, with a seeded default set:

- store
- retailer
- stockist
- distributor
- dealer

Include display label, slug, active state, and ordering so merchants can customize types without changing code.

### OpeningHour

- `id`
- `locationId`
- `dayOfWeek`
- `openTime`
- `closeTime`
- `closed`

Use a unique constraint on `(locationId, dayOfWeek)`.

### Tags

- `LocationTag`: `id`, `shopId`, `name`, `slug`
- `LocationTagRelation`: `locationId`, `tagId`

Use unique constraints and indexes to prevent duplicate tenant tags.

### LocationProduct

- `id`
- `locationId`
- `shopifyProductId`
- `shopifyVariantId` nullable
- `createdAt`
- `updatedAt`

Add indexes for location and product lookups and a uniqueness constraint over the relationship fields.

### Settings

- `id`
- `shopId` unique
- `mapProvider`
- `defaultLatitude`
- `defaultLongitude`
- `defaultZoom`
- `searchRadius`
- `enableGeolocation`
- `showDirections`
- `showPhone`
- `showWebsite`
- `showOpeningHours`
- `mapStyle`
- `markerStyle`
- `primaryColor`
- `accentColor`
- `createdAt`
- `updatedAt`

### GeocodingCache

- `id`
- `addressHash` indexed
- `provider`
- `latitude`
- `longitude`
- `formattedAddress`
- `rawResponse` JSON
- `createdAt`

Use a stable normalized address hash and provider in cache lookup. Do not send a geocoding request on every keystroke.

### Required indexes

At minimum:

- `Location.shopId`
- `Location.published`
- `(shopId, published)`
- `(shopId, city)`
- `(shopId, countryCode)`
- `(shopId, type)`
- coordinate indexes for bounding-box filtering
- product/location relationship indexes
- tag relationship indexes

Evaluate PostGIS after baseline implementation if the dataset or query latency warrants it.

---

## 7. Shopify authentication and embedded app security

1. Implement Shopify OAuth for online app access and offline merchant access where needed.
2. Store the Shopify domain and Shopify shop ID after installation.
3. Verify App Bridge session tokens on every embedded admin API request.
4. Derive the current `Shop` from the verified session.
5. Never accept `shopId` from request body, query string, or route parameters for authorization.
6. Use Shopify Admin API access only on the server.
7. Never send Shopify access tokens to React components or the browser.
8. Add CSRF protection where cookie-based flows are used.
9. Validate all route parameters and bodies with Zod.
10. Return generic authorization errors without leaking tenant existence.

### Webhooks

Register and verify signed webhooks for:

- `app/uninstalled`
- `products/delete`
- `products/update` if product cache is maintained
- `shop/update`

Webhook processing must be idempotent and must verify HMAC signatures before parsing or writing data.

On uninstall, revoke/delete stored access credentials and clean up merchant-owned application data according to the documented retention policy.

---

## 8. Admin application plan

### Main navigation

- Dashboard
- Locations
- Products
- Map
- Settings

Use Shopify-native embedded navigation and App Bridge context.

### Dashboard

Show metrics for the current shop only:

- Total locations
- Published locations
- Unpublished locations
- Locations missing coordinates
- Products connected to locations
- Recent changes or import status

### Locations index

Implement a server-paginated table with:

- Name
- City
- Country
- Type
- Published status
- Product count
- Updated date
- Actions

Support:

- Search
- Type, country, tag, and published filters
- Sorting
- Pagination
- Bulk publish/unpublish
- Bulk delete with confirmation
- Duplicate location
- CSV import/export actions

### Location editor

Sections:

1. Basic information
2. Address
3. Contact
4. Coordinates
5. Opening hours
6. Products
7. Tags
8. Publishing

The editor must support:

- Explicit `Locate address` geocoding action.
- Draggable Mapbox marker.
- A manual-coordinate indicator.
- No automatic overwrite of manually adjusted coordinates.
- Product search using Shopify Admin API/resource picker.
- Existing tag selection and inline tag creation.
- Server-side validation with field-level errors.
- Unsaved-change protection.

### Admin map

- Mapbox map with server-loaded location data.
- Marker clustering.
- Popup summary.
- Click marker to open location editor.
- Fit bounds to filtered locations.
- Search and filters matching the location table.
- Published/unpublished visibility filter.

Avoid exposing an unrestricted Mapbox secret to the browser.

### Settings

Provide controls for:

- Default center and zoom
- Search radius: 20, 50, 100, or 200 km
- Geolocation enabled/disabled
- Directions, phone, website, and opening-hours visibility
- Map style
- Marker style
- Primary and accent colors
- Location card fields

---

## 9. Storefront Theme App Extension

Create a Theme App Extension that merchants can add as a Store Locator block/section.

The storefront UI should include:

- Search input
- Use my location button when enabled
- Product filter when product relationships exist
- Location type and tag filters
- Map
- Location list
- Loading, empty, error, and permission-denied states

### Desktop layout

- Two-column responsive layout.
- Location list on the left.
- Map on the right.
- Selecting a card focuses the marker.
- Selecting a marker highlights the card.

### Mobile layout

- Search and filters first.
- Map next.
- Location cards below the map.
- Touch-friendly controls.

### Storefront API behavior

- Return published locations only.
- Enforce the merchant/storefront tenant context using an app proxy or signed storefront context rather than accepting an arbitrary shop ID.
- Use server-side radius filtering, bounding-box filtering, pagination, and distance sorting.
- Return `distanceMeters` and `distanceKilometers`.
- Do not send thousands of locations to the browser unnecessarily.
- Use clustering for map display.

Mapbox browser code must receive only the public token and required map data.

---

## 10. API surface

### Storefront

- `GET /api/storefront/locations`
- `GET /api/storefront/locations/:id`
- `GET /api/storefront/search`
- `GET /api/storefront/products`
- `GET /api/storefront/settings`

Storefront responses must omit unpublished locations and internal database identifiers where they are not needed.

### Admin

- `GET /api/admin/locations`
- `POST /api/admin/locations`
- `GET /api/admin/locations/:id`
- `PUT /api/admin/locations/:id`
- `DELETE /api/admin/locations/:id`
- `POST /api/admin/locations/:id/geocode`
- `GET /api/admin/products`
- `POST /api/admin/locations/:id/products`
- `DELETE /api/admin/locations/:id/products/:productId`
- `GET /api/admin/settings`
- `PUT /api/admin/settings`
- `POST /api/admin/import/preview`
- `POST /api/admin/import/confirm`
- `GET /api/admin/export/locations.csv`

All admin routes require a verified Shopify session and tenant-scoped database queries.

---

## 11. Search and distance implementation

### Search flow

1. Normalize the query.
2. Detect whether it is a city, postal code, country, address, or coordinate query.
3. For text queries, geocode only after an explicit search action.
4. Check the normalized geocoding cache first.
5. Query candidate locations using a coordinate bounding box.
6. Calculate exact Haversine distance on the server.
7. Filter by configured radius.
8. Sort by distance.
9. Return paginated results plus map bounds/cluster data.

### Geolocation

- Request browser geolocation only when the merchant setting permits it and the customer explicitly clicks the control.
- Handle permission denial and unavailable location gracefully.
- Never use customer coordinates for unrelated tracking.

### Rate limiting and caching

Rate-limit:

- Search
- Storefront endpoints
- Admin endpoints
- Geocoding
- CSV imports

Cache:

- Geocoding results
- Store locator settings
- Product lookup results where safe

Never put unpublished admin data in public caches.

---

## 12. CSV import and export

### Import flow

1. Upload CSV.
2. Parse and normalize headers.
3. Validate every row.
4. Display a preview.
5. Show row-level errors.
6. Allow the merchant to confirm valid rows.
7. Import valid rows in a transaction/batched job.
8. Geocode rows missing coordinates using rate-limited background processing.
9. Report final imported, skipped, and failed counts.

Never silently partially import data.

Required columns:

```text
name,address,address2,city,state,postal_code,country,
latitude,longitude,phone,email,website,type,description
```

Optional opening-hour columns:

```text
monday_open,monday_close,
tuesday_open,tuesday_close,
wednesday_open,wednesday_close,
thursday_open,thursday_close,
friday_open,friday_close,
saturday_open,saturday_close,
sunday_open,sunday_close
```

### Export

Export all locations belonging to the authenticated shop, including opening hours and configured product/tag relationships where useful.

---

## 13. Render deployment

Create `render.yaml` with:

- One Node web service.
- Build command: install dependencies, generate Prisma client, and build Next.js.
- Start command: run the production Next.js server.
- Migration command: run Prisma migrations using `DIRECT_DATABASE_URL` before application startup/deploy.
- Environment variable declarations for Shopify, Neon, Mapbox, encryption, and session configuration.

Production requirements:

- HTTPS app URL.
- Shopify OAuth URLs configured to the Render URL.
- Webhook URLs configured to the Render URL.
- Health endpoint for Render.
- Structured server logging without tokens or personal data.
- Graceful shutdown and database connection cleanup.

---

## 14. Testing strategy

### Unit tests

- Haversine distance calculation.
- Radius filtering.
- Address normalization and hashing.
- Geocoding cache behavior.
- Opening-hours status calculation.
- Zod validation.
- CSV parsing and row validation.
- Tenant-scoped query helpers.

### Integration tests

- Shopify session verification.
- Location CRUD.
- Cross-shop authorization failures.
- Product/location relationships.
- Published-only storefront responses.
- Webhook HMAC verification and idempotency.
- Geocode endpoint and cache reuse.
- Settings persistence.

### End-to-end tests

1. Merchant installs the app.
2. Merchant creates a location.
3. Merchant geocodes the address.
4. Merchant adjusts and saves coordinates.
5. Merchant publishes the location.
6. Location appears in the storefront extension.
7. Customer searches for Riga.
8. Nearby locations are returned in distance order.
9. Customer opens a location card.
10. Directions, website, and phone controls respect settings.
11. Unpublished locations never appear publicly.
12. Merchant imports a CSV and receives row-level validation results.

Use isolated test data and a separate Neon branch/database for CI.

---

## 15. Documentation deliverables

Create `README.md` covering:

- Product architecture.
- Local prerequisites.
- Shopify CLI setup.
- Shopify app configuration.
- OAuth and webhook configuration.
- Neon project and branch setup.
- Pooled vs direct database URLs.
- Prisma migration commands.
- Mapbox token setup and restrictions.
- Environment variables.
- Local development commands.
- Theme App Extension installation.
- Render deployment.
- CSV format.
- Testing and troubleshooting.
- Secret rotation and security practices.

---

## 16. Implementation phases

### Phase 1 — Foundation

- Bootstrap Shopify CLI/Next.js app.
- Configure TypeScript, linting, tests, environment validation, and Render.
- Add Shopify OAuth/session verification.
- Add Prisma and Neon connection handling.
- Create initial schema and migration.

### Phase 2 — Core tenant data

- Implement Shop lifecycle.
- Implement Location, LocationType, OpeningHour, tags, products, settings, and geocoding cache services.
- Add tenant-scoped CRUD APIs.
- Add unit and authorization tests.

### Phase 3 — Admin experience

- Build embedded dashboard.
- Build location table, filters, sorting, pagination, bulk actions, and editor.
- Add product picker/search.
- Add Mapbox geocoding and draggable marker.
- Add settings screen and admin map.

### Phase 4 — Storefront locator

- Build Theme App Extension.
- Add signed/app-proxy storefront context.
- Implement search, radius filtering, distance sorting, product filters, cards, and map clustering.
- Add responsive desktop/mobile layouts.

### Phase 5 — Imports, exports, and lifecycle

- Add CSV preview/validation/import/export.
- Add Shopify product and uninstall webhooks.
- Add idempotency and cleanup behavior.
- Add rate limiting and caching.

### Phase 6 — Production hardening

- Complete integration and end-to-end tests.
- Run security review for tenant isolation and token handling.
- Load-test storefront search with large location sets.
- Verify Mapbox token restrictions.
- Verify Render deployment and migrations.
- Complete README and merchant setup instructions.

---

## 17. Definition of done

The app is ready for production only when:

- Multiple Shopify merchants can install and use it independently.
- No location data is stored in Shopify metafields as the primary database.
- All admin requests derive tenant identity from verified Shopify sessions.
- Storefront requests return only published locations for the correct shop.
- Geocoding is explicit, cached, and rate-limited.
- Manual coordinates are never overwritten automatically.
- Large location sets use server-side filtering, pagination, distance sorting, and clustering.
- Product/location relationships survive product lifecycle events safely.
- CSV imports provide previews and row-level errors.
- Secrets are absent from source control and browser bundles.
- Prisma migrations work against Neon using the direct connection.
- Render deployment is reproducible through `render.yaml`.
- Automated tests cover authentication, authorization, CRUD, geocoding, distance, imports, webhooks, and storefront filtering.
