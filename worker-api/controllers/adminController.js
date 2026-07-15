const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const smsService = require('../services/smsService');

async function sendSMS(phone, message) {
    return await smsService.queueSMS(phone, message);
}

// Helper function to dynamically fetch settings from system_settings
async function getSettingValue(name, defaultValue) {
    try {
        const [rows] = await db.upbsPool.query('SELECT setting_value FROM system_settings WHERE setting_name = ?', [name]);
        if (rows.length > 0) {
            return parseInt(rows[0].setting_value, 10);
        }
    } catch (err) {
        console.error(`Failed to fetch setting ${name}:`, err);
    }
    return defaultValue;
}

// POST /api/admin/login
const login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    try {
        const [rows] = await db.upbsPool.query('SELECT * FROM admins WHERE username = ?', [username]);

        if (rows.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid username or password' });
        }

        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (isMatch) {
            const token = jwt.sign({ username: user.username }, process.env.JWT_SECRET || 'upbs-super-secret-key-2026', { expiresIn: '24h' });
            return res.json({ success: true, token });
        } else {
            return res.status(401).json({ success: false, error: 'Invalid username or password' });
        }
    } catch (err) {
        console.error('Error during admin database login, checking env fallback...', err.message);

        // Fallback to environment variables if the admins table doesn't exist
        const envUsername = process.env.ADMIN_USERNAME || 'admin';
        const envPassword = process.env.ADMIN_PASSWORD || 'upbsadmin2026';

        if (username === envUsername && password === envPassword) {
            const token = jwt.sign({ username }, process.env.JWT_SECRET || 'upbs-super-secret-key-2026', { expiresIn: '24h' });
            return res.json({ success: true, token });
        } else {
            return res.status(401).json({ success: false, error: 'Invalid username or password' });
        }
    }
};

// GET /api/admin/members
const getMembers = async (req, res) => {
    try {
        const [rows] = await db.upbsPool.query('SELECT firstname, lastname, phone_number, trust_points, points_frozen, is_active FROM members ORDER BY is_active DESC, lastname ASC, firstname ASC');
        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error in getMembers controller:', err);
        return res.status(500).json({ success: false, error: 'Database error fetching members list' });
    }
};

// POST /api/admin/members
const addMember = async (req, res) => {
    const { firstname, lastname, phone_number } = req.body;

    if (!firstname || !lastname || !phone_number) {
        return res.status(400).json({ success: false, error: 'firstname, lastname, and phone_number are required' });
    }

    try {
        const [existing] = await db.upbsPool.query('SELECT * FROM members WHERE phone_number = ?', [phone_number]);

        if (existing.length > 0) {
            const member = existing[0];
            if (member.is_active === 0 || member.is_active === false) {
                await db.upbsPool.query(
                    "UPDATE members SET firstname = ?, lastname = ?, is_active = 1, role = 'student', trust_points = 100, leaderboard_points = 100, points_frozen = 0 WHERE phone_number = ?",
                    [firstname, lastname, phone_number]
                );

                await sendSMS(phone_number, `Welcome back to UP Bike Share! Your account has been reactivated.`);

                return res.json({ success: true, message: 'User account re-activated and updated successfully!' });
            }
            return res.status(400).json({ success: false, error: 'Phone number already registered' });
        }

        await db.upbsPool.query(
            "INSERT INTO members (firstname, lastname, phone_number, role) VALUES (?, ?, ?, 'student')",
            [firstname, lastname, phone_number]
        );

        await sendSMS(phone_number, `Welcome to UP Bike Share! You are now registered and can start borrowing bikes.`);

        return res.json({ success: true, message: 'User registered successfully!' });
    } catch (err) {
        console.error('Error in addMember controller:', err);
        return res.status(500).json({ success: false, error: 'Database error registering user' });
    }
};

// POST /api/admin/bicycles
const addBicycle = async (req, res) => {
    const { bicycle_code, combination_lock, initial_location } = req.body;

    if (!bicycle_code || !combination_lock || !initial_location) {
        return res.status(400).json({ success: false, error: 'bicycle_code, combination_lock, and initial_location are required' });
    }

    try {
        const [existing] = await db.upbsPool.query('SELECT * FROM bicycle_codes WHERE bicycle_code = ?', [bicycle_code]);
        if (existing.length > 0) {
            const bike = existing[0];
            if (bike.is_active === 0 || bike.is_active === false) {
                await db.upbsPool.query(
                    'UPDATE bicycle_codes SET combination_lock = ?, previous_location = ?, new_location = ?, is_active = 1, condition_status = "Good", is_disabled = 0 WHERE bicycle_code = ?',
                    [combination_lock, initial_location, initial_location, bicycle_code]
                );
                return res.json({ success: true, message: 'Bicycle re-activated and updated successfully!' });
            }
            return res.status(400).json({ success: false, error: 'Bicycle code already exists' });
        }

        await db.upbsPool.query(
            'INSERT INTO bicycle_codes (bicycle_code, combination_lock, previous_location, new_location) VALUES (?, ?, ?, ?)',
            [bicycle_code, combination_lock, initial_location, initial_location]
        );

        return res.json({ success: true, message: 'Bicycle successfully added!' });
    } catch (err) {
        console.error('Error in addBicycle controller:', err);
        return res.status(500).json({ success: false, error: 'Database error adding bicycle' });
    }
};

// POST /api/admin/locations
const addLocation = async (req, res) => {
    const { location_name, latitude, longitude } = req.body;

    if (!location_name || latitude === undefined || longitude === undefined) {
        return res.status(400).json({ success: false, error: 'location_name, latitude, and longitude are required' });
    }

    try {
        const [existing] = await db.upbsPool.query('SELECT * FROM locations WHERE location_name = ?', [location_name]);
        if (existing.length > 0) {
            const loc = existing[0];
            if (loc.is_active === 0 || loc.is_active === false) {
                await db.upbsPool.query(
                    'UPDATE locations SET is_active = 1, is_disabled = 0, latitude = ?, longitude = ? WHERE location_name = ?',
                    [latitude, longitude, location_name]
                );
                return res.json({ success: true, message: 'Station re-activated successfully!' });
            }
            return res.status(400).json({ success: false, error: 'Location name already exists' });
        }

        await db.upbsPool.query(
            'INSERT INTO locations (location_name, is_active, is_disabled, latitude, longitude) VALUES (?, 1, 0, ?, ?)',
            [location_name, latitude, longitude]
        );

        return res.json({ success: true, message: 'Station successfully added!' });
    } catch (err) {
        console.error('Error in addLocation controller:', err);
        return res.status(500).json({ success: false, error: 'Database error adding location' });
    }
};

