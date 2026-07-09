const db = require('../db');
const smsService = require('../services/smsService');
const notificationService = require('../services/notificationService');

// Helper function to dynamically fetch settings from system_settings
async function getSettingValue(name, defaultValue, conn = db.upbsPool) {
    try {
        const [rows] = await conn.query('SELECT setting_value FROM system_settings WHERE setting_name = ?', [name]);
        if (rows.length > 0) {
            return parseInt(rows[0].setting_value, 10);
        }
    } catch (err) {
        console.error(`Failed to fetch setting ${name}:`, err);
    }
    return defaultValue;
}

// POST /api/search
const search = async (req, res) => {
    const { smsSender, bicycleCode, messageId } = req.body;

    if (!smsSender || !bicycleCode || !messageId) {
        return res.status(400).json({ error: 'smsSender, bicycleCode, and messageId are required' });
    }

    try {
        // 1. Retrieve member information (must be active)
        const memberQuery = `
            SELECT lastname, firstname, phone_number
            FROM members
            WHERE phone_number = ? AND is_active = 1
        `;
        const [memberRecords] = await db.upbsPool.query(memberQuery, [smsSender]);

        if (memberRecords.length === 0) {
            return res.json({ reply: 'Sorry, you must be a registered UP Bike Share member to use this service.' });
        }

        const { lastname, firstname, phone_number } = memberRecords[0];

        // 2. Check if the query is a location/building name instead of a bike code
        const [locationRows] = await db.upbsPool.query(
            "SELECT location_name FROM locations WHERE location_name = ? AND is_active = 1",
            [bicycleCode]
        );

        let replyMessage = "";

        if (locationRows.length > 0) {
            // It is a building search! Fetch only available (Good) bikes at this location
            const [bikes] = await db.upbsPool.query(
                "SELECT bicycle_code FROM bicycle_codes WHERE new_location = ? AND condition_status = 'Good' AND is_active = 1 AND (is_disabled = 0 OR is_disabled IS NULL)",
                [bicycleCode]
            );

            if (bikes.length === 0) {
                replyMessage = `There are no bicycles available at ${bicycleCode.toLowerCase()} at the moment.`;
            } else {
                const list = bikes.map(b => b.bicycle_code).join(', ');
                replyMessage = `Bicycles currently available at ${bicycleCode.toLowerCase()}: ${list}.`;
            }

            // Log search building request
            const logQuery = `
                INSERT INTO Logs (LastName, FirstName, MobileNumber, SenderNumber, DateTime, Request, MessageID) 
                VALUES (?, ?, ?, ?, NOW(), ?, ?)
            `;
            await db.upbsPool.query(logQuery, [
                lastname,
                firstname,
                phone_number,
                smsSender,
                'Search Bldg Request',
                messageId
            ]);
        } else {
            // It is a bike code search! Retrieve the location of the bicycle
            const locationQuery = `
                SELECT new_location
                FROM bicycle_codes
                WHERE bicycle_code = ? AND is_active = 1 AND (is_disabled = 0 OR is_disabled IS NULL)
            `;
            const [locationRecords] = await db.upbsPool.query(locationQuery, [bicycleCode]);

            if (locationRecords.length === 0) {
                replyMessage = `Bicycle or station code "${bicycleCode}" not found.`;
            } else {
                const newLocation = locationRecords[0].new_location;
                replyMessage = `At the moment, the current location of ${bicycleCode} is at ${newLocation.toLowerCase()}.`;
            }

            // Log the search request
            const logQuery = `
                INSERT INTO Logs (LastName, FirstName, MobileNumber, SenderNumber, DateTime, Request, MessageID) 
                VALUES (?, ?, ?, ?, NOW(), ?, ?)
            `;
            await db.upbsPool.query(logQuery, [
                lastname,
                firstname,
                phone_number,
                smsSender,
                'Search Request',
                messageId
            ]);
        }

        return res.json({ reply: replyMessage });

    } catch (err) {
        console.error('Error in search controller:', err);
        res.status(500).json({ error: 'Database error processing search request' });
    }
};

// POST /api/search-all
const searchAll = async (req, res) => {
    const { smsSender, messageId } = req.body;

    if (!smsSender || !messageId) {
        return res.status(400).json({ error: 'smsSender and messageId are required' });
    }

    try {
        // 1. Check if the sender is a registered member (for logging purposes)
        const memberQuery = `
            SELECT lastname, firstname, phone_number
            FROM members
            WHERE phone_number = ? AND is_active = 1
        `;
        const [memberRecords] = await db.upbsPool.query(memberQuery, [smsSender]);

        let userLogInfo = { lastname: null, firstname: null, phone_number: null };
        if (memberRecords.length > 0) {
            userLogInfo = memberRecords[0];
        }

        // 2. Query to fetch bicycle locations and count available bikes per location
        const locationQuery = "SELECT location_name FROM locations WHERE is_active = 1 AND (is_disabled = 0 OR is_disabled IS NULL) ORDER BY location_name ASC";
        const [locs] = await db.upbsPool.query(locationQuery);

        const countQuery = `
            SELECT UPPER(COALESCE(new_location, previous_location)) AS loc, COUNT(*) AS cnt 
            FROM bicycle_codes 
            WHERE condition_status = 'Good' AND is_active = 1 AND (is_disabled = 0 OR is_disabled IS NULL) 
            GROUP BY UPPER(COALESCE(new_location, previous_location))
        `;
        const [counts] = await db.upbsPool.query(countQuery);
        const countMap = {};
        counts.forEach(r => {
            if (r.loc) countMap[r.loc] = r.cnt;
        });

        const summaryParts = locs.map(l => {
            const name = l.location_name.toUpperCase();
            const cnt = countMap[name] || 0;
            delete countMap[name];
            return `${name}: ${cnt} ${cnt === 1 ? 'bike' : 'bikes'}`;
        });

        // Add any remaining locations from countMap that weren't in locs table
        Object.keys(countMap).sort().forEach(name => {
            const cnt = countMap[name];
            summaryParts.push(`${name}: ${cnt} ${cnt === 1 ? 'bike' : 'bikes'}`);
        });

        const replies = [];
        if (summaryParts.length === 0) {
            replies.push("No locations available at the moment.");
        } else {
            replies.push(`Available bikes across campus:\n${summaryParts.join('\n')}\n\nText 'search [location]' for bike codes.`);
        }

        // 3. Log the search-all request
        const logQuery = `
            INSERT INTO Logs (LastName, FirstName, MobileNumber, SenderNumber, DateTime, Request, MessageID) 
            VALUES (?, ?, ?, ?, NOW(), ?, ?)
        `;
        await db.upbsPool.query(logQuery, [
            userLogInfo.lastname,
            userLogInfo.firstname,
            userLogInfo.phone_number,
            smsSender,
            'Search All',
            messageId
        ]);

        return res.json({ replies });

    } catch (err) {
        console.error('Error in searchAll controller:', err);
        res.status(500).json({ error: 'Database error processing search-all request' });
    }
};

