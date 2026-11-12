# Driver App: Frontend Structure and Database Guide

## Purpose and framework

The Driver App is a mobile-first Progressive Web App (PWA), not a React Native or Flutter application. It uses HTML, CSS, and vanilla JavaScript modules so it can run in a mobile browser and install as an app. The frontend lives in [`frontend/driver-app/`](../frontend/driver-app/).

The app focuses on the authenticated driver's assigned routes: profile and vehicle readiness, route start, pickup and parcel scanning, navigation and arrival, proof of delivery, delivery exceptions, and offline event synchronization.

## Frontend layout

```text
frontend/driver-app/
├── index.html                 # App shell entry point
├── manifest.webmanifest       # Installable PWA metadata
├── sw.js                      # Offline app-shell caching
├── css/
│   └── style.css              # Responsive layout, typography, and touch targets
└── js/
    ├── app.js                 # Startup, authentication restore, and UI event handlers
    ├── api.js                 # Core API / Driver Gateway requests and route normalization
    ├── state.js               # In-memory UI state and shared rendering helpers
    ├── storage.js             # IndexedDB schema, offline outbox, and active-route snapshot
    ├── views.js               # Top-level screen and navigation rendering
    ├── components/            # Screen and reusable UI components
    └── services/              # Account operations, barcode detection, and driver events
```

### Responsibilities by module

| Module | Responsibility |
| --- | --- |
| `js/app.js` | Opens local storage, registers the service worker, restores the central driver session, loads account data, and wires UI and browser events. |
| `js/state.js` | Holds transient view state such as the active route, selected tab, scan progress, GPS fix, sync status, and customer-note alerts. |
| `js/views.js` | Selects the active screen, renders the shared navigation and offline banner, and places route-only actions such as SOS. |
| `js/api.js` | Sends credentialed requests and converts API route/stop responses into the frontend's display model. |
| `js/storage.js` | Stores the ordered event outbox and a recoverable active-route work snapshot in IndexedDB. |
| `js/services/account.js` | Loads and updates the driver profile, assigned routes, and available vehicles through the API. |
| `js/services/driver-events.js` | Starts routes, validates parcel scans, records GPS-dependent actions, captures evidence, queues events locally, and synchronizes them to the Gateway. |
| `js/components/dashboard.js` | Home dashboard, route/task summary, network state, and metrics supported by current data. |
| `js/components/routes.js` | Assigned route list, route details, stop manifest, map handoff, and staged route actions. |
| `js/components/deliveries.js` | Current-route manifest and supported delivery status filters; it is not a historical order ledger. |
| `js/components/profile.js` | Supported profile and vehicle settings. |
| `js/components/activity.js` | Local activity and queued-event status. |
| `js/components/scanner.js` and `js/services/barcode-scanner.js` | Barcode scanning UI and browser camera detection, with manual-token fallback. |
| `js/components/pod.js` | Photo/signature/recipient evidence capture and exception evidence controls. |
| `js/components/communications.js` | In-Transit customer communication presentation and customer-note-update event handling. |
| `js/components/safety-tools.js` | Lifecycle-gated SOS confirmation and package/verification UI. |
| `js/components/order-request.js` | Timed request presentation hook. There is no backend route-offer feed or accept-offer contract yet. |
| `js/components/earnings.js` | Earnings and payout UI placeholders; values/actions remain unavailable without a supporting API and data model. |
| `js/components/navigation.js`, `brand.js` | Shared top navigation and brand presentation. |

`views.js` and the component modules produce presentation markup. `app.js` owns DOM event delegation, while service modules handle API/storage operations. The browser does not connect directly to PostgreSQL, Redis, or MinIO.

## Runtime and data flow

```text
Mobile browser / installed PWA
  ├── Core API: driver session, profile, vehicles, assigned routes, route acceptance
  ├── Driver Gateway: authenticated driver-event and proof-of-delivery ingestion
  ├── IndexedDB: active work snapshot and durable pending-event outbox
  └── Service worker: cached app shell for offline launch

Core API ── PostgreSQL + PostGIS: authoritative business records
Driver Gateway ── Redis Streams: accepted driver events
Driver Gateway ── MinIO: private proof-of-delivery evidence files
Routing Worker ── PostgreSQL: applies arrival and terminal delivery outcomes
```

