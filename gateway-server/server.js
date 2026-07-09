// gateway-server/server.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Import required dependencies
const db = require('./db');
const axios = require('axios');
const { spawn } = require('child_process');

const express = require('express');
const app = express();
app.use(express.json());

// This endpoint allows the worker-api to trigger an outgoing SMS
app.post('/api/sms/send', async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    const configuredApiKey = process.env.GATEWAY_API_KEY || 'upbs-gateway-secret-api-key-2026';

    if (!apiKey || apiKey !== configuredApiKey) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing API Key' });
    }

    const { phoneNumber, message } = req.body;
    if (!phoneNumber || !message) {
        return res.status(400).json({ error: 'Missing phoneNumber or message' });
    }

    try {
        await sendReply(phoneNumber, message);
        res.json({ success: true, message: 'SMS queued for sending' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to send SMS' });
    }
});

// Start the Express server on port 3000
const GATEWAY_PORT = 3000;
app.listen(GATEWAY_PORT, () => {
    console.log(`Gateway HTTP Server listening on port ${GATEWAY_PORT}`);
});

const http = require('http');
const https = require('https');

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:3001';
const workerAPI = axios.create({
    baseURL: WORKER_URL,
    timeout: 10000,
    httpAgent: new http.Agent({ keepAlive: true }),
    httpsAgent: new https.Agent({ keepAlive: true }),
    headers: {
        'x-gateway-secret': process.env.GATEWAY_SECRET || 'upbs-gateway-secret-token-2026'
    }
});

// Outbound SMS Polling loop
async function pollOutboundSms() {
    try {
        const response = await workerAPI.get('/api/gateway/outbound');
        const pendingSms = response.data.smsList;
        for (const sms of pendingSms) {
            console.log(`[Cloud Queue] Outbound SMS found: to ${sms.phone_number} -> "${sms.message}"`);
            try {
                await sendReply(sms.phone_number, sms.message);
                await workerAPI.post(`/api/gateway/outbound/${sms.id}/sent`);
                console.log(`[Cloud Queue] SMS ${sms.id} successfully sent and marked complete.`);
            } catch (smsErr) {
                console.error(`[Cloud Queue] Failed to dispatch SMS ${sms.id}:`, smsErr.message);
            }
        }
    } catch (err) {
        // Suppress noisy transient network disconnects during background polling
        const transientErrors = ['ECONNRESET', 'ETIMEDOUT', 'socket hang up', 'socket disconnected'];
        const isTransient = transientErrors.some(t => (err.code && err.code.includes(t)) || (err.message && err.message.includes(t)));
        if (!isTransient) {
            console.error("[Cloud Queue] Error polling outbound SMS:", err.message);
        }
    }
}

// Start polling outbound queue every 5 seconds
setInterval(pollOutboundSms, 5000);


