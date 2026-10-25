# Driver App

The Driver App is a mobile-friendly Progressive Web App (PWA) for driver sign-in, profile and vehicle management, parcel scanning, assigned-route execution, proof capture, and delivery outcomes. This document describes the implemented system, how to run it, and the boundaries of the current workflows.

## At a glance

| Layer | Responsibility | Location |
| --- | --- | --- |
| PWA | Mobile UI, account and route screens, offline app shell, local event outbox | `frontend/driver-app/` |
| Driver Gateway | Serves the PWA, proxies allowlisted driver APIs, validates and publishes driver events | `services/driver_gateway/` |
| Core API | Driver authentication, authorization, profile, vehicle, and route operations | `services/core_api/app/driver/` and `services/core_api/app/auth/` |
| PostgreSQL/PostGIS | Authoritative persistent application data and constraints | [`schema.sql`](../schema.sql), accessed by Core API |
| Redis Streams | Transport for accepted driver events | `driver_events_stream`, accessed through `streaming/` |

Driver Gateway has no Postgres connection. Database-backed driver behavior belongs to Core API.

## Check a database against the driver contract

To inspect a connected PostgreSQL/Neon database without changing it, open [`scripts/check_driver_app_database.sql`](../scripts/check_driver_app_database.sql) in the SQL editor for the database and schema you want to check, then run the whole file. The first result set lists required tables/columns and PostgreSQL types; the second checks required enum types and values; the third checks required extensions; the fourth reports aggregate driver/vehicle/route readiness and active-route consistency. Look for `MISSING TABLE`, `MISSING COLUMN`, `TYPE MISMATCH`, `MISSING ENUM TYPE`, `MISSING ENUM VALUE`, or `MISSING EXTENSION`. `OK` means that catalog item matches the current driver contract; readiness rows can also show that data is absent or inconsistent even when the schema is correct.

The script is read-only. It checks the schema selected by PostgreSQL's current `search_path`; confirm that the SQL editor is connected to the intended database/schema first. It checks the platform's existing driver tables, not tables for unsupported payout, KYC, shift, notification, or support features. It does not check whether the database contains valid driver accounts, assigned routes, vehicles, Redis, or object-storage configuration.

## Driver UI coverage and contract boundaries

The mobile-first UI covers the requested driver workflow through the existing HTML/CSS/JavaScript app:

| Design area | Current app surface |
| --- | --- |
| Home dashboard | Home tab: driver/shift status, assigned route, network state, queued-sync status, daily stop counts, next route action, and an earnings-data availability preview. |
| Routes and acceptance | Routes tab and route-details dialog: assigned planned routes can be reviewed with distance, duration, assigned vehicle, and a map preview; routes can be started when driver status and vehicle match. |
| Deliveries | Deliveries tab: active route manifest, per-stop pending/scanned/arrived/delivered/failed/skipped statuses, summary counts, and filters. Historical completed/failed/returned orders are unavailable because the API lists only planned and in-progress routes. |
| Earnings | Secondary Earnings page, linked from Deliveries and Profile: delivered-stop context and sync status. Payout amounts are explicitly unavailable because no earnings API or schema-backed payout data exists. |
| Pickup and scanning | Active Route tab: scan parcels with supported device barcode detection or manual tracking-token entry, then confirm pickup after the manifest is verified. |
| Navigation and arrival | Active Route tab: route map/directions and explicit GPS check-in. |
| Delivery proof | Delivery dialog: photo, signature, or recipient-name evidence. |
| Exceptions and returns | Exception dialog: supported failure reason, optional notes/photo, and return-to-hub flag. |
| Driver and sync settings | Profile and Activity views: editable supported profile fields, assigned vehicle registration, connection settings, and queued event status. Activity and earnings are secondary pages linked from Profile/Deliveries; the main navigation is Home, Routes, Deliveries, and Profile. |

The dashboard progress card reports delivered, total daily stops, and failed stops from the active route state. Its next-action card links back into the active route workflow. The Deliveries tab filters the current route manifest only; it does not imply that historical records are available. The app does not estimate earnings.

Some Figma concepts cannot be connected to the current backend contract and are intentionally not presented as working features:

