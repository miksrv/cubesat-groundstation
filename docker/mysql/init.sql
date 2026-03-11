-- Initialize CubeSat Ground Station Database
-- This script runs automatically when MySQL container starts for the first time

-- Grant all privileges to cubesat_user
GRANT ALL PRIVILEGES ON cubesat_groundstation.* TO 'cubesat_user'@'%';

-- Create test database for QA Agent
CREATE DATABASE IF NOT EXISTS cubesat_groundstation_test;
GRANT ALL PRIVILEGES ON cubesat_groundstation_test.* TO 'cubesat_user'@'%';

-- Flush privileges to apply changes
FLUSH PRIVILEGES;

-- Switch to main database
USE cubesat_groundstation;

-- Set timezone to UTC
SET time_zone = '+00:00';

-- Log initialization
SELECT 'CubeSat Ground Station Database Initialized' AS Status;

