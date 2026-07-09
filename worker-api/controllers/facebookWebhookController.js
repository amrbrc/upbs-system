const db = require('../db');
const notificationService = require('../services/notificationService');

// Helper to send messages back to the user via Meta's Send API using built-in fetch
async function sendFbMessage(recipientPsid, messageText) {
    const pageAccessToken = process.env.FB_PAGE_ACCESS_TOKEN;
    if (!pageAccessToken) {
        console.error('[FB Bot] Missing FB_PAGE_ACCESS_TOKEN environment variable.');
        return;
    }

    try {
        const response = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recipient: { id: recipientPsid },
                message: { text: messageText }
            })
        });
        const result = await response.json();
        if (result.error) {
            console.error('[FB Bot] Send API error:', result.error);
        } else {
            console.log(`[FB Bot] Message sent to PSID ${recipientPsid}: "${messageText.substring(0, 30)}..."`);
        }
    } catch (err) {
        console.error('[FB Bot] Fetch error calling Send API:', err);
    }
}

// Helper to send vertical stacked buttons (Button Template) after conversation finishes
async function sendFbCompletionButtons(recipientPsid, textMessage = "Select an option below to continue:") {
    const pageAccessToken = process.env.FB_PAGE_ACCESS_TOKEN;
    if (!pageAccessToken) return;

    try {
        const response = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recipient: { id: recipientPsid },
                message: {
                    attachment: {
                        type: "template",
                        payload: {
                            template_type: "button",
                            text: textMessage,
                            buttons: [
                                {
                                    type: "postback",
                                    title: "🚲 File Appeal",
                                    payload: "RESET"
                                },
                                {
                                    type: "postback",
                                    title: "🔄 Start Over",
                                    payload: "RESET"
                                }
                            ]
                        }
                    }
                }
            })
        });
        const result = await response.json();
        if (result.error) {
            console.error('[FB Bot] Completion buttons Send API error:', result.error);
        } else {
            console.log(`[FB Bot] Vertical completion buttons sent to PSID ${recipientPsid}`);
        }
    } catch (err) {
        console.error('[FB Bot] Error sending completion buttons:', err);
    }
}

// Helper to send buttons specifically for suspended users to request Community Service
async function sendFbSuspendedButtons(recipientPsid, textMessage = "Select an option below to continue:") {
    const pageAccessToken = process.env.FB_PAGE_ACCESS_TOKEN;
    if (!pageAccessToken) return;

    try {
        const response = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recipient: { id: recipientPsid },
                message: {
                    attachment: {
                        type: "template",
                        payload: {
                            template_type: "button",
                            text: textMessage,
                            buttons: [
                                {
                                    type: "postback",
                                    title: "🤝 Req Comm Service",
                                    payload: "SIGNUP_COMMUNITY_SERVICE"
                                },
                                {
                                    type: "postback",
                                    title: "🔄 Start Over",
                                    payload: "RESET"
                                }
                            ]
                        }
                    }
                }
            })
        });
        const result = await response.json();
        if (result.error) {
            console.error('[FB Bot] Suspended buttons Send API error:', result.error);
        } else {
            console.log(`[FB Bot] Vertical suspended buttons sent to PSID ${recipientPsid}`);
        }
    } catch (err) {
        console.error('[FB Bot] Error sending suspended buttons:', err);
    }
}

// GET /api/webhook/facebook - Webhook verification
const verifyWebhook = (req, res) => {
    const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'upbs_secure_webhook_2026';
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('[FB Webhook] Verification successful!');
            return res.status(200).send(challenge);
        } else {
            console.warn('[FB Webhook] Verification failed. Invalid verify token.');
            return res.sendStatus(403);
        }
    }
    return res.sendStatus(400);
};

// POST /api/webhook/facebook - Incoming message handler
const handleWebhookEvent = async (req, res) => {
    const body = req.body;

    if (body.object === 'page') {
        // Iterate over each entry - there may be multiple if batched
        for (const entry of body.entry) {
            if (!entry.messaging) continue;

            for (const webhookEvent of entry.messaging) {
                const senderPsid = webhookEvent.sender.id;

                // 1. Handle standard message events (text, attachments)
                if (webhookEvent.message) {
                    const message = webhookEvent.message;
                    if (message.text || message.attachments) {
                        try {
                            await processIncomingMessage(senderPsid, message);
                        } catch (err) {
                            console.error('[FB Bot] Error processing message:', err);
                            await sendFbMessage(senderPsid, 'Sorry, there was a system error processing your request. Please try again later.');
                        }
                    }
                }

                // 2. Handle postback events (Get Started, Ice Breakers, button clicks)
                if (webhookEvent.postback) {
                    const payload = webhookEvent.postback.payload;
                    if (payload) {
                        // Map the payload to text commands so it feeds into the existing state machine
                        const simulatedMessage = { text: payload };
                        try {
                            await processIncomingMessage(senderPsid, simulatedMessage);
                        } catch (err) {
                            console.error('[FB Bot] Error processing postback:', err);
                            await sendFbMessage(senderPsid, 'Sorry, there was a system error processing your request. Please try again later.');
                        }
                    }
                }
            }
        }
        return res.status(200).send('EVENT_RECEIVED');
    } else {
        return res.sendStatus(404);
    }
};