// POST /api/locations
const locations = async (req, res) => {
    const { smsSender, messageId } = req.body;

    if (!smsSender || !messageId) {
        return res.status(400).json({ error: 'smsSender and messageId are required' });
    }

    try {
        // 1. Retrieve member information (required)
        const memberQuery = `
            SELECT lastname, firstname, phone_number
            FROM members
            WHERE phone_number = ? AND is_active = 1
        `;
        const [memberRecords] = await db.upbsPool.query(memberQuery, [smsSender]);

        if (memberRecords.length === 0) {
            return res.json({ reply: 'Sorry, you must be a registered UP Bike Share member to use this service.' });
        }

        const { lastname, firstname, phone_number } = memberRecords[0];

        // 2. Fetch active locations
        const locationQuery = "SELECT location_name FROM locations WHERE is_active = 1 AND (is_disabled = 0 OR is_disabled IS NULL)";
        const [locations] = await db.upbsPool.query(locationQuery);

        let replyMessage = "";
        if (locations.length === 0) {
            replyMessage = "No locations available at the moment.";
        } else {
            const locationList = locations.map(loc => loc.location_name.toLowerCase()).join(', ');
            replyMessage = `Available locations: ${locationList}`;
        }

        // 3. Log the locations request
        const logQuery = `
            INSERT INTO Logs (LastName, FirstName, MobileNumber, SenderNumber, DateTime, Request, MessageID) 
            VALUES (?, ?, ?, ?, NOW(), ?, ?)
        `;
        await db.upbsPool.query(logQuery, [
            lastname,
            firstname,
            phone_number,
            smsSender,
            'Locations',
            messageId
        ]);

        return res.json({ reply: replyMessage });

    } catch (err) {
        console.error('Error in locations controller:', err);
        res.status(500).json({ error: 'Database error processing locations request' });
    }
};

// POST /api/usage
const usage = async (req, res) => {
    const { smsSender, bicycleCode, messageId } = req.body;

    if (!smsSender || !bicycleCode || !messageId) {
        return res.status(400).json({ error: 'smsSender, bicycleCode, and messageId are required' });
    }

    try {
        // 1. Retrieve member information (required)
        const memberQuery = `
            SELECT lastname, firstname, phone_number
            FROM members
            WHERE phone_number = ? AND is_active = 1
        `;
        const [memberRecords] = await db.upbsPool.query(memberQuery, [smsSender]);

        if (memberRecords.length === 0) {
            return res.json({ replies: ['Sorry, you must be a registered UP Bike Share member to use this service.'] });
        }

        const { lastname, firstname, phone_number } = memberRecords[0];

        // 2. Validate Bicycle Code
        const bikeQuery = "SELECT * FROM bicycle_codes WHERE bicycle_code = ? AND is_active = 1";
        const [bicycles] = await db.upbsPool.query(bikeQuery, [bicycleCode]);

        if (bicycles.length === 0) {
            return res.json({ replies: [`Invalid bicycle code ${bicycleCode}. Please check and try again.`] });
        }

        // 3. Retrieve bicycle usage history
        const historyQuery = `
            SELECT previous_location, new_location, borrowed_at
            FROM bicycle_history
            WHERE bicycle_code = ?
            ORDER BY borrowed_at DESC
            LIMIT 3
        `;
        const [historyRecords] = await db.upbsPool.query(historyQuery, [bicycleCode]);

        const currLoc = bicycles[0].new_location ? bicycles[0].new_location.toUpperCase() : 'UNKNOWN';
        const currStatus = bicycles[0].condition_status || 'Unknown';
        let header = `Bike ${bicycleCode} (${currStatus} at ${currLoc}):\nRecent trips:\n`;
        let replyMsg = header;

        if (historyRecords.length === 0) {
            replyMsg += "No recent trips logged.";
        } else {
            for (let i = 0; i < historyRecords.length; i++) {
                const record = historyRecords[i];
                const dateObj = new Date(record.borrowed_at);
                const dateStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
                const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                const line = `${i + 1}. ${record.previous_location.toLowerCase()}->${record.new_location.toLowerCase()} (${dateStr} ${timeStr})\n`;
                
                // Ensure adding this trip won't exceed standard 160 SMS limit to prevent multi-part out-of-order texts
                if ((replyMsg + line).length > 160 && i > 0) {
                    break;
                }
                replyMsg += line;
            }
        }

        const replies = [replyMsg.trim()];

        // 5. Log the usage request
        const logQuery = `
            INSERT INTO Logs (LastName, FirstName, MobileNumber, SenderNumber, DateTime, Request, MessageID) 
            VALUES (?, ?, ?, ?, NOW(), ?, ?)
        `;
        await db.upbsPool.query(logQuery, [
            lastname,
            firstname,
            phone_number,
            smsSender,
            'Usage Request',
            messageId
        ]);

        return res.json({ replies });

    } catch (err) {
        console.error('Error in usage controller:', err);
        res.status(500).json({ error: 'Database error processing usage request' });
    }
};

