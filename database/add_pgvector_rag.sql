-- Add pgvector extension for vector similarity search
-- This enables semantic search for skill matching

-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add vector embeddings table for roles and skills
CREATE TABLE IF NOT EXISTS role_embeddings (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(255) UNIQUE NOT NULL,
    category VARCHAR(100),
    embedding vector(384),  -- sentence-transformers all-MiniLM-L6-v2 produces 384-dim vectors
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for fast vector similarity search (using cosine distance)
CREATE INDEX IF NOT EXISTS idx_role_embeddings_vector 
ON role_embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Add skill recommendations table
CREATE TABLE IF NOT EXISTS skill_recommendations (
    id SERIAL PRIMARY KEY,
    resume_id INTEGER NOT NULL,
    recommended_roles JSONB,
    skill_gaps JSONB,
    upskilling_suggestions JSONB,
    match_scores JSONB,
    career_progression JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index on resume_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_recommendations_resume_id 
ON skill_recommendations(resume_id);

-- Comments for documentation
COMMENT ON TABLE role_embeddings IS 'Vector embeddings of job roles for semantic similarity search';
COMMENT ON TABLE skill_recommendations IS 'Cached RAG-based recommendations for resumes';
COMMENT ON COLUMN role_embeddings.embedding IS '384-dimensional vector from sentence-transformers';
COMMENT ON COLUMN skill_recommendations.recommended_roles IS 'Top matching roles with scores';
COMMENT ON COLUMN skill_recommendations.skill_gaps IS 'Missing skills for each role';
COMMENT ON COLUMN skill_recommendations.upskilling_suggestions IS 'Learning paths and resources';

-- Verify tables created
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('role_embeddings', 'skill_recommendations');
