# RAG System Setup Guide

## Quick Setup Steps

### 1. Install PostgreSQL pgvector Extension

You need to install pg vector first. Follow one of these methods:

**Windows (via pgAdmin or psql):**
```sql
-- Connect to PostgreSQL as superuser
psql -U postgres

-- Install pgvector (you may need to download and install it first from GitHub)
-- Download from: https://github.com/pgvector/pgvector/releases
-- Or use the SQL command if already installed:
CREATE EXTENSION IF NOT EXISTS vector;
```

If pgvector is not installed on your system, you can work around it by:
- Download pgvector from GitHub releases
- Or for development, we can modify the code to skip vector indexing temporarily

### 2. Install Python Dependencies

```bash
#Navigate to project root
cd c:\kuldeep\Genai_forge_2026_Devx

# Install RAG dependencies
pip install sentence-transformers scikit-learn numpy
```

### 3. Run Database Migration

```bash
python database\migrate_pgvector_rag.py
```

This will:
- Enable pgvector extension
- Create `role_embeddings` table for vector search
- Create `skill_recommendations` table for caching results

### 4. Start the Backend

The backend will automatically:
-Load the RAG engine
- Load the knowledge base (34 roles)
- Generate embeddings for all roles on first startup

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 5. Test RAG Endpoints

Once the server is running, visit: `http://localhost:8000/docs`

Try these endpoints:
- `GET /api/knowledge-base/roles` - See all 34 roles
- `POST /api/match-skills` - Match skills to roles
- `POST /api/recommend-roles/{resume_id}` - Get personalized recommendations
- `POST /api/upskilling-path` - Get learning path for target role
- `POST /api/career-progression/{resume_id}` - Get career advancement suggestions

## Troubleshooting

### Issue: pgvector extension not found

**Solution 1 (Recommended)**: Install pgvector
- Windows: Download from https://github.com/pgvector/pgvector/releases
- Follow installation instructions for your PostgreSQL version

**Solution 2 (Temporary workaround)**:  
If you can't install pgvector right now, I can modify the code to use in-memory FAISS instead. Let me know!

### Issue: sentence-transformers taking long on first run

This is normal! It's downloading the embedding model (~80MB). Subsequent runs will be instant.

### Issue: RAG Engine not initialized

Check backend logs for:
- Knowledge base file path (should be `knowledge_base.json` in project root)
- Database connection errors
- Import errors for sentence-transformers

##Next Steps

Once RAG backend is working:
1. I'll create the frontend UI for recommendations
2. Add visualization charts for skill matching
3. Create beautiful role recommendation cards

**READY TO PROCEED?** Let me know if you encounter any issues!