// POST /api/borrow
const borrow = async (req, res) => {
    const { smsSender, bicycleCode, fromLocation, toLocation, messageId } = req.body;

    if (!smsSender || !bicycleCode || !fromLocation || !toLocation || !messageId) {
        return res.status(400).json({ error: 'smsSender, bicycleCode, fromLocation, toLocation, and messageId are required' });
    }

    // Acquire a dedicated connection for the transaction
    let upbsConn;
    try {
        upbsConn = await db.upbsPool.getConnection();
    } catch (dbErr) {
        console.error('Failed to acquire database connection:', dbErr);
        return res.status(500).json({ error: 'Database connection failed' });
    }

    try {
        // 4. Start the database transaction (Moved here for concurrency safety)
        await upbsConn.beginTransaction();

        // 1. Retrieve member information (required)
        const memberQuery = `
            SELECT lastname, firstname, phone_number, trust_points, points_frozen
            FROM members
            WHERE phone_number = ? AND is_active = 1
            FOR UPDATE
        `;
        const [memberRecords] = await upbsConn.query(memberQuery, [smsSender]);

        if (memberRecords.length === 0) {
            await upbsConn.rollback();
            return res.json({ reply: 'Sorry, you must be a registered UP Bike Share member to use this service.' });
        }

        const user = memberRecords[0];

        // Apply Gatekeeper checks for member trust points and frozen status
        const suspensionLimit = await getSettingValue('suspension_limit', 50, upbsConn);
        if (user.trust_points < suspensionLimit) {
            await upbsConn.rollback();
            return res.json({ reply: `Account suspended (${user.trust_points} pts). To lift: deliver missing/broken bikes to hubs, or message m(.)me/upbikesharebot (remove parenthesis) or visit Admin Hub.` });
        }

        if (user.points_frozen == 1 || user.points_frozen === true || user.points_frozen === 'true') {
            await upbsConn.rollback();
            return res.json({ reply: "Account frozen due to dispute. To settle: send photo to m(.)me/upbikesharebot (remove parenthesis) or visit UP Bikeshare Admin Hub." });
        }

        // Apply Gatekeeper check for multiple simultaneous borrows
        const currentUserName = `${user.firstname} ${user.lastname}`;
        const activeTripQuery = `
            SELECT bh.id, bh.done_text_received, bh.bicycle_code
            FROM bicycle_history bh
            JOIN bicycle_codes bc ON bc.bicycle_code = bh.bicycle_code
            WHERE bh.borrowed_by = ? 
              AND (
                (bh.done_text_received = 0 AND bc.condition_status = 'Borrowed')
                OR
                (bh.done_text_received = 1 AND bh.condition_confirmed = 0 AND bc.condition_status = 'Pending_Status')
              )
            LIMIT 1
        `;
        const [activeTrips] = await upbsConn.query(activeTripQuery, [currentUserName]);
        if (activeTrips.length > 0) {
            await upbsConn.rollback();
            const activeTrip = activeTrips[0];
            if (activeTrip.done_text_received === 1) {
                return res.json({ reply: `You have a pending return confirmation for Bike ${activeTrip.bicycle_code}. Please reply 'GOOD ${activeTrip.bicycle_code}' or 'BROKEN ${activeTrip.bicycle_code}' first before checking out another bike.` });
            } else {
                return res.json({ reply: "You already have an active bike checked out. Please return it and text 'done' before borrowing another." });
            }
        }

        // 2. Validate Bicycle Code
        const bikeQuery = "SELECT * FROM bicycle_codes WHERE bicycle_code = ? AND is_active = 1 AND (is_disabled = 0 OR is_disabled IS NULL) FOR UPDATE";
        const [bicycles] = await upbsConn.query(bikeQuery, [bicycleCode]);

        if (bicycles.length === 0) {
            await upbsConn.rollback();
            return res.json({ reply: `Bike ${bicycleCode} not found or inactive.` });
        }

        const bicycle = bicycles[0];

        // Apply Gatekeeper check for bicycle condition
        if (bicycle.condition_status !== 'Good') {
            await upbsConn.rollback();
            let statusMsg = "Bike unavailable.";
            if (bicycle.condition_status === 'Broken') {
                statusMsg = `Bike ${bicycleCode} cannot be used because it was reported damaged/broken. It is waiting for maintenance collection.`;
            } else if (bicycle.condition_status === 'In_Repair') {
                statusMsg = `Bike ${bicycleCode} is currently undergoing maintenance/repairs and cannot be borrowed.`;
            } else if (bicycle.condition_status === 'Disputed') {
                statusMsg = `Bike ${bicycleCode} is currently disputed and under admin review. Please choose another bike.`;
            } else if (bicycle.condition_status === 'Missing') {
                statusMsg = `Bike ${bicycleCode} has been reported missing and is under investigation.`;
            } else if (bicycle.condition_status === 'Borrowed') {
                statusMsg = `Bike ${bicycleCode} is currently checked out by another member.`;
            } else if (bicycle.condition_status === 'Pending_Status') {
                statusMsg = `Bike ${bicycleCode} is currently pending a condition report from the previous user. Please try another bike.`;
            }
            return res.json({ reply: statusMsg });
        }


        // Helper function for location validation inside the handler
        const validateLoc = async (loc) => {
            const [rows] = await upbsConn.query("SELECT * FROM locations WHERE location_name = ? AND is_active = 1 AND (is_disabled = 0 OR is_disabled IS NULL)", [loc]);
            return rows.length > 0;
        };

        // 3. Validate 'from' and 'to' locations
        const validFrom = await validateLoc(fromLocation);
        const validTo = await validateLoc(toLocation);

        if (!validFrom || !validTo) {
            await upbsConn.rollback();
            return res.json({ reply: "One or both locations are invalid, offline, or unavailable at the moment." });
        }

        // Update bicycle location and set condition_status to 'Borrowed'
        const updateBicycleQuery = `
            UPDATE bicycle_codes 
            SET previous_location = ?, new_location = ?, condition_status = 'Borrowed' 
            WHERE bicycle_code = ?
        `;
        await upbsConn.query(updateBicycleQuery, [fromLocation, toLocation, bicycleCode]);

        // Insert into bicycle_history
        const insertHistoryQuery = `
            INSERT INTO bicycle_history (bicycle_code, previous_location, new_location, borrowed_by, borrower_phone)
            VALUES (?, ?, ?, ?, ?)
        `;
        await upbsConn.query(insertHistoryQuery, [
            bicycleCode,
            fromLocation,
            toLocation,
            `${user.firstname} ${user.lastname}`,
            smsSender
        ]);

        // Formulate the combination lock reply
        const replyMessage = `Hi ${user.firstname}! Bike ${bicycle.bicycle_code} lock code: ${bicycle.combination_lock}. Proceed to ${toLocation.toLowerCase()}. Remember to lock it & reply 'DONE ${bicycleCode}' when finished. Safe ride!`;

        // Log the borrowing request
        const logQuery = `
            INSERT INTO Logs (LastName, FirstName, MobileNumber, SenderNumber, DateTime, Request, MessageID) 
            VALUES (?, ?, ?, ?, NOW(), ?, ?)
        `;
        await upbsConn.query(logQuery, [
            user.lastname,
            user.firstname,
            user.phone_number,
            smsSender,
            'Borrowing',
            messageId
        ]);

        // Commit transaction
        await upbsConn.commit();

        return res.json({ reply: replyMessage });

    } catch (err) {
        console.error('Error during transaction inside borrow controller:', err);
        // Rollback transaction in case of any SQL/database error
        try {
            await upbsConn.rollback();
        } catch (rollbackErr) {
            console.error('Error during transaction rollback:', rollbackErr);
        }
        res.status(500).json({ error: 'Database transaction error processing borrowing request' });
    } finally {
        // Always release connection back to the pool
        if (upbsConn) {
            upbsConn.release();
        }
    }
};