// POST /api/admin/locations/toggle
const toggleLocation = async (req, res) => {
    const { location_name, is_disabled } = req.body;

    if (!location_name || is_disabled === undefined) {
        return res.status(400).json({ success: false, error: 'location_name and is_disabled are required' });
    }

    try {
        const val = is_disabled ? 1 : 0;
        const [result] = await db.upbsPool.query(
            'UPDATE locations SET is_disabled = ? WHERE location_name = ?',
            [val, location_name]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Location not found' });
        }

        return res.json({ success: true });
    } catch (err) {
        console.error('Error in toggleLocation controller:', err);
        return res.status(500).json({ success: false, error: 'Database error toggling location status' });
    }
};

// POST /api/admin/resolve-dispute
const resolveDispute = async (req, res) => {
    const { phone_number, verdict, bicycle_code, waive_penalty } = req.body;

    if (!phone_number || !verdict || !bicycle_code) {
        return res.status(400).json({ success: false, error: 'phone_number, verdict, and bicycle_code are required' });
    }

    try {
        // Retrieve the dispute_reported_by phone number from bicycle_codes
        const [bike] = await db.upbsPool.query("SELECT dispute_reported_by, condition_status FROM bicycle_codes WHERE bicycle_code = ?", [bicycle_code]);
        const reporterPhone = bike.length > 0 ? bike[0].dispute_reported_by : null;
        const conditionStatus = bike.length > 0 ? bike[0].condition_status : 'Broken';

        const gatewayUrl = process.env.GATEWAY_URL || 'http://localhost:3000';

        // Retrieve reporter's actual name if available
        let reporterLastName = 'System';
        let reporterFirstName = 'Dispute Resolution';
        if (reporterPhone) {
            const [reporterRows] = await db.upbsPool.query("SELECT firstname, lastname FROM members WHERE phone_number = ?", [reporterPhone]);
            if (reporterRows.length > 0) {
                reporterLastName = reporterRows[0].lastname;
                reporterFirstName = reporterRows[0].firstname;
            }
        }

        if (verdict === 'guilty') {
            const hitAndRunPenalty = await getSettingValue('penalty_hit_and_run', -35);
            const absolutePenalty = Math.abs(hitAndRunPenalty);

            if (waive_penalty === true || waive_penalty === 'true') {
                // Reset frozen status and consecutive good rides but do not deduct points
                await db.upbsPool.query(
                    "UPDATE members SET points_frozen = 0, consecutive_good_rides = 0 WHERE phone_number = ?",
                    [phone_number]
                );
            } else {
                // Deduct points dynamically (adding a negative number)
                await db.upbsPool.query(
                    "UPDATE members SET points_frozen = 0, consecutive_good_rides = 0, trust_points = GREATEST(0, LEAST(120, CAST(trust_points AS SIGNED) + ?)), leaderboard_points = GREATEST(0, CAST(leaderboard_points AS SIGNED) + ?) WHERE phone_number = ?",
                    [hitAndRunPenalty, hitAndRunPenalty, phone_number]
                );

                const notificationService = require('../services/notificationService');
                await notificationService.checkAndAlertSuspension(phone_number);
            }

            if (conditionStatus === 'Missing') {
                await db.upbsPool.query("UPDATE bicycle_codes SET condition_status = 'Missing', dispute_reported_by = NULL WHERE bicycle_code = ?", [bicycle_code]);
            } else {
                await db.upbsPool.query("UPDATE bicycle_codes SET condition_status = 'Broken', dispute_reported_by = NULL, dispute_image_url = NULL, broken_reported_at = NOW(), penalty_applied = 0 WHERE bicycle_code = ?", [bicycle_code]);
            }

            // Set the borrower's history record to reflect the truth
            const [lastTrip] = await db.upbsPool.query(
                "SELECT id FROM bicycle_history WHERE bicycle_code = ? AND (borrower_phone = ? OR (borrower_phone IS NULL AND borrowed_by = (SELECT CONCAT(firstname, ' ', lastname) FROM members WHERE phone_number = ?))) ORDER BY borrowed_at DESC LIMIT 1",
                [bicycle_code, phone_number, phone_number]
            );
            if (lastTrip.length > 0) {
                await db.upbsPool.query(
                    "UPDATE bicycle_history SET condition_confirmed = 1, reported_condition = ? WHERE id = ?",
                    [conditionStatus, lastTrip[0].id]
                );
            }

            // Text the borrower that they are guilty
            let message;
            if (conditionStatus === 'Missing') {
                message = (waive_penalty === true || waive_penalty === 'true')
                    ? `Notice: You were found responsible for losing Bike ${bicycle_code}, but the admin waived your penalty points this time.`
                    : `Notice: You were found responsible for losing Bike ${bicycle_code}. ${absolutePenalty} points were deducted from your trust points.`;
            } else {
                message = (waive_penalty === true || waive_penalty === 'true')
                    ? "Notice: You were found responsible for bike damage, but the admin has opted to waive your penalty points this time. Please be careful next time."
                    : `You have been proven guilty of unreported damage (Hit-and-Run) on a bike. ${absolutePenalty} points were deducted from your trust points.`;
            }

            await sendSMS(phone_number, message);

            // Reward and text the reporter
            if (reporterPhone) {
                const reward = await getSettingValue('reward_honest_report', 5);
                // Reward the reporter (ceiling 120)
                await db.upbsPool.query("UPDATE members SET trust_points = LEAST(120, CAST(trust_points AS SIGNED) + ?), leaderboard_points = CAST(leaderboard_points AS SIGNED) + ? WHERE phone_number = ?", [reward, reward, reporterPhone]);

                // Log the reward
                await db.upbsPool.query(
                    "INSERT INTO Logs (LastName, FirstName, MobileNumber, SenderNumber, DateTime, Request) VALUES (?, ?, ?, ?, NOW(), ?)",
                    [reporterLastName, reporterFirstName, reporterPhone, reporterPhone, 'Conflict Report Reward']
                );

                const reporterMsg = (conditionStatus === 'Missing')
                    ? `Missing report verified! Bike ${bicycle_code} confirmed missing. +${reward} pts added to your trust points. Thank you!`
                    : `The dispute you reported has been resolved. The previous user was penalized. You have earned +${reward} trust points. Thank you for keeping our bikes safe!`;

                await sendSMS(reporterPhone, reporterMsg);
            }

        } else if (verdict === 'innocent') {
            await db.upbsPool.query("UPDATE members SET points_frozen = 0 WHERE phone_number = ?", [phone_number]);
            await db.upbsPool.query("UPDATE bicycle_codes SET condition_status = 'Good', dispute_reported_by = NULL, dispute_image_url = NULL, broken_reported_at = NULL WHERE bicycle_code = ?", [bicycle_code]);

            // Text the borrower that they are innocent
            const innocentMsg = (conditionStatus === 'Missing')
                ? `The missing report for Bike ${bicycle_code} was resolved in your favor. No points deducted.`
                : `The dispute has been resolved in your favor (Innocent). No trust points were deducted from your account.`;
            await sendSMS(phone_number, innocentMsg);

            if (reporterPhone) {
                if (waive_penalty === true || waive_penalty === 'true') {
                    // Reset consecutive good rides but do NOT deduct penalty points from the false reporter
                    await db.upbsPool.query("UPDATE members SET consecutive_good_rides = 0 WHERE phone_number = ?", [reporterPhone]);

                    // Log the false report waiver
                    await db.upbsPool.query(
                        "INSERT INTO Logs (LastName, FirstName, MobileNumber, SenderNumber, DateTime, Request) VALUES (?, ?, ?, ?, NOW(), ?)",
                        [reporterLastName, reporterFirstName, reporterPhone, reporterPhone, 'False Report Waived']
                    );

                    // Text the false reporter about the waiver
                    const waiverMsg = (conditionStatus === 'Missing')
                        ? `Notice: Your missing report for Bike ${bicycle_code} was unverified. Your penalty was waived by admin this time.`
                        : `Notice: Your damage report was unverified. Your false report point penalty was waived by admin this time. Please inspect bikes carefully next time.`;
                    await sendSMS(reporterPhone, waiverMsg);
                } else {
                    const penalty = await getSettingValue('penalty_false_report', -5);
                    const absolutePenalty = Math.abs(penalty);
                    // Penalize the false reporter (adding a negative number) and reset consecutive good rides
                    await db.upbsPool.query("UPDATE members SET trust_points = GREATEST(0, LEAST(120, CAST(trust_points AS SIGNED) + ?)), leaderboard_points = GREATEST(0, CAST(leaderboard_points AS SIGNED) + ?), consecutive_good_rides = 0 WHERE phone_number = ?", [penalty, penalty, reporterPhone]);

                    // Log the false report penalty
                    await db.upbsPool.query(
                        "INSERT INTO Logs (LastName, FirstName, MobileNumber, SenderNumber, DateTime, Request) VALUES (?, ?, ?, ?, NOW(), ?)",
                        [reporterLastName, reporterFirstName, reporterPhone, reporterPhone, 'False Report Penalty']
                    );

                    // Text the false reporter about their points deduction
                    const penaltyMsg = (conditionStatus === 'Missing')
                        ? `Your missing report for Bike ${bicycle_code} was found false. A ${absolutePenalty}-point penalty was applied.`
                        : `Your recent damage report was found to be false. A ${absolutePenalty}-point penalty has been applied to your trust points.`;
                    await sendSMS(reporterPhone, penaltyMsg);

                    const notificationService = require('../services/notificationService');
                    await notificationService.checkAndAlertSuspension(reporterPhone);
                }
            }
        } else if (verdict === 'neutral') {
            await db.upbsPool.query("UPDATE members SET points_frozen = 0 WHERE phone_number = ?", [phone_number]);

            if (conditionStatus === 'Missing') {
                await db.upbsPool.query("UPDATE bicycle_codes SET condition_status = 'Missing', dispute_reported_by = NULL WHERE bicycle_code = ?", [bicycle_code]);
            } else {
                await db.upbsPool.query("UPDATE bicycle_codes SET condition_status = 'Broken', dispute_reported_by = NULL, dispute_image_url = NULL, broken_reported_at = NOW(), penalty_applied = 0 WHERE bicycle_code = ?", [bicycle_code]);
            }

            // Text the borrower
            const neutralMsg = conditionStatus === 'Missing' ?
                `The missing report for Bike ${bicycle_code} was resolved neutrally (external factor). No penalty points were deducted from your account.` :
                `The dispute has been resolved neutrally (external damage). The bike is broken, but no points were deducted from your account.`;

            await sendSMS(phone_number, neutralMsg);

            // Text the reporter
            if (reporterPhone) {
                const reward = await getSettingValue('reward_honest_report', 5);
                // Reward the reporter with points for correctly identifying a broken bike (ceiling 120)
                await db.upbsPool.query("UPDATE members SET trust_points = LEAST(120, CAST(trust_points AS SIGNED) + ?), leaderboard_points = CAST(leaderboard_points AS SIGNED) + ? WHERE phone_number = ?", [reward, reward, reporterPhone]);

                // Log the reward
                await db.upbsPool.query(
                    "INSERT INTO Logs (LastName, FirstName, MobileNumber, SenderNumber, DateTime, Request) VALUES (?, ?, ?, ?, NOW(), ?)",
                    [reporterLastName, reporterFirstName, reporterPhone, reporterPhone, 'Neutral Report Reward']
                );

                const neutralReporterMsg = (conditionStatus === 'Missing')
                    ? `The missing bike report has been resolved neutrally (external factor). You have earned +${reward} trust points for alerting us. Thank you!`
                    : `The dispute you reported has been resolved neutrally (external damage). You have earned +${reward} trust points for accurately reporting the broken bike. Thank you!`;
                await sendSMS(reporterPhone, neutralReporterMsg);
            }
        }
        return res.json({ success: true, message: `Dispute resolved as ${verdict}.` });
    } catch (err) {
        console.error('Error resolving dispute:', err);
        return res.status(500).json({ success: false, error: 'Database error' });
    }
};

