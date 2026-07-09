# Verification & Test Plan: UP Bikeshare Revisions

This document outlines the step-by-step verification plan to manually test and validate all the security, logical, and structural updates implemented in the UP Bikeshare system.

---

## 📋 General Test Setup
Ensure the following before starting tests:
1. The backend is running on `192.168.100.221:3001` (Worker API) and `3000` (Gateway).
2. You have executed the SQL script in **phpMyAdmin** to insert the new settings (`borrow_time_limit_hours`, `abort_trip_grace_period_mins`, `handshake_timeout_mins`, and `penalty_abandoned_handshake`).
3. You have registered test members in the database (one student borrower, one student reporter, and one admin).
4. All code changes have been pushed to the remote server using the `rsync` command.

---

## 🧪 Test Scenarios

### 1. Dynamic Borrow Time Limits & Warnings
*   **Goal:** Verify that the system dynamically calculates reminders and penalties based on the DB settings.
*   **Steps:**
    1. In **phpMyAdmin** / **Admin Settings Dashboard**, set `borrow_time_limit_hours` to `3`.
    2. Check out a bike: Text `borrow 1 hubA to hubB` to start a trip.
    3. **Cheat Code 1 (Warning):** To test the 1-hour warning without waiting, push the start time 65 minutes into the past:
       ```sql
       UPDATE bicycle_history SET borrowed_at = DATE_SUB(NOW(), INTERVAL 65 MINUTE) ORDER BY id DESC LIMIT 1;
       ```
       *Wait for the 10-minute clock mark. You should receive the Warning SMS.*
    4. **Cheat Code 2 (Penalty):** To test the 3-hour overtime penalty, push it 185 minutes into the past:
       ```sql
       UPDATE bicycle_history SET borrowed_at = DATE_SUB(NOW(), INTERVAL 185 MINUTE) ORDER BY id DESC LIMIT 1;
       ```
       *Wait for the 10-minute clock mark. You should receive the Penalty SMS.*
    5. **Test Hourly Recurrence (Optional):** If you want to simulate another real-world hour passing to get the second hourly penalty instantly, push the penalty timer into the past:
       ```sql
       UPDATE bicycle_history SET last_penalty_time = DATE_SUB(NOW(), INTERVAL 65 MINUTE) ORDER BY id DESC LIMIT 1;
       ```
    6. Once verified, refresh your Student Dashboard to see your newly deducted Trust Points! Then, text `done 1` and `good 1` to close the trip safely.

---

### 2. Active Trip Grace Period (15 Mins)
*   **Goal:** Prevent a user from riding a bike, breaking it, and aborting the trip to shift blame to the previous rider.
*   **Steps:**
    1. First, make sure you don't have any active trips (Text `done 5` and `good 5` if you haven't closed Bike 5).
    2. Check out Bike 1: Text `borrow 1 hubA to hubB`.
    3. Wait **less than 15 minutes** (e.g., just 1 minute) and text `broken 1`.
        *   *Expected outcome:* The active trip is deleted, the previous rider is frozen, and you receive the dispute-success SMS.
    4. Since the trip was deleted, Bike 1 is locked. Let's fix it manually in phpMyAdmin: set Bike 1's `condition_status` back to `Good` in the `bicycle_codes` table so we can test it again.
    5. Check out Bike 1 again: Text `borrow 1 hubA to hubB`.
    6. **Cheat Code (Skip the 15 min wait):** Run this in phpMyAdmin to age your trip by 16 minutes:
       ```sql
       UPDATE bicycle_history SET borrowed_at = DATE_SUB(NOW(), INTERVAL 16 MINUTE) ORDER BY id DESC LIMIT 1;
       ```
    7. Now text `broken 1`.
        *   *Expected outcome:* The active trip is completed normally (not deleted), the bike status is set to `Broken`, the previous user is NOT frozen, and you receive the SMS: *"Notice: Your borrow duration of 16 mins exceeds the 15-min grace period..."*

---

### 3. Return Handshake Timeout Expiry
*   **Goal:** Prevent bikes from locking the system indefinitely in `Pending_Status` if a student forgets to reply to the return check.
*   **Steps:**
    1. Borrow Bike 1 (`borrow 1 hubA to hubB`), then text `done 1`.
    2. The system asks if the bike is GOOD or BROKEN. **Do NOT reply.**
    3. **Cheat Code (Skip the 30 min wait):** Run this in phpMyAdmin to age your pending handshake by 31 minutes:
       ```sql
       UPDATE bicycle_history SET pending_status_time = DATE_SUB(NOW(), INTERVAL 31 MINUTE) ORDER BY id DESC LIMIT 1;
       ```
    4. Wait for the next 5-minute clock mark for the background cron check to run.
    5. **Expected outcome:** 
        *   Bike 1's condition status automatically returns to `Good`.
        *   The active history trip is confirmed (`condition_confirmed = 1`).
        *   Your account is deducted `-2` trust points.
        *   You receive an SMS alert: *"ALERT: You failed to confirm the condition of Bike 1 within 30 minutes. Your trip has been auto-completed..."*

---

