const db = require('../db');

// POST /api/invalid-command
const invalidCommand = async (req, res) => {
    const { smsSender, messageId } = req.body;

    if (!smsSender || !messageId) {
        return res.status(400).json({ error: 'smsSender and messageId are required' });
    }

    try {
        // Retrieve member details to determine registration status
        const memberQuery = "SELECT lastname, firstname, phone_number, trust_points, points_frozen FROM members WHERE phone_number = ?";
        const [memberRecords] = await db.upbsPool.query(memberQuery, [smsSender]);
        const isRegistered = memberRecords.length > 0;

        let replyMessage = "";

        if (isRegistered) {
            const user = memberRecords[0];
            const [settingRows] = await db.upbsPool.query("SELECT setting_value FROM system_settings WHERE setting_name = 'suspension_limit'");
            const suspensionLimit = (settingRows.length > 0) ? parseInt(settingRows[0].setting_value, 10) : 50;

            if (user.points_frozen == 1 || user.points_frozen === true || user.points_frozen === 'true') {
                replyMessage = "Account frozen due to dispute. To settle: send photo to m(.)me/upbikesharebot (remove parenthesis) or visit UP Bikeshare Admin Hub.";
            } else if (user.trust_points < suspensionLimit) {
                replyMessage = `Account suspended (${user.trust_points} pts). To lift: deliver missing/broken bikes to hubs, or message m(.)me/upbikesharebot (remove parenthesis) or visit Admin Hub.`;
            } else {
                replyMessage = 'Invalid Command. Send "bikeshare help" for list of available commands.';
            }
            
            // Check if this invalid command attempt has already been logged
            const checkQuery = "SELECT * FROM invalid_command_senders WHERE phone_number = ? AND message_id = ?";
            const [existing] = await db.upbsPool.query(checkQuery, [smsSender, messageId]);

            if (existing.length === 0) {
                try {
                    const insertQuery = "INSERT IGNORE INTO invalid_command_senders (phone_number, message_id) VALUES (?, ?)";
                    await db.upbsPool.query(insertQuery, [smsSender, messageId]);

                    const userLogInfo = memberRecords[0];

                    const logQuery = `
                        INSERT INTO Logs (LastName, FirstName, MobileNumber, SenderNumber, DateTime, Request, MessageID) 
                        VALUES (?, ?, ?, ?, NOW(), ?, ?)
                    `;
                    await db.upbsPool.query(logQuery, [
                        userLogInfo.lastname,
                        userLogInfo.firstname,
                        userLogInfo.phone_number,
                        smsSender,
                        'Invalid Command',
                        messageId
                    ]);
                } catch (logErr) {
                    console.error('Logging failed for invalid command (swallowed):', logErr.message);
                }
            }
        } else {
            replyMessage = "Sorry, you are not registered with UP Bike Share.";

            // Check if this non-registered attempt has already been logged
            const checkQuery = "SELECT * FROM non_registered_senders WHERE phone_number = ? AND message_id = ?";
            const [existing] = await db.upbsPool.query(checkQuery, [smsSender, messageId]);

            if (existing.length === 0) {
                try {
                    const insertQuery = "INSERT IGNORE INTO non_registered_senders (phone_number, message_id) VALUES (?, ?)";
                    await db.upbsPool.query(insertQuery, [smsSender, messageId]);

                    const logQuery = `
                        INSERT INTO Logs (LastName, FirstName, MobileNumber, SenderNumber, DateTime, Request, MessageID) 
                        VALUES (NULL, NULL, NULL, ?, NOW(), ?, ?)
                    `;
                    await db.upbsPool.query(logQuery, [
                        smsSender,
                        'Non-Registered',
                        messageId
                    ]);
                } catch (logErr) {
                    console.error('Logging failed for non-registered sender (swallowed):', logErr.message);
                }
            }
        }

        return res.json({ reply: replyMessage });

    } catch (err) {
        console.error('Error in invalidCommand controller:', err);
        res.status(500).json({ error: 'Database error processing invalid command' });
    }
};

// POST /api/non-registered
const nonRegistered = async (req, res) => {
    const { smsSender, messageId } = req.body;

    if (!smsSender || !messageId) {
        return res.status(400).json({ error: 'smsSender and messageId are required' });
    }

    try {
        // 1. Check if this non-registered attempt has already been logged for this message ID
        const checkQuery = "SELECT * FROM non_registered_senders WHERE phone_number = ? AND message_id = ?";
        const [existing] = await db.upbsPool.query(checkQuery, [smsSender, messageId]);

        const replyMessage = "Sorry, you are not registered with UP Bike Share.";

        if (existing.length === 0) {
            try {
                // Log it in non_registered_senders using IGNORE to skip duplicate key warnings
                const insertQuery = "INSERT IGNORE INTO non_registered_senders (phone_number, message_id) VALUES (?, ?)";
                await db.upbsPool.query(insertQuery, [smsSender, messageId]);

                // Log request in Logs table (since non-registered, name and phone fields are null)
                const logQuery = `
                    INSERT INTO Logs (LastName, FirstName, MobileNumber, SenderNumber, DateTime, Request, MessageID) 
                    VALUES (NULL, NULL, NULL, ?, NOW(), ?, ?)
                `;
                await db.upbsPool.query(logQuery, [
                    smsSender,
                    'Non-Registered',
                    messageId
                ]);
            } catch (logErr) {
                console.error('Logging failed for non-registered sender (swallowed):', logErr.message);
            }
        }

        return res.json({ reply: replyMessage });

    } catch (err) {
        console.error('Error in nonRegistered controller:', err);
        res.status(500).json({ error: 'Database error processing non-registered sender log' });
    }
};

module.exports = {
    invalidCommand,
    nonRegistered
};
