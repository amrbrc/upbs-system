# UP Bikeshare System

The UP Bikeshare System is a student-run, free-to-use bicycle-sharing service designed for the University of the Philippines. This repository houses the backend services and dashboards of the platform.

The system allows registered users to search for available bicycles, query location stations, view usage history, and borrow bicycles directly by sending normalized SMS commands from their mobile phones.

---

## Key Features

- **Decoupled Microservices**: Separates low-level SMS hardware polling from resource-heavy business logic, preventing modem freeze issues.
- **SMS Command Interface**: Intuitive command parsing allows students to borrow and check bike statuses from any standard mobile phone.
- **Real-Time Map & Dashboards**: Dedicated student and administrator dashboards providing live coordinates and bicycle availability.
- **Trust Score & Dispute Audit**: An automated point-based merit system tracking honest returns and damage reporting, complete with a dispute resolution panel.

---

## Directory Structure

```text
upbs/
├── dashboard/            # Static HTML, CSS, and JS web dashboards
│   ├── index.html        # Public entry / login landing page
│   ├── student-dashboard.html
│   ├── admin-dashboard.html
│   └── js/               # Core application and map logic
├── gateway-server/       # SMS gateway microservice
│   ├── server.js         # Inbox polling and modem integration logic
│   └── db.js             # Local smsd database connection pool
├── worker-api/           # Core API server & business logic
│   ├── server.js         # Entry point for HTTP routing and static serving
│   ├── db.js             # MySQL database migration and pool config
│   ├── recreate_db.js    # One-command database recreation and seeding
│   ├── controllers/      # Route handler implementations
│   ├── routes/           # REST API routing definitions
│   └── services/         # Background cron jobs and outbound SMS queue
└── package.json          # Root scripts for multi-project orchestration
```

## System Architecture

The platform uses a decoupled microservices model to ensure high availability and prevent hardware lockups during heavy database operations.

```mermaid
flowchart TD
    User([User Phone]) <-->|SMS| Modem[GSM Modem]
    
    subgraph Local ["On-Premise Hardware Box"]
        Modem <-->|Read / Inject| Gammu[Gammu SMSD]
        Gammu <-->|Read/Write| smsd_db[(Local DB: smsd)]
        smsd_db <-->|Poll / Processed| Gateway[Gateway Server]
    end
    
    subgraph Core ["Core Server (Cloud or Local Box)"]
        Gateway <-->|HTTP POST / Outbound Poll| Worker[Worker API]
        Worker <-->|Read/Write| upbs_db[(Core DB: upbs)]
        Worker <-->|Static Files| Dashboard[Web Dashboard]
    end

    style Local fill:#f4f7fa,stroke:#2b579a,stroke-width:2px;
    style Core fill:#fffaf4,stroke:#e06666,stroke-width:2px;
```

1. **User Sends SMS**: A user texts a command (e.g. `search all` or `b1eee to vinzons`) to the system's phone number.
2. **Modem Reception**: A physical GSM modem receives the text, and `gammu-smsd` stores it in the local `smsd.inbox` table.
3. **Gateway Polling**: The **Gateway Server** polls the inbox table, parses the command patterns, and forwards them to the **Worker API**.
4. **Business Logic**: The **Worker API** processes database transactions in the core `upbs` database (updates coordinate logs, audits memberships, logs operations) and returns the reply.
5. **Reply Dispatched**: The Gateway Server injects the reply back to the modem using `gammu-smsd-inject` for immediate dispatch back to the user.

---

## REST API Reference

To access protected endpoints, request headers must supply:
1. **JWT Auth**: Header `Authorization: Bearer <JWT_TOKEN>` (obtained via login).
2. **Gateway Auth**: Header `x-gateway-secret: <GATEWAY_SECRET>`.

### Authentication
- **`POST /api/auth/login`**: Login students via phone number.
- **`POST /api/admin/login`**: Login administrators via username and password.

### Student Panel (JWT Auth)
- **`GET /api/student/dashboard`**: Fetch student statistics, current active borrow, logs, and Wall of Honor.
- **`GET /api/student/leaderboards`**: Fetch bi-weekly leaderboard standing stats.

### Public Directory & Stats
- **`GET /api/bicycles`**: Returns all active bicycles and statuses.
- **`GET /api/locations`**: Returns all hubs and map coordinates.
- **`GET /api/history/:bicycleCode`**: Fetch borrowing history logs for a bicycle.
- **`GET /api/analytics`**: Retrieve system-wide analytics and usage statistics.

### SMS Gateway Polling (Gateway Auth)
- **`POST /api/members/check`**: Check if a user is active/registered.
- **`GET /api/gateway/outbound`**: Poll the API for pending outbound SMS queue records.
- **`POST /api/gateway/outbound/:id/sent`**: Callback to mark a pending outbound SMS record as sent.

