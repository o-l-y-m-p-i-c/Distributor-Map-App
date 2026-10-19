# Move the backend to an existing server (zero additional hosting spend)

This is a **runbook, not an executed migration**. It moves the Next.js API
and admin pages from Render to a machine you already operate. "0" means no
new hosting subscription **if** you already have sufficient server capacity,
a domain, and a database you can use. Electricity, bandwidth, DNS/domain
renewal, backups, TLS, maintenance, map/geocoding quotas and Shopify's own
fees are not automatically free. Do not cancel Render or delete data until
the new environment has passed verification. See
[paid-app audit](paid-app-audit-and-rebuild.md) for billing and entitlement
work that hosting alone does **not** implement.

## Inventory and prerequisites

- Backend: `map-app/` is a Next.js 16 Node app. `render.yaml` currently runs
  `npm ci`, `npm run generate`, `npm run build`, `npm run migrate:deploy`, then
  `npm run start`; `/api/health` returns a static `ok` and **does not** check
  database or Shopify connectivity. The root `Dockerfile` builds from
  `map-app/`; it does not migrate the database or bundle the Shopify extension.
- Database: Prisma expects PostgreSQL (`prisma/schema.prisma`).
  `DATABASE_URL` is used at runtime (`lib/db/client.ts`);
  `DIRECT_DATABASE_URL` is required for migrations (`prisma.config.ts`).
  Even if locations move entirely to Shopify metaobjects, current settings,
  proxy search, authentication's shop upsert and uninstall handling still use
  PostgreSQL. Paid billing/trial history would also need durable storage.
- Shopify endpoints: `shopify.app.toml` sets the app URL, app proxy and
  relative webhook route. App Home pages contain **absolute Render URLs**
  in `extensions/app-home/src/pages/{LocationsPage,NewLocationPage,EditLocationPage,ImportPage,SettingsPage}.jsx`
  (including export and constructor URLs). Changing DNS/TOML alone will not
  update the deployed extension bundle.
- The server needs outbound HTTPS to Shopify and map/geocoding providers,
  public inbound HTTPS on a stable domain, Node 22 (matching `render.yaml`),
  enough RAM/disk for `next build` and Postgres if colocated, a reverse proxy,
  and a non-root process user. Verify the intended domain, firewall, backup
  destination, and monitoring **before** cutting traffic over. Do not expose
  port 3000 or PostgreSQL port 5432 publicly.

## Migration choices

**Lowest-risk, lowest-change:** move only the app process to the existing
server; keep the current managed PostgreSQL database temporarily if it is
already available at no additional cost. Set `DATABASE_URL` and
`DIRECT_DATABASE_URL` to the existing DB's correct pooled/direct endpoints
and verify firewall, TLS, latency, and provider egress costs. This is *not*
fully independent of the old database provider.

**Fully self-hosted:** install a supported PostgreSQL version on the existing
server (or another already-owned machine). Provision a dedicated DB/user,
restrict connections to local/private interfaces, and configure backups to
an **independent** location. Take a consistent export of the current DB and
record the migration baseline; restore into a new empty database, confirm
table and per-shop row counts, then run only pending Prisma migrations.
Move encrypted tokens with their original `TOKEN_ENCRYPTION_KEY`: rotating or
losing this key without a re-encryption plan will make existing tokens
unreadable. Do not treat a copied `.env` as a safe backup. A new local DB with
`prisma migrate deploy` alone creates schema, **not** merchant data.

Do not run the storage-to-metaobjects migration at the same time as the hosting
move. Separate changes so data discrepancies can be diagnosed and rolled back.
If a new app identity is used instead of the existing Shopify app, existing
app-owned metaobjects, installations, theme blocks and tokens do not simply
transfer; use the same Shopify app identity for a hosting-only move.

## Staging on the existing server (example: Linux + systemd + Caddy)

These are example commands/configuration to adapt, **not** commands already
run. Check the real OS, paths and service names first. Obtain approval and a
restore-tested backup before any database writes or production URL updates.

1. Provision `locator.example.com` with DNS pointed to the server and
   reachable from Shopify over valid HTTPS. Prepare a non-root `locator` user
   and a private `/srv/distributor-map` application directory. Keep any
   existing sites on the server isolated; never restart a shared proxy or DB
   blindly. Deploy a pinned commit, not an unreviewed working tree.
2. Store secrets outside the repository in a root/owner-readable environment
   file such as `/etc/distributor-map.env` with restrictive permissions (for
   example `0600`). Populate the required names from `map-app/env.example`:
   `SHOPIFY_CLIENT_ID`, `SHOPIFY_SECRET`, `SHOPIFY_WEBHOOK_SECRET`,
   `SHOPIFY_APP_URL=https://locator.example.com`, `SCOPES`,
   `DATABASE_URL`, `DIRECT_DATABASE_URL`, `MAP_STYLE_URL`,
   `GEOCODER_URL`, `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY`,
   `APP_ENV=production`. Keep existing secrets during a hostname-only move.
   `RENDER_EXTERNAL_URL` is optional; audit its need before setting it.
   Review `SCOPES` against `shopify.app.toml` rather than copying Render's
   default `read_products` unchanged.
