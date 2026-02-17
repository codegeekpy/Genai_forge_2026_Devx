-- Add columns for storing extracted resume information
-- This migration adds JSONB storage for LLM-extracted resume data

ALTER TABLE resumes 
ADD COLUMN IF NOT EXISTS extracted_info JSONB,
ADD COLUMN IF NOT EXISTS extraction_processed_time TIMESTAMP;

-- Create GIN index on JSONB column for faster queries
-- GIN indexes are optimal for JSONB data in PostgreSQL
CREATE INDEX IF NOT EXISTS idx_resumes_extracted_info 
ON resumes USING GIN (extracted_info);

-- Add column comments for documentation
COMMENT ON COLUMN resumes.extracted_info IS 'Structured resume data extracted by LLM (name, email, phone, education, skills, projects, experience, certifications)';
COMMENT ON COLUMN resumes.extraction_processed_time IS 'Timestamp when LLM extraction was completed';

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'resumes'
ORDER BY ordinal_position;
