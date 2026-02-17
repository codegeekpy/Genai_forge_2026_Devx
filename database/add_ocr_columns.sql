-- Migration to add OCR columns to existing resumes table
-- Run this in your PostgreSQL database

-- Connect to doc_db database
\c doc_db

-- Add OCR columns if they don't exist
ALTER TABLE resumes 
ADD COLUMN IF NOT EXISTS ocr_text TEXT,
ADD COLUMN IF NOT EXISTS ocr_processed_time TIMESTAMP;

-- Verify the columns were added
\d resumes