// Main polling function to check for new SMS messages
let isPolling = false;
async function pollInbox() {
    if (isPolling) return;
    isPolling = true;

    try {
        // Select all columns from 'inbox' where Processed is 'false'
        const [rows] = await db.query("SELECT * FROM inbox WHERE Processed='false'");

        for (const message of rows) {
            const smsSender = message.SenderNumber;
            const rawText = message.TextDecoded;
            const messageId = message.ID;

            if (!rawText) {
                console.error(`Empty message received from Sender: ${smsSender}, Message ID: ${messageId}`);
                await db.query("UPDATE inbox SET Processed='true' WHERE ID=?", [messageId]);
                continue;
            }

            const smsMessage = rawText.trim().toLowerCase();
            console.log(`Processing command '${smsMessage}' from ${smsSender} (ID: ${messageId})...`);

            try {
                // 1. Verify user registration status with the Worker API before proceeding
                const checkResponse = await workerAPI.post('/api/members/check', {
                    phone_number: smsSender,
                    message_text: rawText.trim()
                });

                const isRegistered = checkResponse.data.registered;

                if (!isRegistered) {
                    console.log(`Sender ${smsSender} is not registered. Routing to non-registered fallback.`);
                    // Send to non-registered fallback
                    const workerResponse = await workerAPI.post('/api/non-registered', {
                        smsSender,
                        messageId
                    });
                    const replyMessage = workerResponse.data.reply || "Sorry, you are not registered with UP Bike Share.";
                    await sendReply(smsSender, replyMessage);
                    await db.query("UPDATE inbox SET Processed='true' WHERE ID=?", [messageId]);
                    continue;
                }

                // 2. Parse command using regex and route to correct endpoints
                let endpoint = '';
                let payload = { smsSender, messageId };

                // Match regexes (mimicking monolith logic)
                const searchMatch = smsMessage.match(/^search\s+(\w+)$/i);
                const usageMatch = smsMessage.match(/^usage\s+(\w+)$/i);
                const borrowMatch = smsMessage.match(/^(\w+)\s+(\w+)\s+to\s+(\w+)$/i);

                // NEW HONESTY POLICY REGEXES
                const doneMatch = smsMessage.match(/^done\s+(\w+)$/i);
                const goodMatch = smsMessage.match(/^(\w+)\s+good$|^good\s+(\w+)$/i);
                const brokenMatch = smsMessage.match(/^(\w+)\s+broken$|^broken\s+(\w+)$/i);
                const missingMatch = smsMessage.match(/^(\w+)\s+missing$|^missing\s+(\w+)$/i);
                const deliveredMatch = smsMessage.match(/^delivered\s+(\w+)(?:\s+(\w+))?$|^(\w+)\s+delivered(?:\s+(\w+))?$/i);
                const pointsMatch = smsMessage.match(/^points$/i);

                if (smsMessage === 'search all') {
                    endpoint = '/api/search-all';
                } else if (searchMatch) {
                    endpoint = '/api/search';
                    payload.bicycleCode = searchMatch[1].toLowerCase();
                } else if (smsMessage === 'bikeshare help') {
                    endpoint = '/api/help';
                } else if (smsMessage === 'how') {
                    endpoint = '/api/how';
                } else if (smsMessage === 'locations') {
                    endpoint = '/api/locations';
                } else if (usageMatch) {
                    endpoint = '/api/usage';
                    payload.bicycleCode = usageMatch[1].toLowerCase();
                } else if (borrowMatch) {
                    endpoint = '/api/borrow';
                    payload.bicycleCode = borrowMatch[1].toLowerCase();
                    payload.fromLocation = borrowMatch[2].toLowerCase();
                    payload.toLocation = borrowMatch[3].toLowerCase();
                } else if (doneMatch) {
                    endpoint = '/api/done';
                    payload.bicycleCode = doneMatch[1].toLowerCase();
                } else if (goodMatch) {
                    endpoint = '/api/good';
                    payload.bicycleCode = (goodMatch[1] || goodMatch[2]).toLowerCase();
                } else if (brokenMatch) {
                    endpoint = '/api/broken';
                    payload.bicycleCode = (brokenMatch[1] || brokenMatch[2]).toLowerCase();
                } else if (missingMatch) {
                    endpoint = '/api/missing';
                    payload.bicycleCode = (missingMatch[1] || missingMatch[2]).toLowerCase();
                } else if (deliveredMatch) {
                    endpoint = '/api/delivered';
                    payload.bicycleCode = (deliveredMatch[1] || deliveredMatch[3]).toLowerCase();
                    payload.deliveryLocation = (deliveredMatch[2] || deliveredMatch[4]) ? (deliveredMatch[2] || deliveredMatch[4]).toLowerCase() : null;
                } else if (pointsMatch) {
                    endpoint = '/api/points';
                } else {
                    endpoint = '/api/invalid-command';
                }

                console.log(`Routing command to Worker API: ${endpoint} with payload:`, payload);

                // 3. Send payload to Worker API
                const workerResponse = await workerAPI.post(endpoint, payload);

                // 4. Extract reply/replies and send
                if (endpoint === '/api/borrow' && workerResponse.data.invalidBicycle) {
                    // Fallback to invalid command
                    console.log(`Borrow failed (invalid bicycle). Routing to invalid-command fallback.`);
                    const fallbackResponse = await workerAPI.post('/api/invalid-command', {
                        smsSender,
                        messageId
                    });
                    const replyMessage = fallbackResponse.data.reply || 'Invalid Command. Send "bikeshare help" for list of available commands.';
                    await sendReply(smsSender, replyMessage);
                } else if (workerResponse.data.replies && Array.isArray(workerResponse.data.replies)) {
                    // Endpoint returns multiple replies
                    const replies = workerResponse.data.replies;
                    for (const reply of replies) {
                        await sendReply(smsSender, reply);
                    }
                } else {
                    // Endpoint returns a single reply
                    const replyMessage = workerResponse.data.reply || "Request processed successfully.";
                    await sendReply(smsSender, replyMessage);
                }

                // 5. Mark the message as processed in the database
                await db.query("UPDATE inbox SET Processed='true' WHERE ID=?", [messageId]);
                console.log(`Message ${messageId} marked as processed!`);

            } catch (apiError) {
                console.error(`Worker API error or failed for ${smsSender}:`, apiError.message);
                
                // Determine if it's a 4xx client-level error (bad request, not found, etc.)
                if (apiError.response && apiError.response.status >= 400 && apiError.response.status < 500) {
                    console.log(`Marking message ${messageId} as processed due to client-level error: ${apiError.response.status}`);
                    await db.query("UPDATE inbox SET Processed='true' WHERE ID=?", [messageId]);
                } else {
                    // It's a 5xx server error or network issue (transient).
                    // We do NOT mark the message as processed, so the loop will try again later!
                    console.log(`Transient error encountered for message ${messageId}. Will retry later.`);
                }
            }
        }
    } catch (error) {
        console.error("Database polling error:", error);
    } finally {
        isPolling = false;
    }
}