The PWA first queues supported work in IndexedDB, then synchronizes it when online. The API and Gateway authenticate and validate requests; backend services own durable business writes. Redis is the event transport, not the driver's relational database. MinIO stores binary evidence, not relational order data.

## Which database should this app use?

For this platform, use **PostgreSQL with PostGIS** as the authoritative database. This is already the platform's selected database and is defined by the root [`schema.sql`](../schema.sql). Do not add a separate driver database or have the browser connect directly to the database.

Use the other storage layers for their existing purposes:

| Storage | Use |
| --- | --- |
| PostgreSQL + PostGIS | Users, driver profiles/status, vehicles, orders, route plans/stops, and durable order-status history. |
| Redis Streams | Backend event transport and processing; not a replacement for durable order/route records. |
| MinIO | Private delivery/exception evidence objects; the current schema does not save a MinIO object reference to an order. |
| Browser IndexedDB | Device-local active-route progress and queued driver events for offline-first operation; it is not shared or authoritative server storage. |
| `localStorage` | Small, non-sensitive presentation/connection settings; not credentials or business records. |

PostgreSQL's `uuid-ossp`, `citext`, and `postgis` extensions are part of the current schema contract. Location columns use PostGIS `geography(Point, 4326)`; preserve the exact types and constraints in `schema.sql`.

## Database words and where things live

These terms describe different levels:

```text
PostgreSQL server (local PostgreSQL or a Neon project)
└── Database (the database name in DATABASE_URL)
    └── PostgreSQL schema / namespace (normally public)
        └── Tables (for example drivers, routes, orders)
            └── Columns (for example status, driver_id, tracking_token)
                └── Rows (individual drivers, routes, and orders)
```

