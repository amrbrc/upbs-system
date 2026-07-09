// worker-api/recreate_db.js
const path = require('path');
// Load environment variables from worker-api/.env
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function main() {
    console.log('[DB Setup] Starting database recreation...');

    // Use DB_ROOT_USER and DB_ROOT_PASSWORD if provided for high-privilege operations,
    // otherwise fallback to standard DB credentials
    const host = process.env.DB_HOST || '127.0.0.1';
    const port = Number(process.env.DB_PORT) || 3306;
    const user = process.env.DB_ROOT_USER || process.env.DB_USER || 'upbs2024';
    const password = process.env.DB_ROOT_PASSWORD || process.env.DB_PASSWORD || 'upbs2024';

    console.log(`[DB Setup] Connecting to MySQL server at ${host}:${port} as user "${user}"...`);

    let connection;
    try {
        connection = await mysql.createConnection({
            host,
            port,
            user,
            password,
            multipleStatements: true
        });
    } catch (err) {
        console.error('[DB Setup] Connection failed. Please ensure MySQL is running and credentials are correct.');
        console.error('[DB Setup] Error detail:', err.message);
        process.exit(1);
    }

    try {
        // 1. Drop and recreate databases
        console.log('[DB Setup] Recreating databases...');
        await connection.query('DROP DATABASE IF EXISTS upbs;');
        await connection.query('CREATE DATABASE upbs CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
        console.log('[DB Setup] Database "upbs" created.');

        await connection.query('DROP DATABASE IF EXISTS smsd;');
        await connection.query('CREATE DATABASE smsd CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
        console.log('[DB Setup] Database "smsd" created.');

        // 2. Initialize upbs tables
        console.log('[DB Setup] Initializing "upbs" tables...');
        await connection.query('USE upbs;');

        // admins table
        await connection.query(`
            CREATE TABLE admins (
                username VARCHAR(100) PRIMARY KEY,
                password VARCHAR(255) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // members table
        await connection.query(`
            CREATE TABLE members (
                phone_number VARCHAR(20) PRIMARY KEY,
                firstname VARCHAR(100) NOT NULL,
                lastname VARCHAR(100) NOT NULL,
                trust_points INT DEFAULT 100,
                points_frozen TINYINT(1) DEFAULT 0,
                is_active TINYINT(1) DEFAULT 1,
                role VARCHAR(20) DEFAULT 'student',
                consecutive_good_rides INT DEFAULT 0,
                leaderboard_points INT DEFAULT 100,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // bicycle_codes table
        await connection.query(`
            CREATE TABLE bicycle_codes (
                bicycle_code VARCHAR(20) PRIMARY KEY,
                combination_lock VARCHAR(50) NOT NULL,
                condition_status VARCHAR(50) DEFAULT 'Good',
                broken_reported_at DATETIME DEFAULT NULL,
                penalty_applied TINYINT(1) DEFAULT 0,
                is_active TINYINT(1) DEFAULT 1,
                dispute_reported_by VARCHAR(20) DEFAULT NULL,
                dispute_image_url VARCHAR(512) DEFAULT NULL,
                is_disabled TINYINT(1) DEFAULT 0,
                previous_location VARCHAR(100) DEFAULT NULL,
                new_location VARCHAR(100) DEFAULT NULL,
                reminder_24h_sent TINYINT(1) DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // bicycle_history table
        await connection.query(`
            CREATE TABLE bicycle_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                bicycle_code VARCHAR(20) NOT NULL,
                borrowed_by VARCHAR(255) NOT NULL,
                borrower_phone VARCHAR(20) NOT NULL,
                borrowed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                returned_at DATETIME DEFAULT NULL,
                previous_location VARCHAR(100) NOT NULL,
                new_location VARCHAR(100) NOT NULL,
                reminder_1h_sent TINYINT(1) DEFAULT 0,
                reminder_4h_sent TINYINT(1) DEFAULT 0,
                done_text_received TINYINT(1) DEFAULT 0,
                condition_confirmed TINYINT(1) DEFAULT 0,
                pending_status_time DATETIME DEFAULT NULL,
                reminder_pending_sent TINYINT(1) DEFAULT 0,
                reported_condition VARCHAR(50) DEFAULT NULL,
                last_penalty_time DATETIME DEFAULT NULL,
                dispute_image_url VARCHAR(512) DEFAULT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // locations table
        await connection.query(`
            CREATE TABLE locations (
                location_name VARCHAR(100) PRIMARY KEY,
                latitude DECIMAL(10, 8) DEFAULT NULL,
                longitude DECIMAL(11, 8) DEFAULT NULL,
                is_active TINYINT(1) DEFAULT 1,
                is_disabled TINYINT(1) DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Logs table
        await connection.query(`
            CREATE TABLE Logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                LastName VARCHAR(100) DEFAULT NULL,
                FirstName VARCHAR(100) DEFAULT NULL,
                MobileNumber VARCHAR(20) DEFAULT NULL,
                SenderNumber VARCHAR(20) DEFAULT NULL,
                DateTime DATETIME DEFAULT CURRENT_TIMESTAMP,
                Request VARCHAR(255) DEFAULT NULL,
                Response TEXT DEFAULT NULL,
                MessageID INT DEFAULT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // app_settings table
        await connection.query(`
            CREATE TABLE app_settings (
                setting_key VARCHAR(50) PRIMARY KEY,
                setting_value VARCHAR(255)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // system_settings table
        await connection.query(`
            CREATE TABLE system_settings (
                setting_name VARCHAR(100) PRIMARY KEY,
                setting_value VARCHAR(255) NOT NULL,
                description VARCHAR(255) DEFAULT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // outbound_sms table
        await connection.query(`
            CREATE TABLE outbound_sms (
                id INT AUTO_INCREMENT PRIMARY KEY,
                phone_number VARCHAR(20) NOT NULL,
                message TEXT NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                sent_at DATETIME DEFAULT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // user_sms_inbox table
        await connection.query(`
            CREATE TABLE user_sms_inbox (
                id INT AUTO_INCREMENT PRIMARY KEY,
                SenderNumber VARCHAR(20) NOT NULL,
                TextDecoded TEXT NOT NULL,
                ReceivingDateTime DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // fb_bot_sessions table
        await connection.query(`
            CREATE TABLE fb_bot_sessions (
                psid VARCHAR(100) PRIMARY KEY,
                phone_number VARCHAR(20) DEFAULT NULL,
                bot_state VARCHAR(50) NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        console.log('[DB Setup] "upbs" tables created successfully.');

        // 3. Seed upbs database
        console.log('[DB Setup] Seeding default records into "upbs"...');

        // Seed admins
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        const adminPassword = process.env.ADMIN_PASSWORD || 'upbs';
        const adminHashedPassword = await bcrypt.hash(adminPassword, 10);
        await connection.query('INSERT INTO admins (username, password) VALUES (?, ?);', [adminUsername, adminHashedPassword]);
        console.log(`[DB Setup] Seeded admin user "${adminUsername}".`);

        // Seed app_settings
        const lastReset = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
        await connection.query("INSERT INTO app_settings (setting_key, setting_value) VALUES ('leaderboard_last_reset', ?)", [lastReset]);
        await connection.query("INSERT INTO app_settings (setting_key, setting_value) VALUES ('utc_to_pst_shifted_v3', 'true')");

        // Seed system_settings
        await connection.query(`
            INSERT INTO system_settings (setting_name, setting_value, description) VALUES
            ('honesty_reward', '2', 'Points rewarded when a Good condition report is confirmed by the next rider.'),
            ('consistent_rider_reward', '10', 'Points rewarded for completing multiple rides without issues.'),
            ('reward_honest_report', '15', 'Points rewarded for reporting a broken/missing bike that was disputed.'),
            ('reward_community_volunteer', '30', 'Points rewarded to a user who completes a verified Community Service shift at a hub.'),
            ('reward_delivered_bike', '5', 'Points rewarded to a user who delivers a broken bike to a maintenance hub.'),
            ('penalty_hit_and_run', '-35', 'Points deducted from a user found guilty of unreported damage (Hit-and-Run).'),
            ('penalty_false_report', '-5', 'Points deducted from a user who submits a false damage/missing report.'),
            ('penalty_overtime', '-5', 'Points deducted per hour from a user who borrows a bike past the 6-hour limit.'),
            ('suspension_limit', '50', 'Trust score threshold below which a member account is automatically suspended.'),
            ('borrow_time_limit_hours', '6', 'Limit hours for borrowing a bicycle before penalty is applied.'),
            ('abort_trip_grace_period_mins', '15', 'Grace period in minutes to cancel/abort a borrowing trip.'),
            ('handshake_timeout_mins', '30', 'Time limit in minutes to handshake verify condition of returned bike.'),
            ('penalty_abandoned_handshake', '-2', 'Penalty for failing to respond to return handshake.'),
            ('admin_alert_name_1', 'UPBS Coordinator', 'Name of Primary Admin contact for SMS notifications.'),
            ('admin_alert_phone_1', '+639170000001', 'Phone number of Primary Admin contact for SMS notifications.'),
            ('admin_alert_name_2', '', 'Name of Secondary Admin contact for SMS notifications.'),
            ('admin_alert_phone_2', '', 'Phone number of Secondary Admin contact for SMS notifications.');
        `);

        // Seed default locations
        await connection.query(`
            INSERT INTO locations (location_name, latitude, longitude, is_active, is_disabled) VALUES
            ('eee', 14.6493, 121.0685, 1, 0),
            ('vinzons', 14.6538, 121.0722, 1, 0),
            ('melchor', 14.6572, 121.0698, 1, 0),
            ('albert', 14.6515, 121.0709, 1, 0),
            ('science-hub', 14.6482, 121.0664, 1, 0),
            ('chkt', 14.6560, 121.0645, 1, 0);
        `);

        // Seed default bicycles
        await connection.query(`
            INSERT INTO bicycle_codes (bicycle_code, combination_lock, condition_status, previous_location, new_location, is_active, is_disabled) VALUES
            ('b1', '1234', 'Good', 'eee', 'eee', 1, 0),
            ('b2', '5678', 'Good', 'vinzons', 'vinzons', 1, 0),
            ('b3', '9012', 'Good', 'melchor', 'melchor', 1, 0),
            ('b4', '3456', 'Good', 'albert', 'albert', 1, 0),
            ('b5', '7890', 'Good', 'science-hub', 'science-hub', 1, 0);
        `);

        // Seed default member (John Doe)
        await connection.query(`
            INSERT INTO members (phone_number, firstname, lastname, trust_points, points_frozen, is_active, role, consecutive_good_rides, leaderboard_points) VALUES
            ('+639171234567', 'John', 'Doe', 100, 0, 1, 'student', 0, 100),
            ('+639177654321', 'Jane', 'Smith', 100, 0, 1, 'student', 0, 100);
        `);

        console.log('[DB Setup] Default data seeded into "upbs" successfully.');

        // 4. Initialize smsd tables (Gammu SMSD compatibility)
        console.log('[DB Setup] Initializing "smsd" tables for Gammu SMSD compatibility...');
        await connection.query('USE smsd;');

        // inbox table (MySQL strict mode compatible)
        await connection.query(`
            CREATE TABLE inbox (
                UpdatedInDB timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                ReceivingDateTime datetime DEFAULT NULL,
                Text varchar(160) NOT NULL DEFAULT '',
                SenderNumber varchar(20) NOT NULL DEFAULT '',
                Coding enum('Default_No_Compression','Unicode_No_Compression','8bit','Default_Compression','Unicode_Compression') NOT NULL DEFAULT 'Default_No_Compression',
                UDH text,
                SMSCNumber varchar(20) NOT NULL DEFAULT '',
                Class int(11) NOT NULL DEFAULT '-1',
                TextDecoded text,
                ID int(10) unsigned NOT NULL AUTO_INCREMENT,
                RecipientID text,
                Processed enum('false','true') NOT NULL DEFAULT 'false',
                PRIMARY KEY (ID)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // outbox table
        await connection.query(`
            CREATE TABLE outbox (
                UpdatedInDB timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                InsertIntoDB datetime DEFAULT NULL,
                SendingDateTime datetime DEFAULT NULL,
                SendBefore time NOT NULL DEFAULT '23:59:59',
                SendAfter time NOT NULL DEFAULT '00:00:00',
                Text varchar(160) DEFAULT NULL,
                DestinationNumber varchar(20) NOT NULL DEFAULT '',
                Coding enum('Default_No_Compression','Unicode_No_Compression','8bit','Default_Compression','Unicode_Compression') NOT NULL DEFAULT 'Default_No_Compression',
                UDH text,
                Class int(11) DEFAULT '-1',
                TextDecoded text,
                ID int(10) unsigned NOT NULL AUTO_INCREMENT,
                MultiPart enum('false','true') DEFAULT 'false',
                RelativeValidity int(11) DEFAULT '-1',
                SenderID varchar(255) DEFAULT NULL,
                SendingTimeOut datetime DEFAULT NULL,
                DeliveryReport enum('default','yes','no') DEFAULT 'default',
                CreatorID text,
                Retries int(3) DEFAULT '0',
                PRIMARY KEY (ID)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // sentitems table
        await connection.query(`
            CREATE TABLE sentitems (
                UpdatedInDB timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                InsertIntoDB datetime DEFAULT NULL,
                SendingDateTime datetime DEFAULT NULL,
                DeliveryDateTime datetime DEFAULT NULL,
                Text varchar(160) NOT NULL DEFAULT '',
                DestinationNumber varchar(20) NOT NULL DEFAULT '',
                Coding enum('Default_No_Compression','Unicode_No_Compression','8bit','Default_Compression','Unicode_Compression') NOT NULL DEFAULT 'Default_No_Compression',
                UDH text,
                SMSCNumber varchar(20) NOT NULL DEFAULT '',
                Class int(11) NOT NULL DEFAULT '-1',
                TextDecoded text,
                ID int(10) unsigned NOT NULL DEFAULT '0',
                SenderID varchar(255) NOT NULL DEFAULT '',
                SequencePosition int(11) NOT NULL DEFAULT '1',
                Status enum('SendingOK','SendingOKNoReport','SendingError','DeliveryOK','DeliveryFailed','DeliveryPending','DeliveryUnknown','Error') NOT NULL DEFAULT 'SendingOK',
                StatusError int(11) NOT NULL DEFAULT '-1',
                TPMR int(11) NOT NULL DEFAULT '-1',
                RelativeValidity int(11) NOT NULL DEFAULT '-1',
                CreatorID text,
                PRIMARY KEY (ID,SequencePosition)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // phones table
        await connection.query(`
            CREATE TABLE phones (
                ID text NOT NULL,
                IMEI text NOT NULL PRIMARY KEY,
                Client text NOT NULL,
                Sent int(11) NOT NULL DEFAULT '0',
                Received int(11) NOT NULL DEFAULT '0',
                InsertIntoDB datetime DEFAULT NULL,
                TimeOut datetime DEFAULT NULL,
                UpdatedInDB timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // gammu table
        await connection.query(`
            CREATE TABLE gammu (
                Version int(11) NOT NULL DEFAULT '0' PRIMARY KEY
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        
        await connection.query('INSERT INTO gammu (Version) VALUES (16);');

        console.log('[DB Setup] "smsd" tables created successfully.');
        console.log('[DB Setup] Database setup complete! Both "upbs" and "smsd" are ready to use.');

    } catch (err) {
        console.error('[DB Setup] An error occurred during database initialization.');
        console.error('[DB Setup] Error detail:', err.message);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

main();
