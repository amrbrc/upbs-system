// worker-api/services/cronJobs.js
const cron = require('node-cron');
const db = require('../db');

const smsService = require('./smsService');

// Helper function to send SMS via the Gateway API (queues message in DB)
async function sendSMS(phoneNumber, text) {
    return await smsService.queueSMS(phoneNumber, text);
}

// Helper function to dynamically fetch settings from system_settings
async function getSettingValue(name, defaultValue) {
    try {
        const [rows] = await db.upbsPool.query('SELECT setting_value FROM system_settings WHERE setting_name = ?', [name]);
        if (rows.length > 0) {
            return parseInt(rows[0].setting_value, 10);
        }
    } catch (err) {
        console.error(`[Cron] Failed to fetch setting ${name}:`, err);
    }
    return defaultValue;
}

// ---------------------------------------------------------
// BOOT GRACE PERIOD
// Prevents cron penalties from firing immediately upon server
// startup, allowing backlogged Gateway SMS messages (like 'done')
// to process first.
// ---------------------------------------------------------
const BOOT_GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes
let isGracePeriod = true;

setTimeout(() => {
    isGracePeriod = false;
    console.log('[Cron] Boot grace period ended. Penalty jobs are now fully active.');
}, BOOT_GRACE_PERIOD_MS);

console.log(`[Cron] Boot grace period started for 5 minutes. Penalty jobs are temporarily locked.`);


// Job 1 (Every 10 mins): Dynamic active borrow reminders
const startBorrowRemindersJob = () => {
    cron.schedule('*/10 * * * *', async () => {
        try {
            const borrowLimitHours = await getSettingValue('borrow_time_limit_hours', 6);
            const reminder4hThreshold = Math.max(1, borrowLimitHours - 2); // e.g. 4 if limit is 6, or 2 if limit is 4

            console.log(`[Cron] Running borrow reminders check (Limit: ${borrowLimitHours}h, Warning: ${reminder4hThreshold}h)...`);

            // Find active borrowings that need reminders
            const query = `
                SELECT bh.id, bh.bicycle_code, bh.borrowed_by, bh.borrowed_at, 
                       bh.reminder_1h_sent, bh.reminder_4h_sent,
                       bh.borrower_phone AS phone_number
                FROM bicycle_history bh
                JOIN bicycle_codes bc ON bc.bicycle_code = bh.bicycle_code
                WHERE bh.done_text_received = 0 
                  AND bh.condition_confirmed = 0
                  AND bc.condition_status = 'Borrowed'
                  AND bh.borrower_phone IS NOT NULL
                  AND (
                      (bh.reminder_1h_sent = 0 AND bh.borrowed_at < NOW() - INTERVAL 1 HOUR)
                      OR 
                      (bh.reminder_4h_sent = 0 AND bh.borrowed_at < NOW() - INTERVAL ? HOUR)
                  )
            `;
            const [records] = await db.upbsPool.query(query, [reminder4hThreshold]);

            for (const row of records) {
                const borrowTimeMs = Date.now() - new Date(row.borrowed_at).getTime();
                const borrowHours = borrowTimeMs / (1000 * 60 * 60);

                console.log(`[Cron Debug] Row ID: ${row.id}, Bike: ${row.bicycle_code}, borrowed_at: ${row.borrowed_at}, borrowHours: ${borrowHours}`);

                if (row.reminder_4h_sent === 0 && borrowHours >= reminder4hThreshold) {
                    // Send Warning Reminder
                    const hoursLeft = Math.max(1, borrowLimitHours - reminder4hThreshold);
                    const text = `Reminder: You have ${hoursLeft} hour(s) left on Bike ${row.bicycle_code}. Please return it to a station soon. Remember to text 'done ${row.bicycle_code}' when finished.`;
                    const success = await sendSMS(row.phone_number, text);
                    if (success) {
                        await db.upbsPool.query(
                            'UPDATE bicycle_history SET reminder_1h_sent = 1, reminder_4h_sent = 1 WHERE id = ?',
                            [row.id]
                        );
                    }
                } else if (row.reminder_1h_sent === 0 && borrowHours >= 1) {
                    // Send 1-Hour Reminder
                    const text = `Hope you're enjoying the ride! Remember to text 'done ${row.bicycle_code}' when finished.`;
                    const success = await sendSMS(row.phone_number, text);
                    if (success) {
                        await db.upbsPool.query(
                            'UPDATE bicycle_history SET reminder_1h_sent = 1 WHERE id = ?',
                            [row.id]
                        );
                    }
                }
            }
        } catch (err) {
            console.error('[Cron] Error in borrow reminders job:', err);
        }
    }, { suppressMissedWarning: true });
};