// GET /api/admin/search/bicycles
const searchBicycles = async (req, res) => {
    const query = req.query.q || '';
    try {
        let sql = "SELECT * FROM bicycle_codes WHERE (is_active = 1 OR is_active IS NULL)";
        let params = [];
        if (query.trim() !== '') {
            sql += " AND bicycle_code LIKE ?";
            params.push(`%${query.trim()}%`);
        }
        sql += " LIMIT 50";
        const [rows] = await db.upbsPool.query(sql, params);
        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, error: 'Database error' });
    }
};

// GET /api/admin/search/members
const searchMembers = async (req, res) => {
    const query = req.query.q || '';
    const cleanQuery = query.trim().replace(/[\s\-\(\)]/g, '');
    const phoneQuery = cleanQuery.replace(/^(\+63|63|0)(?=9)/, '');
    try {
        const [rows] = await db.upbsPool.query(
            "SELECT firstname, lastname, phone_number, trust_points, points_frozen FROM members WHERE (phone_number LIKE ? OR phone_number LIKE ? OR firstname LIKE ? OR lastname LIKE ?) AND (is_active = 1 OR is_active IS NULL) LIMIT 50",
            [`%${query.trim()}%`, `%${phoneQuery}%`, `%${query.trim()}%`, `%${query.trim()}%`]
        );
        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, error: 'Database error' });
    }
};

