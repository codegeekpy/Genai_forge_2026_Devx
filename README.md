# Job Application System with AI-Powered Career Recommendations

A full-stack web application for job applications with resume upload, OCR text extraction, and **intelligent career recommendations using RAG (Retrieval-Augmented Generation)**.

## Features

✅ **Professional Frontend Form**
- Responsive design with gradient backgrounds
- Real-time validation
- Multi-select job roles with checkboxes
- Smooth animations and user feedback
- Resume upload page with drag-and-drop support

✅ **FastAPI Backend**
- RESTful API endpoints
- Data validation using Pydantic
- Password hashing
- CORS enabled for frontend integration
- Resume file storage with OCR support

✅ **AI-Powered LLM Extraction (Groq API)**
- Cloud-based extraction (zero local RAM usage)
- Structured data extraction from resumes
- Extract: skills, experience, education, projects, certifications
- Fast and free tier available

✅ **RAG-Based Career Recommendations** 🆕
- **Vector embeddings** using sentence-transformers (384-dim)
- **Semantic skill matching** with pgvector similarity search
- **Role recommendations** with match scores (0-100%)
- **Upskilling suggestions** with learning time estimates
- **Career progression paths** for advancement planning
- **Knowledge base** of 34 IT job roles

✅ **PostgreSQL Databases**
- Main database for applicant data (`job_applications`)
- Document database for resume storage (`doc_db`)
- Email uniqueness constraint
- Timestamp tracking
- OCR text storage
- pgvector extension for embeddings

✅ **Resume Upload System**
- PDF and DOCX file support
- File validation (type and size limits)
- Binary storage in PostgreSQL
- OCR processing capability (PaddleOCR integration ready)

✅ **Job Roles Included**
- Software Engineer
- Data Scientist
- Full Stack Developer
- DevOps Engineer
- Machine Learning Engineer
- Frontend Developer
- Backend Developer
- Product Manager
- UI/UX Designer
- Quality Assurance Engineer
... and 24 more roles in knowledge base

## Project Structure

```
Genai_forge_2026_Devx/
├── backend/
│   ├── main.py                  # FastAPI application with RAG endpoints
│   ├── database.py              # PostgreSQL database operations
│   ├── ocr_processor.py         # OCR text extraction module
│   ├── groq_extractor.py        # Groq API LLM extraction
│   ├── rag_engine.py            # RAG engine for recommendations 🆕
│   └── .env                     # Environment variables
├── frontend/
│   ├── index.html               # Application form
│   ├── style.css                # Form styling
│   ├── script.js                # Form logic
│   ├── resume.html              # Resume upload page
│   ├── resume.css               # Resume page styling
│   └── resume.js                # Resume upload logic
├── database/
│   ├── schema.sql               # Database schema
│   ├── migrate_add_ocr.py       # OCR columns migration
│   ├── add_ocr_columns.sql      # SQL migration script
│   ├── migrate_pgvector_rag.py  # RAG system migration 🆕
│   └── add_pgvector_rag.sql     # pgvector + RAG tables 🆕
├── knowledge_base.json          # 34 IT roles with skills 🆕
├── requirements.txt             # Python dependencies
├── .env                         # Environment variables
├── GROQ_SETUP.md               # Groq API setup guide
├── RAG_SETUP.md                # RAG system setup guide 🆕
└── README.md                    # This file
```

## Setup Instructions

### 1. Prerequisites

- Python 3.8+
- PostgreSQL 12+
- Modern web browser
- Virtual environment (recommended)

### 2. Database Setup

1. Install and start PostgreSQL server

2. Create the databases:

```bash
# Create databases
psql -U postgres -c "CREATE DATABASE job_applications;"
psql -U postgres -c "CREATE DATABASE doc_db;"
```

3. The tables will be created automatically when the backend starts

### 3. Environment Configuration

1. Copy or create `.env` file in the project root:

```env
# Main Job Application Database (PostgreSQL)
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=job_applications
DB_PORT=5432

# Document Database (PostgreSQL)
DOC_DB_HOST=localhost
DOC_DB_USER=postgres
DOC_DB_PASSWORD=your_password
DOC_DB_NAME=doc_db
DOC_DB_PORT=5432
```

### 4. Create Virtual Environment

```bash
# Create virtual environment
python3 -m venv .job

# Activate virtual environment
source .job/bin/activate  # On Windows: .job\Scripts\activate
```

### 5. Install Python Dependencies

```bash
# Install base dependencies
pip install -r requirements.txt
```

**Note:** OCR dependencies (paddleocr, paddlepaddle, etc.) are included in `requirements.txt` but OCR functionality is currently disabled in the code. See "Enabling OCR" section below.

### 6. Run the Backend Server

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

### 7. Run the Frontend

In a separate terminal:

```bash
cd frontend
python3 -m http.server 3000
```

Then visit `http://localhost:3000` in your browser

## API Endpoints

### GET `/`
Health check endpoint

### GET `/api/options`
Get available job roles

**Response:**
```json
{
  "job_roles": ["Software Engineer", "Data Scientist", ...]
}
```