// Job 1.5 (Every 10 mins): Dynamic Timeout Penalty
const startSixHourPenaltyJob = () => {
    cron.schedule('*/10 * * * *', async () => {
        if (isGracePeriod) {
            console.log('[Cron] Overtime penalty check skipped (Boot Grace Period active).');
            return;
        }

        try {
            const borrowLimitHours = await getSettingValue('borrow_time_limit_hours', 6);
            console.log(`[Cron] Running ${borrowLimitHours}-Hour borrow limit check...`);

            // Find active borrowings that exceed the borrow limit and haven't been penalized yet
            const query = `
                SELECT bh.id, bh.bicycle_code, bh.borrowed_by, bh.borrowed_at, 
                       bh.borrower_phone AS phone_number
                FROM bicycle_history bh
                JOIN bicycle_codes bc ON bc.bicycle_code = bh.bicycle_code
                WHERE bh.done_text_received = 0 
                  AND bc.condition_status = 'Borrowed'
                  AND bh.borrower_phone IS NOT NULL
                  AND bh.borrowed_at < NOW() - INTERVAL ? HOUR
                  AND (bh.last_penalty_time IS NULL OR bh.last_penalty_time < NOW() - INTERVAL 1 HOUR)
            `;
            const [records] = await db.upbsPool.query(query, [borrowLimitHours]);

            const overtimePenalty = await getSettingValue('penalty_overtime', -5);
            const absolutePenalty = Math.abs(overtimePenalty);

            for (const row of records) {
                console.log(`[Cron] Applying ${borrowLimitHours}-hour penalty for Bike ${row.bicycle_code} to ${row.borrowed_by}`);

                // Deduct points dynamically (adding negative value)
                await db.upbsPool.query(
                    'UPDATE members SET trust_points = GREATEST(0, LEAST(120, CAST(trust_points AS SIGNED) + ?)), leaderboard_points = GREATEST(0, CAST(leaderboard_points AS SIGNED) + ?) WHERE phone_number = ?',
                    [overtimePenalty, overtimePenalty, row.phone_number]
                );

                // Log the penalty
                await db.upbsPool.query(
                    "INSERT INTO Logs (LastName, FirstName, MobileNumber, SenderNumber, DateTime, Request) VALUES (?, ?, ?, ?, NOW(), ?)",
                    ['System', 'Cron Jobs', row.phone_number, row.phone_number, `${borrowLimitHours}-Hour Penalty Applied`]
                );

                // Mark penalty timestamp
                await db.upbsPool.query(
                    'UPDATE bicycle_history SET last_penalty_time = NOW() WHERE id = ?',
                    [row.id]
                );

                const text = `ALERT: You have exceeded the borrow time limit for Bike ${row.bicycle_code}. A -${absolutePenalty} point demerit has been applied. You will continue to lose ${absolutePenalty} demerits EVERY HOUR until the bike is returned.`;
                await sendSMS(row.phone_number, text);

                const notificationService = require('./notificationService');
                await notificationService.checkAndAlertSuspension(row.phone_number);
            }
        } catch (err) {
            console.error('[Cron] Error in dynamic timeout penalty job:', err);
        }
    }, { suppressMissedWarning: true });
};

// Job 2 (Every 2 mins): 5-Minute Pending_Status handshake photo proof reminder
const startHandshakeReminderJob = () => {
    cron.schedule('*/2 * * * *', async () => {
        console.log('[Cron] Running 5-Minute Pending return handshake check...');
        try {
            // Find records in Pending_Status (done_text_received = 1, condition_confirmed = 0)
            // that are older than 5 minutes and haven't had a reminder sent yet
            const query = `
                SELECT bh.id, bh.bicycle_code, bh.borrowed_by, bh.pending_status_time,
                       bh.borrower_phone AS phone_number, bh.reminder_pending_sent, bc.condition_status
                FROM bicycle_history bh
                JOIN bicycle_codes bc ON bc.bicycle_code = bh.bicycle_code
                WHERE bh.done_text_received = 1 
                  AND bh.condition_confirmed = 0
                  AND (bh.reminder_pending_sent = 0 OR bh.reminder_pending_sent IS NULL)
                  AND bc.condition_status = 'Pending_Status'
                  AND bh.borrower_phone IS NOT NULL
                  AND bh.pending_status_time < NOW() - INTERVAL 5 MINUTE
            `;
            const [records] = await db.upbsPool.query(query);

            for (const row of records) {
                console.log(`[Cron] Sending handshake reminder for Bike ${row.bicycle_code}`);
                const text = `Reminder: Confirm condition for Bike ${row.bicycle_code}. Reply 'GOOD ${row.bicycle_code}' or 'BROKEN ${row.bicycle_code}'. Save a photo on your phone as local proof (do not send).`;
                const success = await sendSMS(row.phone_number, text);
                if (success) {
                    await db.upbsPool.query(
                        'UPDATE bicycle_history SET reminder_pending_sent = 1 WHERE id = ?',
                        [row.id]
                    );
                }
            }
        } catch (err) {
            console.error('[Cron] Error in handshake reminder job:', err);
        }
    }, { suppressMissedWarning: true });
};

