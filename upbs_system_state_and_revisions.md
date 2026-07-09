# UP Bikeshare System (UPBS) Revisions: Developer Division of Labor

This document establishes the division of labor between **Amer** (Backend, DB, & Security) and **Jhirick** (Frontend & Dashboard Integration) for implementing the de-hardcoding and organization-led policy revisions.

---

## 🚀 Prerequisites & Workflow Rules (Conflict Prevention)

To prevent merge conflicts and ensure a smooth integration, both developers must adhere to the following order of operations and rules:

1. **Database Schema Setup First (Critical Prerequisite)**:
   - **Amer** MUST prioritize completing and sharing `worker-api/schema_update.sql` (Task A.1). 
   - **Jhirick** must run Amer's migration script on their local database before testing frontend API integrations to prevent "missing table/column" errors.
   - *Action:* Avoid completely dropping/deleting the database. Use `ALTER TABLE` and `CREATE TABLE IF NOT EXISTS` in migration scripts to preserve existing data.

2. **API Contracts & Payload Synchronization**:
   - Both developers must strictly follow the agreed payload structures (e.g., `waive_penalty` boolean flag, login JSON bodies). Any changes to API endpoint URLs or JSON request/response structures must be communicated immediately.
   - **Amer** must ensure the backend endpoints for Login (`/api/auth/login`) and Settings (`/api/admin/settings`) are functioning before **Jhirick** wires up the frontend fetch requests.
3. **Isolated Workspaces (Zero Code Overlap)**:
   - Git merge conflicts will be naturally avoided if developers stay within their designated directories.
   - **Rule:** Amer strictly works inside the `worker-api/` directory. Jhirick strictly works inside the `dashboard/` directory. Do not modify files in each other's directories without coordination.

---

## 👨‍💻 Developer A (Amer - Worker API, DB, & Security Lead)

Amer is responsible for all database migrations, backend endpoints, scheduled timers (cron jobs), dynamic string queries, OTP logic, and de-hardcoding database queries.

### 1. Database Migrations (`worker-api/schema_update.sql`)
* [x] **Table Upgrades**: Create and run the SQL migrations for:
  - Adding `role VARCHAR(20) DEFAULT 'student'` and `consecutive_good_rides INT DEFAULT 0` to the `members` table.
  - Creating the `system_settings` table to store rules and values dynamically.
* [x] **Defaults Injection**: Populate `system_settings` with the default points settings (e.g., `'penalty_hit_and_run' = -35`, `'suspension_limit' = 50`, etc.).
* [x] **Initial Role Data**: Run a script to set specific existing user phone numbers to have `role = 'admin'` for dashboard management access.

### 2. Cron Jobs cleanup (`worker-api/services/cronJobs.js`)
* [x] **Timer Deletion**: Remove `startUnrepairedDamageJob` (48h countdown) and `start24hReminderJob` (24h warn) from the cron routines.
* [x] **Settings Integration**: Update `startSixHourPenaltyJob` to fetch `'penalty_overtime'` points amount dynamically from the settings table instead of subtracting a hardcoded `-5`.

### 3. Dynamic points & merits logic
* [x] **De-hardcoding Points**: Update the Worker API endpoints (`adminController.js` and `bikeController.js`) to query values from the `system_settings` table before applying additions/subtractions:
  - **Honesty Reward**: Query `'honesty_reward'` in `POST /api/done`.
  - **Borrow threshold**: Query `'suspension_limit'` in `POST /api/borrow`.
  - **Dispute verdicts**: Query `'penalty_hit_and_run'`, `'penalty_false_report'`, and `'reward_honest_report'` in `POST /api/admin/resolve-dispute`.
* [x] **Consistent Rider Routine**:
  - In `POST /api/good` (when trip condition is confirmed Good): Increment user's `consecutive_good_rides`. If it reaches a multiple of 5, reward them with the `'consistent_rider_reward'` points (up to 120 max limit) and trigger an SMS notification.
  - In `POST /api/admin/resolve-dispute`: If a user is found Guilty, reset `consecutive_good_rides` to `0`.

