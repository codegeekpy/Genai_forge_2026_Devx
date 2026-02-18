# TalentForge — AI-Powered Career Recommendations & Learning Paths

A full-stack recruitment application with **secure user authentication**, resume upload, OCR text extraction, **RAG-based career recommendations**, and **personalized course generation** powered by Groq LLM.

## 🚀 Key Features

### 👤 User & Account Management
- **Secure Authentication** — JWT-inspired local storage auth with Signup and Login flows.
- **Personal Dashboard** — Overview of uploaded resumes, overall "Resume Ready" score, and top role matches.
- **Profile Management** — View and edit user details, managed skills, and missing skills breakdown.
- **Resume History** — Track and manage multiple resume uploads with delete functionality.

### 🤖 AI-Powered Pipeline
- **Groq LLM Extraction** — Structured data extraction from resumes (skills, experience, education, projects).
- **RAG Career Matching** — Semantic search using `all-MiniLM-L6-v2` embeddings across 34+ IT roles.
- **Skill Gap Analysis** — Intelligent identification of missing skills for targeted roles.
- **Course Generation** — Personalized upskilling courses with weekly/daily breakdowns and curated resources (YouTube + Web).

### 🎨 Modern Classic Interface
- **Corporate Aesthetics** — Navy, Teal, and Gold color palette with elegant Merriweather typography.
- **Dynamic Dashboard** — Animated score progress rings and interactive role cards.
- **Responsive Design** — Fully functional across desktop and mobile devices.

---

## 📂 Project Structure

```
Genai_forge_2026_Devx/
├── backend/
│   ├── main.py                 # FastAPI application & API routing
│   ├── database.py             # PostgreSQL & Document DB management
│   ├── rag_engine.py           # Vector matching & role recommendation logic
│   ├── course_generator.py     # Groq-powered curriculum development
│   ├── ocr_processor.py        # Resume parsing & OCR module
│   └── .env                    # Secret keys & DB credentials
├── frontend/
│   ├── index.html              # Home page / Application landing
│   ├── auth.html               # Login & Registration page 🆕
│   ├── dashboard.html          # User overview & quick stats 🆕
│   ├── profile.html            # Detailed skill & resume management 🆕
│   ├── resume.html             # Multi-format resume upload center
│   ├── course.html             # Learning path visualization
│   └── style.css               # Core design system
├── database/
│   ├── schema.sql              # Core table definitions
│   └── migrations/             # SQL & Python migration scripts
├── knowledge_base.json         # Master role-skill reference (34+ roles)
└── requirements.txt            # Python environment dependencies
```

---

## 🛠️ Setup Instructions

### 1. Prerequisites
- Python 3.9+
- PostgreSQL 13+ (with `pgvector` extension)
- Groq Cloud API Key ([Get one here](https://console.groq.com/))

### 2. Database Initialization
```bash
# Create the required PostgreSQL databases
psql -U postgres -c "CREATE DATABASE job_applications;"
psql -U postgres -c "CREATE DATABASE doc_db;"
```

### 3. Environment Config
Create a `.env` file in the `backend/` directory:
```env
DB_HOST=localhost
DB_NAME=job_applications
DB_USER=your_user
DB_PASSWORD=your_password

DOC_DB_NAME=doc_db
GROQ_API_KEY=gsk_your_key_here
```

### 4. Running the Project
**Backend:**
```bash
cd backend
python -m venv .job
source .job/bin/activate  # Linux/Mac
uvicorn main:app --reload
```

**Frontend:**
```bash
cd frontend
python3 -m http.server 3000
```

---

## 📡 API Endpoints

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/signup` | POST | Register a new user |
| `/api/auth/login` | POST | Authenticate user & return ID |

### Dashboard & Profile
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/user/{id}/profile` | GET | Comprehensive user profile & skills |
| `/api/user/{id}/resumes` | GET | Fetch all resumes for a user |
| `/api/user/{id}/update` | PUT | Update profile information |

### RAG & Courses
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/recommend-roles/{id}` | POST | Generate ranked role matches (0-100%) |
| `/api/generate-course/{id}` | POST | Build full course for specific role |
| `/api/generate-course-week` | POST | Expand week into daily tasks |

---

## 🔄 Application Flow
1. **Join** → Register/Login via `auth.html`
2. **Setup** → Submit basic info via `index.html`
3. **Upload** → Provide resume in `resume.html`
4. **Discover** → View matches on `dashboard.html`
5. **Learn** → Generate courses on `course.html`
6. **Improve** → Track missing skills on `profile.html`

---

## 🗄️ Database Schema Highlights

### `users` (job_applications DB)
- `username`, `email`, `password` (SHA-256), `user_id`

### `resumes` (doc_db)
- `user_id`, `file` (BYTEA), `ocr_text`, `extracted_info` (JSONB)

### `skill_recommendations` (doc_db)
- `resume_id`, `recommended_roles` (JSONB - includes scores, matching & missing skills)

---

## 🛡️ Security & Reliability
- **Password Protection**: SHA-256 hashing for all user accounts.
- **Fail-safe Matching**: Python-based similarity fallback if `pgvector` is missing.
- **Integer Scoring**: Accurate 0-100% whole number match percentages.
- **OCR Redundancy**: Multi-stage text extraction for complex PDF layouts.

## 📄 License
Education purposes only. Designed for **Advanced Agentic Coding** demonstration.