// Job 3 (Hourly): 48-Hour Unrepaired Damage grace period countdown
const startUnrepairedDamageJob = () => {
    cron.schedule('0 * * * *', async () => {
        console.log('[Cron] Running 48-Hour Unrepaired Damage check...');
        try {
            const query = `
                SELECT bicycle_code, broken_reported_at
                FROM bicycle_codes
                WHERE condition_status = 'Broken'
                  AND broken_reported_at < NOW() - INTERVAL 48 HOUR
                  AND penalty_applied = 0
            `;
            const [brokenBikes] = await db.upbsPool.query(query);

            for (const bike of brokenBikes) {
                const borrowerQuery = `
                    SELECT bh.id AS history_id, bh.borrowed_by, bh.borrower_phone AS phone_number
                    FROM bicycle_history bh
                    WHERE bh.bicycle_code = ?
                      AND bh.borrower_phone IS NOT NULL
                    ORDER BY bh.borrowed_at DESC
                    LIMIT 1
                `;
                const [members] = await db.upbsPool.query(borrowerQuery, [bike.bicycle_code]);

                if (members.length > 0) {
                    const member = members[0];
                    console.log(`[Cron] Applying penalty for Bike ${bike.bicycle_code} to ${member.borrowed_by}`);

                    await db.upbsPool.query(
                        'UPDATE members SET trust_points = GREATEST(0, CAST(trust_points AS SIGNED) - 10), leaderboard_points = GREATEST(0, CAST(leaderboard_points AS SIGNED) - 10) WHERE phone_number = ?',
                        [member.phone_number]
                    );

                    await db.upbsPool.query(
                        'UPDATE bicycle_codes SET penalty_applied = 1 WHERE bicycle_code = ?',
                        [bike.bicycle_code]
                    );

                    const text = `ALERT: The 48-hour grace period to repair Bike ${bike.bicycle_code} has expired. A -10 demerit has been applied to your account.`;
                    await sendSMS(member.phone_number, text);

                    const notificationService = require('./notificationService');
                    await notificationService.checkAndAlertSuspension(member.phone_number);
                }
            }
        } catch (err) {
            console.error('[Cron] Error in unrepaired damage job:', err);
        }
    }, { suppressMissedWarning: true });
};

// Job 4: 24-Hour Repair Warning Reminder
const start24hReminderJob = () => {
    cron.schedule('0 * * * *', async () => {
        console.log('[Cron] Running 24-Hour Repair Warning check...');
        try {
            const query = `
                SELECT bicycle_code, broken_reported_at
                FROM bicycle_codes
                WHERE condition_status = 'Broken'
                  AND broken_reported_at < NOW() - INTERVAL 24 HOUR
                  AND reminder_24h_sent = 0
            `;
            const [brokenBikes] = await db.upbsPool.query(query);

            for (const bike of brokenBikes) {
                const borrowerQuery = `
                    SELECT bh.id AS history_id, bh.borrowed_by, bh.borrower_phone AS phone_number
                    FROM bicycle_history bh
                    WHERE bh.bicycle_code = ?
                      AND bh.borrower_phone IS NOT NULL
                    ORDER BY bh.borrowed_at DESC
                    LIMIT 1
                `;
                const [members] = await db.upbsPool.query(borrowerQuery, [bike.bicycle_code]);

                if (members.length > 0) {
                    const member = members[0];
                    console.log(`[Cron] Sending 24h repair warning for Bike ${bike.bicycle_code}`);

                    const text = `REMINDER: You have 24 hours left to repair Bike ${bike.bicycle_code} before a -10 demerit is applied to your account.`;
                    const success = await sendSMS(member.phone_number, text);

                    if (success) {
                        await db.upbsPool.query(
                            'UPDATE bicycle_codes SET reminder_24h_sent = 1 WHERE bicycle_code = ?',
                            [bike.bicycle_code]
                        );
                    }
                }
            }
        } catch (err) {
            console.error('[Cron] Error in 24h reminder job:', err);
        }
    }, { suppressMissedWarning: true });
};