const overrideBicycle = async (req, res) => {
    const { bicycle_code, combination_lock, condition_status, new_location } = req.body;

    if (!combination_lock && !condition_status && !new_location) {
        return res.status(400).json({ success: false, error: 'At least one field (combination_lock, condition_status, or new_location) is required' });
    }

    let conn;
    try {
        conn = await db.upbsPool.getConnection();
        await conn.beginTransaction();

        let updateQuery = "UPDATE bicycle_codes SET ";
        let params = [];
        if (combination_lock) { updateQuery += "combination_lock = ?, "; params.push(combination_lock); }
        if (condition_status) {
            updateQuery += "condition_status = ?, ";
            params.push(condition_status);
            if (condition_status === 'Good') {
                updateQuery += "broken_reported_at = NULL, ";
            } else if (condition_status === 'Broken' || condition_status === 'Disputed' || condition_status === 'Missing') {
                updateQuery += "broken_reported_at = COALESCE(broken_reported_at, NOW()), ";
            }
        }
        if (new_location) { updateQuery += "new_location = ?, previous_location = ?, "; params.push(new_location, new_location); }
        updateQuery = updateQuery.slice(0, -2) + " WHERE bicycle_code = ? AND (is_active = 1 OR is_active IS NULL)";
        params.push(bicycle_code);

        await conn.query(updateQuery, params);

        if (condition_status && condition_status !== 'Borrowed' && condition_status !== 'Pending_Status') {
            const [activeTrips] = await conn.query(
                "SELECT id FROM bicycle_history WHERE bicycle_code = ? AND (done_text_received = 0 OR condition_confirmed = 0) ORDER BY borrowed_at DESC LIMIT 1 FOR UPDATE",
                [bicycle_code]
            );
            if (activeTrips.length > 0) {
                let reported = 'Good';
                if (condition_status === 'Broken' || condition_status === 'In_Repair') {
                    reported = 'Broken';
                } else if (condition_status === 'Missing') {
                    reported = 'Missing';
                }
                await conn.query(
                    "UPDATE bicycle_history SET done_text_received = 1, condition_confirmed = 1, reported_condition = ? WHERE id = ?",
                    [reported, activeTrips[0].id]
                );
            }
        }

        await conn.commit();
        return res.json({ success: true, message: 'Bicycle successfully updated.' });
    } catch (err) {
        console.error(err);
        if (conn) {
            try {
                await conn.rollback();
            } catch (rbErr) { }
        }
        return res.status(500).json({ success: false, error: 'Database error' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// GET /api/admin/maintenance
const getMaintenanceQueue = async (req, res) => {
    try {
        const query = `
            SELECT b.bicycle_code, b.new_location, b.condition_status, b.dispute_image_url, b.dispute_reported_by,
                   (SELECT bh.borrower_phone 
                    FROM bicycle_history bh 
                    WHERE bh.bicycle_code = b.bicycle_code 
                    ORDER BY bh.borrowed_at DESC 
                    LIMIT 1) AS last_user_phone,
                   (SELECT CONCAT(m.firstname, ' ', m.lastname)
                    FROM members m
                    WHERE m.phone_number = (
                        SELECT bh2.borrower_phone 
                        FROM bicycle_history bh2 
                        WHERE bh2.bicycle_code = b.bicycle_code 
                        ORDER BY bh2.borrowed_at DESC 
                        LIMIT 1
                    )) AS last_user_name,
                   COALESCE(b.dispute_reported_by, (
                        SELECT bh4.borrower_phone 
                        FROM bicycle_history bh4 
                        WHERE bh4.bicycle_code = b.bicycle_code 
                        ORDER BY bh4.borrowed_at DESC 
                        LIMIT 1
                   )) AS reporter_phone,
                   (SELECT CONCAT(m2.firstname, ' ', m2.lastname)
                    FROM members m2
                    WHERE m2.phone_number = COALESCE(b.dispute_reported_by, (
                        SELECT bh5.borrower_phone 
                        FROM bicycle_history bh5 
                        WHERE bh5.bicycle_code = b.bicycle_code 
                        ORDER BY bh5.borrowed_at DESC 
                        LIMIT 1
                    ))) AS reporter_name,
                    COALESCE(b.broken_reported_at, (
                        SELECT MAX(bh3.borrowed_at)
                        FROM bicycle_history bh3
                        WHERE bh3.bicycle_code = b.bicycle_code
                    )) AS last_activity
            FROM bicycle_codes b
            WHERE b.condition_status IN ('Broken', 'Missing', 'Disputed', 'In_Repair', 'Pending_Delivery') 
              AND (b.is_active = 1 OR b.is_active IS NULL)
            ORDER BY last_activity DESC, b.bicycle_code ASC
        `;
        const [rows] = await db.upbsPool.query(query);
        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, error: 'Database error' });
    }
};

// GET /api/admin/honesty
const getHonestyLogs = async (req, res) => {
    try {
        const query = `
            SELECT FirstName, LastName, MobileNumber, SenderNumber, DateTime, Request, MessageID
            FROM Logs
            WHERE Request IN ('Broken Report', 'Delivered for Repair', 'Missing Report', 'False Report Penalty')
              AND DateTime >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            ORDER BY DateTime DESC
            LIMIT 100
        `;
        const [rows] = await db.upbsPool.query(query);
        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, error: 'Database error' });
    }
};

