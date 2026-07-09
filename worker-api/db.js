const mysql = require('mysql2/promise');

const poolConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'upbs2024',
    password: process.env.DB_PASSWORD || 'upbs2024',
    database: process.env.DB_NAME || 'upbs',
    timezone: '+08:00',
    connectionLimit: 10
};

// Automatically enable SSL if connecting to an Aiven database or if DB_SSL is set
if (process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production' || (process.env.DB_HOST && process.env.DB_HOST.includes('aivencloud.com'))) {
    poolConfig.ssl = { rejectUnauthorized: false };
    console.log("[DB] SSL connection enabled for database pool.");
}

const upbsPool = mysql.createPool(poolConfig);

// Ensure every connection created in the pool has the session time_zone set to +08:00 (Philippine Time)
upbsPool.on('connection', (connection) => {
    connection.query("SET time_zone = '+08:00'");
});


async function runMigrations() {
    try {
        const [tz] = await upbsPool.query("SELECT @@global.time_zone, @@session.time_zone, NOW() as now_val");
        console.log("[DB] Timezone check:", tz[0]);
    } catch (e) {
        console.error("[DB] Timezone check error:", e.message);
    }
    try {
        await upbsPool.query("ALTER TABLE members ADD COLUMN leaderboard_points INT DEFAULT 100");
        console.log("[DB] Added leaderboard_points column to members.");
    } catch(e) {
        if(e.code !== 'ER_DUP_FIELDNAME') console.error("[DB] Migration error:", e.message);
    }
    try {
        await upbsPool.query("ALTER TABLE members ALTER leaderboard_points SET DEFAULT 100");
        // Fix bugged members who registered while default was 0 and earned small points
        await upbsPool.query("UPDATE members SET leaderboard_points = trust_points WHERE leaderboard_points < 20 AND trust_points >= 100 AND is_active = 1");
        await upbsPool.query("UPDATE members SET leaderboard_points = trust_points WHERE leaderboard_points = 0");
    } catch (e) {
        console.error("[DB] Migration fix error:", e.message);
    }
    try {
        await upbsPool.query(`
            CREATE TABLE IF NOT EXISTS app_settings (
                setting_key VARCHAR(50) PRIMARY KEY,
                setting_value VARCHAR(255)
            )
        `);
        const lastReset = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
        await upbsPool.query("INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES ('leaderboard_last_reset', ?)", [lastReset]);
    } catch(e) {
        console.error("[DB] Migration error settings:", e.message);
    }
    try {
        await upbsPool.query(`
            CREATE TABLE IF NOT EXISTS outbound_sms (
                id INT AUTO_INCREMENT PRIMARY KEY,
                phone_number VARCHAR(20) NOT NULL,
                message TEXT NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                sent_at DATETIME DEFAULT NULL
            )
        `);
        console.log("[DB] Ensured outbound_sms queue table exists.");
    } catch(e) {
        console.error("[DB] Migration error outbound_sms:", e.message);
    }
    try {
        await upbsPool.query(`
            CREATE TABLE IF NOT EXISTS user_sms_inbox (
                id INT AUTO_INCREMENT PRIMARY KEY,
                SenderNumber VARCHAR(20) NOT NULL,
                TextDecoded TEXT NOT NULL,
                ReceivingDateTime DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("[DB] Ensured user_sms_inbox table exists.");
    } catch(e) {
        console.error("[DB] Migration error user_sms_inbox:", e.message);
    }
    try {
        await upbsPool.query(`
            INSERT IGNORE INTO system_settings (setting_name, setting_value, description)
            VALUES 
            ('reward_delivered_bike', '5', 'Points rewarded to a user who delivers a broken bike to a maintenance hub.'),
            ('admin_alert_name_1', '', 'Name of Primary Admin contact for SMS notifications.'),
            ('admin_alert_phone_1', '', 'Phone number of Primary Admin contact for SMS notifications.'),
            ('admin_alert_name_2', '', 'Name of Secondary Admin contact for SMS notifications.'),
            ('admin_alert_phone_2', '', 'Phone number of Secondary Admin contact for SMS notifications.')
        `);
        console.log("[DB] Ensured reward_delivered_bike and admin alert settings exist.");
    } catch(e) {
        console.error("[DB] Migration error reward_delivered_bike or admin alert settings:", e.message);
    }
    const colsToEnsure = [
        "ALTER TABLE bicycle_codes ADD COLUMN dispute_image_url VARCHAR(512) DEFAULT NULL",
        "ALTER TABLE bicycle_codes ADD COLUMN broken_reported_at DATETIME DEFAULT NULL",
        "ALTER TABLE bicycle_codes ADD COLUMN dispute_reported_by VARCHAR(50) DEFAULT NULL",
        "ALTER TABLE bicycle_codes ADD COLUMN penalty_applied INT DEFAULT 0"
    ];
    for (const q of colsToEnsure) {
        try { await upbsPool.query(q); } catch(e) { if(e.code !== 'ER_DUP_FIELDNAME') console.error("[DB] Migration error:", e.message); }
    }
    try {
        await upbsPool.query("ALTER TABLE bicycle_history ADD COLUMN dispute_image_url VARCHAR(512) DEFAULT NULL");
        console.log("[DB] Added dispute_image_url column to bicycle_history.");
    } catch(e) {
        if(e.code !== 'ER_DUP_FIELDNAME') console.error("[DB] Migration error dispute_image_url (bicycle_history):", e.message);
    }
    try {
        await upbsPool.query(`
            CREATE TABLE IF NOT EXISTS fb_bot_sessions (
                psid VARCHAR(100) PRIMARY KEY,
                phone_number VARCHAR(20) DEFAULT NULL,
                bot_state VARCHAR(50) NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log("[DB] Ensured fb_bot_sessions table exists.");
    } catch(e) {
        console.error("[DB] Migration error fb_bot_sessions table:", e.message);
    }
    try {
        // Shift existing UTC datetimes to PST (+08:00) exactly once (v3)
        const [rows] = await upbsPool.query("SELECT setting_value FROM app_settings WHERE setting_key = 'utc_to_pst_shifted_v3'");
        if (rows.length === 0) {
            console.log("[DB] Shifting historical UTC datetimes to PST (+08:00)...");
            
            // 1. Shift bicycle_history
            await upbsPool.query(`
                UPDATE bicycle_history 
                SET borrowed_at = DATE_ADD(borrowed_at, INTERVAL 8 HOUR),
                    pending_status_time = CASE WHEN pending_status_time IS NOT NULL THEN DATE_ADD(pending_status_time, INTERVAL 8 HOUR) ELSE NULL END,
                    last_penalty_time = CASE WHEN last_penalty_time IS NOT NULL THEN DATE_ADD(last_penalty_time, INTERVAL 8 HOUR) ELSE NULL END
                WHERE borrowed_at < '2026-07-03 10:00:00'
            `);
            
            // 2. Shift bicycle_codes
            await upbsPool.query(`
                UPDATE bicycle_codes 
                SET broken_reported_at = DATE_ADD(broken_reported_at, INTERVAL 8 HOUR)
                WHERE broken_reported_at < '2026-07-03 10:00:00'
            `);
            
            // 3. Shift Logs
            await upbsPool.query(`
                UPDATE Logs 
                SET DateTime = DATE_ADD(DateTime, INTERVAL 8 HOUR)
                WHERE DateTime < '2026-07-03 10:00:00'
            `);

            // Mark as completed
            await upbsPool.query("INSERT INTO app_settings (setting_key, setting_value) VALUES ('utc_to_pst_shifted_v3', 'true')");
            console.log("[DB] Successfully shifted historical UTC datetimes to PST.");
        }
    } catch (e) {
        console.error("[DB] Error shifting datetimes to PST:", e.message);
    }
}
runMigrations();

module.exports = { upbsPool };