// Job 5: Dynamic Handshake Timeout Expiry
const startHandshakeTimeoutJob = () => {
    cron.schedule('*/5 * * * *', async () => {
        if (isGracePeriod) {
            console.log('[Cron] Return Handshake Timeout check skipped (Boot Grace Period active).');
            return;
        }

        console.log('[Cron] Running Return Handshake Timeout check...');
        try {
            const timeoutMins = await getSettingValue('handshake_timeout_mins', 30);
            const penalty = await getSettingValue('penalty_abandoned_handshake', -2);
            const absolutePenalty = Math.abs(penalty);

            // Find records in Pending_Status (done_text_received = 1, condition_confirmed = 0)
            // that have exceeded the handshake timeout limit
            const query = `
                SELECT bh.id, bh.bicycle_code, bh.borrowed_by, bh.pending_status_time,
                       bh.borrower_phone AS phone_number
                FROM bicycle_history bh
                JOIN bicycle_codes bc ON bc.bicycle_code = bh.bicycle_code
                WHERE bh.done_text_received = 1 
                  AND bh.condition_confirmed = 0
                  AND bc.condition_status = 'Pending_Status'
                  AND bh.borrower_phone IS NOT NULL
                  AND bh.pending_status_time < NOW() - INTERVAL ? MINUTE
            `;
            const [records] = await db.upbsPool.query(query, [timeoutMins]);

            for (const row of records) {
                console.log(`[Cron] Auto-completing handshake for Bike ${row.bicycle_code} (User: ${row.borrowed_by}) due to timeout`);

                // Start transaction to execute updates atomically
                const conn = await db.upbsPool.getConnection();
                try {
                    await conn.beginTransaction();

                    // Update bike status back to Good
                    await conn.query(
                        "UPDATE bicycle_codes SET condition_status = 'Good' WHERE bicycle_code = ?",
                        [row.bicycle_code]
                    );

                    // Confirm the trip as good
                    await conn.query(
                        "UPDATE bicycle_history SET condition_confirmed = 1, reported_condition = 'Timeout' WHERE id = ?",
                        [row.id]
                    );

                    // Penalize the user for abandoning the handshake (adding a negative value)
                    await conn.query(
                        "UPDATE members SET trust_points = GREATEST(0, LEAST(120, CAST(trust_points AS SIGNED) + ?)), leaderboard_points = GREATEST(0, CAST(leaderboard_points AS SIGNED) + ?) WHERE phone_number = ?",
                        [penalty, penalty, row.phone_number]
                    );

                    // Log the penalty in Logs
                    await conn.query(
                        "INSERT INTO Logs (LastName, FirstName, MobileNumber, SenderNumber, DateTime, Request) VALUES (?, ?, ?, ?, NOW(), ?)",
                        ['System', 'Cron Jobs', row.phone_number, row.phone_number, 'Handshake Timeout Penalty']
                    );

                    await conn.commit();

                    const text = `ALERT: You failed to confirm the condition of Bike ${row.bicycle_code} within ${timeoutMins} minutes. Your trip has been auto-completed, and a -${absolutePenalty} point penalty has been applied to your account.`;
                    await sendSMS(row.phone_number, text);

                } catch (txErr) {
                    await conn.rollback();
                    console.error(`[Cron] Transaction failed for handshake timeout on Bike ${row.bicycle_code}:`, txErr);
                } finally {
                    conn.release();
                }
            }
        } catch (err) {
            console.error('[Cron] Error in handshake timeout job:', err);
        }
    }, { suppressMissedWarning: true });
};

const initCronJobs = () => {
    console.log('[Cron] Initializing background timer tasks...');
    startBorrowRemindersJob();
    startSixHourPenaltyJob();
    startHandshakeReminderJob();
    // startUnrepairedDamageJob(); // Disabled under organization repair policy
    // start24hReminderJob();       // Disabled under organization repair policy
    startHandshakeTimeoutJob();
};

module.exports = { initCronJobs };