const getBicycles = async (req, res) => {
    try {
        const [rows] = await db.upbsPool.query('SELECT bicycle_code, new_location, previous_location, condition_status, is_disabled FROM bicycle_codes WHERE is_active = 1');
        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error in getBicycles:', err);
        return res.status(500).json({ success: false, error: 'Database error fetching bicycles' });
    }
};

const getLocations = async (req, res) => {
    try {
        // Include is_active = 1 AND is_active IS NULL just in case old records were created without the flag
        const [rows] = await db.upbsPool.query('SELECT location_name, is_disabled, latitude, longitude FROM locations WHERE is_active = 1 OR is_active IS NULL');
        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error in getLocations:', err);
        return res.status(500).json({ success: false, error: 'Database error fetching locations' });
    }
};

const getHistory = async (req, res) => {
    const { bicycleCode } = req.params;
    try {
        const [rows] = await db.upbsPool.query(
            'SELECT previous_location, new_location, borrowed_by, borrowed_at FROM bicycle_history WHERE bicycle_code = ? ORDER BY borrowed_at DESC',
            [bicycleCode]
        );
        return res.json(rows);
    } catch (err) {
        console.error('Error in getHistory:', err);
        return res.status(500).json({ error: 'Database error fetching bicycle history' });
    }
};

const done = async (req, res) => {
    const { smsSender, bicycleCode } = req.body;
    let upbsConn;
    try {
        upbsConn = await db.upbsPool.getConnection();
        await upbsConn.beginTransaction();

        const [member] = await upbsConn.query("SELECT firstname, lastname FROM members WHERE phone_number = ? AND is_active = 1", [smsSender]);
        if (member.length === 0) {
            await upbsConn.rollback();
            return res.json({ reply: "Sorry, you must be a registered UP Bike Share member to use this service." });
        }
        const currentUserName = `${member[0].firstname} ${member[0].lastname}`;

        const [bike] = await upbsConn.query("SELECT condition_status FROM bicycle_codes WHERE bicycle_code = ? AND is_active = 1 FOR UPDATE", [bicycleCode]);
        if (bike.length === 0) {
            await upbsConn.rollback();
            return res.json({ reply: `Bike ${bicycleCode} not found.` });
        }

        if (bike[0].condition_status !== 'Borrowed' && bike[0].condition_status !== 'Pending_Status') {
            await upbsConn.rollback();
            return res.json({ reply: `Bike ${bicycleCode} is not currently borrowed.` });
        }

        const [history] = await upbsConn.query(
            "SELECT id, borrowed_by, done_text_received FROM bicycle_history WHERE bicycle_code = ? ORDER BY id DESC LIMIT 1 FOR UPDATE",
            [bicycleCode]
        );

        if (history.length === 0 || history[0].borrowed_by !== currentUserName) {
            await upbsConn.rollback();
            return res.json({ reply: `You do not have an active borrow for Bike ${bicycleCode}.` });
        }

        if (history[0].done_text_received === 1) {
            await upbsConn.rollback();
            return res.json({ reply: `Trip for Bike ${bicycleCode} has already been ended. Please reply 'GOOD ${bicycleCode}' or 'BROKEN ${bicycleCode}'.` });
        }

        await upbsConn.query(
            "UPDATE bicycle_history SET done_text_received = 1, pending_status_time = NOW() WHERE id = ?",
            [history[0].id]
        );

        await upbsConn.query(
            "UPDATE bicycle_codes SET condition_status = 'Pending_Status' WHERE bicycle_code = ?",
            [bicycleCode]
        );

        // Reward the PREVIOUS user if they accurately confirmed the condition as good
        const [historyRecords] = await upbsConn.query(
            "SELECT borrowed_by, borrower_phone, condition_confirmed, reported_condition FROM bicycle_history WHERE bicycle_code = ? ORDER BY id DESC LIMIT 2",
            [bicycleCode]
        );

        if (historyRecords.length > 1) {
            const prevUser = historyRecords[1];
            if (prevUser.reported_condition === 'Good' || (prevUser.reported_condition === null && prevUser.condition_confirmed === 1)) {
                // Reward previous user for being honest (ceiling of 120 points)
                const honestyReward = await getSettingValue('honesty_reward', 2, upbsConn);
                if (prevUser.borrower_phone) {
                    await upbsConn.query(
                        "UPDATE members SET trust_points = LEAST(120, CAST(trust_points AS SIGNED) + ?), leaderboard_points = CAST(leaderboard_points AS SIGNED) + ? WHERE phone_number = ?",
                        [honestyReward, honestyReward, prevUser.borrower_phone]
                    );
                } else {
                    await upbsConn.query(
                        "UPDATE members SET trust_points = LEAST(120, CAST(trust_points AS SIGNED) + ?), leaderboard_points = CAST(leaderboard_points AS SIGNED) + ? WHERE CONCAT(firstname, ' ', lastname) = ?",
                        [honestyReward, honestyReward, prevUser.borrowed_by]
                    );
                }
            }
        }

        await upbsConn.commit();
        return res.json({ reply: `Trip ended for Bike ${bicycleCode}. Reply 'GOOD ${bicycleCode}' or 'BROKEN ${bicycleCode}'. Save a photo on your phone as local proof (do not send).` });
    } catch (err) {
        console.error(err);
        if (upbsConn) {
            try {
                await upbsConn.rollback();
            } catch (rbErr) { }
        }
        return res.status(500).json({ error: 'Database error processing done request' });
    } finally {
        if (upbsConn) {
            upbsConn.release();
        }
    }
};

