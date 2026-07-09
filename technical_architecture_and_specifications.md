# 🏗️ UP Bikeshare System — Complete Technical Architecture & System Specifications

This document provides a comprehensive, deep-dive architectural and technical analysis ("walang labis, walang kulang") of the **UP Bikeshare System**. It details the exact engineering implementation across all layers: hardware modem interfacing, microservices backend communication, relational database transactions, scheduled cron automation, and responsive frontend dashboard technologies.

---

## 📋 Table of Contents
1. [Executive Summary & Architecture Overview](#1-executive-summary--architecture-overview)
2. [Hardware & GSM Modem Layer (Gammu SMSD Interface)](#2-hardware--gsm-modem-layer-gammu-smsd-interface)
3. [End-to-End Communication Flow (SMS ➔ Hardware ➔ Gateway ➔ Worker ➔ DB ➔ Dashboard)](#3-end-to-end-communication-flow)
4. [Backend Technology Stack & Microservices Design](#4-backend-technology-stack--microservices-design)
5. [Database Architecture & ACID Transaction Management](#5-database-architecture--acid-transaction-management)
6. [Frontend & UI Technology Stack (Bootstrap 5, Vanilla CSS, Responsive Glassmorphism)](#6-frontend--ui-technology-stack)
7. [Automated Background Job Scheduler (`node-cron` System Timers)](#7-automated-background-job-scheduler)
8. [Network Routing, Security & Inter-Process Communication (IPC)](#8-network-routing-security--inter-process-communication)
9. [Deployment & Server Engineering (Linux Systemd Automation)](#9-deployment--server-engineering)

---

## 1. Executive Summary & Architecture Overview
The UP Bikeshare System is a **hybrid IoT-telecom-web application** engineered to allow university students to check out, ride, and report communal bicycles across campus using basic SMS (Short Message Service), without requiring mobile data or internet connectivity on the rider's phone.

To achieve high reliability, modularity, and clean separation of concerns, the backend is split into a **Two-Tier Microservices Architecture**:
* **Tier 1: Gateway Server (Port 3000):** Dedicated exclusively to interfacing with the physical GSM SIM modem hardware, polling SMS inbox queues, parsing raw regex command syntax, and dispatching outgoing SMS via serial AT injection.
* **Tier 2: Worker API Server (Port 3001):** The central business logic engine. It handles database transactions, user authentication, ride timers, demerit calculations, background cron jobs, and serves the REST API for the real-time Web Dashboard.

```
+------------------+       AT Commands       +-----------------------+
|  Student Phone   | <=====================> |  Physical GSM Modem   |
|  (SMS Sending /  |    Cellular Network     |  (USB SIM Dongle /    |
|    Receiving)    |                         |  Serial ttyUSB0/ACM0) |
+------------------+                         +-----------+-----------+
                                                         |
                                                         | (Gammu SMSD SQL Inbox/Outbox)
                                                         v
                                             +-----------------------+
                                             | MySQL Database Engine |
                                             |   (`inbox` table &    |
                                             |    `upbsPool` DB)     |
                                             +-----------+-----------+
                                                         ^
                                                         | (200ms Polling Loop &
                                                         |  gammu-smsd-inject)
+------------------+      HTTP REST API      +-----------+-----------+
|  Web Dashboard   | <=====================> |  Gateway Server       |
|  (Student &      |    (Fetch / JSON)       |  (Node.js - Port 3000)|
|   Admin UI)      |                         +-----------+-----------+
+--------+---------+                                     ^
         ^                                               | (Authenticated HTTP API
         |                                               |  with x-gateway-secret)
         |                                               v
         |                           +---------------------------+
         +-------------------------- |  Worker API Server        |
               HTTP REST API         |  (Node.js - Port 3001)    |
                                     +---------------------------+
```

---

## 2. Hardware & GSM Modem Layer (Gammu SMSD Interface)
The physical bridge between mobile phones and the software server is managed via **Gammu SMS Daemon (`gammu-smsd`)**, an industrial-grade open-source SMS gateway daemon running on the Ubuntu Linux host.

### 2.1 Hardware Interfacing
* **Modem Device:** A physical USB GSM SIM dongle or cellular modem (e.g., Huawei E3372, Wavecom, SIM800L) connected to the server's serial port (`/dev/ttyUSB0` or `/dev/ttyACM0`).
* **Communication Protocol:** The daemon communicates with the SIM hardware using standard **Hayes AT Commands** over serial baud rates (typically 9600 or 115200 bps).

### 2.2 Incoming SMS Processing (`inbox` Polling)
1. When an SMS arrives at the cellular tower, the GSM modem receives the radio signal and notifies Gammu SMSD.
2. Gammu SMSD automatically decodes the PDU (Protocol Data Unit), extracts the sender mobile number (`SenderNumber`) and text body (`TextDecoded`), and inserts a row directly into the MySQL `inbox` table with status `Processed = 'false'`.
3. The **Gateway Server (`gateway-server/server.js`)** runs a non-blocking asynchronous polling loop every **200 milliseconds** (`setInterval(pollInbox, 200)`):
   ```sql
   SELECT * FROM inbox WHERE Processed='false'
   ```
4. Once picked up, the Gateway Server processes the command and marks the record as handled:
   ```sql
   UPDATE inbox SET Processed='true' WHERE ID=?
   ```

### 2.3 Outgoing SMS Transmission (`gammu-smsd-inject`)
When the system needs to reply to a student or send an automated cron alert, it invokes the asynchronous `sendReply(phoneNumber, text)` function in the Gateway:
1. **Intelligent Chunking (<160 Characters):** Standard SMS messages have a hard limit of 160 GSM-7 characters. If a reply exceeds 160 characters (e.g., full command help list), the Gateway automatically splits the message into **150-character chunks**, splitting cleanly at word boundaries (spaces) to prevent chopping words in half. It prepends pagination headers (e.g., `(1/2) ...`, `(2/2) ...`).
2. **Subprocess Spawn:** For each chunk, the Node.js process spawns a native Linux system command via `child_process.spawn`:
   ```bash
   gammu-smsd-inject TEXT <phoneNumber> -text "<message_chunk>"
   ```
3. **Hardware Dispatch:** `gammu-smsd-inject` pushes the payload into Gammu's outbox spooler. The daemon immediately injects the AT command (`AT+CMGS`) to the USB modem, transmitting the SMS radio frequency signal back to the student's mobile phone within 1–3 seconds.

---

## 3. End-to-End Communication Flow
To understand how all system components interact in a live scenario, here is the lifecycle trace of a standard bike checkout transaction (`1 eee to vinzons`):

```
[Student Phone]  ──(1. SMS: "1 eee to vinzons")──>  [Cellular Tower]  ──>  [USB GSM Modem]
                                                                                  │
                                                                   (2. AT Command / PDU Decode)
                                                                                  ▼
[Gateway Server] <──(3. Polling: SELECT * FROM inbox)── [MySQL `inbox`] <──(Gammu SMSD Insert)
       │
       ├──(4. HTTP POST /api/members/check [payload: { phone_number, message_text }])──> [Worker API Server]
       │                                                                                       │
       │                                                                        (5. Query `members` & INSERT)
       │                                                                        (into MySQL `user_sms_inbox`)
       │                                                                                       │
       ▼                                                                                       ▼
[Gateway Server] <──(6. JSON: { registered: true })────────────────────────────────────────────┘
       │
       ├──(7. Regex Parse: /^(\w+)\s+(\w+)\s+to\s+(\w+)$/i)
       │
       └──(8. HTTP POST /api/borrow [payload: { smsSender, bicycleCode, from, to }])──┐
                                                                                      │
                                                                                      ▼
[MySQL Database] <──(9. ACID Transaction: FOR UPDATE Row Locks & INSERT log)── [Worker API Server]
       │                                                                              │
       ▼                                                                              │
[Gateway Server] <──(10. JSON: { reply: "Hi Juan! Bike 1 lock code: 4321..." })───────┘
       │
       └──(11. Subprocess: gammu-smsd-inject TEXT 09123456789 -text "Hi Juan...")──> [GSM Modem]
                                                                                          │
[Student Phone]  <──(12. SMS Reply Received on Mobile Screen)── [Cellular Tower] <────────┘
```

### Simultaneous Real-Time Dashboard Reflection
At step 9, when the MySQL transaction commits:
* The `condition_status` of Bike 1 in table `bicycle_codes` changes from `Good` to `Borrowed`.
* Its `new_location` updates to `vinzons`.
* When any administrator or student opens the **Web Dashboard (`dashboard/`)** on their browser, the frontend JavaScript (`student.js`, `admin-search.js`, `bike.js`) fetches `http://localhost:3001/api/bicycles` or `/api/student/dashboard`. The browser renders the bike as **"In Use"** with active timers and location badges in real time!

---

## 4. Backend Technology Stack & Microservices Design
The backend is written entirely in **JavaScript (Node.js)** utilizing modern asynchronous ES6+ patterns (`async/await`, Promises, modular design).

### 4.1 Tier 1: Gateway Server (`gateway-server/`)
* **Role:** Telecom-to-HTTP Bridge & Regex Router.
* **Dependencies (`package.json`):**
  * `express` (^5.2.1): Lightweight HTTP server running on **Port 3000** to listen for outgoing SMS requests (`/api/sms/send`).
  * `mysql2` (^3.22.5): Direct connection to Gammu's `inbox` database table.
  * `axios` (^1.18.0): HTTP client used to forward cleaned SMS payloads to the Worker API.
  * `dotenv` (^17.4.2): Environment variable management (`GATEWAY_SECRET`, `WORKER_URL`, `DB_HOST`).
* **Regex Command Parsing Engine:** The Gateway normalizes incoming text (`smsMessage.trim().toLowerCase()`) and matches against strict regex patterns before routing:
  * Borrow: `/^([a-z0-9-]+)\s+([a-z0-9_]+)\s+to\s+([a-z0-9_]+)$/i` ➔ `POST /api/borrow`
  * End Trip: `/^done\s+([a-z0-9-]+)$/i` or `/^([a-z0-9-]+)\s+done$/i` ➔ `POST /api/done`
  * Good Condition: `/^good\s+([a-z0-9-]+)$/i` or `/^([a-z0-9-]+)\s+good$/i` ➔ `POST /api/good`
  * Broken Report: `/^broken\s+([a-z0-9-]+)$/i` or `/^([a-z0-9-]+)\s+broken$/i` ➔ `POST /api/broken`
  * Missing Report: `/^missing\s+([a-z0-9-]+)$/i` or `/^([a-z0-9-]+)\s+missing$/i` ➔ `POST /api/missing`
  * Delivery Hub: `/^delivered\s+([a-z0-9-]+)\s+([a-z0-9_]+)$/i` ➔ `POST /api/delivered`
  * Inquiries: `/^search\s+(\w+)$/i`, `/^search\s+all$/i`, `/^locations$/i`, `/^points$/i`, `/^how$/i`, `/^bikeshare\s+help$/i`

### 4.2 Tier 2: Worker API Server (`worker-api/`)
* **Role:** Business Logic Engine, Database Controller & REST API Host.
* **Dependencies (`package.json`):**
  * `express` (^5.2.1): Main API server running on **Port 3001**. Serves both internal SMS webhooks and external Dashboard JSON requests.
  * `cors` (^2.8.6): Cross-Origin Resource Sharing middleware allowing browsers on local networks (e.g., `192.168.1.x`) to fetch API endpoints securely.
  * `mysql2` (^3.22.5): Configured with a high-performance **Connection Pool (`upbsPool`)** with `waitForConnections: true`, `connectionLimit: 10`, and `queueLimit: 0`.
  * `jsonwebtoken` (^9.0.3): Issues and verifies secure JWT bearer tokens (`authMiddleware.js`) for administrative and student dashboard sessions.
  * `node-cron` (^4.5.0): Automated background job scheduler.
  * `dotenv` (^16.4.5): Secret keys, MySQL credentials, and application settings.

### 4.3 Controller Modularity
To maintain clean architecture, business logic in `worker-api` is segregated by domain:
* `memberController.js`: Student authentication (`/auth/login`), registration verification (`/members/check`), student dashboard aggregate statistics, and leaderboard rankings.
* `bikeController.js`: Core SMS command execution (`borrow`, `done`, `good`, `broken`, `delivered`, `missing`, `points`, `search`, `locations`, `usage`) and dashboard data feeds (`/bicycles`, `/locations`, `/history/:code`).
* `adminController.js`: Administrative operations (CRUD members, bicycles, stations, point overrides, dispute resolution, maintenance queue, honesty logs).
* `facebookWebhookController.js`: Meta Graph API integration for Facebook Messenger. Handles webhook verification (`GET /webhook`), incoming message parsing (`POST /webhook`), session state machine (`fb_bot_sessions`), dispute appeal photo attachments (`dispute_image_url`), volunteer delivery proof verification, interactive Community Service shift scheduling (`SIGNUP_COMMUNITY_SERVICE`), and vertical stacked button templates (`sendFbCompletionButtons`, `sendFbSuspendedButtons`).
* `analyticsController.js`: Decoupled analytics engine that queries `bicycle_history` directly (without strict inner joins on `members` or `bicycle_codes`) so historical trips are never dropped even when bicycles or members are archived. Filters completed rides via `(reported_condition != 'Timeout' OR reported_condition IS NULL)` and supports both **Monthly View** (`period = 'month'`, filtered by `YEAR` + `MONTH`) and **Yearly View** (`period = 'year'`, filtered across all months of a year) along with dynamic available year queries (`LIMIT 15`).
* `helpController.js`: Formulates multi-part help guides and instruction manuals.
* `fallbackController.js`: Gracefully handles and logs unregistered users and unrecognized syntax commands.

---

## 5. Database Architecture & ACID Transaction Management
The relational database layer is powered by **MySQL / MariaDB**, designed with strict foreign key relationships, indexing, and ACID compliance.

### 5.1 Core Database Schema (`schema_update.sql`)
1. **`members` Table:**
   * Stores student identity: `id`, `student_number`, `firstname`, `lastname`, `phone_number` (Unique Indexed), `email`, `is_active`, `is_admin`.
   * **Gamification Columns:** `trust_points` (Default: 100, Hard Cap: 120, Minimum: 0), `leaderboard_points` (No maximum cap, cumulative lifetime score), `consecutive_good_rides` (Streak counter for milestone bonuses).
2. **`bicycle_codes` Table:**
   * Fleet inventory: `id`, `bicycle_code` (Primary Key / Unique), `combination_lock`, `is_active`.
   * **State Tracking:** `condition_status` ENUM (`Good`, `Borrowed`, `Pending_Status`, `Broken`, `In_Repair`, `Missing`, `Disputed`).
   * **Location & Timing:** `current_location`, `new_location`, `broken_reported_at`, `penalty_applied`, `dispute_reported_by`, `dispute_image_url`, `reminder_24h_sent`.
3. **`bicycle_history` Table:**
   * Immutable ride log: `id`, `bicycle_code`, `borrowed_by`, `borrower_phone`, `from_location`, `to_location`, `borrowed_at`, `done_text_received`, `condition_confirmed`, `reported_condition`, `pending_status_time`, `dispute_image_url`.
   * **Automation Flags:** `reminder_1h_sent`, `reminder_4h_sent`, `reminder_pending_sent`, `last_penalty_time`.
4. **`locations` Table:**
   * Station hubs: `id`, `location_name` (e.g., EEE, ENGG, PALMA_HALL, VINZONS, CHK), `is_active`, `is_disabled`.
5. **`fb_bot_sessions` Table:**
   * Facebook Messenger bot state machine: `id`, `psid` (Unique Facebook User ID), `phone_number`, `bot_state` (`IDLE`, `AWAITING_PHONE`, `AWAITING_PHOTO`, `COMPLETED`), `last_updated`.
6. **`Logs` Table:**
   * Complete system audit trail: `id`, `LastName`, `FirstName`, `MobileNumber`, `SenderNumber`, `DateTime`, `Request`, `MessageID`.
7. **`user_sms_inbox` Table:**
   * Cloud database SMS logging bridge: `id`, `SenderNumber`, `TextDecoded`, `ReceivingDateTime`. Populated dynamically during member verification (`/api/members/check`) when `gateway-server` forwards the raw SMS text, ensuring the student dashboard can retrieve real-time text transactions even when Gammu SMSD runs on an isolated local modem PC.
8. **`outbound_sms` Table:**
   * Asynchronous SMS outbox queue: `id`, `phone_number`, `message`, `status`, `created_at`, `sent_at`.
9. **`system_settings` Table:**
   * Dynamic real-time configuration storage (`setting_key`, `setting_value`, `description`). Supports 10 core administrative variables:
     * `honesty_reward`: Points awarded to the previous rider when the next borrower completes their trip (`done`) without reporting issues, confirming the bike was left clean (Default: `5`).
     * `consistent_rider_reward`: Milestone points awarded every 5th consecutive clean ride (Default: `10`).
     * `reward_honest_report`: Points awarded for reporting a broken/missing bike verified by admin (Default: `15`).
     * `reward_community_volunteer`: Points awarded for completing a verified hub volunteer shift (Default: `30`).
     * `reward_delivered_bike`: Points awarded for transporting a broken bike to a repair hub (Default: `5`).
     * `penalty_abandoned_handshake`: Points deducted for failing to confirm condition within 30 mins (Default: `-2`).
     * `penalty_overtime`: Points deducted per hour when exceeding the borrow limit (Default: `-5`).
     * `penalty_hit_and_run`: Points deducted upon Guilty verdict in unreported damage dispute (Default: `-35`).
     * `penalty_false_report`: Points deducted for submitting a false damage/missing report (Default: `-5`).
     * `handshake_timeout_mins`: Minutes allowed before pending handshake expires (Default: `30`).

### 5.2 Application-Level Timezone Synchronization (`+08:00`)
To guarantee accurate timestamp logging across all ride histories, SMS logs, and cron schedules without requiring root-level MySQL server modifications (`SUPER` privileges), the application enforces Philippine Standard Time directly within the Node.js database connection pool (`db.js`):
```javascript
const upbsPool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    timezone: '+08:00', // Explicit Philippine Standard Time synchronization
    waitForConnections: true,
    connectionLimit: 10
});
```

### 5.3 ACID Concurrency Control & Row Locking (`FOR UPDATE`)
A critical engineering challenge in bikeshare systems is **Race Conditions** (e.g., two students texting `1 eee to vinzons` at the exact same millisecond for the last available bike).
To prevent duplicate checkouts or corrupted states, all modifying operations in `bikeController.js` use **Explicit MySQL Transactions with Row-Level Locking (`FOR UPDATE`)**:

```javascript
const upbsConn = await db.upbsPool.getConnection();
try {
    await upbsConn.beginTransaction(); // Start atomic ACID transaction

    // 1. Lock the specific bicycle row exclusively until transaction completes
    const [bikes] = await upbsConn.query(
        "SELECT condition_status, combination_lock FROM bicycle_codes WHERE bicycle_code = ? AND is_active = 1 FOR UPDATE",
        [bicycleCode]
    );

    if (bikes[0].condition_status !== 'Good') {
        await upbsConn.rollback(); // Rollback immediately if already taken
        return res.json({ reply: "Bike unavailable." });
    }

    // 2. Perform state changes safely
    await upbsConn.query("UPDATE bicycle_codes SET condition_status = 'Borrowed', ... WHERE bicycle_code = ?", [bicycleCode]);
    await upbsConn.query("INSERT INTO bicycle_history (...) VALUES (...)");

    await upbsConn.commit(); // Commit transaction and release row lock
} catch (err) {
    await upbsConn.rollback();
    throw err;
} finally {
    upbsConn.release(); // Return connection back to the pool
}
```

---

## 6. Frontend & UI Technology Stack
The User Interface (`dashboard/`) is a sleek, modern web application designed with state-of-the-art aesthetics, responsiveness, and accessibility without relying on heavy frontend compilation pipelines (no Webpack/Vite build steps needed for production deployment).

### 6.1 Core Frontend Technologies
* **Markup:** Clean, semantic **HTML5** (`student-dashboard.html`, `index.html`).
* **CSS Framework:** **Bootstrap 5 (v5.3)** is utilized for its robust layout grid system (`container-fluid`, `row`, `col-md-6`, `col-lg-4`), responsive breakpoints, cards, modals, and standardized form elements.
* **Scripting:** Pure **Vanilla JavaScript (ES6+)** using modern browser features:
  * Async/Await & Fetch API (`fetch()`) for non-blocking REST API calls.
  * Dynamic DOM construction (`document.createElement`, `innerHTML`, `classList`).
  * Event delegation and local storage session caching (`localStorage.getItem('upbs_token')`).
* **Data Visualization:** **Chart.js** library used in `analytics.js` to generate responsive HTML5 `<canvas>` visualizations (Linear Gradient Line Charts for trip history, Bar Charts for station usage, Pie Charts for fleet health).
* **Iconography:** **Boxicons** (`<i class='bx bx-bicycle'></i>`, `<i class='bx bxs-award'></i>`) combined with custom inline **SVG micro-icons**.

### 6.2 Custom Design System & Aesthetics (`style.css`, `student.css`, `variables.css`)
To elevate the visual experience beyond generic Bootstrap defaults, a custom design system was engineered:
* **Curated Color Tokens (CSS Variables):**
  * `--up-maroon: #7b1113;` (Primary University Branding)
  * `--up-maroon-dark: #580c0e;` / `--up-maroon-light: #a3171a;`
  * `--up-green: #006a4e;` (Secondary Accent / Success / Trust Points)
  * `--bg-main: #0a0a0c;` / `--bg-panel: #141418;` (Sleek Dark Mode Aesthetics)
  * `--text-h: #ffffff;` / `--text: #c9c9d1;` / `--text-muted: #828291;`
* **Glassmorphism & Elevational Depth:** Panels, cards, and modals utilize semi-transparent rgba backgrounds combined with backdrop blurring (`backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);`) and multi-layered box shadows (`box-shadow: 0 32px 72px rgba(0, 0, 0, 0.4);`).
* **Dynamic Micro-Animations:**
  * `@keyframes qs-slide-up`: Smooth modal entrance scaling (`transform: translateY(32px) scale(0.97)` to `scale(1)`).
  * `@keyframes fadeIn`: Smooth page tab transitions.
  * Interactive hover states (`transform: translateY(-3px); box-shadow: 0 12px 28px rgba(123, 17, 19, 0.3);`).
* **Responsive Mobile Optimization (`@media (max-width: 768px)`):**
  * Custom media queries ensure modals (like the Quick Start Guide) adapt to phone screens cleanly:
    ```css
    @media (max-width: 768px) {
        .quickstart-modal { width: 90% !important; max-width: 330px !important; max-height: 68vh !important; }
        .qs-step { padding: 1rem 1rem 0.25rem !important; gap: 0.45rem !important; }
        .qs-icon-wrap { width: 36px !important; height: 36px !important; }
        .qs-title { font-size: 0.98rem !important; }
    }
    ```

### 6.3 Modular Frontend Architecture
* `student.js`: Powers the Student Portal. Manages authentication state, renders user trust score and leaderboard ranking, dynamically displays campus bike availability, and controls the multi-step interactive Quick Start Guide modal with smooth pagination.
* `admin.js`: Powers the Admin Portal. Handles tabbed navigation (Fleet, Members, Stations, Analytics, Settings, Logs).
* `admin-search.js`: Real-time filtering and live table rendering for bicycles and student records.
* `settings.js`: Interface for adjusting system variables (timeout durations, reward points, borrow limits) via `/api/admin/settings`, rendered inside a responsive floating modal card (`#settings-card`) with fixed header controls and a scrollable body so it remains fully accessible and never stretches off-screen on mobile viewports.
* `analytics.js`: Fetches aggregate backend metrics and paints dynamic Chart.js canvas graphs. Features an interactive Year Selector built with an `<input type="number">` paired with a `<datalist>`, allowing administrators to either type any custom historical year directly or choose from dynamically fetched recent years (`LIMIT 15`) without dropdown list overflow.
* `theme.js`: Handles instant Dark/Light theme toggling via `data-theme` attribute on the HTML root.

### 6.4 Leaderboard & Gamification Architecture
To maximize student engagement across campus, the dashboard implements a dual-scoring gamification engine:
* **Trust Points vs. Leaderboard Points:** While `trust_points` track account standing and safety (capped at a maximum of `120`), `leaderboard_points` accumulate indefinitely without a ceiling to rank competitive campus activity.
* **Curated Rank Badges & Titles:** Students achieve distinct interactive titles displayed on the leaderboard:
  * 👑 **Oble's Speedster / Campus Champion:** Top overall ranked riders.
  * 🛡️ **Bike Guardian / Trusted Rider:** Awarded for maintaining a 100% clean record with 0 dispute tickets.
  * 🌱 **Eco Warrior:** Top riders who have offset the most carbon emissions.
  * ⚡ **Early Bird / 🦉 Sunset Cruiser:** Awarded based on time-of-day borrowing habits.
* **Impact Calculations:** Real-time environmental metrics computed per trip:
  * **CO₂ Emissions Saved:** Estimated at `~200g` of carbon offset per campus trip compared to motorized transit.
  * **Calories Burned:** Estimated at `~35 kcal` burned per loop around campus academic buildings.
* **Competitive Filter Tabs:** Supports filtering by **Weekly Sprint** (resets weekly for fair new-rider competition), **All-Time Hall of Fame**, and team competitions (**Inter-College / Department Wars** and **Dormitory Leaderboards**).

---

## 7. Automated Background Job Scheduler (`node-cron`)
Because students may forget to text `done` or confirm condition handshakes, the Worker API runs an automated background scheduler (`worker-api/services/cronJobs.js`) powered by `node-cron`.

### 7.1 Scheduled Job Specifications
| Job Name | Cron Expression | Execution Frequency | Target Condition | Action / Automated Trigger |
| :--- | :---: | :---: | :--- | :--- |
| **1-Hour Ride Reminder** | `0 * * * *` | Hourly | Bike `Borrowed` for >= 1 hour & `reminder_1h_sent = 0` | Dispatches check-in SMS: *"Hope you're enjoying the ride! Remember to text 'done'..."* |
| **Dynamic Overtime Warning**| `0 * * * *` | Hourly | Bike `Borrowed` approaching max limit hours | Calculates remaining hours and sends warning SMS to return bike soon. |
| **Overtime Penalty Alert** | `0 * * * *` | Hourly | Bike `Borrowed` exceeding max duration limit | Applies dynamic demerit (default: **−5 pts/hr**), logs penalty, sends violation alert SMS. |
| **5-Min Handshake Reminder**| `*/2 * * * *` | Every 2 Mins | Bike in `Pending_Status` for > 5 mins & `reminder_pending_sent = 0` | Sends reminder SMS to confirm condition (`GOOD`/`BROKEN`) and save local photo proof. |
| **Handshake Timeout Expiry**| `*/5 * * * *` | Every 5 Mins | Bike in `Pending_Status` for > `handshake_timeout_mins` (30 mins) | Auto-finalizes trip as `Good`, applies abandoned handshake penalty (**dynamic via `penalty_abandoned_handshake`, default: −2 pts**), sends alert SMS. |
*(Note: 24-Hour Repair Warning and 48-Hour Damage Penalty timers were removed/disabled under the organization's community volunteer repair policy).*

---

## 8. Network Routing, Security & Inter-Process Communication (IPC)
Because the system operates across multiple ports and handles sensitive student data and hardware execution, multi-layered security protocols are enforced.

### 8.1 Inter-Process Communication (Gateway ➔ Worker)
* **Private API Token (`x-gateway-secret`):** The Gateway Server on Port 3000 and Worker API Server on Port 3001 communicate over HTTP REST JSON. To prevent external users or malicious local scripts from bypassing the GSM modem and triggering fake borrow/return events directly on Port 3001, every SMS webhook request must include the header:
  ```http
  x-gateway-secret: <process.env.GATEWAY_SECRET>
  ```
* In `worker-api/routes/api.js`, the `verifyGateway` middleware intercepts every request:
  ```javascript
  const verifyGateway = (req, res, next) => {
      const token = req.headers['x-gateway-secret'];
      if (!token || token !== process.env.GATEWAY_SECRET) {
          console.log(`[Security] Blocked unauthorized gateway attempt from IP: ${req.ip}`);
          return res.status(403).json({ error: 'Unauthorized Gateway' });
      }
      next();
  };
  ```

### 8.2 Outgoing SMS Authorization (Worker ➔ Gateway)
When cron jobs in `worker-api` need to send automated SMS reminders, they call `http://localhost:3000/api/sms/send`. This endpoint is secured via an API key header:
```http
x-api-key: <process.env.GATEWAY_API_KEY>
```

### 8.3 Dashboard Authentication & JWT Sessions
* **JSON Web Tokens (JWT):** When a student or administrator logs into the Web Dashboard (`/api/auth/login` or `/api/admin/login`), the server verifies credentials and signs a secure JWT bearer token (`jsonwebtoken`) containing the user's ID, phone number, and role (`is_admin`).
* **Route Protection (`authMiddleware.js`):** All sensitive Dashboard API endpoints (`/api/student/dashboard`, `/api/admin/...`) require the header:
  ```http
  Authorization: Bearer <jwt_token>
  ```
  If expired or tampered with, the server returns `401 Unauthorized` and redirects the browser to the login page.

### 8.4 Git Secrets & Environmental Security (`.gitignore`)
To adhere to zero-trust security standards and prevent automated credential leak detection alerts (such as GitGuardian false alarms), all local environment configuration files (`.env`, `.env.example`, and `.env.production`) are explicitly excluded from version control via `.gitignore`. Sensitive tokens—including `FB_PAGE_ACCESS_TOKEN`, `FB_VERIFY_TOKEN`, `GATEWAY_API_KEY`, `JWT_SECRET`, and MySQL database credentials—are loaded exclusively at runtime from isolated host environments.

---

## 9. Deployment & Server Engineering
The application is engineered for reliable, unattended continuous operation on a Linux production host (e.g., Ubuntu Server at `192.168.1.10`).

### 9.1 Process Automation via Linux `systemd`
Instead of running manual terminal sessions that terminate when SSH closes, the two microservices are registered as native Linux system daemons (`.service` files in `/etc/systemd/system/`).

#### `bikeshare-gateway.service`:
```ini
[Unit]
Description=UP Bikeshare Gateway Server (Port 3000 & Gammu Interface)
After=network.target mysql.service gammu-smsd.service

[Service]
Type=simple
User=stph
WorkingDirectory=/home/stph/bikeshareAPI_2/gateway-server
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

#### `bikeshare-worker.service`:
```ini
[Unit]
Description=UP Bikeshare Worker API & Cron Scheduler (Port 3001)
After=network.target mysql.service bikeshare-gateway.service

[Service]
Type=simple
User=stph
WorkingDirectory=/home/stph/bikeshareAPI_2/worker-api
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### 9.2 Server Management Commands
* **Check Service Health & Uptime:**
  ```bash
  sudo systemctl status bikeshare-gateway bikeshare-worker
  ```
* **View Real-Time Live Logs (SMS tracking & Cron firing):**
  ```bash
  sudo journalctl -u bikeshare-gateway -u bikeshare-worker -f
  ```
* **Restart System After Code Sync:**
  ```bash
  sudo systemctl restart bikeshare-gateway bikeshare-worker
  ```

---

## 🏆 Summary of Architectural Highlights
* **Zero Internet Requirement for Riders:** Complete bike borrow, return, and reporting lifecycle works over standard 2G/3G cellular SMS via AT modem injection.
* **ACID Transaction Safety:** Concurrency-proof database queries utilizing `FOR UPDATE` row locking eliminate race conditions and double-borrow bugs.
* **Fully Automated Accountability:** 5 active background cron jobs monitor timers, enforce handshakes, apply demerits, and reward milestones automatically.
* **Sleek, Lightweight Web UI:** Responsive Bootstrap 5 grid combined with custom Vanilla CSS glassmorphism and Chart.js graphs delivers a premium dashboard without complex build toolchains.
