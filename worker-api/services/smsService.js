const db = require('../db');

/**
 * Inserts an SMS request into the outbound_sms queue table.
 * @param {string} phoneNumber - Recipient's phone number
 * @param {string} message - Content of the SMS message
 * @param {object} connection - Optional database connection instance (useful for transactions)
 */
async function queueSMS(phoneNumber, message, connection = db.upbsPool) {
    try {
        console.log(`[SMS Queue] Queueing SMS to ${phoneNumber}: "${message}"`);
        await connection.query(
            "INSERT INTO outbound_sms (phone_number, message, status) VALUES (?, ?, 'pending')",
            [phoneNumber, message]
        );
        return true;
    } catch (err) {
        console.error(`[SMS Queue] Failed to queue SMS to ${phoneNumber}:`, err.message);
        return false;
    }
}

module.exports = { queueSMS };