const good = async (req, res) => {
    const { smsSender, bicycleCode } = req.body;
    let upbsConn;
    try {
        upbsConn = await db.upbsPool.getConnection();
        await upbsConn.beginTransaction();

        const [member] = await upbsConn.query("SELECT firstname, lastname FROM members WHERE phone_number = ? AND is_active = 1", [smsSender]);
        if (member.length === 0) {
            await upbsConn.rollback();
            return res.json({ reply: "Sorry, you must be a registered UP Bike Share member to use this service." });
        }
        const currentUserName = `${member[0].firstname} ${member[0].lastname}`;

        const [bike] = await upbsConn.query("SELECT condition_status FROM bicycle_codes WHERE bicycle_code = ? AND is_active = 1 FOR UPDATE", [bicycleCode]);

        if (bike.length === 0 || bike[0].condition_status !== 'Pending_Status') {
            await upbsConn.rollback();
            return res.json({ reply: `Bike ${bicycleCode} is not awaiting a condition check.` });
        }

        const [history] = await upbsConn.query("SELECT id, borrowed_by FROM bicycle_history WHERE bicycle_code = ? ORDER BY id DESC LIMIT 1 FOR UPDATE", [bicycleCode]);

        if (history.length === 0 || history[0].borrowed_by !== currentUserName) {
            await upbsConn.rollback();
            return res.json({ reply: `You are not the borrower of Bike ${bicycleCode} awaiting confirmation.` });
        }

        await upbsConn.query("UPDATE bicycle_codes SET condition_status = 'Good' WHERE bicycle_code = ?", [bicycleCode]);
        await upbsConn.query("UPDATE bicycle_history SET condition_confirmed = 1, reported_condition = 'Good' WHERE id = ?", [history[0].id]);

        // Consistent Rider Logic (Merit System)
        await upbsConn.query("UPDATE members SET consecutive_good_rides = consecutive_good_rides + 1 WHERE phone_number = ?", [smsSender]);

        // Fetch updated consecutive rides and trust points
        const [memberData] = await upbsConn.query("SELECT consecutive_good_rides, trust_points FROM members WHERE phone_number = ?", [smsSender]);
        let congratsMsg = "";
        if (memberData.length > 0) {
            const consecutive = memberData[0].consecutive_good_rides;
            if (consecutive > 0 && consecutive % 5 === 0) {
                const reward = await getSettingValue('consistent_rider_reward', 5, upbsConn);
                await upbsConn.query(
                    "UPDATE members SET trust_points = LEAST(120, CAST(trust_points AS SIGNED) + ?), leaderboard_points = CAST(leaderboard_points AS SIGNED) + ? WHERE phone_number = ?",
                    [reward, reward, smsSender]
                );
                congratsMsg = ` Congratulations! You earned +${reward} bonus points for completing ${consecutive} consecutive clean rides without disputes!`;
            }
        }

        await upbsConn.commit();
        return res.json({ reply: `Thank you! Bike ${bicycleCode} condition confirmed as Good.${congratsMsg}` });
    } catch (err) {
        console.error(err);
        if (upbsConn) {
            try {
                await upbsConn.rollback();
            } catch (rbErr) { }
        }
        return res.status(500).json({ error: 'Database error' });
    } finally {
        if (upbsConn) {
            upbsConn.release();
        }
    }
};

