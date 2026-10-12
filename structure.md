last-mile-platform/
├── AGENTS.md                        # Authoritative repository invariants, guardrails, and runtime law
├── README.md                        # Project overview and setup instructions
├── schema.sql                       # Authoritative PostgreSQL/PostGIS database contract
├── requirements.txt                 # Unified dependencies for single-process runtime & testing
├── render.yaml                      # Render deployment blueprint (Neon DB, Valkey Redis, single-process)
├── .env.example                     # Environment variables configuration template
├── .gitignore                       # Git ignore rules for Python, virtual environments, IDEs
├── setup_windows.ps1                # PowerShell environment setup script
├── setup_linux_mac.sh               # Shell environment setup script
├── ai_structure.md                  # Detailed file tree specification
├── structure.md                     # Current project layout and architecture overview
│
├── .github/
│   └── workflows/
│       └── ci.yml                   # CI pipeline workflow
│
├── docs/
│   ├── PRD.md                       # Product Requirements Document
│   ├── architecture.md              # Technical Architecture & ADR documentation
│   ├── API_CONTRACTS.md             # Documented REST, WebSocket, and Redis Stream contracts
│   └── CURRENT_STATE.md             # Verified implementation status snapshot
│
├── db/
│   ├── migrations/                  # Shared database schema migrations package
│   └── seed/                        # Database seed scripts
│
├── db_models/                       # SQLAlchemy 2.0 ORM models (exact mirror of schema.sql)
│   ├── __init__.py
│   └── models.py                    # Users, Roles, Drivers, Warehouses, Orders, Routes, RouteStops, etc.
│
├── streaming/                       # Shared Redis Stream & Client package
│   ├── __init__.py
│   ├── client.py                    # Redis async connection pool wrapper (redis.asyncio)
│   └── schemas/
│       ├── __init__.py
│       └── events.py                # Stream schemas: orders_stream, route_stream, driver_events_stream
│
├── services/
│   ├── __init__.py
│   ├── app.py                       # Unified single-process gateway launcher & background task owner
│   │
│   ├── core_api/                    # Core API Service (Postgres transactional owner)
│   │   └── app/
│   │       ├── __init__.py
│   │       ├── main.py              # Core API FastAPI sub-app entrypoint
│   │       ├── config.py            # Core API configuration loader
│   │       ├── database/
│   │       │   ├── __init__.py
│   │       │   └── connection.py    # Async SQLAlchemy session provider (Neon Postgres)
│   │       ├── auth/
│   │       │   ├── __init__.py
│   │       │   ├── email.py         # Password reset email sender (aiosmtplib)
│   │       │   ├── router.py        # /auth routes: register, login, logout, refresh, reset, me
│   │       │   ├── schemas.py       # Pydantic schemas for auth requests and responses
│   │       │   ├── security.py      # Password hashing, JWT creation/decoding, role redirection
│   │       │   └── service.py       # User lifecycle, authentication, token rotation business logic
│   │       ├── orders/
│   │       │   ├── __init__.py
│   │       │   └── router.py        # Order intake, PostGIS KNN warehouse assignment, stream publishing
│   │       ├── staff/
│   │       │   ├── __init__.py
│   │       │   └── router.py        # Staff and admin operational endpoints
│   │       ├── tracking/
│   │       │   ├── __init__.py
│   │       │   └── router.py        # Public parcel tracking with rate-limiting (/api/v1/track/{order_id})
│   │       └── home/
│   │           ├── __init__.py
│   │           └── router.py        # Static HTML page routing (home, login, register, reset, workspaces)
│   │
│   ├── routing_worker/              # Route Optimization Compute Engine (Pure consumer, Postgres access)
│   │   └── app/
│   │       ├── __init__.py
│   │       ├── main.py              # Worker persistent consumer entrypoint
│   │       ├── config.py            # Routing worker configuration
│   │       ├── consumers/
│   │       │   ├── __init__.py
│   │       │   ├── orders_consumer.py          # orders_stream XREADGROUP & XAUTOCLAIM optimization loop
│   │       │   └── terminal_events_consumer.py # driver_events_stream terminal event processing loop
│   │       ├── database/
│   │       │   ├── __init__.py
│   │       │   └── connection.py    # Async SQLAlchemy database write context
│   │       └── engines/
│   │           ├── __init__.py
│   │           ├── osrm.py          # OSRM matrix compilation client
│   │           └── vroom.py         # VROOM CVRPTW solver client
│   │
│   ├── control_tower/               # Live Dispatcher Dashboard Service (Redis hot state only, NO Postgres)
│   │   └── app/
│   │       ├── __init__.py
│   │       ├── main.py              # Control Tower FastAPI sub-app entrypoint
│   │       ├── config.py            # Redis-only configuration loader
│   │       ├── consumers/
│   │       │   ├── __init__.py
│   │       │   └── telemetry_consumer.py # Telemetry ticks XREADGROUP stream reader
│   │       ├── fleet_state/
│   │       │   ├── __init__.py
│   │       │   └── manager.py       # Redis Hash driver/vehicle hot state management
│   │       └── websockets/
│   │           ├── __init__.py
│   │           └── router.py        # WebSocket fanout broadcaster & rescue triggers
│   │
│   ├── driver_gateway/              # Secure Edge Ingestion DMZ (Redis & MinIO only, NO Postgres)
│   │   └── app/
│   │       ├── __init__.py
│   │       ├── main.py              # Driver Gateway FastAPI sub-app entrypoint
│   │       ├── config.py            # Gateway configuration loader (Redis, MinIO, JWT)
│   │       ├── auth/
│   │       │   ├── __init__.py
│   │       │   └── jwt.py           # Stateless driver JWT session verifier
│   │       ├── ingestion/
│   │       │   ├── __init__.py
│   │       │   └── router.py        # Ingestion routes: driver GPS pings & delivery events
│   │       └── storage/
│   │           ├── __init__.py
│   │           └── minio_client.py  # Proof-of-delivery (POD) photo upload to MinIO S3
│   │
│   └── simulator/                   # Black-box External World Simulator
│       └── app/
│           ├── __init__.py
│           ├── main.py              # Synthetic driver location pings & lifecycle runner
│           └── config.py            # Simulator configuration loader
│
└── frontend/                        # Static HTML/CSS/JS frontend applications
    ├── shared/                      # Shared assets across multiple pages
    │   ├── css/
    │   │   └── auth.css             # Unified modern design system for auth views (login, register, reset)
    │   └── js/
    │       └── contracts.js         # Shared status enums, driver states, and event contracts
    │
    ├── home/                        # Public platform landing page
    │   ├── index.html
    │   ├── css/
    │   │   └── landing.css
    │   └── js/
    │       └── home.js
    │
    ├── login/                       # User sign-in page
    │   ├── index.html
    │   ├── css/
    │   └── js/
    │       └── login.js
    │
    ├── register/                    # User registration page (customer & driver accounts)
    │   ├── index.html
    │   ├── css/
    │   └── js/
    │       └── register.js
    │
    ├── reset-password/              # Password recovery & reset page
    │   ├── index.html
    │   └── js/
    │       └── reset.js
    │
    ├── track/                       # Public parcel tracking page
    │   ├── index.html
    │   ├── css/
    │   │   └── track.css
    │   └── js/
    │       └── track.js
    │
    ├── dashboards/                  # Role-based workspace operational views
    │   ├── css/
    │   │   └── dashboard.css
    │   ├── admin/
    │   │   └── index.html           # Admin operations workspace
    │   ├── customer/
    │   │   └── index.html           # Customer delivery tracking workspace
    │   ├── dispatcher/
    │   │   └── index.html           # Dispatcher live dispatch workspace
    │   ├── driver/
    │   │   └── index.html           # Driver active route workspace
    │   ├── fleet-manager/
    │   │   └── index.html           # Fleet manager workspace
    │   └── merchant/
    │       └── index.html           # Merchant order intake workspace
    │
    ├── control-tower/               # Live Control Tower dashboard UI
    │   ├── index.html
    │   ├── css/
    │   │   └── style.css
    │   └── js/
    │       └── app.js
    │
    └── driver-app/                  # Mobile Driver PWA application
        ├── index.html
        ├── sw.js                    # Service worker for offline asset caching
        ├── css/
        │   └── style.css
        └── js/
            └── app.js               # Offline-first IndexedDB queue & replay client
