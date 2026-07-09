const db = require('../db');
const smsService = require('./smsService');

/**
 * Queues an SMS alert to all configured admin phone numbers.
 */
async function sendAdminSmsAlert(message) {
    try {
        const [rows] = await db.upbsPool.query(
            "SELECT setting_name, setting_value FROM system_settings WHERE setting_name IN ('admin_alert_phone_1', 'admin_alert_phone_2')"
        );
        for (const row of rows) {
            const phone = row.setting_value ? row.setting_value.trim() : '';
            if (phone) {
                console.log(`[Notification] Queueing Admin SMS Alert to ${phone}: "${message}"`);
                await smsService.queueSMS(phone, message);
            }
        }
    } catch (err) {
        console.error('[Notification] Failed to send Admin SMS Alert:', err.message);
    }
}

/**
 * Sends a rich embed notification to a Discord channel via webhook.
 */
async function sendDiscordNotification(studentName, phoneNumber, bikeCode, imageUrl, status = 'Disputed') {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
        console.log('[Notification] DISCORD_WEBHOOK_URL not configured. Skipping Discord alert.');
        return;
    }

    const title = status === 'Missing' ? "🔔 New Missing Bike Appeal Submitted" : "🔔 New Dispute Appeal Submitted";
    const description = status === 'Missing'
        ? `A student has submitted an appeal photo showing they returned Bike #${bikeCode} (reported missing). Please review and resolve this report in the UP Bikeshare Admin Dashboard.`
        : `A student has submitted an appeal photo for their frozen account. Please review and resolve this dispute in the UP Bikeshare Admin Dashboard.`;

    const payload = {
        embeds: [{
            title,
            color: 8065299, // Crimson/maroon tone
            fields: [
                { name: "Student Name", value: studentName, inline: true },
                { name: "Phone Number", value: phoneNumber, inline: true },
                { name: "Bicycle Code", value: `Bike #${bikeCode}`, inline: true }
            ],
            image: { url: imageUrl },
            description,
            timestamp: new Date().toISOString()
        }]
    };

    try {
        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            console.error(`[Notification] Discord webhook returned status ${res.status}`);
        } else {
            console.log(`[Notification] Discord webhook alert sent successfully for Bike #${bikeCode}`);
        }
    } catch (err) {
        console.error('[Notification] Failed to send Discord webhook:', err.message);
    }
}

/**
 * Sends a notification when a bike is disputed (before the photo is uploaded).
 */
async function sendDisputeCreatedNotification(bikeCode, reporterName, reporterPhone, frozenName, frozenPhone) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    
    // Asynchronously send SMS alerts to admin contacts
    sendAdminSmsAlert(`UPBS ALERT: Bike ${bikeCode} reported broken by next user. Prev borrower ${frozenName || 'Unknown'} (${frozenPhone}) points frozen. Review in dashboard.`)
        .catch(err => console.error('[Notification] Failed to trigger admin SMS alert:', err.message));

    if (webhookUrl) {
        const payload = {
            embeds: [{
                title: "⚠️ New Dispute Flagged",
                color: 16753920, // Orange warning color
                fields: [
                    { name: "Bicycle Code", value: `Bike #${bikeCode}`, inline: true },
                    { name: "Reported By (Next Rider)", value: `${reporterName} (${reporterPhone})`, inline: true },
                    { name: "Frozen Account (Prev Rider)", value: `${frozenName ? `${frozenName} (${frozenPhone})` : frozenPhone}`, inline: true }
                ],
                description: `Bike #${bikeCode} has been reported broken by the next user. The previous borrower's account has been frozen pending a Messenger appeal photo.`,
                timestamp: new Date().toISOString()
            }]
        };

        try {
            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                console.error(`[Notification] Discord warning returned status ${res.status}`);
            } else {
                console.log(`[Notification] Discord dispute warning sent for Bike #${bikeCode}`);
            }
        } catch (err) {
            console.error('[Notification] Failed to send Discord warning:', err.message);
        }
    }
}

/**
 * Sends a notification when a bike is reported missing (before the photo is uploaded).
 */
async function sendMissingCreatedNotification(bikeCode, reporterName, reporterPhone, frozenName, frozenPhone) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    
    // Asynchronously send SMS alerts to admin contacts
    sendAdminSmsAlert(`UPBS ALERT: Bike ${bikeCode} reported MISSING by ${reporterName} (${reporterPhone}). Prev borrower ${frozenName || 'Unknown'} (${frozenPhone}) points frozen.`)
        .catch(err => console.error('[Notification] Failed to trigger admin SMS alert:', err.message));

    if (webhookUrl) {
        const payload = {
            embeds: [{
                title: "🚨 Bike Reported Missing",
                color: 16515840, // Red warning color
                fields: [
                    { name: "Bicycle Code", value: `Bike #${bikeCode}`, inline: true },
                    { name: "Reported By (Reporter)", value: `${reporterName} (${reporterPhone})`, inline: true },
                    { name: "Frozen Account (Prev Rider)", value: `${frozenName ? `${frozenName} (${frozenPhone})` : frozenPhone}`, inline: true }
                ],
                description: `Bike #${bikeCode} has been reported missing. The previous borrower's account has been frozen pending investigation / Messenger photo appeal.`,
                timestamp: new Date().toISOString()
            }]
        };

        try {
            const res = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                console.error(`[Notification] Discord webhook returned status ${res.status}`);
            }
        } catch (err) {
            console.error('[Notification] Failed to send Discord webhook:', err.message);
        }
    }
}

/**
 * Checks if a member's trust score has dropped below the suspension limit, and if so, sends an alert to administrators.
 */
async function checkAndAlertSuspension(phoneNumber, conn = null) {
    try {
        const pool = conn || db.upbsPool;
        const [memberRows] = await pool.query(
            "SELECT firstname, lastname, trust_points FROM members WHERE phone_number = ? AND is_active = 1",
            [phoneNumber]
        );
        if (memberRows.length === 0) return;
        const member = memberRows[0];

        const [settingRows] = await pool.query(
            "SELECT setting_value FROM system_settings WHERE setting_name = 'suspension_limit'"
        );
        const suspensionLimit = settingRows.length > 0 ? parseInt(settingRows[0].setting_value, 10) : 50;

        if (member.trust_points < suspensionLimit) {
            const alertMsg = `UPBS ALERT: Account suspended for ${member.firstname} ${member.lastname} (${phoneNumber}). Trust score is ${member.trust_points} points (limit is ${suspensionLimit}).`;
            console.log(`[Suspension Sync] Account suspended. Sending alert: ${alertMsg}`);
            await sendAdminSmsAlert(alertMsg);
        }
    } catch (err) {
        console.error('[Notification] Failed to check and alert suspension:', err.message);
    }
}

module.exports = { sendDiscordNotification, sendDisputeCreatedNotification, sendMissingCreatedNotification, sendAdminSmsAlert, checkAndAlertSuspension };