- **Database**: the named container on a PostgreSQL server that the application connects to. The Core API reads its connection string from `DATABASE_URL` in the repository's `.env` file or deployment environment.
- **PostgreSQL schema**: a namespace inside a database that contains tables. It is not the same thing as the repository file [`schema.sql`](../schema.sql). This project does not issue `CREATE SCHEMA`; on a normal fresh PostgreSQL database its tables are created in the default `public` schema (or in the schema selected by that connection's `search_path`).
- **`schema.sql`**: the repository's authoritative SQL definition for the required extensions, enum types, tables, columns, keys, constraints, and indexes. It is at the repository root, not inside `frontend/driver-app/`.
- **Table**: a collection of records for one kind of thing. For example, `drivers` contains driver-specific status/vehicle links; `orders` contains the shipment's recipient, address, status, and tracking token.
- **Column**: a named, typed field in a table. For example, `orders.tracking_token` is text, while `orders.delivery_location` is a PostGIS geography point. The SQL type matters; do not replace a specified UUID, enum, timestamp, or geography type with arbitrary text.
- **Row**: one record stored in a table, such as one driver or one route stop.
- **Primary key (PK)**: the column(s) that uniquely identify a row. In this schema, IDs are commonly UUIDs. For example, `users.id` identifies a user and `routes.id` identifies a route.
- **Foreign key (FK)**: a column that points to a row in another table and enforces the relationship. For example, `drivers.user_id` refers to `users.id`; `routes.driver_id` refers to a driver; `route_stops.order_id` refers to an order. These links let the API retrieve an assigned driver's route and its stops safely.
- **Unique key/constraint**: prevents duplicate values where duplicates are invalid. For example, `orders.tracking_token` is unique; scanning a token identifies an order but does not create the order.

To see this in a database browser, select the correct database, then expand **Schemas → public → Tables** (the exact labels vary by tool). Select a table to inspect its **Columns**, **Constraints/Keys**, and **Indexes**. If the tables are not under `public`, check the connection's active schema/`search_path` before assuming the schema is missing.

For a quick read-only check in the database SQL editor, list the created tables:

```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_type = 'BASE TABLE'
  AND table_schema = 'public'
ORDER BY table_name;
```

Inspect columns and their database types for the app's main tables:

```sql
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('users', 'drivers', 'vehicles', 'warehouses',
                     'orders', 'routes', 'route_stops', 'order_events')
ORDER BY table_name, ordinal_position;
```

The read-only [`check_driver_app_database.sql`](../scripts/check_driver_app_database.sql) is a more complete contract check: it reports required tables/columns/types, enums, extensions, and a summary of driver/vehicle/route readiness.

## What to create for a driver app database

For a new local development database, create/use **one PostgreSQL database with PostGIS**, then apply the project's schema; do not hand-create the driver tables one by one.

1. Install/use PostgreSQL 15 with PostGIS 3.3, or use the platform's PostgreSQL + PostGIS database in Neon. For local PostgreSQL, create a database in pgAdmin or run `createdb lastmile_dev` after configuring PostgreSQL access. If using the existing Neon project, use its intended database instead of creating another one without checking with your team. The example database name `lastmile_dev` is your choice, not a required table or schema name.
2. Connect to that database as a role allowed to create the required extensions and objects. For a fresh database, use the `public` schema/default `search_path`. `schema.sql` creates the tables and other objects inside the database you connect to; it does not create the PostgreSQL server or database itself.
3. Execute the complete root [`schema.sql`](../schema.sql) against that database once. In Neon or pgAdmin, open the SQL editor for the intended database, load the file, and run it. With `psql` already installed and authenticated, from the repository root you can run `psql -d <database_name> -v ON_ERROR_STOP=1 -f .\schema.sql`. Replace `<database_name>` with the database you created. Do not run this create script a second time on the same populated database; its types/tables already exist, and it is not a repeatable migration.
4. Put the matching application connection string in `.env` as `DATABASE_URL`. The project uses SQLAlchemy's asyncpg format, for example `postgresql+asyncpg://<user>:<password>@<host>:5432/<database_name>?ssl=require` for a provider that requires SSL. Use the connection string supplied by your provider and the format documented in [`README.md`](../README.md); never commit or share the real password.
5. Run `python scripts/verify_database_connection.py` to check that the configured Core API database connection works. Run the read-only [`scripts/check_driver_app_database.sql`](../scripts/check_driver_app_database.sql) in the target database to check its schema and summarize driver/vehicle/route readiness. Neither command creates app data.
6. Arrange valid application data through an authorized admin/API workflow or a seed workflow if your team has one. The minimum related records are: a user account with the `driver` role; the matching `drivers` row; an active vehicle assigned to that driver; an active warehouse; an active merchant; orders linked to that merchant and warehouse; and a planned route assigned to that driver and vehicle, with a `route_stops` row for each order. To start the route, the driver must be `available`, the route must be `planned`, and the driver's assigned vehicle must match the route vehicle. Do not invent tracking tokens or insert guessed rows; use the actual supported data-creation process.
7. Start the Core API and Driver Gateway with the repo's documented local workflow, then sign in through central authentication. The app can only display routes belonging to that authenticated driver. A valid schema by itself does not create a sign-in, a driver, or demo route data.

In short: create a **database**; use its default PostgreSQL **schema** (`public`); run root `schema.sql` to create the platform's tables, columns, and keys; configure `DATABASE_URL`; then provide valid driver and route records through an authorized data workflow. You do not need to invent a new schema or manually define the app's columns. The words *database*, *schema*, *table*, *column*, and *key* are not interchangeable.

## Existing database records used by the frontend

The frontend's main data path maps to these existing tables:

```text
users ── user_roles
  └── drivers ── vehicles
                  │
warehouses ── routes ── route_stops ── orders ── merchants
                                     └── order_events
```

| Frontend need | Database source | How the frontend receives/uses it |
| --- | --- | --- |
| Driver identity, name, phone, and role | `users`, `user_roles` | Central authentication and `GET /driver/profile`; profile updates are limited to supported fields. |
| Driver status and assigned vehicle | `drivers`, `vehicles` | `GET /driver/profile`, `GET /driver/vehicles`; assignment uses `PUT /driver/vehicle`. Status is staff/backend managed. |
| Vehicle choice and capacity/type | `vehicles` | Vehicle search returns active, unassigned vehicles and the driver's own vehicle. Schema tracks registration number, type, weight capacity, and volume capacity; it does not define VIN or compliance documents. |
| Pickup/depot address and route metrics | `warehouses`, `routes` | `GET /driver/routes`; route distance/duration may be null if not computed. |
| Customer address, recipient details, and tracking token | `orders` | Included in the assigned route's stop response. The tracking token is the parcel identifier used for scan matching. |
| Stop sequence, planned arrival, status, and GPS arrival/completion times | `route_stops` | Stop details are returned with the route. Routing Worker applies arrival and terminal outcome changes. |
| Order lifecycle status and audit trail | `orders`, append-only `order_events` | Status values come from the `order_status` enum. The frontend gates customer communication on `out_for_delivery`. |
| Supported failure reasons | `route_stops.failure_reason` and `failure_reason` enum | Current allowed values are `recipient_unavailable`, `wrong_address`, `refused`, and `other`. |

The active route is selected from routes already assigned to the authenticated driver. `POST /driver/routes/{route_id}/accept` starts an eligible planned route; it does not accept a public offer. The API's route-stop response includes the authoritative order status and tracking token.

## Current database contract versus UI concepts

The schema is not designed to persist every concept shown in a product mockup. Do not treat a disabled control, empty state, browser event hook, or locally cached value as proof that a database/API feature exists.

| UI concept | Current support |
| --- | --- |
| Assigned routes, delivery addresses, customer contact, scanning validation, arrival, delivery success/failure | Supported by the current schema and driver API/event flow. |
| Offline scanning/work progress | Stored temporarily on the device in IndexedDB; scans and pickup confirmation are not persisted as scan rows in PostgreSQL. |
| Proof photo/signature | Evidence file is stored in MinIO and announced through the event stream; no evidence-object reference is currently stored in PostgreSQL. |
| Shift setup, VIN, document/compliance status, driver-controlled online toggle | No corresponding complete schema/API contract. Driver status is managed by backend/staff workflows. |
| Request offers, countdown expiration, payout shown on an offer | No driver offer feed or accept-offer API/data contract. The UI hook is a scaffold, not a real dispatched request. |
| Customer chat, masked calling, customer note-update delivery | No message, VoIP, or customer-note notification API/schema. The UI is disabled or uses a documented browser-event seam. |
| Earnings balance, tips, bonuses, instant payout, payment ledger | No earnings, payout, or transaction tables/API. Do not derive or fabricate amounts from delivery counts. |
| Historical driver trip ledger | Current driver route API returns planned/in-progress routes; no driver history endpoint is provided. `order_events` is an order-status audit log, not a payout/trip ledger. |
| Order items, merchant pickup leg, OTP handover verification | No order-item, distinct merchant-stop, or OTP-verification contract in the current schema/API. |
| SOS dispatch and durable alert history | The app can show a confirmation UI, but there is no dispatch integration or SOS persistence contract. |

If these become real requirements, define their behavior, ownership, retention, authorization, and API contract first. Then update `schema.sql` and the corresponding SQLAlchemy models together, add the appropriate Core API/worker/Gateway integration, and update the frontend in the same contract change. Do not put database access into Driver Gateway or add PostgreSQL access to the browser.

## API surfaces used by the app

The Driver App uses Core API through the Driver Gateway allowlist:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/auth/me` | Restore the central session and verify the driver role. |
| `GET` / `PATCH` | `/driver/profile` | Read profile or update supported name/phone fields. |
| `GET` | `/driver/vehicles` | Search vehicles available for assignment. |
| `PUT` | `/driver/vehicle` | Assign an available vehicle. |
| `GET` | `/driver/routes` | Load assigned planned and in-progress routes. |
| `POST` | `/driver/routes/{route_id}/accept` | Start an assigned planned route. |
| `POST` | `/driver/routes/{route_id}/scan` | Validate a route tracking token and scan stage; does not create a durable scan record. |
| `POST` | `/driver/events` | Validate and publish supported driver events to Redis Streams. |
| `POST` | `/driver/pod` | Authorize and upload proof/exception evidence. |

Central authentication uses HttpOnly cookies; the frontend does not store bearer tokens. For the full event fields, authorization rules, and service boundaries, see [`docs/driver-app.md`](./driver-app.md) and [`docs/architecture.md`](./architecture.md).

## Local development

Use the repository's Windows setup and local environment instructions in [`docs/driver-app.md`](./driver-app.md) and [`README.md`](../README.md). The app is served at `/driver` by Core API, and driver events use Driver Gateway. A local database must be initialized from the authoritative root `schema.sql`, with PostGIS enabled and valid application configuration. A database schema alone is not enough to sign in or see a route: the database also needs an active driver account with the driver role, an assigned vehicle as needed, and a route assigned to that driver.

Do not use a guessed tracking number as a substitute for seed data. A tracking token must belong to an order on the authenticated driver's active route to pass the app's local manifest match and server validation.