3. In the app directory, build against the selected DB connection:

   ```sh
   cd /srv/distributor-map/map-app
   npm ci
   npm run generate
   npm run typecheck
   npm run build
   # With the approved DB backup restored and env loaded:
   npm run migrate:deploy
   ```

   `prisma.config.ts` needs `DIRECT_DATABASE_URL` available for both generate
   and migrations; load the server env securely for these commands. Never
   print secrets to logs, commit them, or paste them into a support ticket.
   Run migrations once, as an explicit deploy step, not on every app start.
4. Example service file (`/etc/systemd/system/distributor-map.service`):

   ```ini
   [Unit]
   Description=Distributor Map Next.js backend
   After=network-online.target
   Wants=network-online.target

   [Service]
   Type=simple
   User=locator
   WorkingDirectory=/srv/distributor-map/map-app
   EnvironmentFile=/etc/distributor-map.env
   Environment=NODE_ENV=production
   ExecStart=/usr/bin/npm run start -- --hostname 127.0.0.1 --port 3000
   Restart=on-failure
   RestartSec=5
   NoNewPrivileges=true

   [Install]
   WantedBy=multi-user.target
   ```

   Adapt `npm` path and port. Keep the service down until the env, build,
   permissions and DB connectivity are confirmed.
5. Example Caddy site (`Caddyfile` fragment), on a host where Caddy is already
   an approved option and ports 80/443 can be used safely:

   ```caddy
   locator.example.com {
       encode zstd gzip
       reverse_proxy 127.0.0.1:3000
   }
   ```

   Arrange HTTPS certificates and renewal, request limits, log rotation,
   service monitoring and alerts. Limit oversized CSV and webhook requests.
   A `200` from `/api/health` proves only that Next.js is reachable; add a
   separate authenticated readiness check covering DB connectivity.
6. Test the new hostname **before** redirecting the existing app. Check
   `/api/health`, Shopify ID-token admin requests, a real app-proxy signature,
   settings and CRUD on a development store, import/export, theme block,
   webhook HMAC and uninstall behavior (on a disposable test store only).
   Use a separate test app/store if needed; never run destructive uninstall
   tests against a merchant's production store.

## Shopify cutover (planned maintenance window)

1. Give the old/new backends a rollback window. Freeze merchant writes or
   use a tested sync strategy while copying the database; a point-in-time
   snapshot while the old app keeps accepting writes can lose later changes.
   If the DB stays remote, no DB copy is needed. Record a last verified
   backup and row counts per shop before cutover.
2. Replace `application_url` and `[app_proxy].url` in
   `map-app/shopify.app.toml` with the new HTTPS domain. The webhook URI is
   relative (`/api/webhooks`), so verify its effective resolved URL after
   deploying app configuration. Check any auth redirect URLs needed by the
   chosen install flow.
3. Replace **all** hard-coded Render API/constructor URLs in the App Home
   source listed above, preferably via one central, build-time backend
   base-URL configuration supported by that extension runtime. Rebuild and
   deploy the extension and Shopify app config with `shopify app deploy`
   from an authenticated operator workstation. Backend deploy and Shopify
   extension/config deploy are **separate** steps. Review the deployment
   diff/URL resolution; don't publish an extension that points at a new
   server before it is healthy.
4. Verify App Home list/edit/import/export/settings/constructor, theme proxy
   requests to `/apps/distributor-map/search` and `/settings`, webhook
   delivery/HMAC, all required scopes and a full merchant install test.
   Check server logs for request failures without logging authorization
   headers or tokens. Monitor for several days before turning off Render.

## Rollback and operating cost

- If only the app host changed, restore previous Shopify app/proxy URLs and
  extension build, and route requests back to the still-running Render
  backend. **If writes happened in a newly moved database**, routing back
  without reconciling those writes can lose merchant updates; freeze writes
  first and use the verified recovery procedure. A DB migration with
  incompatible schema may make rollback impossible without a tested
  down-migration or backup restore.
- Keep Render and the original DB intact until production reads/writes,
  billable flows (once implemented), webhook delivery and backups all pass.
  Canceling a paid Render plan or deleting a database is a separate,
  explicitly approved operation, not part of these instructions.
- "Zero additional hosting spend" holds only if the existing machine has
  spare capacity and you already pay for connectivity, domain and backup
  storage. A single-server setup has one failure domain; schedule off-server
  encrypted backups and periodic restore tests. Track CPU, RAM, disk,
  database growth, TLS renewal, map tile/geocoder limits, and webhook error
  rates. The Shopify paid-app rebuild still requires a server-side billing
  and entitlement implementation after this hosting migration.