// GET /api/admin/search-bike
const searchBike = async (req, res) => {
    const { bicycleCode } = req.query;
    if (!bicycleCode) {
        return res.status(400).json({ success: false, error: 'bicycleCode query parameter is required' });
    }

    try {
        // 1. Get the bicycle details (filtering for active ones)
        const [bikes] = await db.upbsPool.query(
            "SELECT bicycle_code, combination_lock, condition_status FROM bicycle_codes WHERE bicycle_code = ? AND (is_active = 1 OR is_active IS NULL)",
            [bicycleCode]
        );

        if (bikes.length === 0) {
            return res.status(404).json({ success: false, error: 'Bicycle not found or is inactive' });
        }

        const bike = bikes[0];

        // 2. Get the last 10 trips in history for this bike
        const [history] = await db.upbsPool.query(
            "SELECT id, previous_location, new_location, borrowed_by, borrowed_at, done_text_received, condition_confirmed, pending_status_time FROM bicycle_history WHERE bicycle_code = ? ORDER BY borrowed_at DESC LIMIT 10",
            [bicycleCode]
        );

        // 3. Determine if there is a running active borrow on the bike (done_text_received = 0)
        let activeBorrow = null;
        if (history.length > 0 && history[0].done_text_received === 0) {
            activeBorrow = {
                borrowed_by: history[0].borrowed_by,
                borrowed_at: history[0].borrowed_at
            };
        }

        return res.json({
            success: true,
            data: {
                bicycle_code: bike.bicycle_code,
                combination_lock: bike.combination_lock,
                condition_status: bike.condition_status,
                active_borrow: activeBorrow,
                history: history
            }
        });
    } catch (err) {
        console.error('Error in searchBike controller:', err);
        return res.status(500).json({ success: false, error: 'Database error searching bicycle' });
    }
};

// GET /api/admin/search-member
const searchMember = async (req, res) => {
    const { query } = req.query;
    if (!query) {
        return res.status(400).json({ success: false, error: 'query parameter is required' });
    }

    try {
        const cleanQuery = query.trim().replace(/[\s\-\(\)]/g, '');
        const phoneQuery = cleanQuery.replace(/^(\+63|63|0)(?=9)/, '');
        const sql = `
            SELECT firstname, lastname, phone_number, trust_points, points_frozen, is_active 
            FROM members 
            WHERE (phone_number LIKE ? OR phone_number LIKE ? OR firstname LIKE ? OR lastname LIKE ?) ORDER BY is_active DESC
            LIMIT 20
        `;
        const qTrim = `%${query.trim()}%`;
        const qPhone = `%${phoneQuery}%`;
        const [rows] = await db.upbsPool.query(sql, [qTrim, qPhone, qTrim, qTrim]);

        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error in searchMember controller:', err);
        return res.status(500).json({ success: false, error: 'Database error searching members' });
    }
};

// POST /api/admin/override-points
const overridePoints = async (req, res) => {
    const { phone_number, trust_points } = req.body;
    if (!phone_number || trust_points === undefined) {
        return res.status(400).json({ success: false, error: 'phone_number and trust_points are required' });
    }

    try {
        let clampedPoints = Math.max(0, Math.min(120, Number(trust_points)));
        const [result] = await db.upbsPool.query(
            "UPDATE members SET trust_points = ?, leaderboard_points = ? WHERE phone_number = ? AND (is_active = 1 OR is_active IS NULL)",
            [clampedPoints, clampedPoints, phone_number]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Member not found or is inactive' });
        }

        const notificationService = require('../services/notificationService');
        await notificationService.checkAndAlertSuspension(phone_number);

        return res.json({ success: true, message: 'Trust points updated successfully!' });
    } catch (err) {
        console.error('Error in overridePoints controller:', err);
        return res.status(500).json({ success: false, error: 'Database error overriding points' });
    }
};

// POST /api/admin/override-bike
const overrideBike = async (req, res) => {
    const { bicycle_code, combination_lock, condition_status } = req.body;
    if (!bicycle_code || !combination_lock || !condition_status) {
        return res.status(400).json({ success: false, error: 'bicycle_code, combination_lock, and condition_status are required' });
    }

    let conn;
    try {
        conn = await db.upbsPool.getConnection();
        await conn.beginTransaction();

        const [result] = await conn.query(
            "UPDATE bicycle_codes SET combination_lock = ?, condition_status = ? WHERE bicycle_code = ? AND (is_active = 1 OR is_active IS NULL)",
            [combination_lock, condition_status, bicycle_code]
        );

        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ success: false, error: 'Bicycle not found or is inactive' });
        }

        if (condition_status !== 'Borrowed' && condition_status !== 'Pending_Status') {
            const [activeTrips] = await conn.query(
                "SELECT id FROM bicycle_history WHERE bicycle_code = ? AND (done_text_received = 0 OR condition_confirmed = 0) ORDER BY borrowed_at DESC LIMIT 1 FOR UPDATE",
                [bicycle_code]
            );
            if (activeTrips.length > 0) {
                let reported = 'Good';
                if (condition_status === 'Broken' || condition_status === 'In_Repair') {
                    reported = 'Broken';
                } else if (condition_status === 'Missing') {
                    reported = 'Missing';
                }
                await conn.query(
                    "UPDATE bicycle_history SET done_text_received = 1, condition_confirmed = 1, reported_condition = ? WHERE id = ?",
                    [reported, activeTrips[0].id]
                );
            }
        }

        await conn.commit();
        return res.json({ success: true, message: 'Bicycle override settings applied!' });
    } catch (err) {
        console.error('Error in overrideBike controller:', err);
        if (conn) {
            try {
                await conn.rollback();
            } catch (rbErr) { }
        }
        return res.status(500).json({ success: false, error: 'Database error overriding bicycle settings' });
    } finally {
        if (conn) {
            conn.release();
        }
    }
};

