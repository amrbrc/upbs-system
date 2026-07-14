-- SQL Schema Upgrades for UP Bikeshare Honesty Policy & Decoupled Architecture
-- Database: upbs

USE upbs;

-- 1. Upgrades for the members table
ALTER TABLE members ADD COLUMN IF NOT EXISTS trust_points INT DEFAULT 100;
ALTER TABLE members MODIFY COLUMN trust_points INT DEFAULT 100;
ALTER TABLE members ADD COLUMN IF NOT EXISTS points_frozen TINYINT(1) DEFAULT 0;
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_active TINYINT(1) DEFAULT 1;
ALTER TABLE members MODIFY COLUMN is_active TINYINT(1) DEFAULT 1;
ALTER TABLE members ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'student';
ALTER TABLE members ADD COLUMN IF NOT EXISTS consecutive_good_rides INT DEFAULT 0;
ALTER TABLE members ADD COLUMN IF NOT EXISTS leaderboard_points INT DEFAULT 100;

-- 2. Upgrades for the bicycle_codes table
ALTER TABLE bicycle_codes ADD COLUMN IF NOT EXISTS condition_status VARCHAR(50) DEFAULT 'Good';
ALTER TABLE bicycle_codes ADD COLUMN IF NOT EXISTS broken_reported_at DATETIME DEFAULT NULL;
ALTER TABLE bicycle_codes ADD COLUMN IF NOT EXISTS penalty_applied TINYINT(1) DEFAULT 0;
ALTER TABLE bicycle_codes ADD COLUMN IF NOT EXISTS is_active TINYINT(1) DEFAULT 1;
ALTER TABLE bicycle_codes MODIFY COLUMN is_active TINYINT(1) DEFAULT 1;
ALTER TABLE bicycle_codes ADD COLUMN IF NOT EXISTS dispute_reported_by VARCHAR(20) DEFAULT NULL;
ALTER TABLE bicycle_codes ADD COLUMN IF NOT EXISTS dispute_image_url VARCHAR(512) DEFAULT NULL;
ALTER TABLE bicycle_codes ADD COLUMN IF NOT EXISTS is_disabled TINYINT(1) DEFAULT 0;
ALTER TABLE bicycle_codes ADD COLUMN IF NOT EXISTS previous_location VARCHAR(100) DEFAULT NULL;
ALTER TABLE bicycle_codes ADD COLUMN IF NOT EXISTS new_location VARCHAR(100) DEFAULT NULL;
ALTER TABLE bicycle_codes ADD COLUMN IF NOT EXISTS reminder_24h_sent TINYINT(1) DEFAULT 0;

-- 3. Upgrades for the bicycle_history table
ALTER TABLE bicycle_history ADD COLUMN IF NOT EXISTS reminder_1h_sent TINYINT(1) DEFAULT 0;
ALTER TABLE bicycle_history ADD COLUMN IF NOT EXISTS reminder_4h_sent TINYINT(1) DEFAULT 0;
ALTER TABLE bicycle_history ADD COLUMN IF NOT EXISTS done_text_received TINYINT(1) DEFAULT 0;
ALTER TABLE bicycle_history ADD COLUMN IF NOT EXISTS condition_confirmed TINYINT(1) DEFAULT 0;
ALTER TABLE bicycle_history ADD COLUMN IF NOT EXISTS pending_status_time DATETIME DEFAULT NULL;
ALTER TABLE bicycle_history ADD COLUMN IF NOT EXISTS reminder_pending_sent TINYINT(1) DEFAULT 0;
ALTER TABLE bicycle_history ADD COLUMN IF NOT EXISTS reported_condition VARCHAR(50) DEFAULT NULL;
ALTER TABLE bicycle_history ADD COLUMN IF NOT EXISTS borrower_phone VARCHAR(20) DEFAULT NULL;
ALTER TABLE bicycle_history ADD COLUMN IF NOT EXISTS last_penalty_time DATETIME DEFAULT NULL;
ALTER TABLE bicycle_history ADD COLUMN IF NOT EXISTS dispute_image_url VARCHAR(512) DEFAULT NULL;

-- 4. Upgrades for the locations table
ALTER TABLE locations ADD COLUMN IF NOT EXISTS is_active TINYINT(1) DEFAULT 1;
ALTER TABLE locations MODIFY COLUMN is_active TINYINT(1) DEFAULT 1;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8) DEFAULT NULL;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8) DEFAULT NULL;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS is_disabled TINYINT(1) DEFAULT 0;

-- 5. Backfill borrower_phone for legacy records
UPDATE bicycle_history bh
JOIN members m ON CONCAT(m.firstname, ' ', m.lastname) = bh.borrowed_by
SET bh.borrower_phone = m.phone_number
WHERE bh.borrower_phone IS NULL;

-- 6. Create system_settings table to store dynamic rules and de-hardcoded point values
CREATE TABLE IF NOT EXISTS system_settings (
    setting_name VARCHAR(100) PRIMARY KEY,
    setting_value VARCHAR(255) NOT NULL,
    description VARCHAR(255) DEFAULT NULL
);

-- Insert/Update default rules and point configurations
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
('admin_alert_phone_2', '', 'Phone number of Secondary Admin contact for SMS notifications.')
ON DUPLICATE KEY UPDATE 
    setting_value = VALUES(setting_value),
    description = VALUES(description);

-- 7. Create missing support tables
CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES 
('leaderboard_last_reset', NOW() - INTERVAL 15 DAY),
('utc_to_pst_shifted_v3', 'true');

CREATE TABLE IF NOT EXISTS outbound_sms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_sms_inbox (
    id INT AUTO_INCREMENT PRIMARY KEY,
    SenderNumber VARCHAR(20) NOT NULL,
    TextDecoded TEXT NOT NULL,
    ReceivingDateTime DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fb_bot_sessions (
    psid VARCHAR(100) PRIMARY KEY,
    phone_number VARCHAR(20) DEFAULT NULL,
    bot_state VARCHAR(50) NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS non_registered_senders (
    phone_number VARCHAR(20) NOT NULL,
    message_id INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (phone_number, message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS invalid_command_senders (
    phone_number VARCHAR(20) NOT NULL,
    message_id INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (phone_number, message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
