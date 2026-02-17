-- Create database
CREATE DATABASE IF NOT EXISTS job_applications;
USE job_applications;

-- Drop old table if exists (for fresh schema)
DROP TABLE IF EXISTS applicants;

-- Create applicants table with JSON for multiple job roles
CREATE TABLE applicants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    job_roles JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email)
);