### 4. Direct Delivery Auto-Closure & Location Updates
*   **Goal:** Ensure that users can deliver bikes to a station, update the map location, and that the system properly handles both stranded bikes and active trips.
*   **Steps:**
    *   **Option A (Picking up the Broken Bike from Test 2):**
        1. Bike 1 is currently stuck in `Broken` status from the end of Test 2.
        2. Text `delivered 1`.
            *   *Expected outcome:* The system rejects it: *"Please specify the station... Example: delivered 1 engg"*
        3. Text `delivered 1 engg`.
            *   *Expected outcome:* You receive SMS: *"Thank you! Bike 1 has been marked as delivered to ENGG for repair."*
            *   Check `bicycle_codes` table: Bike 1 status is set to `In_Repair` and `new_location` is set to `engg`.
    
    *   **Option B (Direct Delivery of an Active Trip):**
        1. Borrow Bike 2: Text `borrow 2 hubA to hubB` (active checkout).
        2. Instead of texting `broken`, you push it to a hub yourself. Text `delivered 2 chk`.
        3. **Expected outcome:** 
            *   You receive SMS: *"Thank you! Bike 2 has been marked as delivered to CHK for repair."*
            *   Check `bicycle_history` table: your active trip is closed automatically, and you are NOT penalized.
            *   Check `bicycle_codes` table: Bike 2 status is set to `In_Repair` and `new_location` is set to `chk`.

---

### 5. Double-Reporting Prevention of Under-Repair Bikes
*   **Goal:** Prevent users from submitting redundant broken/missing reports on bikes that are already flagged for maintenance.
*   **Steps:**
    1. Ensure Bike 1 is in `In_Repair` status.
    2. As a different user, text `broken 1`.
        *   *Expected outcome:* Request is blocked. Reply received: *"Bike 1 is currently reported as delivered and undergoing repairs."*
    3. Text `missing 1`.
        *   *Expected outcome:* Request is blocked. Reply received: *"Bike 1 is currently undergoing repairs."*

---

### 6. Auto-Close Trips on Bike Retirement (Soft-Delete)
*   **Goal:** Prevent a user from being locked out of the system forever if an admin retires (deletes) the bike they are currently borrowing.
*   **Steps:**
    1. Borrow Bike 1.
    2. Log into the **Admin Settings Dashboard**, go to **Bicycle Fleet**, find Bike 1, and click **Delete** (soft-delete).
    3. **Expected outcome:**
        *   Bike 1 `is_active` status in `bicycle_codes` changes to `0`.
        *   Check `bicycle_history` table: your trip for Bike 1 is automatically closed (`done_text_received = 1`, `condition_confirmed = 1`).
        *   You are free to borrow another active bike immediately.

---

### 7. Auto-Release Bike on Member Deactivation
*   **Goal:** Ensure that if an admin deactivates a user who currently has a bike checked out, the bike is released back into service immediately.
*   **Steps:**
    1. Borrow Bike 1.
    2. Log into the **Admin Settings Dashboard**, go to **Registered Members**, and click **Delete** on your test member account.
    3. **Expected outcome:**
        *   The member's account `is_active` changes to `0`.
        *   Bike 1's condition status is automatically set to `Good` (released).
        *   The active history record is closed.

---

### 8. Deactivation of Unrepaired Damage Demerits
*   **Goal:** Ensure users are never penalized for unrepaired damages because the organization covers all repairs.
*   **Steps:**
    1. Report Bike 1 as broken (`broken 1`).
    2. Leave it unrepaired in `'Broken'` or `'In_Repair'` status for over 48 hours.
    3. **Expected outcome:**
        *   Confirm that the borrower does **not** receive warning reminders after 24 hours.
        *   Confirm that the borrower's account is **not** penalized `-10` points after 48 hours.

---

### 9. Transactional Safety & Concurrency Locking (Race Conditions)
*   **Goal:** Verify that rapid concurrent requests (e.g. done spamming) are locked sequentially and do not result in double processing or double honesty rewards.
*   **Steps:**
    1. Borrow Bike 1.
    2. Use a REST client or scripts to send two simultaneous requests to `/api/done` with `smsSender` and `bicycleCode = 1`.
    3. **Expected outcome:**
        *   The first request obtains a row-level lock (`FOR UPDATE`) on both `bicycle_codes` and `bicycle_history`, completes the transaction, and sets the status to `Pending_Status`.
        *   The second request blocks, waits, resumes once the lock is released, detects that `done_text_received` is already `1`, rolls back safely, and returns a warning: *"Trip has already been ended..."*
        *   The previous user is only awarded the honesty reward exactly once.

---

### 10. Phone-Based Naming Collision Isolation
*   **Goal:** Verify that if two members have the exact same name, checkouts and background penalties only affect the actual borrower.
*   **Steps:**
    1. Register two members:
        *   Member A: `firstname = 'Juan'`, `lastname = 'Cruz'`, `phone_number = '+639171111111'`.
        *   Member B: `firstname = 'Juan'`, `lastname = 'Cruz'`, `phone_number = '+639172222222'`.
    2. Have Member A borrow Bike 1.
    3. Verify in the database `bicycle_history` table that the new record is marked with `borrower_phone = '+639171111111'`.
    4. Force a timeout or a 6-hour overtime reminder:
        *   **Expected outcome:** Only Member A's phone number receives the alert and/or demerit. Member B's account, points, and status are completely unaffected.