### POST `/api/submit`
Submit job application

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepass123",
  "job_roles": ["Software Engineer", "Data Scientist"]
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Application submitted successfully!"
}
```

### GET `/api/applicants`
Get all applicants (admin endpoint)

### POST `/api/upload-resume`
Upload resume file (PDF or DOCX)

**Form Data:**
- `user_name`: Applicant name
- `resume`: File upload (PDF or DOCX, max 10MB)

**Response:**
```json
{
  "status": "success",
  "message": "Resume uploaded successfully!",
  "resume_id": 1,
  "file_name": "resume.pdf",
  "file_type": "pdf",
  "ocr_processed": false,
  "ocr_message": "OCR dependencies not installed yet"
}
```

## Database Schema

### applicants table (job_applications database)
- `id` - Serial primary key
- `name` - VARCHAR(255)
- `email` - VARCHAR(255) UNIQUE
- `password` - VARCHAR(255) (hashed)
- `job_roles` - TEXT (JSON array)
- `created_at` - TIMESTAMP

### resumes table (doc_db database)
- `id` - Serial primary key
- `user_name` - VARCHAR(255)
- `file` - BYTEA (binary file data)
- `file_type` - VARCHAR(10)
- `file_uploaded_time` - TIMESTAMP
- `ocr_text` - TEXT (extracted text from resume)
- `ocr_processed_time` - TIMESTAMP (when OCR was performed)
- `extracted_info` - JSONB (structured data from LLM) 🆕
- `extraction_processed_time` - TIMESTAMP 🆕

### role_embeddings table (doc_db database) 🆕
- `id` - Serial primary key
- `role_name` - VARCHAR(255) UNIQUE
- `category` - VARCHAR(100)
- `embedding` - VECTOR(384) (sentence-transformer embeddings)
- `created_at` - TIMESTAMP

### skill_recommendations table (doc_db database) 🆕
- `id` - Serial primary key
- `resume_id` - INTEGER (references resumes.id)
- `recommended_roles` - JSONB (cached recommendations)
- `created_at` - TIMESTAMP
- `updated_at` - TIMESTAMP

## Enabling OCR (Optional)

OCR functionality is ready but currently disabled to avoid dependency installation issues. To enable:

### Step 1: Ensure Dependencies Are Installed

```bash
source .job/bin/activate
pip install paddleocr paddlepaddle pdf2image Pillow python-docx
```

Or use the helper script:
```bash
./install_ocr.sh
```

### Step 2: Uncomment OCR Code

In `backend/main.py`, uncomment:
- Line ~5: `from ocr_processor import OCRProcessor`
- Line ~28: `ocr_processor = OCRProcessor()`
- Lines ~156-160: OCR processing code

And remove the temporary placeholders.

### Step 3: Restart Backend

The backend will auto-reload if using `--reload` flag.

**First Run:** PaddleOCR will download language models (~8-10MB).

## Security Features

- Password hashing using SHA-256 (upgrade to bcrypt for production)
- Email uniqueness validation
- Input sanitization and validation
- File type and size validation for uploads
- CORS configuration

## Troubleshooting

### Backend won't start
- Check if PostgreSQL is running: `systemctl status postgresql`
- Verify database credentials in `.env`
- Ensure databases are created: `psql -U postgres -l`
- Check if port 8000 is available: `lsof -i :8000`

### Frontend can't connect to API
- Verify backend is running on port 8000
- Check browser console for CORS errors
- Ensure frontend is on port 3000 (not 8000)
- Verify API_BASE_URL in `script.js` is `http://localhost:8000`

### Database connection errors
- Test PostgreSQL connection: `psql -U postgres`
- Check if databases exist: `\l` in psql
- Verify tables exist: `\c job_applications` then `\dt` and `\c doc_db` then `\dt`

### Resume upload errors
- Check file size (max 10MB)
- Verify file type is PDF or DOCX
- Check backend logs for detailed error messages
- Ensure OCR columns exist (run `python3 database/migrate_add_ocr.py` if needed)

### Port conflicts
- Backend must run on port 8000 (API)
- Frontend must run on different port (e.g., 3000)
- Kill conflicting processes: `fuser -k 8000/tcp`

## Database Migrations

If you already have a `resumes` table without OCR columns, run:

```bash
python3 database/migrate_add_ocr.py
```

This adds:
- `ocr_text` TEXT column
- `ocr_processed_time` TIMESTAMP column

## Future Enhancements

- [x] Add resume/CV upload
- [x] PostgreSQL database migration
- [x] OCR text extraction (ready to enable)
- [x] AI-powered LLM extraction (Groq API) 🆕
- [x] RAG-based career recommendations 🆕
- [x] Semantic skill matching 🆕
- [x] Upskilling path suggestions 🆕
- [x] Career progression planning 🆕
- [ ] Frontend UI for recommendations
- [ ] User authentication/login system
- [ ] Implement bcrypt for password hashing
- [ ] Email confirmation system
- [ ] Admin dashboard for managing applications
- [ ] Application status tracking
- [ ] Export applicants to CSV/Excel
- [ ] Resume parsing improvements
- [ ] Integration with job boards

## License

This project is open source and available for educational purposes.