// Initialize the server polling loop (runs every 200 milliseconds)
console.log("Gateway Server started. Polling for messages...");
setInterval(pollInbox, 200);

// Helper function to send SMS via Gammu hardware (handles auto-splitting for long messages)
async function sendReply(phoneNumber, text) {
    if (text.length <= 160) {
        return sendSingleReply(phoneNumber, text);
    }

    // Split text into chunks of 150 characters (splitting at spaces if possible to avoid cutting words)
    const chunks = [];
    let remaining = text;
    while (remaining.length > 0) {
        if (remaining.length <= 150) {
            chunks.push(remaining);
            break;
        }
        // Find last space within 150 characters
        let splitIndex = remaining.lastIndexOf(' ', 150);
        if (splitIndex === -1) {
            splitIndex = 150; // Fallback to hard split if no spaces exist
        }
        chunks.push(remaining.substring(0, splitIndex).trim());
        remaining = remaining.substring(splitIndex).trim();
    }

    for (let i = 0; i < chunks.length; i++) {
        const partText = `(${i + 1}/${chunks.length}) ${chunks[i]}`;
        await sendSingleReply(phoneNumber, partText);
    }
}

function sendSingleReply(phoneNumber, text) {
    return new Promise((resolve, reject) => {
        console.log(`Sending SMS to ${phoneNumber}: "${text}"`);

        // This runs the actual terminal command to the modem
        const gammu = spawn('gammu-smsd-inject', ['TEXT', phoneNumber, '-text', text]);

        gammu.on('error', (err) => {
            console.error(`Failed to spawn gammu-smsd-inject:`, err.message);
            reject(new Error(`Failed to spawn gammu-smsd-inject: ${err.message}`));
        });

        gammu.on('close', (code) => {
            if (code === 0) {
                console.log(`SMS successfully sent to ${phoneNumber}`);
                resolve();
            } else {
                console.error(`Gammu failed to send. Exit code ${code}`);
                reject(new Error(`Gammu failed with exit code ${code}`));
            }
        });
    });
}