const broken = async (req, res) => {
    const { smsSender, bicycleCode } = req.body;
    let upbsConn;
    try {
        upbsConn = await db.upbsPool.getConnection();
    } catch (dbErr) {
        console.error('Failed to acquire database connection for broken:', dbErr);
        return res.status(500).json({ error: 'Database connection failed' });
    }

    try {
        await upbsConn.beginTransaction();

        const [member] = await upbsConn.query("SELECT firstname, lastname, phone_number FROM members WHERE phone_number = ? AND is_active = 1", [smsSender]);
        if (member.length === 0) {
            await upbsConn.rollback();
            return res.json({ reply: "Sorry, you must be a registered UP Bike Share member to use this service." });
        }
        const currentUserName = `${member[0].firstname} ${member[0].lastname}`;

        const [bike] = await upbsConn.query("SELECT condition_status FROM bicycle_codes WHERE bicycle_code = ? AND is_active = 1", [bicycleCode]);
        if (bike.length === 0) {
            await upbsConn.rollback();
            return res.json({ reply: "Bike not found." });
        }

        if (bike[0].condition_status === 'Disputed') {
            await upbsConn.rollback();
            return res.json({ reply: `Bike ${bicycleCode} is already disputed for admin review.` });
        }
        if (bike[0].condition_status === 'Broken') {
            await upbsConn.rollback();
            return res.json({ reply: `Bike ${bicycleCode} is already reported broken and undergoing repairs.` });
        }
        if (bike[0].condition_status === 'In_Repair') {
            await upbsConn.rollback();
            return res.json({ reply: `Bike ${bicycleCode} is currently reported as delivered and undergoing repairs.` });
        }

        const [history] = await upbsConn.query("SELECT id, borrowed_by, borrower_phone, done_text_received, borrowed_at, previous_location FROM bicycle_history WHERE bicycle_code = ? ORDER BY id DESC LIMIT 2", [bicycleCode]);

        // Determine if this is the immediate user or the next user
        let isImmediateUser = history.length > 0 && history[0].borrowed_by === currentUserName;
        let isAbortedTrip = false;
        let gracePeriodExpired = false;
        let borrowMins = 0;
        let gracePeriodMins = 10;

        // If the current user borrowed the bike but hasn't finished the trip (no done text), 
        // and they are reporting it broken, they are ABORTING their trip and blaming the previous user!
        if (isImmediateUser && history[0].done_text_received === 0) {
            gracePeriodMins = await getSettingValue('abort_trip_grace_period_mins', 15, upbsConn);
            const borrowTimeMs = Date.now() - new Date(history[0].borrowed_at).getTime();
            borrowMins = borrowTimeMs / (1000 * 60);

            if (borrowMins <= gracePeriodMins) {
                isAbortedTrip = true;
                isImmediateUser = false; // Treat them as the next user disputing the bike
            } else {
                isAbortedTrip = false;
                gracePeriodExpired = true;
                // Treated as immediate user self-reporting damage
            }
        }

        if (isImmediateUser) {
            // Immediate user reporting broken (Honesty Policy)
            await upbsConn.query(
                "UPDATE bicycle_codes SET condition_status = 'Broken', dispute_reported_by = ?, broken_reported_at = NOW(), penalty_applied = 0 WHERE bicycle_code = ?",
                [smsSender, bicycleCode]
            );

            await upbsConn.query(
                "UPDATE bicycle_history SET done_text_received = 1, condition_confirmed = 1, reported_condition = 'Broken' WHERE id = ?",
                [history[0].id]
            );

            await upbsConn.query(
                "INSERT INTO Logs (LastName, FirstName, MobileNumber, SenderNumber, DateTime, Request) VALUES (?, ?, ?, ?, NOW(), ?)",
                [member[0].lastname, member[0].firstname, member[0].phone_number, smsSender, 'Broken Report']
            );

            await upbsConn.commit();

            const replyMsg = gracePeriodExpired
                ? `Notice: Your borrow duration of ${Math.round(borrowMins)} mins exceeds the ${gracePeriodMins}-min grace period. This trip has been ended as a self-reported damage. Please return Bike ${bicycleCode} to your destination hub. Once dropped off, text 'delivered ${bicycleCode} [location]' so our team can collect it.`
                : `Thank you for reporting damage on Bike ${bicycleCode}. Please lock and leave it at a station hub. Once dropped off, text 'delivered ${bicycleCode} [location]' so our team can collect it.`;

            return res.json({ reply: replyMsg });
        } else {
            // If the bike is currently actively borrowed by another user, outsiders cannot dispute it to prevent griefing (Scenario 3.4).
            if (bike[0].condition_status === 'Borrowed' && !isAbortedTrip) {
                await upbsConn.rollback();
                return res.json({ reply: `Bike ${bicycleCode} is currently checked out by another member.` });
            }

            if (isAbortedTrip) {
                const startingLocation = history[0].previous_location;
                // Delete the aborted trip from history so the blame correctly falls on the previous user
                await upbsConn.query("DELETE FROM bicycle_history WHERE id = ?", [history[0].id]);
                // Reset the bicycle's location in bicycle_codes back to its starting station
                await upbsConn.query(
                    "UPDATE bicycle_codes SET previous_location = ?, new_location = ? WHERE bicycle_code = ?",
                    [startingLocation, startingLocation, bicycleCode]
                );
                // Shift history array so history[0] points to the previous user for the freeze logic below
                if (history.length > 1) {
                    history[0] = history[1];
                } else {
                    history.shift();
                }
            }

            // Conflict! Next user is reporting it broken after previous user said Good.
            await upbsConn.query(
                "UPDATE bicycle_codes SET condition_status = 'Disputed', dispute_reported_by = ?, broken_reported_at = NOW() WHERE bicycle_code = ?",
                [smsSender, bicycleCode]
            );

            // Log Dispute Request
            await upbsConn.query(
                "INSERT INTO Logs (LastName, FirstName, MobileNumber, SenderNumber, DateTime, Request) VALUES (?, ?, ?, ?, NOW(), ?)",
                [member[0].lastname, member[0].firstname, member[0].phone_number, smsSender, 'Dispute Report']
            );

            // Freeze Previous User
            if (history.length > 0) {
                let prevMemberPhone = history[0].borrower_phone;
                if (!prevMemberPhone && history[0].borrowed_by) {
                    const [prevMember] = await upbsConn.query("SELECT phone_number FROM members WHERE CONCAT(firstname, ' ', lastname) = ?", [history[0].borrowed_by]);
                    if (prevMember.length > 0) {
                        prevMemberPhone = prevMember[0].phone_number;
                    }
                }
                if (prevMemberPhone) {
                    await upbsConn.query("UPDATE members SET points_frozen = 1 WHERE phone_number = ?", [prevMemberPhone]);

                    // Alert the previous user by queueing the outbound alert SMS
                    await smsService.queueSMS(
                        prevMemberPhone,
                        `ALERT: Bike ${bicycleCode} reported broken! Points frozen. Send photo to m(.)me/upbikesharebot (remove parenthesis) or visit UPBS Admin Hub to appeal.`,
                    );
                }
            }
            // Trigger off-dashboard notification (Discord & Email)
            const reporterName = `${member[0].firstname} ${member[0].lastname}`;
            const frozenName = (history.length > 0) ? (history[0].borrowed_by || 'Unknown') : 'Unknown';
            let prevPhone = 'N/A';
            if (history.length > 0) {
                prevPhone = history[0].borrower_phone;
                if (!prevPhone && history[0].borrowed_by) {
                    const [prevMember] = await upbsConn.query("SELECT phone_number FROM members WHERE CONCAT(firstname, ' ', lastname) = ?", [history[0].borrowed_by]);
                    if (prevMember.length > 0) {
                        prevPhone = prevMember[0].phone_number;
                    }
                }
            }

            notificationService.sendDisputeCreatedNotification(
                bicycleCode,
                reporterName,
                smsSender,
                frozenName,
                prevPhone
            ).catch(err => console.error('[Dispute Notifier] Failed:', err.message));

            await upbsConn.commit();
            return res.json({ reply: `Thank you for reporting. Bike ${bicycleCode} is marked as Disputed for admin review. You will be rewarded trust points if this is verified.` });
        }
    } catch (err) {
        console.error('Error during transaction inside broken controller:', err);
        try {
            await upbsConn.rollback();
        } catch (rollbackErr) {
            console.error('Error during transaction rollback:', rollbackErr);
        }
        return res.status(500).json({ error: 'Database transaction error' });
    } finally {
        if (upbsConn) {
            upbsConn.release();
        }
    }
};