- Login uses the existing email/phone and password contract; OTP login, KYC submission, and document verification endpoints are not available.
- Driver availability is staff-managed. The top-bar online/offline indicator reports browser network connectivity; shift start/end, vehicle inspection, fuel/charging records, and a driver availability toggle are not available.
- The route API returns routes already assigned to the driver, not offers. Route accept/reject, payout estimates, parcel-capacity validation, and stop reordering are not part of that contract.
- Earnings and payout history are not available through the driver API or authoritative schema.
- The route API returns planned and in-progress routes only. Historical delivery, returned-order, and shift-closeout endpoints are not available.
- Arrival records an explicit GPS check-in; no geofence radius or geofence status is configured. The current POD API accepts photo/signature/name evidence but has no delivery OTP verification contract.
- Vehicle profiles expose registration/type and capacity measurements for vehicle search; VIN/chassis selection and licence/insurance verification fields are not available.
- There are no notification, dispatcher/support, SOS/incident, reschedule/reattempt, return-handover, or parcel damage/missing-report endpoints in the driver API.

These are backend/API compatibility gaps, not frontend fallbacks. Do not add synthetic values or controls that imply those operations succeeded.

## Frontend structure

The PWA is implemented with HTML, CSS, and JavaScript ES modules:

- `frontend/driver-app/index.html` is the entry page; `css/style.css` contains app styling.
- `js/app.js` initializes storage, restores an eligible session, and wires UI actions.
- `js/components/` contains the account, navigation, route, dashboard, activity, barcode scanner, and proof-capture views.
- `js/services/account.js` handles login, registration, profile, vehicle, and account actions.
- `js/services/driver-events.js` handles route actions, location collection, and event synchronization.
- `js/api.js` sends same-origin requests to Gateway and handles session refresh.
- `js/storage.js` manages IndexedDB work state and the ordered event outbox.
- `manifest.webmanifest` and `sw.js` provide installability and offline app-shell caching.

The browser uses HttpOnly cookies rather than reading authentication tokens in JavaScript. IndexedDB stores supported app state and queues events before attempting network sync. Queued events are replayed sequentially and bound to the driver account that created them.

The app has no server-backed demo mode: route, profile, vehicle, and delivery data are loaded for the signed-in driver through Driver Gateway and Core API. On localhost only, the sign-in screen offers an optional read-only UI preview using synthetic data. Preview mode blocks API requests and driver actions; it does not authenticate, read Neon data, or write to the server. Previously saved sample routes and demo-only queued actions are removed from this device on startup; real queued driver actions are preserved.

### Route maps

An active route displays an embedded Google Maps directions map when a Google Maps Embed API key is configured in Profile → Sync settings. The map uses the warehouse address as its origin and the route stops in sequence as its destination and waypoints. The key is stored only in that browser's local settings; it is a public browser key, not a secret. Restrict it to the app's website referrer and enable only Maps Embed API in Google Cloud. A Google Cloud billing-enabled project is required. Without a key, the app still offers a direct full-route link to Google Maps. Synthetic preview/sample addresses are not used for navigation.

## Backend and persistence

### Driver Gateway

`services/driver_gateway/app/main.py` assembles the FastAPI application and serves the PWA. The Gateway proxies allowlisted `/auth/*` and `/driver/*` requests to Core API, forwarding session cookies. It validates the driver identity and event schema for `POST /driver/events`, then appends accepted payloads to Redis `driver_events_stream`. For `POST /driver/pod`, Gateway asks Core API to authorize the driver/route/stop, uploads evidence to a private MinIO bucket, and publishes its object key to the same stream. Gateway itself never accesses Postgres.

### Core API and database

Core API checks that the user is active, has the `driver` role, and has a driver profile before serving driver operations. It owns all Postgres access and currently uses schema-backed records including `users`, `user_roles`, `drivers`, `vehicles`, `routes`, `route_stops`, `warehouses`, `orders`, and `order_events`. The route manifest returns each assigned parcel's tracking token, contact phone, and available order time window. Delivery notes are not a field in the current schema. The root [`schema.sql`](../schema.sql) is authoritative for table and enum definitions; `db_models/` mirrors it.

Routing Worker's terminal-event consumer validates route ownership and updates `route_stops`, `orders`, `order_events`, and route/driver status using existing columns and enums. Arrival time is stored in `route_stops.arrived_at`. Redis is an event transport, not the system of record for driver profiles or route assignment. Do not add database access to Gateway or infer new database fields from a frontend screen.

## Authentication and API