async function processIncomingMessage(psid, message) {
    const rawText = message.text ? message.text.trim() : '';
    const upperText = rawText.toUpperCase();

    // 1. Check if the user wants to reset or start over
    if (upperText === 'RESET' || upperText === 'START' || upperText === 'HELLO' || upperText === 'HI') {
        await db.upbsPool.query(
            'INSERT INTO fb_bot_sessions (psid, bot_state) VALUES (?, ?) ON DUPLICATE KEY UPDATE bot_state = ?, phone_number = NULL',
            [psid, 'AWAITING_PHONE', 'AWAITING_PHONE']
        );
        await sendFbMessage(
            psid,
            'Welcome to the UP Bikeshare Dispute Appeal Bot! 🚲\n\nTo begin, please reply with your registered phone number (e.g. +639XXXXXXXXX or 09XXXXXXXXX) to verify your account.'
        );
        return;
    }

    // Handle Community Service Request
    if (upperText === 'SIGNUP_COMMUNITY_SERVICE' || upperText === 'COMMUNITY SERVICE' || upperText === 'COMMUNITY_SERVICE') {
        const [sessions] = await db.upbsPool.query('SELECT * FROM fb_bot_sessions WHERE psid = ?', [psid]);
        const session = sessions.length > 0 ? sessions[0] : null;

        if (!session || !session.phone_number) {
            await sendFbMessage(psid, 'Please reply with your registered phone number first so we can schedule your Community Service shift.');
            return;
        }

        const [members] = await db.upbsPool.query(
            'SELECT firstname, lastname, phone_number, trust_points FROM members WHERE phone_number = ?',
            [session.phone_number]
        );
        const member = members.length > 0 ? members[0] : { firstname: 'Student', lastname: '', trust_points: 0 };
        const studentName = `${member.firstname} ${member.lastname}`.trim();

        await sendFbMessage(
            psid,
            `Thank you for volunteering for UP Bikeshare Community Service! 🚲🤝\n\nWe have logged your request for ${studentName} (${session.phone_number}). Our Student Committee / Hub Coordinator will reach out to you directly via Facebook Messenger or SMS within 24 hours to schedule your volunteer station shift.\n\nOnce completed, an admin will award points to restore your account standing!`
        );

        // Notify Admins via SMS
        notificationService.sendAdminSmsAlert(`UPBS ALERT: Suspended member ${studentName} (${session.phone_number}) requested Community Service shift via FB Messenger.`)
            .catch(err => console.error('[FB Bot] Async Admin SMS alert failed:', err.message));

        // Notify Admins via Discord Webhook
        try {
            const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
            if (webhookUrl) {
                const payload = {
                    embeds: [{
                        title: "🤝 New Community Service Volunteer Request",
                        color: 3066993,
                        fields: [
                            { name: "Volunteer Name", value: studentName, inline: true },
                            { name: "Phone Number", value: session.phone_number, inline: true },
                            { name: "Current Trust Score", value: `${member.trust_points} pts`, inline: true }
                        ],
                        description: `A suspended student requested to schedule a Community Service shift via FB Messenger to restore their account standing.`,
                        timestamp: new Date().toISOString()
                    }]
                };
                await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }
        } catch (discordErr) {
            console.error('[FB Bot] Failed to send Discord comm service notification:', discordErr.message);
        }

        await db.upbsPool.query('UPDATE fb_bot_sessions SET bot_state = ? WHERE psid = ?', ['COMPLETED', psid]);
        return;
    }

    // 2. Fetch or initialize the user's session
    const [sessions] = await db.upbsPool.query('SELECT * FROM fb_bot_sessions WHERE psid = ?', [psid]);
    
    let session;
    if (sessions.length === 0) {
        // Create new session
        await db.upbsPool.query('INSERT INTO fb_bot_sessions (psid, bot_state) VALUES (?, ?)', [psid, 'AWAITING_PHONE']);
        session = { psid, bot_state: 'AWAITING_PHONE', phone_number: null };
        await sendFbMessage(
            psid,
            'Welcome to the UP Bikeshare Dispute Appeal Bot! 🚲\n\nTo begin, please reply with your registered phone number (e.g. +639XXXXXXXXX or 09XXXXXXXXX) to verify your account.'
        );
        return;
    } else {
        session = sessions[0];
    }

    // 3. State Machine logic
    if (session.bot_state === 'AWAITING_PHONE') {
        // We expect a phone number input
        if (!rawText) {
            await sendFbMessage(psid, 'Please enter your registered phone number to verify your account.');
            return;
        }

        // Normalize phone number
        let normalizedPhone = rawText;
        if (normalizedPhone.startsWith('09') && normalizedPhone.length === 11) {
            normalizedPhone = '+63' + normalizedPhone.substring(1);
        } else if (normalizedPhone.startsWith('9') && normalizedPhone.length === 10) {
            normalizedPhone = '+63' + normalizedPhone;
        } else if (normalizedPhone.startsWith('639') && normalizedPhone.length === 12) {
            normalizedPhone = '+' + normalizedPhone;
        }

        // Validate member exists and is active
        const [members] = await db.upbsPool.query(
            'SELECT firstname, lastname, phone_number, points_frozen, trust_points FROM members WHERE phone_number = ? AND is_active = 1',
            [normalizedPhone]
        );

        if (members.length === 0) {
            await sendFbMessage(psid, `We couldn't find a registered member with the phone number "${rawText}". Please make sure you typed it correctly.`);
            return;
        }

        const member = members[0];

        // Fetch suspension limit setting
        const [settingRows] = await db.upbsPool.query(
            "SELECT setting_value FROM system_settings WHERE setting_name = 'suspension_limit'"
        );
        const suspensionLimit = settingRows.length > 0 ? parseInt(settingRows[0].setting_value, 10) : 50;

        // 1. First check if there is a pending delivery for this volunteer phone number (even if suspended, delivering earns +5 pts!)
        const [pendingDeliveries] = await db.upbsPool.query(
            "SELECT bicycle_code, new_location FROM bicycle_codes WHERE condition_status = 'Pending_Delivery' AND dispute_reported_by = ?",
            [normalizedPhone]
        );

        if (pendingDeliveries.length > 0) {
            const delivery = pendingDeliveries[0];
            await db.upbsPool.query(
                'UPDATE fb_bot_sessions SET phone_number = ?, bot_state = ? WHERE psid = ?',
                [normalizedPhone, 'WAITING_DELIVERY_PHOTO', psid]
            );
            await sendFbMessage(
                psid,
                `Account verified: ${member.firstname} ${member.lastname}.\n\nWe found a pending volunteer delivery report for Bike #${delivery.bicycle_code} at ${delivery.new_location.toUpperCase()}.\n\nPlease upload/send a clear photo of the bike at the hub now to request admin confirmation and claim your +5 points!`
            );
            return;
        }

        if (member.trust_points < suspensionLimit) {
            // Save phone number and bot state
            await db.upbsPool.query(
                'UPDATE fb_bot_sessions SET phone_number = ? WHERE psid = ?',
                [normalizedPhone, psid]
            );
            await sendFbSuspendedButtons(
                psid,
                `Hello ${member.firstname}! Your account (${normalizedPhone}) is currently SUSPENDED due to low trust score (${member.trust_points} pts, below limit ${suspensionLimit}).\n\nTap '🤝 Req Comm Service' below to request a volunteer station shift, or deliver missing/broken bikes to a hub (+5 pts)!`
            );
            return;
        }

        if (member.points_frozen !== 1) {
            await sendFbCompletionButtons(
                psid,
                `Hello ${member.firstname}! Your account (associated with ${normalizedPhone}) is currently in good standing (not frozen). You do not need to file an appeal. If you have any questions, feel free to contact us!`
            );
            return;
        }

        // Find the disputed/missing bicycle code and the last trip of this member
        const [disputes] = await db.upbsPool.query(
            `SELECT bc.bicycle_code, bc.condition_status, bh.id AS history_id
             FROM bicycle_codes bc
             JOIN bicycle_history bh ON bc.bicycle_code = bh.bicycle_code
             WHERE bc.condition_status IN ('Disputed', 'Missing') 
               AND (bh.borrower_phone = ? OR bh.borrowed_by = ?)
             ORDER BY bh.borrowed_at DESC LIMIT 1`,
            [normalizedPhone, `${member.firstname} ${member.lastname}`]
        );

        if (disputes.length === 0) {
            await sendFbCompletionButtons(
                psid,
                `Hello ${member.firstname}. Your points are frozen, but we couldn't automatically locate an active dispute ticket for your last trip. Please contact page administrators directly for manual resolution.`
            );
            return;
        }

        const dispute = disputes[0];

        // Save phone number and transit state to AWAITING_PHOTO
        await db.upbsPool.query(
            'UPDATE fb_bot_sessions SET phone_number = ?, bot_state = ? WHERE psid = ?',
            [normalizedPhone, 'AWAITING_PHOTO', psid]
        );

        let greetingMsg = `Account verified: ${member.firstname} ${member.lastname}.\n\n`;
        if (dispute.condition_status === 'Missing') {
            greetingMsg += `We found a pending missing report on Bike #${dispute.bicycle_code}.\n\nPlease upload/send a clear photo showing that you actually returned the bike at the hub to support your appeal. (Or if you prefer, you may also visit the UP Bikeshare Admin Hub to settle in person.)`;
        } else {
            greetingMsg += `We found a pending dispute on Bike #${dispute.bicycle_code}.\n\nPlease upload/send a clear photo of the bike showing its condition and lock to support your appeal. (Or if you prefer, you may also visit the UP Bikeshare Admin Hub to settle in person.)`;
        }

        await sendFbMessage(psid, greetingMsg);

    } else if (session.bot_state === 'WAITING_DELIVERY_PHOTO') {
        let imageUrl = null;
        if (message.attachments && message.attachments.length > 0) {
            const imageAttachment = message.attachments.find(att => att.type === 'image');
            if (imageAttachment && imageAttachment.payload && imageAttachment.payload.url) {
                imageUrl = imageAttachment.payload.url;
            }
        }

        if (!imageUrl) {
            await sendFbMessage(psid, 'Please upload/send a photo of the delivered bike. Note: If you want to restart verification, reply with "RESET".');
            return;
        }

        // Look up member
        const [members] = await db.upbsPool.query(
            'SELECT firstname, lastname FROM members WHERE phone_number = ? AND is_active = 1',
            [session.phone_number]
        );

        if (members.length === 0) {
            await sendFbMessage(psid, 'Session error: Member record not found. Please reply "RESET" to verify again.');
            return;
        }

        const member = members[0];

        // Retrieve the pending delivery bike
        const [deliveries] = await db.upbsPool.query(
            "SELECT bicycle_code, new_location FROM bicycle_codes WHERE condition_status = 'Pending_Delivery' AND dispute_reported_by = ?",
            [session.phone_number]
        );

        if (deliveries.length === 0) {
            await sendFbCompletionButtons(psid, 'We could not find a pending delivery report for your account anymore. It might have already been confirmed. Select an option below to continue.');
            return;
        }

        const delivery = deliveries[0];
        const bikeCode = delivery.bicycle_code;

        // Save delivery image URL to the bike record
        await db.upbsPool.query(
            'UPDATE bicycle_codes SET dispute_image_url = ? WHERE bicycle_code = ?',
            [imageUrl, bikeCode]
        );

        // Trigger off-dashboard admin notifications
        const studentName = `${member.firstname} ${member.lastname}`;
        const phoneNumber = session.phone_number;

        // Custom Discord webhook message for volunteer deliveries
        try {
            const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
            if (webhookUrl) {
                const payload = {
                    embeds: [{
                        title: "🔔 New Volunteer Delivery Proof Submitted",
                        color: 8065299,
                        fields: [
                            { name: "Volunteer Name", value: studentName, inline: true },
                            { name: "Phone Number", value: phoneNumber, inline: true },
                            { name: "Bicycle Code", value: `Bike #${bikeCode}`, inline: true },
                            { name: "Delivered To Hub", value: delivery.new_location.toUpperCase(), inline: true }
                        ],
                        image: { url: imageUrl },
                        description: `A student has submitted delivery proof photos for volunteer transport. Please review and confirm this delivery in the UP Bikeshare Admin Dashboard to award their trust points.`,
                        timestamp: new Date().toISOString()
                    }]
                };
                await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }
        } catch (discordErr) {
            console.error('[FB Bot] Failed to send Discord delivery notification:', discordErr.message);
        }

        // Send SMS to admins
        notificationService.sendAdminSmsAlert(`UPBS ALERT: Volunteer delivery photo uploaded for Bike ${bikeCode} by ${studentName}. Review in dashboard.`)
            .catch(err => console.error('[FB Bot] Async Admin SMS alert failed:', err.message));

        // Mark session as COMPLETED
        await db.upbsPool.query('UPDATE fb_bot_sessions SET bot_state = ? WHERE psid = ?', ['COMPLETED', psid]);

        await sendFbCompletionButtons(
            psid,
            `Thank you! Your delivery proof photo has been successfully uploaded for Bike #${bikeCode}.\n\nOur administrators will verify the delivery details soon. You will receive an SMS notification once your volunteer reward (+5 points) is approved!`
        );

    } else if (session.bot_state === 'AWAITING_PHOTO') {
        // We expect an image attachment
        let imageUrl = null;
        if (message.attachments && message.attachments.length > 0) {
            const imageAttachment = message.attachments.find(att => att.type === 'image');
            if (imageAttachment && imageAttachment.payload && imageAttachment.payload.url) {
                imageUrl = imageAttachment.payload.url;
            }
        }

        if (!imageUrl) {
            await sendFbMessage(psid, 'To appeal, please upload/send a photo of the bicycle. Note: If you want to restart verification, reply with "RESET".');
            return;
        }

        // Look up member and their active dispute
        const [members] = await db.upbsPool.query(
            'SELECT firstname, lastname FROM members WHERE phone_number = ? AND is_active = 1',
            [session.phone_number]
        );

        if (members.length === 0) {
            await sendFbMessage(psid, 'Session error: Member record not found. Please reply "RESET" to verify again.');
            return;
        }

        const member = members[0];

        const [disputes] = await db.upbsPool.query(
            `SELECT bc.bicycle_code, bc.condition_status, bh.id AS history_id
             FROM bicycle_codes bc
             JOIN bicycle_history bh ON bc.bicycle_code = bh.bicycle_code
             WHERE bc.condition_status IN ('Disputed', 'Missing') 
               AND (bh.borrower_phone = ? OR bh.borrowed_by = ?)
             ORDER BY bh.borrowed_at DESC LIMIT 1`,
            [session.phone_number, `${member.firstname} ${member.lastname}`]
        );

        if (disputes.length === 0) {
            await sendFbCompletionButtons(psid, 'We could not find an active dispute ticket for your account anymore. It might have already been resolved. Select an option below to continue.');
            return;
        }

        const dispute = disputes[0];

        // Save image URL to both the bike code and history record
        await db.upbsPool.query('UPDATE bicycle_codes SET dispute_image_url = ? WHERE bicycle_code = ?', [imageUrl, dispute.bicycle_code]);
        await db.upbsPool.query('UPDATE bicycle_history SET dispute_image_url = ? WHERE id = ?', [imageUrl, dispute.history_id]);

        // Trigger off-dashboard admin notifications (Discord Webhook)
        const studentName = `${member.firstname} ${member.lastname}`;
        const phoneNumber = session.phone_number;
        const bikeCode = dispute.bicycle_code;
        const bikeStatus = dispute.condition_status;

        notificationService.sendDiscordNotification(studentName, phoneNumber, bikeCode, imageUrl, bikeStatus)
            .catch(err => console.error('[FB Bot] Async Discord notification failed:', err.message));

        const alertText = bikeStatus === 'Missing'
            ? `UPBS ALERT: Missing bike appeal photo uploaded for Bike ${bikeCode} by ${studentName}. Review in dashboard.`
            : `UPBS ALERT: Dispute appeal photo uploaded for Bike ${bikeCode} by ${studentName}. Review in dashboard.`;

        notificationService.sendAdminSmsAlert(alertText)
            .catch(err => console.error('[FB Bot] Async Admin SMS alert failed:', err.message));

        // Mark session as COMPLETED
        await db.upbsPool.query('UPDATE fb_bot_sessions SET bot_state = ? WHERE psid = ?', ['COMPLETED', psid]);

        await sendFbCompletionButtons(
            psid,
            `Thank you! Your dispute appeal photo has been successfully uploaded and linked to Bike #${dispute.bicycle_code}.\n\nOur administrators will review the evidence shortly. You will receive an SMS notification once a decision is made.`
        );

    } else if (session.bot_state === 'COMPLETED') {
        await sendFbCompletionButtons(
            psid,
            'Your appeal photo has already been submitted and is pending administrator review. Select an option below if you need to start over.'
        );
    }
}

module.exports = {
    verifyWebhook,
    handleWebhookEvent
};