const missing = async (req, res) => {
    const { smsSender, bicycleCode } = req.body;
    let upbsConn;

    try {
        upbsConn = await db.upbsPool.getConnection();
        await upbsConn.beginTransaction();

        const [member] = await upbsConn.query("SELECT firstname, lastname, phone_number FROM members WHERE phone_number = ? AND is_active = 1", [smsSender]);
        if (member.length === 0) {
            await upbsConn.rollback();
            return res.json({ reply: "Sorry, you must be a registered UP Bike Share member to use this service." });
        }
        const currentUserName = `${member[0].firstname} ${member[0].lastname}`;

        const [bike] = await upbsConn.query("SELECT condition_status FROM bicycle_codes WHERE bicycle_code = ? AND (is_active = 1 OR is_active IS NULL)", [bicycleCode]);
        if (bike.length === 0) {
            await upbsConn.rollback();
            return res.json({ reply: "Bike not found." });
        }

        if (bike[0].condition_status === 'Disputed') {
            await upbsConn.rollback();
            return res.json({ reply: `Bike ${bicycleCode} is already disputed for admin review.` });
        }
        if (bike[0].condition_status === 'Missing') {
            await upbsConn.rollback();
            return res.json({ reply: `Bike ${bicycleCode} is already reported missing and under investigation.` });
        }
        if (bike[0].condition_status === 'In_Repair') {
            await upbsConn.rollback();
            return res.json({ reply: `Bike ${bicycleCode} is currently undergoing repairs.` });
        }
        if (bike[0].condition_status === 'Broken') {
            await upbsConn.rollback();
            return res.json({ reply: `Bike ${bicycleCode} is already reported broken and undergoing repairs.` });
        }

        if (bike[0].condition_status === 'Borrowed' || bike[0].condition_status === 'Pending_Status') {
            await upbsConn.rollback();
            return res.json({ reply: `Bike ${bicycleCode} is currently checked out by another member or pending a condition check.` });
        }

        // It is currently Good, but they can't find it.
        await upbsConn.query(
            "UPDATE bicycle_codes SET condition_status = 'Missing', dispute_reported_by = ?, broken_reported_at = NOW() WHERE bicycle_code = ?",
            [smsSender, bicycleCode]
        );

        await upbsConn.query(
            "INSERT INTO Logs (LastName, FirstName, MobileNumber, SenderNumber, DateTime, Request) VALUES (?, ?, ?, ?, NOW(), ?)",
            [member[0].lastname, member[0].firstname, member[0].phone_number, smsSender, 'Missing Report']
        );

        const [history] = await upbsConn.query("SELECT id, borrowed_by, borrower_phone FROM bicycle_history WHERE bicycle_code = ? ORDER BY id DESC LIMIT 1", [bicycleCode]);

        if (history.length > 0) {
            let prevMemberPhone = history[0].borrower_phone;
            if (!prevMemberPhone && history[0].borrowed_by) {
                const [prevMember] = await upbsConn.query("SELECT phone_number FROM members WHERE CONCAT(firstname, ' ', lastname) = ?", [history[0].borrowed_by]);
                if (prevMember.length > 0) {
                    prevMemberPhone = prevMember[0].phone_number;
                }
            }
            if (prevMemberPhone) {
                await upbsConn.query("UPDATE members SET points_frozen = 1 WHERE phone_number = ?", [prevMemberPhone]);

                // Alert the previous user by queueing the outbound alert SMS
                await smsService.queueSMS(
                    prevMemberPhone,
                    `ALERT: Bike ${bicycleCode} reported MISSING! Points frozen. Send photo to m(.)me/upbikesharebot (remove parenthesis) or visit UPBS Admin Hub to appeal.`,
                    upbsConn
                );
            }

            // Trigger admin/Discord notifications for the missing bike report
            try {
                const prevMemberName = history[0].borrowed_by || 'Unknown';
                const reporterName = currentUserName;
                const reporterPhone = smsSender;

                const notificationService = require('../services/notificationService');
                await notificationService.sendMissingCreatedNotification(
                    bicycleCode,
                    reporterName,
                    reporterPhone,
                    prevMemberName,
                    prevMemberPhone || 'N/A'
                );
            } catch (notifyErr) {
                console.error('[Missing Alert] Failed to dispatch admin notifications:', notifyErr.message);
            }
        }

        await upbsConn.commit();
        return res.json({ reply: `Thank you for reporting. Bike ${bicycleCode} is marked as Missing for admin review. You will be rewarded trust points if this is verified.` });

    } catch (err) {
        console.error('Error during transaction inside missing controller:', err);
        if (upbsConn) await upbsConn.rollback();
        return res.status(500).json({ error: 'Database transaction error' });
    } finally {
        if (upbsConn) upbsConn.release();
    }
};

