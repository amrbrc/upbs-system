-- SQL Schema Upgrades for UP Bikeshare Honesty Policy
-- Database: upbs

USE upbs;

-- 1. Upgrades for the members table
ALTER TABLE members ADD COLUMN trust_points INT DEFAULT 100;
ALTER TABLE members MODIFY COLUMN trust_points INT DEFAULT 100;
ALTER TABLE members ADD COLUMN points_frozen TINYINT(1) DEFAULT 0;
ALTER TABLE members ADD COLUMN is_active TINYINT(1) DEFAULT 1;
ALTER TABLE members MODIFY COLUMN is_active TINYINT(1) DEFAULT 1;

-- 2. Upgrades for the bicycle_codes table
ALTER TABLE bicycle_codes ADD COLUMN condition_status VARCHAR(50) DEFAULT 'Good';
ALTER TABLE bicycle_codes ADD COLUMN broken_reported_at DATETIME DEFAULT NULL;
ALTER TABLE bicycle_codes ADD COLUMN penalty_applied TINYINT(1) DEFAULT 0;
ALTER TABLE bicycle_codes ADD COLUMN is_active TINYINT(1) DEFAULT 1;
ALTER TABLE bicycle_codes MODIFY COLUMN is_active TINYINT(1) DEFAULT 1;

-- 3. Upgrades for the bicycle_history table
ALTER TABLE bicycle_history ADD COLUMN reminder_1h_sent TINYINT(1) DEFAULT 0;
ALTER TABLE bicycle_history ADD COLUMN reminder_4h_sent TINYINT(1) DEFAULT 0;
ALTER TABLE bicycle_history ADD COLUMN done_text_received TINYINT(1) DEFAULT 0;
ALTER TABLE bicycle_history ADD COLUMN condition_confirmed TINYINT(1) DEFAULT 0;
ALTER TABLE bicycle_history ADD COLUMN pending_status_time DATETIME DEFAULT NULL;
ALTER TABLE bicycle_history ADD COLUMN reminder_pending_sent TINYINT(1) DEFAULT 0;
ALTER TABLE bicycle_history ADD COLUMN reported_condition VARCHAR(50) DEFAULT NULL;

-- 4. Upgrades for the locations table
ALTER TABLE locations ADD COLUMN is_active TINYINT(1) DEFAULT 1;
ALTER TABLE locations MODIFY COLUMN is_active TINYINT(1) DEFAULT 1;

-- 5. UPBS Revisions: De-Hardcoding & Org-Led Policies
-- Upgrade members table for role-based logins and consecutive clean ride tracking
ALTER TABLE members ADD COLUMN role VARCHAR(20) DEFAULT 'student';
ALTER TABLE members ADD COLUMN consecutive_good_rides INT DEFAULT 0;

-- Upgrade bicycle_history with borrower_phone
ALTER TABLE bicycle_history ADD COLUMN borrower_phone VARCHAR(20) DEFAULT NULL;

-- Backfill legacy records
UPDATE bicycle_history bh
JOIN members m ON CONCAT(m.firstname, ' ', m.lastname) = bh.borrowed_by
SET bh.borrower_phone = m.phone_number
WHERE bh.borrower_phone IS NULL;

-- Create system_settings table to store dynamic rules and de-hardcoded point values
CREATE TABLE IF NOT EXISTS system_settings (
    setting_name VARCHAR(100) PRIMARY KEY,
    setting_value VARCHAR(255) NOT NULL,
    description VARCHAR(255) DEFAULT NULL
);

-- Insert default rules and point configurations
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
('admin_alert_name_1', '', 'Name of Primary Admin contact for SMS notifications.'),
('admin_alert_phone_1', '', 'Phone number of Primary Admin contact for SMS notifications.'),
('admin_alert_name_2', '', 'Name of Secondary Admin contact for SMS notifications.'),
('admin_alert_phone_2', '', 'Phone number of Secondary Admin contact for SMS notifications.')
ON DUPLICATE KEY UPDATE 
    setting_value = VALUES(setting_value),
    description = VALUES(description);