---

### 11. Building Search Availability Filter
*   **Goal:** Ensure that users looking for bikes only see ones that are physically at the station and available to ride.
*   **Steps:**
    1. Set Bike 1 to `'Borrowed'` at `vinzons`.
    2. Set Bike 2 to `'Broken'` at `vinzons`.
    3. Set Bike 3 to `'Good'` at `vinzons`.
    4. Text `search vinzons`.
    5. **Expected outcome:**
        *   The reply returns: `"Bicycles currently available at vinzons: 3."`
        *   Bike 1 and Bike 2 are filtered out of the available list.

---

### 12. Deactivated Member Commands Blocking
*   **Goal:** Verify that soft-deleted members are blocked from querying the system.
*   **Steps:**
    1. Set a member's `is_active` status to `0`.
    2. Send `points`, `bikeshare help`, or `how` requests from their phone number.
    3. **Expected outcome:**
        *   The system rejects the query and replies: *"Sorry, you are not registered with UP Bike Share."*

---

### 13. Clean Analytics Reports
*   **Goal:** Verify that retired bikes, deactivated members, and closed stations do not skew popularity statistics.
*   **Steps:**
    1. Create 50 trips involving a retired station or retired bike.
    2. Set that location or bike's `is_active` to `0`.
    3. View the Analytics Dashboard.
    4. **Expected outcome:**
        *   The deactivated location/bike is excluded from the popular stations and peak hour reports.

---

### 14. False Reporter Streak Reset
*   **Goal:** Verify that false damage reports reset the reporter's consecutive good rides streak to `0`.
*   **Steps:**
    1. Set Member A's `consecutive_good_rides` count to `10`.
    2. Have Member A report Bike 1 broken, initiating a dispute.
    3. As an admin, resolve the dispute as `'innocent'` (ruling Member A's report as a false report).
    4. **Expected outcome:**
        *   Member A's `trust_points` are penalized by `-5`.
        *   Member A's `consecutive_good_rides` count is reset to `0`.

---

### 15. Dynamic Dashboard Point Synchronization
*   **Goal:** Verify that changing point values in the Admin Dashboard instantly updates the User Dashboard (no hardcoding).
*   **Steps:** 
    1. In the Admin Dashboard, go to **Rules & Points Configuration**.
    2. Change a reward (e.g., Honesty Reward) to `20` and click Save.
    3. Reload the User Dashboard.
    4. **Expected outcome:**
        *   The User Dashboard instantly displays `+20 pts` instead of the old value.

---

### 16. Singular/Plural Grammar Formatting (UI Polish)
*   **Goal:** Verify that the system handles grammar correctly for `1` vs multiple points/bikes.
*   **Steps:** 
    1. In the Admin Dashboard, set a point configuration (e.g. Honesty Reward) to `1`.
    2. Look at the badge on the Admin Dashboard and User Dashboard.
    3. Look at the Active Stations list on the map for a station with exactly 1 bike.
    4. **Expected outcome:**
        *   The dashboards read `+1 pt` instead of `+1 pts`.
        *   The map reads `1 bike` instead of `1 bikes`.

---

### 17. Admin Member Management (Add Points & Deactivate)
*   **Goal:** Verify that the main Dashboard Search Center is strictly view-only, and that member management logic adds points instead of overwriting them.
*   **Steps:** 
    1. In the main Dashboard's Search Center, search for a member. Verify there are no action buttons.
    2. Go to **Settings -> Registered Members**, search the same member, and click **Add Points**.
    3. Enter `10` as the additional points.
    4. **Expected outcome:**
        *   The system accurately *adds* 10 to the total instead of replacing the entire score with 10.
        *   The UI refreshes and immediately shows the new total.

---

### 18. Dynamic Map Station Zooming
*   **Goal:** Verify that newly added stations with arbitrary capitalization can be clicked to pan/zoom the map.
*   **Steps:** 
    1. Add a new station called `New Station`.
    2. Wait for it to appear on the Active Stations list on the Dashboard.
    3. Click on the station name from the Active Stations list.
    4. **Expected outcome:**
        *   The map seamlessly zooms to its location and opens the popup bubble, despite string casing differences.

---

### 19. Boot Grace Period Safety Mechanism
*   **Goal:** Verify that when the server reboots after a power outage, penalty jobs wait 5 minutes before executing, allowing any queued 'done' SMS messages to process first.
*   **Steps:** 
    1. Restart the `bikeshare-worker` terminal or PM2 process.
    2. Watch the console logs immediately upon startup.
    3. **Expected outcome:**
        *   The system logs: `[Cron] Boot grace period started for 5 minutes. Penalty jobs are temporarily locked.`
        *   If the cron job triggers during the first 5 minutes, it logs: `[Cron] Overtime penalty check skipped (Boot Grace Period active).`
        *   After exactly 5 minutes, it logs: `[Cron] Boot grace period ended. Penalty jobs are now fully active.`