// POST /api/admin/delete-member
const deleteMember = async (req, res) => {
    const { phone_number } = req.body;
    if (!phone_number) {
        return res.status(400).json({ success: false, error: 'phone_number is required' });
    }

    let conn;
    try {
        conn = await db.upbsPool.getConnection();
        await conn.beginTransaction();

        // Retrieve member's first and last name to find their active history records
        const [memberRows] = await conn.query(
            "SELECT firstname, lastname FROM members WHERE phone_number = ?",
            [phone_number]
        );

        if (memberRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ success: false, error: 'Member not found' });
        }

        const member = memberRows[0];
        const currentUserName = `${member.firstname} ${member.lastname}`;

        // Find the bike code currently checked out or pending handshake by this user (if any)
        const [activeTrips] = await conn.query(
            "SELECT id, bicycle_code FROM bicycle_history WHERE (borrower_phone = ? OR (borrower_phone IS NULL AND borrowed_by = ?)) AND (done_text_received = 0 OR condition_confirmed = 0) ORDER BY borrowed_at DESC LIMIT 1",
            [phone_number, currentUserName]
        );

        if (activeTrips.length > 0) {
            const activeTrip = activeTrips[0];

            // 1. Close history record
            await conn.query(
                "UPDATE bicycle_history SET done_text_received = 1, condition_confirmed = 1, reported_condition = 'Good' WHERE id = ?",
                [activeTrip.id]
            );

            // 2. Set the bike back to Good
            await conn.query(
                "UPDATE bicycle_codes SET condition_status = 'Good' WHERE bicycle_code = ?",
                [activeTrip.bicycle_code]
            );
        }

        // Deactivate the member
        await conn.query(
            "UPDATE members SET is_active = 0 WHERE phone_number = ?",
            [phone_number]
        );

        await conn.commit();
        return res.json({ success: true, message: 'Member successfully deactivated (soft-deleted)!' });
    } catch (err) {
        console.error('Error in deleteMember controller:', err);
        if (conn) {
            try {
                await conn.rollback();
            } catch (rollbackErr) {
                console.error('Error rolling back deleteMember transaction:', rollbackErr);
            }
        }
        return res.status(500).json({ success: false, error: 'Database error deleting member' });
    } finally {
        if (conn) conn.release();
    }
};


// POST /api/admin/activate-member
const activateMember = async (req, res) => {
    const { phone_number } = req.body;
    if (!phone_number) {
        return res.status(400).json({ success: false, error: 'phone_number is required' });
    }

    try {
        const [result] = await db.upbsPool.query(
            "UPDATE members SET is_active = 1 WHERE phone_number = ?",
            [phone_number]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Member not found' });
        }

        await sendSMS(phone_number, "Welcome back to UP Bike Share! Your account has been reactivated.");

        return res.json({ success: true, message: 'Member successfully reactivated!' });
    } catch (err) {
        console.error('Error in activateMember controller:', err);
        return res.status(500).json({ success: false, error: 'Database error reactivating member' });
    }
};

// POST /api/admin/hard-delete-member
const hardDeleteMember = async (req, res) => {
    const { phone_number } = req.body;
    if (!phone_number) {
        return res.status(400).json({ success: false, error: 'phone_number is required' });
    }

    let conn;
    try {
        conn = await db.upbsPool.getConnection();
        await conn.beginTransaction();

        // Retrieve member's first and last name to find their active history records
        const [memberRows] = await conn.query(
            "SELECT firstname, lastname FROM members WHERE phone_number = ?",
            [phone_number]
        );

        if (memberRows.length > 0) {
            const member = memberRows[0];
            const currentUserName = `${member.firstname} ${member.lastname}`;

            // Find the bike code currently checked out or pending handshake by this user (if any)
            const [activeTrips] = await conn.query(
                "SELECT id, bicycle_code FROM bicycle_history WHERE (borrower_phone = ? OR (borrower_phone IS NULL AND borrowed_by = ?)) AND (done_text_received = 0 OR condition_confirmed = 0) ORDER BY borrowed_at DESC LIMIT 1",
                [phone_number, currentUserName]
            );

            if (activeTrips.length > 0) {
                const activeTrip = activeTrips[0];

                // 1. Close history record
                await conn.query(
                    "UPDATE bicycle_history SET done_text_received = 1, condition_confirmed = 1, reported_condition = 'Good' WHERE id = ?",
                    [activeTrip.id]
                );

                // 2. Set the bike back to Good
                await conn.query(
                    "UPDATE bicycle_codes SET condition_status = 'Good' WHERE bicycle_code = ?",
                    [activeTrip.bicycle_code]
                );
            }
        }

        // Hard delete the member
        const [result] = await conn.query(
            "DELETE FROM members WHERE phone_number = ?",
            [phone_number]
        );

        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ success: false, error: 'Member not found' });
        }

        await conn.commit();
        return res.json({ success: true, message: 'Member successfully deleted from the database!' });
    } catch (err) {
        console.error('Error in hardDeleteMember controller:', err);
        if (conn) {
            try {
                await conn.rollback();
            } catch (rollbackErr) {
                console.error('Error rolling back hardDeleteMember transaction:', rollbackErr);
            }
        }
        return res.status(500).json({ success: false, error: 'Database error deleting member' });
    } finally {
        if (conn) conn.release();
    }
};