const delivered = async (req, res) => {
    const { smsSender, bicycleCode, deliveryLocation } = req.body;
    let upbsConn;

    if (!deliveryLocation) {
        return res.json({ reply: `Please specify the station where you delivered Bike ${bicycleCode}. Example: delivered ${bicycleCode} engg` });
    }

    try {
        upbsConn = await db.upbsPool.getConnection();
        await upbsConn.beginTransaction();

        const [member] = await upbsConn.query("SELECT firstname, lastname, phone_number FROM members WHERE phone_number = ? AND is_active = 1", [smsSender]);
        if (member.length === 0) {
            await upbsConn.rollback();
            return res.json({ reply: "Sorry, you must be a registered UP Bike Share member to use this service." });
        }
        const currentUserName = `${member[0].firstname} ${member[0].lastname}`;

        // Validate the delivery location
        const [locCheck] = await upbsConn.query("SELECT * FROM locations WHERE location_name = ? AND is_active = 1 AND (is_disabled = 0 OR is_disabled IS NULL)", [deliveryLocation]);
        if (locCheck.length === 0) {
            await upbsConn.rollback();
            return res.json({ reply: `Location '${deliveryLocation}' is not valid or currently offline.` });
        }

        const [bike] = await upbsConn.query("SELECT condition_status FROM bicycle_codes WHERE bicycle_code = ? AND is_active = 1 FOR UPDATE", [bicycleCode]);
        if (bike.length === 0) {
            await upbsConn.rollback();
            return res.json({ reply: `Bike ${bicycleCode} not found.` });
        }
        if (bike[0].condition_status === 'Disputed') {
            await upbsConn.rollback();
            return res.json({ reply: `Bike ${bicycleCode} is currently disputed and can only be resolved by an administrator.` });
        }
        if (bike[0].condition_status === 'In_Repair') {
            await upbsConn.rollback();
            return res.json({ reply: `Bike ${bicycleCode} is currently reported as delivered and undergoing repairs.` });
        }

        // Close any active or pending return trip for this user on this bike
        const [activeTrip] = await upbsConn.query(
            "SELECT id FROM bicycle_history WHERE bicycle_code = ? AND borrowed_by = ? AND (done_text_received = 0 OR (done_text_received = 1 AND condition_confirmed = 0)) ORDER BY id DESC LIMIT 1 FOR UPDATE",
            [bicycleCode, currentUserName]
        );

        if (activeTrip.length === 0 && bike[0].condition_status !== 'Broken' && bike[0].condition_status !== 'Missing') {
            await upbsConn.rollback();
            return res.json({ reply: `Bike ${bicycleCode} is not reported as Broken or Missing. Only damaged/missing bikes need maintenance delivery.` });
        }

        if (activeTrip.length > 0) {
            await upbsConn.query(
                "UPDATE bicycle_history SET done_text_received = 1, condition_confirmed = 1, reported_condition = 'Broken' WHERE id = ?",
                [activeTrip[0].id]
            );
        }

        // Check if the person delivering is the borrower who broke/used it
        const [lastHistory] = await upbsConn.query(
            "SELECT borrowed_by, reported_condition, to_location FROM bicycle_history WHERE bicycle_code = ? ORDER BY id DESC LIMIT 1",
            [bicycleCode]
        );
        const isBorrowerWhoBrokeIt = (activeTrip.length > 0) || (lastHistory.length > 0 && lastHistory[0].borrowed_by === currentUserName && lastHistory[0].reported_condition === 'Broken');

        let replyMessage = '';

        if (isBorrowerWhoBrokeIt) {
            // Update the status to 'Broken' (awaiting admin pickup for repair) and update the location
            await upbsConn.query(
                "UPDATE bicycle_codes SET condition_status = 'Broken', new_location = ?, dispute_reported_by = ?, broken_reported_at = COALESCE(broken_reported_at, NOW()) WHERE bicycle_code = ?",
                [deliveryLocation, smsSender, bicycleCode]
            );
            replyMessage = `Thank you! Bike ${bicycleCode} has been delivered to ${deliveryLocation.toUpperCase()} and marked as Broken. An admin will collect it for repair.`;
        } else {
            // Volunteer delivery - set to 'Pending_Delivery', do NOT reward points yet, ask for photo proof
            const reward = await getSettingValue('reward_delivered_bike', 5, upbsConn);
            await upbsConn.query(
                "UPDATE bicycle_codes SET condition_status = 'Pending_Delivery', new_location = ?, dispute_reported_by = ?, dispute_image_url = NULL, broken_reported_at = COALESCE(broken_reported_at, NOW()) WHERE bicycle_code = ?",
                [deliveryLocation, smsSender, bicycleCode]
            );
            replyMessage = `Thank you! Bike ${bicycleCode} has been reported as delivered to ${deliveryLocation.toUpperCase()}. To confirm your +${reward} trust points, please take a clear picture of the bike at the hub and upload it to our Facebook Messenger bot.`;

            // Alert admins
            try {
                const notificationService = require('../services/notificationService');
                const fullName = `${member[0].firstname} ${member[0].lastname}`;
                await notificationService.sendAdminSmsAlert(`UPBS ALERT: Bike ${bicycleCode} reported delivered to ${deliveryLocation.toUpperCase()} by volunteer ${fullName} (${smsSender}). Photo upload pending.`);
            } catch (err) {
                console.error('[Delivered Alert] Failed to send admin alert:', err.message);
            }
        }

        await upbsConn.query(
            "INSERT INTO Logs (LastName, FirstName, MobileNumber, SenderNumber, DateTime, Request) VALUES (?, ?, ?, ?, NOW(), ?)",
            [member[0].lastname, member[0].firstname, member[0].phone_number, smsSender, `Delivered to ${deliveryLocation.toUpperCase()}`]
        );

        await upbsConn.commit();
        return res.json({ reply: replyMessage });
    } catch (err) {
        console.error(err);
        if (upbsConn) {
            try {
                await upbsConn.rollback();
            } catch (rbErr) { }
        }
        return res.status(500).json({ error: 'Database error' });
    } finally {
        if (upbsConn) {
            upbsConn.release();
        }
    }
};

// Handle points command
const points = async (req, res) => {
    const { smsSender } = req.body;

    try {
        const [memberData] = await db.upbsPool.query('SELECT trust_points FROM members WHERE phone_number = ? AND is_active = 1', [smsSender]);

        if (memberData.length === 0) {
            return res.json({ reply: "Sorry, you must be a registered UP Bike Share member to use this service." });
        }

        const trustPoints = memberData[0].trust_points;
        return res.json({ reply: `Your current UP Bike Share trust points: ${trustPoints}. Keep it up!` });

    } catch (err) {
        console.error('Error in points controller:', err);
        return res.json({ reply: "An error occurred while fetching your points." });
    }
};

module.exports = {
    search,
    searchAll,
    locations,
    usage,
    borrow,
    getBicycles,
    getLocations,
    getHistory,
    done,
    good,
    broken,
    delivered,
    missing,
    points
};