### Admin Controls (Admin JWT Auth)
- **`GET /api/admin/settings`** / **`POST /api/admin/settings`**: Read and update point rules and settings.
- **`GET /api/admin/members`** / **`POST /api/admin/members`**: List and register/update student accounts.
- **`POST /api/admin/bicycles`**: Register a new bicycle on the network.
- **`POST /api/admin/locations`**: Register a new station hub.
- **`POST /api/admin/resolve-dispute`**: Audit and resolve damage/missing disputes (`verdict`: `guilty`, `innocent`, or `neutral`).
- **`POST /api/admin/override-points`**: Overrides student trust points.
- **`POST /api/admin/bicycles/toggle`**: Locks or unlocks a bicycle.

---

## Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: MySQL (Split into `smsd` for SMS daemon operations and `upbs` for bike sharing data)
- **Hardware Integration**: Gammu SMSD

---

## Deployment Guide & Environment Setup

This project is agnostic and can be deployed under two main environments.

### Scenario A: Single Local Hardware Deployment (All-in-One)
Best for testing or environments where the database, server, and physical GSM modem reside on the same machine.

```
+--------------------------------------------------------------+
|                     SINGLE LOCAL SERVER                      |
|                                                              |
|   +--------------+      +----------------+                   |
|   |  Worker API  | <--- | Gateway Server |                   |
|   |  (Port 3001) |      |  (Port 3000)   |                   |
|   +--------------+      +----------------+                   |
|          |                      |                            |
|          v                      v                            |
|     [MySQL:upbs]           [MySQL:smsd] <--- [Gammu Daemon]  |
|                                                     ^        |
|                                                     |        |
+-----------------------------------------------------|--------+
                                                      v
                                              [GSM USB Dongle]
```

#### Step 1: Install Dependencies
From the root directory:
```bash
npm run install:all
```

#### Step 2: Environment Configuration
1. **Worker API**:
   ```bash
   cp worker-api/.env.example worker-api/.env
   ```
2. **Gateway Server**:
   ```bash
   cp gateway-server/.env.example gateway-server/.env
   ```
   *(Ensure `WORKER_URL` in `gateway-server/.env` is set to `http://localhost:3001`)*

#### Step 3: Recreate & Seed Database
Ensure your local MySQL/MariaDB server is running. Create both `upbs` and `smsd` databases by running:
```bash
npm run db:recreate
```

#### Step 4: Run Services
- In development:
  - Terminal 1: `npm run start:worker`
  - Terminal 2: `npm run start:gateway`
- In production (via **PM2**):
  ```bash
  pm2 start worker-api/server.js --name "upbs-worker"
  pm2 start gateway-server/server.js --name "upbs-gateway"
  pm2 save
  pm2 startup
  ```

---

### Scenario B: Hybrid Cloud/Hardware Deployment (Separated Box)
Recommended for live operations. The databases, Worker API, and frontend dashboards are hosted on a Cloud VPS (e.g., Digital Ocean) for reliability, while the physical GSM modem remains connected to an on-premise hardware box running the Gateway Server.

```
+--------------------------------------------------------------+
|                         CLOUD (VPS)                          |
|                                                              |
|          +--------------+                                    |
|          |  Worker API  | (Public HTTPs Port 3001)            |
|          | & Dashboard  |                                    |
|          +--------------+                                    |
|                 |                                            |
|                 v                                            |
|            [MySQL:upbs]                                      |
+-----------------|--------------------------------------------+
                  ^
                  | (Secured Axios Polling / HTTP POSTs)
+-----------------|--------------------------------------------+
                  v                                            |
|          +---------------+                                   |
|          |Gateway Server | (Port 3000)                       |
|          +---------------+                                   |
|                 |                                            |
|                 v                                            |
|            [MySQL:smsd] <--- [Gammu Daemon]                  |
|                                     ^                        |
|                                     |                        |
|                              [GSM USB Dongle]                |
|                    ON-PREMISE HARDWARE BOX                   |
+--------------------------------------------------------------+
```

#### Step 1: Cloud VPS Deployment (Worker API & Dashboard)
1. Clone this repository on your Cloud VPS (e.g. Digital Ocean Droplet).
2. Install dependencies: `npm run install:all`
3. Configure `worker-api/.env` with your cloud database credentials and set `NODE_ENV=production`.
4. Initialize the cloud database:
   ```bash
   npm run db:recreate
   ```
5. Start the Worker API:
   ```bash
   pm2 start worker-api/server.js --name "upbs-worker"
   ```

#### Step 2: On-Premise Hardware Box Deployment (Gateway Server)
1. Clone this repository on your local hardware box connected to the GSM modem.
2. Install dependencies: `npm run install:all`
3. Configure `gateway-server/.env` to connect `DB_HOST` to your local MySQL running `smsd`.
4. Set `WORKER_URL` to point to your cloud VPS address (e.g. `https://upbs-api.yourdomain.com`).
5. Ensure `GATEWAY_SECRET` and `GATEWAY_API_KEY` match those configured on the Cloud VPS.
6. Install and configure `gammu-smsd` to write incoming SMS to the local `smsd` database.
7. Start the Gateway Server:
   ```bash
   pm2 start gateway-server/server.js --name "upbs-gateway"
   ```