// POST /api/admin/delete-bike
const deleteBike = async (req, res) => {
    const { bicycle_code } = req.body;
    if (!bicycle_code) {
        return res.status(400).json({ success: false, error: 'bicycle_code is required' });
    }

    let conn;
    try {
        conn = await db.upbsPool.getConnection();
        await conn.beginTransaction();

        // Close any active or pending return trips associated with this bike to prevent trapping users
        await conn.query(
            "UPDATE bicycle_history SET done_text_received = 1, condition_confirmed = 1, reported_condition = 'Good' WHERE bicycle_code = ? AND (done_text_received = 0 OR condition_confirmed = 0)",
            [bicycle_code]
        );

        const [result] = await conn.query(
            "UPDATE bicycle_codes SET is_active = 0, condition_status = 'Good' WHERE bicycle_code = ?",
            [bicycle_code]
        );

        if (result.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ success: false, error: 'Bicycle not found' });
        }

        await conn.commit();
        return res.json({ success: true, message: 'Bicycle successfully deactivated (soft-deleted)!' });
    } catch (err) {
        console.error('Error in deleteBike controller:', err);
        if (conn) {
            try {
                await conn.rollback();
            } catch (rollbackErr) {
                console.error('Error rolling back deleteBike transaction:', rollbackErr);
            }
        }
        return res.status(500).json({ success: false, error: 'Database error deleting bicycle' });
    } finally {
        if (conn) conn.release();
    }
};

// POST /api/admin/delete-location (Also handles DELETE /api/admin/locations/:name)
const deleteLocation = async (req, res) => {
    const location_name = req.body.location_name || req.params.name;
    if (!location_name) {
        return res.status(400).json({ success: false, error: 'location_name is required' });
    }

    try {
        const [result] = await db.upbsPool.query(
            "UPDATE locations SET is_active = 0 WHERE location_name = ?",
            [location_name]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Location/Station not found' });
        }

        return res.json({ success: true, message: 'Location/Station successfully deactivated (soft-deleted)!' });
    } catch (err) {
        console.error('Error in deleteLocation controller:', err);
        return res.status(500).json({ success: false, error: 'Database error deleting location' });
    }
};

// GET /api/admin/reports
const getReports = async (req, res) => {
    try {
        const queueQuery = `
            SELECT b.bicycle_code, b.new_location, b.condition_status,
                   (SELECT bh.borrower_phone 
                    FROM bicycle_history bh 
                    WHERE bh.bicycle_code = b.bicycle_code 
                    ORDER BY bh.borrowed_at DESC 
                    LIMIT 1) AS last_user_phone
            FROM bicycle_codes b
            WHERE b.condition_status IN ('Broken', 'Missing', 'Disputed', 'In_Repair') AND b.is_active = 1
        `;
        const [maintenanceQueue] = await db.upbsPool.query(queueQuery);

        // 2. Honesty Logs: entries in Logs table where Request matches reports
        const logsQuery = `
            SELECT LastName, FirstName, MobileNumber, SenderNumber, DateTime, Request, MessageID
            FROM Logs
            WHERE Request IN ('Broken Report', 'Delivered for Repair', 'Missing Report')
            ORDER BY DateTime DESC
            LIMIT 100
        `;
        const [honestyLogs] = await db.upbsPool.query(logsQuery);

        return res.json({
            success: true,
            data: {
                maintenanceQueue,
                honestyLogs
            }
        });
    } catch (err) {
        console.error('Error in getReports controller:', err);
        return res.status(500).json({ success: false, error: 'Database error fetching reports' });
    }
};
// POST /api/admin/bicycles/toggle
const toggleBike = async (req, res) => {
    const { bicycle_code, is_disabled } = req.body;

    if (!bicycle_code || is_disabled === undefined) {
        return res.status(400).json({ success: false, error: 'bicycle_code and is_disabled are required' });
    }

    try {
        const val = is_disabled ? 1 : 0;
        const [result] = await db.upbsPool.query(
            'UPDATE bicycle_codes SET is_disabled = ? WHERE bicycle_code = ?',
            [val, bicycle_code]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Bicycle not found' });
        }

        return res.json({ success: true, message: `Bicycle successfully ${val ? 'disabled' : 'enabled'}.` });
    } catch (err) {
        console.error('Error in toggleBike controller:', err);
        return res.status(500).json({ success: false, error: 'Database error toggling bicycle status' });
    }
};

// GET /api/admin/settings
const getSettings = async (req, res) => {
    try {
        const [rows] = await db.upbsPool.query('SELECT * FROM system_settings');
        const settingsObj = {};
        rows.forEach(row => {
            settingsObj[row.setting_name] = row.setting_value;
        });
        return res.json({ success: true, data: settingsObj });
    } catch (err) {
        console.error('Error in getSettings controller:', err);
        return res.status(500).json({ success: false, error: 'Database error fetching system settings' });
    }
};