All paths below are called on Driver Gateway. Authentication and driver self-service requests are proxied to Core API; event ingestion is handled by Gateway.

### Authentication

| Method | Path | Behavior |
| --- | --- | --- |
| `POST` | `/auth/register/driver` | Creates a driver account; the user signs in separately. |
| `POST` | `/auth/login` | Authenticates credentials and sets access and refresh HttpOnly cookies. |
| `GET` | `/auth/me` | Returns the signed-in identity and roles. |
| `POST` | `/auth/refresh` | Rotates the refresh session and sets updated cookies. |
| `POST` | `/auth/logout` | Clears the authentication cookies. |
| `POST` | `/auth/forgot-password` | Starts the existing password-reset flow. |
| `POST` | `/auth/reset-password` | Completes the existing password-reset flow. |

The access cookie is short-lived and scoped to `/`; the refresh cookie is scoped to `/auth`. Cookies use `SameSite=Lax`; `COOKIE_SECURE` must be enabled when served over HTTPS.

### Driver self-service

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/driver/profile` | Reads the signed-in driver's profile, status, and assigned vehicle. |
| `PATCH` | `/driver/profile` | Updates `full_name` and/or E.164 `phone`. Role, email, and driver status are not editable through this endpoint. |
| `GET` | `/driver/vehicles?search=KA%2003&limit=25` | Searches active, unassigned vehicles by registration number; the driver's own assigned vehicle may also appear. |
| `PUT` | `/driver/vehicle` | Assigns a vehicle using exactly one of `{"vehicle_id":"<uuid>"}` or `{"registration_number":"KA 03 MN 4821"}`. |
| `GET` | `/driver/routes` | Lists this driver's assigned planned or in-progress routes and their manifests. |
| `POST` | `/driver/routes/{route_id}/accept` | Starts an assigned planned route. In one transaction Core API updates the route and driver status. Repeating a successful request is idempotent. |
| `POST` | `/driver/routes/{route_id}/scan` | Verifies that a tracking token belongs to an open stop on this driver's active route; does not create a scan database record. |
| `POST` | `/driver/routes/{route_id}/stops/{order_id}/pod-authorize` | Internal Gateway-to-Core API authorization check for an open stop; no state change. |
| `POST` | `/driver/events` | Validates an authenticated driver event and publishes it to Redis; this is not a database write. |
| `POST` | `/driver/pod` | Multipart evidence upload. Core API authorizes the stop, Gateway stores a private MinIO object, and Gateway publishes the object key to Redis. The object key is not persisted against the order. |

An assigned route is not a route offer: the route must already belong to the authenticated driver. Routes have no rejected/offer status. Vehicles are identified by registration number, not VIN.

### Driver event envelopes

Gateway accepts the following event types from `streaming/schemas/events.py`:

| Event type | Required event context |
| --- | --- |
| `route.started` | `event_id`, `route_id`, `timestamp` |
| `driver.location.updated` | `event_id`, `latitude`, `longitude`, `timestamp` |
| `package.scanned` | `event_id`, `route_id`, `order_id`, `scan_stage` (`pickup` or `stop`), `timestamp` |
| `pickup.confirmed` | `event_id`, `route_id`, all `scanned_order_ids`, `timestamp` |
| `stop.arrived` | `event_id`, `current_route_id`, `order_id`, coordinates, `timestamp` |
| `delivery.completed` | `event_id`, `current_route_id`, `order_id`, coordinates, `timestamp` |
| `delivery.failed` | `event_id`, `current_route_id`, `order_id`, coordinates, `failure_reason`, optional `failure_notes` and `return_to_hub`, `timestamp` |
| `pod.captured` / `delivery.exception.evidence` | Gateway-generated evidence event with `event_id`, route/order IDs, evidence type, private MinIO object key, and `timestamp` |

Every event includes `event_id`, `driver_id`, and `timestamp`; Gateway validates `driver_id` against the authenticated driver's identity. Coordinates and failure reasons are validated where required by the event schema. Browser requests authenticate with the Gateway-issued HttpOnly access cookie; non-browser clients may use `Authorization: Bearer <access-token>`.

## Data flow

1. **Sign in and load route:** the PWA authenticates through Gateway. Core API sets HttpOnly cookies and returns the driver's assigned route manifest.
2. **Scan at pickup and stop:** camera scanning uses `BarcodeDetector` where available, with manual entry as fallback. Online scans are checked by Core API against the driver's active route. Scans and pickup confirmation are queued and sent to Redis; scan records and pickup state are not persisted in Postgres.
3. **Navigate and check in:** the route shows ordered addresses, recipient phone links, time windows, and a map handoff link. The driver explicitly requests GPS at arrival. Routing Worker records `arrived_at`; no geofence radius is configured.
4. **Capture proof:** the driver selects a photo, signature, or recipient name. The evidence action is written to IndexedDB first. When synced, Gateway verifies the open stop through Core API, uploads evidence to private MinIO storage, then publishes the object key to Redis.
5. **Complete or report an issue:** the PWA queues `delivery.completed` or `delivery.failed`. Routing Worker applies a terminal transition to `route_stops` and `orders`, writes the status transition to `order_events`, and acknowledges only after commit. A failed order is marked `attempt_failed`, or `returned` when requested.
6. **Sync offline actions:** the PWA replays queued actions sequentially when online. Event UUIDs are stable client identifiers; terminal state transitions avoid repeating the same status change, but the schema has no durable event-ID deduplication table.

## Setup and run locally

### Prerequisites

- Python version and project dependencies as described in the root [`README.md`](../README.md).
- A reachable PostgreSQL database with PostGIS, initialized from the repository schema.
- A reachable Redis-compatible service.
- A configured `JWT_SECRET_KEY`.

### Windows PowerShell

1. Create the local environment file and fill in valid service connection details:

   ```powershell
   Copy-Item .env.example .env
   ```

   Set `DATABASE_URL`, `REDIS_URL`, and `JWT_SECRET_KEY`. Use `CORE_API_URL=http://localhost:8000` and `COOKIE_SECURE=false` for local HTTP. Core API and Gateway must share the same JWT secret.