### 4. Dynamic Hub Locations SMS listing
* [x] **Dynamic Locations**: Update `/api/help` and `/api/locations` inside `helpController.js` to query active location names (`SELECT location_name FROM locations WHERE is_active = 1...`) and construct the SMS reply dynamically:
  - `"UPBS Help: To borrow text '[bike] [from] to [to]'. Available stations: " + activeHubs + ". To end trip, text 'done [bike]'."`

### 5. Dispute "Waive" Checkbox Backend handler
* [x] **Waiver Logic**: Update `POST /api/admin/resolve-dispute` to accept `waive_penalty` in the payload.
* [x] **Point Bypass**: If verdict is guilty (or innocent on a false report) and `waive_penalty` is true, resolve the dispute without deducting points from the guilty borrower (or false reporter). Send a custom SMS explaining that the points deduction was waived.


### 6. Authentication API Endpoints
* [x] **Login Endpoint**: Implement `POST /api/auth/login` (checks if the submitted phone number exists in `members` table and returns a signed JWT containing user's `phone_number` and `role`).
* [x] **Admin credentials API**: Maintain the `/api/admin/login` fallback route checking against environment credentials.


---

## 👩💻 Developer B (Jhirick - Frontend & Dashboard Integration Lead)

Jhirick is responsible for updating the unified login layout, creating the Student Dashboard interface, building the Points Configuration settings tab, and adding the dispute resolution waive checkbox.

### 1. Unified Portal Login UI (`dashboard/index.html` & `dashboard/js/settings.js`)
* [x] **UPBS Portal Login design**: Rename the settings panel login card to "UPBS Portal Login".
* [x] **Login Layout**: Add an input field for registered mobile number and a "Sign In" button.
* [x] **Login actions**: Connect buttons to Amer's login endpoint (`/api/auth/login`). Show loading states during authentication.
* [x] **Admin override**: Provide a togglable link ("Admin Credentials Login") to display the original username/password input for system fallbacks.

### 2. View Routing & Access Control
* [x] **Role checking**: On successful login, decode the JWT token (or check the returned JSON payload) to verify the user's role.
* [x] **Dashboard display**:
  - If `role === 'admin'`: Open the full **Management Dashboard** (live occupancy grids, override settings, user search list, dispute resolution cards).
  - If `role === 'student'`: Render the brand-new **Student Dashboard** view.

### 3. Student Dashboard View (`dashboard/index.html` & CSS)
* [x] **Dashboard Panels**: Build the responsive student landing panel showing:
  - **Trust Score Gauge**: An elegant circular SVG progress gauge displaying their trust score (e.g. `95/120`). Animate the meter bar. Color is calculated dynamically in JS: Green for >= 90, Yellow for 60 to 89, Red for < 60.
  - **Active Ride Timer**: If user has an active checkout, show a prominent widget with a ticking clock counting up to the 6-hour limit.
  - **Personal Ride Log**: A table listing the user's personal borrow history (dates, bike code, stations).
  - **Rules Checklist card**: Modern cards outlining the Honesty Policy commands.

### 4. Dispute "Waive" Checkbox UI
* [x] **Checkbox inclusion**: On the dispute cards in the admin members listing, add a checkbox: `[x] Waive standard point penalty` next to the resolution actions.
* [x] **Payload update**: Include `waive_penalty: checkbox.checked` in the body of the fetch request to `/api/admin/resolve-dispute`.

### 5. Points Configuration Tab
* [x] **Tab Navigation**: Add a new tab button **"Points Settings"** in the Admin panel.
* [x] **Settings Grid**: Construct a dashboard table or list of settings cards populated via `GET /api/admin/settings`.
* [x] **Edit modals**: Add edit/save options to update any settings dynamically via `POST /api/admin/settings`.