// POST /api/admin/settings
const updateSettings = async (req, res) => {
    const { settings, setting_name, setting_value, key, value } = req.body;

    // We can support either bulk updates via "settings" array, single update via "setting_name" & "setting_value", or "key" & "value"
    let updates = [];
    if (Array.isArray(settings)) {
        updates = settings;
    } else if (setting_name !== undefined && setting_value !== undefined) {
        updates = [{ setting_name, setting_value }];
    } else if (key !== undefined && value !== undefined) {
        updates = [{ setting_name: key, setting_value: value }];
    }

    if (updates.length === 0) {
        return res.status(400).json({ success: false, error: 'Settings update data is required. Provide either a settings array, setting_name/setting_value pair, or key/value pair.' });
    }

    // Validate setting names and values
    for (const update of updates) {
        if (!update.setting_name || update.setting_value === undefined) {
            return res.status(400).json({ success: false, error: 'Invalid setting update format. Each update must contain setting_name and setting_value.' });
        }
    }

    const conn = await db.upbsPool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Fetch current admin alert numbers before update
        const [oldSettings] = await conn.query(
            "SELECT setting_name, setting_value FROM system_settings WHERE setting_name IN ('admin_alert_phone_1', 'admin_alert_phone_2')"
        );
        const oldPhones = {};
        oldSettings.forEach(s => { oldPhones[s.setting_name] = s.setting_value; });

        // 2. Perform setting updates
        for (const update of updates) {
            await conn.query(
                'UPDATE system_settings SET setting_value = ? WHERE setting_name = ?',
                [String(update.setting_value), update.setting_name]
            );
        }

        // 3. Fetch new admin alert numbers after update
        const [newSettings] = await conn.query(
            "SELECT setting_name, setting_value FROM system_settings WHERE setting_name IN ('admin_alert_phone_1', 'admin_alert_phone_2')"
        );
        const newPhones = {};
        newSettings.forEach(s => { newPhones[s.setting_name] = s.setting_value; });

        // 4. Compare changes and update member roles in transaction
        const oldPhonesSet = new Set(Object.values(oldPhones).filter(p => p && p.trim() !== ''));
        const newPhonesSet = new Set(Object.values(newPhones).filter(p => p && p.trim() !== ''));

        // Demote removed phone numbers to 'student'
        for (const oldPhone of oldPhonesSet) {
            if (!newPhonesSet.has(oldPhone)) {
                console.log(`[Role Sync] Demoting ${oldPhone} back to student role.`);
                await conn.query("UPDATE members SET role = 'student' WHERE phone_number = ?", [oldPhone]);
            }
        }

        // Promote added phone numbers to 'admin'
        for (const newPhone of newPhonesSet) {
            if (!oldPhonesSet.has(newPhone)) {
                console.log(`[Role Sync] Promoting ${newPhone} to admin role.`);

                // Get member details to check if they exist before promoting
                const [memRows] = await conn.query("SELECT role FROM members WHERE phone_number = ?", [newPhone]);
                if (memRows.length > 0) {
                    await conn.query("UPDATE members SET role = 'admin' WHERE phone_number = ?", [newPhone]);
                    if (memRows[0].role !== 'admin') {
                        await sendSMS(newPhone, `You are now registered as an administrator in the UP Bikeshare System (UPBS).`);
                    }
                }
            }
        }

        await conn.commit();
        return res.json({ success: true, message: 'System settings updated successfully and admin roles synchronized.' });
    } catch (err) {
        await conn.rollback();
        console.error('Error in updateSettings controller:', err);
        return res.status(500).json({ success: false, error: 'Database error updating system settings' });
    } finally {
        conn.release();
    }
};

const resolveDelivery = async (req, res) => {
    const { bicycle_code, verdict, waive_penalty } = req.body;
    if (!bicycle_code || !verdict) {
        return res.status(400).json({ success: false, error: 'bicycle_code and verdict are required' });
    }

    const conn = await db.upbsPool.getConnection();
    try {
        await conn.beginTransaction();

        // Fetch the bike details
        const [bike] = await conn.query(
            "SELECT dispute_reported_by, new_location FROM bicycle_codes WHERE bicycle_code = ? FOR UPDATE",
            [bicycle_code]
        );

        if (bike.length === 0) {
            await conn.rollback();
            return res.status(404).json({ success: false, error: 'Bike not found' });
        }

        let volunteerPhone = bike[0].dispute_reported_by;
        if (!volunteerPhone) {
            const [history] = await conn.query(
                "SELECT student_number FROM bicycle_history WHERE bicycle_code = ? ORDER BY borrowed_at DESC LIMIT 1",
                [bicycle_code]
            );
            if (history.length > 0) {
                volunteerPhone = history[0].student_number;
            }
        }
        console.log(`[Resolve Delivery] Bike #${bicycle_code} verdict=${verdict}, target phone=${volunteerPhone}`);

        if (verdict === 'approve') {
            const reward = await getSettingValue('reward_delivered_bike', 5, conn);

            // Update bike to 'Broken' (awaiting admin maintenance) and clear delivery request
            await conn.query(
                "UPDATE bicycle_codes SET condition_status = 'Broken', dispute_reported_by = NULL, dispute_image_url = NULL, broken_reported_at = NOW() WHERE bicycle_code = ?",
                [bicycle_code]
            );

            if (volunteerPhone) {
                // Reward volunteer
                await conn.query(
                    "UPDATE members SET trust_points = LEAST(120, CAST(trust_points AS SIGNED) + ?), leaderboard_points = CAST(leaderboard_points AS SIGNED) + ? WHERE phone_number = ?",
                    [reward, reward, volunteerPhone]
                );

                // Send SMS confirmation to volunteer
                await sendSMS(volunteerPhone, `Delivery verified! Bike ${bicycle_code} approved by admin. +${reward} pts added to your trust points. Thank you for volunteering!`);
            }

            await conn.commit();
            return res.json({ success: true, message: 'Delivery approved and volunteer rewarded successfully!' });

        } else {
            // Reject delivery - revert back to Broken (or Missing) and clear request
            await conn.query(
                "UPDATE bicycle_codes SET condition_status = 'Broken', dispute_reported_by = NULL, dispute_image_url = NULL WHERE bicycle_code = ?",
                [bicycle_code]
            );

            if (volunteerPhone) {
                if (waive_penalty === true || waive_penalty === 'true') {
                    await sendSMS(volunteerPhone, `Your delivery report for Bike ${bicycle_code} was unverified/rejected by admin. The false report point penalty was waived by admin this time.`);
                } else {
                    const penalty = await getSettingValue('penalty_false_report', -5);
                    await conn.query(
                        "UPDATE members SET trust_points = GREATEST(0, LEAST(120, CAST(trust_points AS SIGNED) + ?)) WHERE phone_number = ?",
                        [penalty, volunteerPhone]
                    );
                    await sendSMS(volunteerPhone, `Your delivery report for Bike ${bicycle_code} was unverified/rejected by admin. A ${Math.abs(penalty)}-point penalty has been applied to your trust points.`);
                }
            }

            await conn.commit();
            return res.json({ success: true, message: 'Delivery rejected and cleared.' });
        }

    } catch (err) {
        await conn.rollback();
        console.error('Error in resolveDelivery controller:', err);
        return res.status(500).json({ success: false, error: 'Database error resolving delivery' });
    } finally {
        conn.release();
    }
};

module.exports = {
    login,
    resolveDelivery,
    toggleBike,
    getMembers,
    addMember,
    addBicycle,
    addLocation,
    toggleLocation,
    resolveDispute,
    searchBike,
    searchMember,
    overridePoints,
    overrideBike,
    deleteMember,
    activateMember,
    hardDeleteMember,
    deleteBike,
    deleteLocation,
    getReports,
    searchBicycles,
    searchMembers,
    overrideBicycle,
    getMaintenanceQueue,
    getHonestyLogs,
    getSettings,
    updateSettings
};