2. Create the virtual environment and install dependencies:

   ```powershell
   .\setup_windows.ps1
   .\venv\Scripts\Activate.ps1
   ```

3. From the repository root, start the configured local process group:

   ```powershell
   honcho start -f Procfile.dev
   ```

4. Open `http://127.0.0.1:8002/` in a browser. The process group includes Core API, which Gateway needs for login and driver self-service requests. Other services and external integrations also require their configured dependencies.

For Linux/macOS setup and the full platform requirements, use the root [`README.md`](../README.md). Do not commit `.env` or production credentials.

### Gateway configuration

| Variable | Purpose |
| --- | --- |
| `CORE_API_URL` | Core API base URL used by Gateway proxy. |
| `REDIS_URL` | Redis connection used for driver event ingestion. |
| `JWT_SECRET_KEY` | Shared signing/verification secret for Core API and Gateway. |
| `JWT_ALGORITHM` | JWT algorithm; configured as `HS256`. |
| `COOKIE_SECURE` | Set `false` for local HTTP; `true` for HTTPS deployments. |
| `MINIO_ENDPOINT` | MinIO host and port, without a URL scheme. |
| `MINIO_SECURE` | Set `true` when MinIO is reachable over TLS; use `false` for local HTTP. |

On Render, configure the Gateway's `CORE_API_URL` to the Core API service URL, and provide the required secrets and Redis URL through the service environment.

## Current implementation boundaries

The UI should not be mistaken for proof that every depicted workflow is persisted. Under the current schema and API:

- Vehicle assignment uses registration number; VIN lookup is not supported.
- Routes are assigned by the platform and can be started by their assigned driver; there is no route-offer acceptance/rejection marketplace.
- Scans are verified against a driver's assigned route and published, but no scan or pickup-confirmation table exists.
- GPS check-in stores `arrived_at`; there is no durable location history or configured geofence enforcement.
- POD and exception evidence is stored in private MinIO and announced on Redis, but the current schema has no column/table linking evidence to an order. The stream is trimmed, so Redis is not a durable POD index.
- Delivery outcomes use existing `route_stops`, `orders`, and `order_events` fields; there is no `delivery_attempt` or `processed_event` table. Worker retries are made state-idempotent, but client event UUIDs are not durably deduplicated.
- Failure reason and final order status persist. Exception notes, evidence references, and physical return-to-hub handling do not; `returned` is only the existing order status.
- Delivery notes are absent from the current schema and are not displayed.

Persisting scans, pickup confirmations, POD references/signatures, exception notes, return custody, or event-ID deduplication requires an explicit schema and API contract update.
