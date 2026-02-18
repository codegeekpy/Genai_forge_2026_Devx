# TalentForge — AI-Powered Career Recommendations & Learning Paths

A full-stack recruitment application with resume upload, OCR text extraction, **RAG-based career recommendations**, and **personalized course generation** powered by Groq LLM.

## Features

### Core Application
- **Job Application Form** — Responsive form with real-time validation, multi-select roles
- **Resume Upload** — PDF/DOCX support, drag-and-drop, file validation (max 10MB)
- **PostgreSQL Storage** — Applicant data, resume binary storage, OCR text

### AI-Powered Pipeline
- **Groq LLM Extraction** — Structured data extraction from resumes (skills, experience, education, projects)
- **RAG Career Matching** — Vector embeddings (384-dim) + pgvector semantic search across 34 IT roles
- **Role Recommendations** — Top 5 roles with match scores, matching/missing skills breakdown
- **Course Generation** 🆕 — Personalized upskilling courses with weekly/daily breakdown and curated resources

### Frontend (Classical Corporate Design)
- Navy/Teal/Gold color palette with Merriweather serif headings
- Shared navigation bar across all pages
- Role cards with match percentages and "Generate Learning Path" buttons
- Course modal with expandable weeks → days → resources (YouTube + web)

## Project Structure

```
Genai_forge_2026_Devx/
├── backend/
│   ├── main.py                 # FastAPI app with all API endpoints
│   ├── database.py             # PostgreSQL database operations
│   ├── ocr_processor.py        # OCR text extraction module
│   ├── groq_extractor.py       # Groq API LLM extraction
│   ├── rag_engine.py           # RAG engine for career recommendations
│   ├── course_generator.py     # Groq-powered course generation 🆕
│   ├── resource_search.py      # YouTube/web resource search 🆕
│   └── .env                    # Environment variables
├── frontend/
│   ├── index.html              # Job application form
│   ├── style.css               # Shared design system (corporate theme)
│   ├── script.js               # Application form logic
│   ├── resume.html             # Resume upload page
│   ├── resume.css              # Resume page styles
│   ├── resume.js               # Resume upload logic
│   ├── course.html             # Recommendations + learning paths 🆕
│   ├── course.css              # Course page styles 🆕
│   └── course.js               # Course generation frontend 🆕
├── database/
│   ├── schema.sql              # Database schema
│   ├── migrate_add_ocr.py      # OCR columns migration
│   ├── add_ocr_columns.sql     # SQL migration script
│   ├── migrate_pgvector_rag.py # RAG system migration
│   └── add_pgvector_rag.sql    # pgvector + RAG tables
├── knowledge_base.json         # 34 IT roles with skills
├── requirements.txt            # Python dependencies
├── .env                        # Environment variables
├── GROQ_SETUP.md              # Groq API setup guide
├── RAG_SETUP.md               # RAG system setup guide
└── README.md                   # This file
```

## Setup Instructions

### 1. Prerequisites

- Python 3.8+
- PostgreSQL 12+ with pgvector extension
- Modern web browser
- Groq API key ([console.groq.com](https://console.groq.com))

### 2. Database Setup

```bash
# Create databases
psql -U postgres -c "CREATE DATABASE job_applications;"
psql -U postgres -c "CREATE DATABASE doc_db;"
```

Tables are created automatically when the backend starts.

### 3. Environment Configuration

Create `.env` in the `backend/` directory:

```env
# Main Database
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=job_applications
DB_PORT=5432

# Document Database
DOC_DB_HOST=localhost
DOC_DB_USER=postgres
DOC_DB_PASSWORD=your_password
DOC_DB_NAME=doc_db
DOC_DB_PORT=5432

# Groq API
GROQ_API_KEY=gsk_your_api_key_here
```

### 4. Install Dependencies

```bash
python -m venv .job
.job\Scripts\activate        # Windows
# source .job/bin/activate   # Linux/Mac

pip install -r requirements.txt
```

### 5. Run the Application

**Backend:**
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
cd frontend
python -m http.server 3000
```

Visit `http://localhost:3000` in your browser.

## API Endpoints

### Application & Resume

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/api/options` | GET | Available job roles |
| `/api/submit` | POST | Submit job application |
| `/api/applicants` | GET | List all applicants |
| `/api/upload-resume` | POST | Upload resume (PDF/DOCX) |

### AI Extraction & Recommendations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/extract-resume/{id}` | POST | Extract structured data via Groq |
| `/api/recommend-roles/{id}` | GET | Get top role recommendations |

### Course Generation 🆕

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/generate-course/{resume_id}` | POST | Generate course from resume + target role |
| `/api/generate-course` | POST | Generate course from skill lists |
| `/api/generate-course-week` | POST | Get daily breakdown for a week |
| `/api/generate-course-day` | POST | Get day content + YouTube/web resources |

## Application Flow

```
1. Apply      →  index.html       →  POST /api/submit
2. Upload     →  resume.html      →  POST /api/upload-resume
3. Extract    →  (automatic)      →  POST /api/extract-resume/{id}
4. Recommend  →  course.html      →  GET  /api/recommend-roles/{id}
5. Learn      →  course.html      →  POST /api/generate-course/{id}
```

## Database Schema

### applicants (job_applications DB)
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Auto-increment ID |
| name | VARCHAR(255) | Full name |
| email | VARCHAR(255) UNIQUE | Email address |
| password | VARCHAR(255) | Hashed password |
| job_roles | TEXT | JSON array of selected roles |
| created_at | TIMESTAMP | Submission time |

### resumes (doc_db)
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Resume ID |
| user_name | VARCHAR(255) | Applicant name |
| file | BYTEA | Binary file data |
| file_type | VARCHAR(10) | pdf/docx |
| ocr_text | TEXT | Extracted text |
| extracted_info | JSONB | Structured data from LLM |

### role_embeddings (doc_db)
| Column | Type | Description |
|--------|------|-------------|
| role_name | VARCHAR(255) UNIQUE | Role title |
| category | VARCHAR(100) | Role category |
| embedding | VECTOR(384) | Sentence-transformer embedding |

## Enabling OCR (Optional)

```bash
pip install paddleocr paddlepaddle pdf2image Pillow python-docx
```

Uncomment OCR code in `backend/main.py` as documented in the file.

## Security Notes

- Passwords hashed with SHA-256 (use bcrypt for production)
- Email uniqueness validation
- File type and size validation
- CORS configuration for frontend integration

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Backend won't start | Check PostgreSQL is running, verify `.env` credentials |
| Frontend can't connect | Ensure backend is on port 8000, check CORS |
| Database errors | Run `psql -U postgres -l` to verify databases exist |
| Resume upload fails | Check file size (<10MB) and type (PDF/DOCX) |
| Course generation fails | Verify `GROQ_API_KEY` in `.env` |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, JavaScript (vanilla) |
| Backend | Python, FastAPI, Uvicorn |
| Database | PostgreSQL, pgvector |
| AI/ML | Groq API (Llama), sentence-transformers |
| Search | DuckDuckGo (web), Invidious (YouTube) |

## License

This project is open source and available for educational purposes.
