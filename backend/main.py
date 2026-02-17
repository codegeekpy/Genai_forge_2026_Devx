from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, field_validator
from database import Database, DocumentDatabase
from ocr_processor import OCRProcessor
from groq_extractor import GroqLLMExtractor
import hashlib
import io

app = FastAPI(
    title="Job Application & Resume Management API",
    description="""
    Complete API for job application management with advanced resume processing capabilities.
    
    ## Features
    * 📝 Job Application Submission
    * 📄 Resume Upload (PDF/DOCX)
    * 🔍 OCR Text Extraction
    * 🤖 AI-Powered Information Extraction
    * 💾 PostgreSQL Database Storage
    
    ## Workflow
    1. Upload resume → OCR extraction → Store in database
    2. Trigger AI extraction → Structured JSON data
    3. Retrieve and use extracted information
    """,
    version="2.0.0",
    contact={
        "name": "API Support",
        "email": "support@example.com",
    },
    license_info={
        "name": "MIT",
    },
)

# Enable CORS for frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database instance
db = Database()

# Document Database instance for resume storage
doc_db = DocumentDatabase()

# OCR Processor instance for text extraction
ocr_processor = OCRProcessor()

# LLM Extractor instance using Groq API (cloud-based, FREE tier)
# No local RAM usage - perfect for low-memory systems
llm_extractor = GroqLLMExtractor()

# RAG Engine instance for skill matching and recommendations
try:
    from rag_engine import RAGEngine
    rag_engine = RAGEngine(knowledge_base_path="knowledge_base.json")
    print("[API] RAG Engine initialized successfully")
except Exception as e:
    rag_engine = None
    print(f"[API] Warning: RAG Engine not initialized: {str(e)}")

# Job roles and industries options
JOB_ROLES = [
    "Software Engineer",
    "Data Scientist",
    "Full Stack Developer",
    "DevOps Engineer",
    "Machine Learning Engineer",
    "Frontend Developer",
    "Backend Developer",
    "Product Manager",
    "UI/UX Designer",
    "Quality Assurance Engineer"
]

class ApplicantRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    job_roles: list[str]
    
    @field_validator('name')
    @classmethod
    def validate_name(cls, v):
        if len(v.strip()) < 2:
            raise ValueError('Name must be at least 2 characters long')
        return v.strip()
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters long')
        return v
    
    @field_validator('job_roles')
    @classmethod
    def validate_job_roles(cls, v):
        if not v or len(v) == 0:
            raise ValueError('Please select at least one job role')
        for role in v:
            if role not in JOB_ROLES:
                raise ValueError(f'Invalid job role: {role}')
        return v

@app.on_event("startup")
async def startup_event():
    """Connect to databases on startup"""
    db.connect()
    doc_db.connect()
    doc_db.create_resumes_table()

@app.on_event("shutdown")
async def shutdown_event():
    """Disconnect from databases on shutdown"""
    db.disconnect()
    doc_db.disconnect()

@app.get("/", tags=["System"])
async def root():
    """API Health Check"""
    return {
        "status": "online",
        "message": "Job Application & Resume Management API",
        "version": "2.0.0",
        "docs": "/docs"
    }

@app.get("/api/options", tags=["Job Application"])
async def get_options():
    """Get available job role options for application form"""
    return {
        "job_roles": JOB_ROLES
    }

@app.post("/api/submit", tags=["Job Application"], summary="Submit Job Application")
async def submit_application(applicant: ApplicantRequest):
    """
    Submit a new job application.
    
    - **name**: Applicant's full name
    - **email**: Valid email address (must be unique)
    - **password**: Account password (min 6 characters)
    - **job_roles**: List of preferred job roles
    """
    # Hash the password (simple hash - in production use bcrypt or similar)
    hashed_password = hashlib.sha256(applicant.password.encode()).hexdigest()
    
    success, message = db.insert_applicant(
        name=applicant.name,
        email=applicant.email,
        password=hashed_password,
        job_roles=applicant.job_roles
    )
    
    if success:
        return {"status": "success", "message": message}
    else:
        raise HTTPException(status_code=400, detail=message)

@app.get("/api/applicants", tags=["Job Application"], summary="Get All Applicants")
async def get_applicants():
    """Retrieve all job applicants (admin endpoint)"""
    applicants = db.get_all_applicants()
    return {"applicants": applicants}


@app.delete("/api/applicant/{applicant_id}", tags=["Job Application"], summary="Delete Applicant")
async def delete_applicant(applicant_id: int):
    """Delete an applicant by ID"""
    try:
        success, message = db.delete_applicant(applicant_id)
        
        if success:
            return {
                "status": "success",
                "message": message,
                "applicant_id": applicant_id
            }
        else:
            raise HTTPException(
                status_code=404,
                detail=message
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting applicant: {str(e)}"
        )


@app.post("/api/upload-resume", tags=["Resume Management"], summary="Upload Resume with OCR")
async def upload_resume(
    user_name: str = Form(...),
    resume: UploadFile = File(...)
):
    """
    Upload a resume file and automatically extract text using OCR.
    
    - **user_name**: Name associated with the resume
    - **resume**: PDF or DOCX file (max 10MB)
    
    Returns resume ID, OCR status, and text preview.
    """
    
    # Validate file type
    allowed_extensions = ['.pdf', '.docx']
    file_extension = None
    
    if resume.filename.lower().endswith('.pdf'):
        file_extension = 'pdf'
    elif resume.filename.lower().endswith('.docx'):
        file_extension = 'docx'
    else:
        raise HTTPException(
            status_code=400, 
            detail="Invalid file type. Only PDF and DOCX files are allowed."
        )
    
    # Read file content
    try:
        file_content = await resume.read()
        
        # Validate file size (max 10MB)
        max_size = 10 * 1024 * 1024  # 10MB
        if len(file_content) > max_size:
            raise HTTPException(
                status_code=400,
                detail="File size exceeds 10MB limit"
            )
        
        # Process OCR to extract text
        ocr_success, ocr_text, ocr_message = ocr_processor.process_file(
            file_data=file_content,
            file_type=file_extension
        )
        
        # Store in database with OCR text (if successful)
        success, resume_id, message = doc_db.insert_resume(
            user_name=user_name,
            file_data=file_content,
            file_type=file_extension,
            ocr_text=ocr_text if ocr_success else None
        )
        
        if success:
            response_data = {
                "status": "success",
                "message": message,
                "resume_id": resume_id,
                "file_name": resume.filename,
                "file_type": file_extension,
                "ocr_processed": ocr_success,
                "ocr_message": ocr_message
            }
            
            # Optionally include preview of extracted text
            if ocr_success and ocr_text:
                response_data["ocr_preview"] = ocr_text[:200] + "..." if len(ocr_text) > 200 else ocr_text
            
            return response_data
        else:
            raise HTTPException(status_code=500, detail=message)
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing file: {str(e)}"
        )


@app.get("/api/resume/{resume_id}/ocr-text", tags=["Resume Management"], summary="Get OCR Text")
async def get_resume_ocr_text(resume_id: int):
    """Retrieve the raw OCR-extracted text from a specific resume"""
    try:
        # Use metadata method to avoid loading large binary file
        resume = doc_db.get_resume_metadata(resume_id)
        
        if not resume:
            raise HTTPException(
                status_code=404,
                detail=f"Resume with ID {resume_id} not found"
            )
        
        return {
            "resume_id": resume['id'],
            "user_name": resume['user_name'],
            "file_type": resume['file_type'],
            "file_uploaded_time": resume['file_uploaded_time'],
            "ocr_text": resume['ocr_text'],
            "ocr_processed_time": resume['ocr_processed_time'],
            "has_ocr_text": resume['ocr_text'] is not None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving OCR text: {str(e)}"
        )


@app.get("/api/resumes", tags=["Resume Management"], summary="List All Resumes")
async def get_all_resumes():
    """
    List all resumes with metadata and extraction status.
    
    Returns: Resume list with OCR status, extraction status, and preview data.
    """
    try:
        from psycopg2 import extras
        cursor = doc_db.connection.cursor(cursor_factory=extras.RealDictCursor)
        query = """
            SELECT id, user_name, file_type, file_uploaded_time, 
                   ocr_processed_time,
                   extraction_processed_time,
                   CASE 
                       WHEN ocr_text IS NOT NULL THEN LEFT(ocr_text, 200)
                       ELSE NULL
                   END as ocr_preview,
                   CASE 
                       WHEN ocr_text iS NOT NULL THEN true
                       ELSE false
                   END as has_ocr_text,
                   CASE 
                       WHEN extracted_info IS NOT NULL THEN true
                       ELSE false
                   END as has_extracted_info,
                   CASE 
                       WHEN extracted_info IS NOT NULL THEN 
                           jsonb_build_object(
                               'name', extracted_info->>'name',
                               'email', extracted_info->>'email',
                               'phone', extracted_info->>'phone'
                           )
                       ELSE NULL
                   END as extraction_preview
            FROM resumes 
            ORDER BY id DESC
        """
        cursor.execute(query)
        results = cursor.fetchall()
        cursor.close()
        
        return {
            "count": len(results),
            "resumes": results
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving resumes: {str(e)}"
        )


@app.delete("/api/resume/{resume_id}", tags=["Resume Management"], summary="Delete Resume")
async def delete_resume(resume_id: int):
    """Delete a resume by ID"""
    try:
        success, message = doc_db.delete_resume(resume_id)
        
        if success:
            return {
                "status": "success",
                "message": message,
                "resume_id": resume_id
            }
        else:
            raise HTTPException(
                status_code=404,
                detail=message
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting resume: {str(e)}"
        )


class ResumeUpdateRequest(BaseModel):
    user_name: str
    
    @field_validator('user_name')
    @classmethod
    def validate_user_name(cls, v):
        if len(v.strip()) < 2:
            raise ValueError('Name must be at least 2 characters long')
        return v.strip()


@app.put("/api/resume/{resume_id}", tags=["Resume Management"], summary="Update Resume Metadata")
async def update_resume(resume_id: int, update_data: ResumeUpdateRequest):
    """Update resume metadata (user_name)"""
    try:
        success, message = doc_db.update_resume(
            resume_id=resume_id,
            user_name=update_data.user_name
        )
        
        if success:
            return {
                "status": "success",
                "message": message,
                "resume_id": resume_id,
                "updated_user_name": update_data.user_name
            }
        else:
            raise HTTPException(
                status_code=404,
                detail=message
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error updating resume: {str(e)}"
        )


@app.post("/api/resume/{resume_id}/extract", tags=["AI Extraction"], summary="Extract Resume Information")
async def extract_resume_information(resume_id: int):
    """
    Trigger AI-powered extraction of structured information from OCR text.
    
    Uses Ollama LLM to extract:
    - Contact information (name, email, phone)
    - Education history
    - Skills list
    - Work experience
    - Projects
    - Certifications
    
    Returns: Extraction preview with counts and basic info.
    """
    try:
        # Get resume metadata with OCR text
        resume = doc_db.get_resume_metadata(resume_id)
        
        if not resume:
            raise HTTPException(
                status_code=404,
                detail=f"Resume with ID {resume_id} not found"
            )
        
        # Check if OCR text exists
        if not resume['ocr_text']:
            raise HTTPException(
                status_code=400,
                detail="No OCR text available for this resume. Please process OCR first."
            )
        
        # Extract information using LLM
        print(f"[API] Starting extraction for resume {resume_id}")
        success, extracted_data, message = llm_extractor.extract_information(
            ocr_text=resume['ocr_text']
        )
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail=f"Extraction failed: {message}"
            )
        
        # Store extracted data in database
        db_success, db_message = doc_db.update_extracted_info(
            resume_id=resume_id,
            extracted_json=extracted_data
        )
        
        if not db_success:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to save extracted data: {db_message}"
            )
        
        return {
            "status": "success",
            "message": "Information extracted successfully",
            "resume_id": resume_id,
            "extracted_preview": {
                "name": extracted_data.get("name", ""),
                "email": extracted_data.get("email", ""),
                "phone": extracted_data.get("phone", ""),
                "skills_count": len(extracted_data.get("skills", [])),
                "education_count": len(extracted_data.get("education", [])),
                "experience_count": len(extracted_data.get("experience", [])),
                "projects_count": len(extracted_data.get("projects", [])),
                "certifications_count": len(extracted_data.get("certifications", []))
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error during extraction: {str(e)}"
        )


@app.get("/api/resume/{resume_id}/extracted-info", tags=["AI Extraction"], summary="Get Extracted JSON Data")
async def get_extracted_information(resume_id: int):
    """
    Retrieve the complete structured JSON data extracted by AI.
    
    Returns all extracted fields in JSON format:
    - name, email, phone
    - education[] (degree, institution, year, details)
    - skills[] (array of strings)
    - experience[] (title, company, duration, responsibilities)
    - projects[] (name, description, technologies, duration)
    - certifications[] (array of strings)
    """
    try:
        result = doc_db.get_extracted_info(resume_id)
        
        if not result:
            raise HTTPException(
                status_code=404,
                detail=f"Resume with ID {resume_id} not found"
            )
        
        if not result['extracted_info']:
            raise HTTPException(
                status_code=404,
                detail="No extracted information available. Please run extraction first."
            )
        
        return {
            "resume_id": result['id'],
            "user_name": result['user_name'],
            "extracted_info": result['extracted_info'],
            "extraction_processed_time": result['extraction_processed_time'],
            "has_extracted_info": True
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving extracted information: {str(e)}"
        )


@app.get("/api/resume/{resume_id}/full", tags=["AI Extraction"], summary="Get Complete Resume Data")
async def get_full_resume_data(resume_id: int):
    """
    Get all resume data in one response.
    
    Combines:
    - Metadata (user_name, file_type, upload time)
    - Raw OCR text
    - Extracted structured JSON
    - Processing timestamps
    """
    try:
        # Get metadata with OCR and extracted info
        resume = doc_db.get_resume_metadata(resume_id)
        extracted = doc_db.get_extracted_info(resume_id)
        
        if not resume:
            raise HTTPException(
                status_code=404,
                detail=f"Resume with ID {resume_id} not found"
            )
        
        return {
            "resume_id": resume['id'],
            "user_name": resume['user_name'],
            "file_type": resume['file_type'],
            "file_uploaded_time": resume['file_uploaded_time'],
            "ocr_text": resume['ocr_text'],
            "ocr_processed_time": resume['ocr_processed_time'],
            "has_ocr_text": resume['ocr_text'] is not None,
            "extracted_info": extracted['extracted_info'] if extracted else None,
            "extraction_processed_time": extracted['extraction_processed_time'] if extracted else None,
            "has_extracted_info": extracted['extracted_info'] is not None if extracted else False
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving full resume data: {str(e)}"
        )



# ==================== RAG SYSTEM ENDPOINTS ====================

class SkillMatchRequest(BaseModel):
    """Request model for skill matching"""
    skills: list[str]
    top_k: int = 5
    
    @field_validator('skills')
    @classmethod
    def validate_skills(cls, v):
        if not v or len(v) == 0:
            raise ValueError('Please provide at least one skill')
        return v
    
    @field_validator('top_k')
    @classmethod
    def validate_top_k(cls, v):
        if v < 1 or v > 20:
            raise ValueError('top_k must be between 1 and 20')
        return v


class UpskillingRequest(BaseModel):
    """Request model for upskilling suggestions"""
    current_skills: list[str]
    target_role: str
    
    @field_validator('current_skills')
    @classmethod
    def validate_skills(cls, v):
        if not v or len(v) == 0:
            raise ValueError('Please provide at least one current skill')
        return v


@app.on_event("startup")
async def startup_rag():
    """Initialize RAG embeddings on startup"""
    if rag_engine:
        try:
            # Embed roles if not already done
            success, message = rag_engine.embed_roles()
            print(f"[RAG] Startup embedding: {message}")
        except Exception as e:
            print(f"[RAG] Warning during startup embedding: {str(e)}")


@app.post("/api/match-skills", tags=["RAG Recommendations"], summary="Match Skills to Roles")
async def match_skills_to_roles(request: SkillMatchRequest):
    """
    Match candidate skills to job roles using semantic similarity.
    
    - **skills**: List of skills to match
    - **top_k**: Number of top matching roles to return (default: 5)
    
    Returns top matching roles with similarity scores.
    """
    if not rag_engine:
        raise HTTPException(
            status_code=503,
            detail="RAG Engine not available. Please check server logs."
        )
    
    try:
        matches = rag_engine.match_skills(
            candidate_skills=request.skills,
            top_k=request.top_k
        )
        
        return {
            "status": "success",
            "input_skills": request.skills,
            "matches_found": len(matches),
            "matches": matches
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error matching skills: {str(e)}"
        )


@app.post("/api/recommend-roles/{resume_id}", tags=["RAG Recommendations"], summary="Get Role Recommendations")
async def recommend_roles_for_resume(resume_id: int, top_k: int = 5):
    """
    Get personalized role recommendations based on extracted resume data.
    
    - **resume_id**: ID of the resume to analyze
    - **top_k**: Number of top recommendations (default: 5)
    
    Returns recommended roles with match scores, matching/missing skills, and career info.
    """
    if not rag_engine:
        raise HTTPException(
            status_code=503,
            detail="RAG Engine not available."
        )
    
    try:
        # Get extracted info from database
        result = doc_db.get_extracted_info(resume_id)
        
        if not result or not result.get('extracted_info'):
            raise HTTPException(
                status_code=404,
                detail="No extracted information found. Please run extraction first."
            )
        
        extracted_data = result['extracted_info']
        
        # Generate recommendations
        recommendations = rag_engine.recommend_roles(
            extracted_data=extracted_data,
            top_k=top_k
        )
        
        # Save recommendations to database
        try:
            doc_db.connection.cursor().execute("""
                INSERT INTO skill_recommendations (resume_id, recommended_roles, created_at)
                VALUES (%s, %s, CURRENT_TIMESTAMP)
                ON CONFLICT (resume_id) DO UPDATE
                SET recommended_roles = EXCLUDED.recommended_roles,
                    updated_at = CURRENT_TIMESTAMP
            """, (resume_id, json.dumps(recommendations)))
            doc_db.connection.commit()
        except Exception as e:
            print(f"[RAG] Warning: Could not save recommendations: {str(e)}")
        
        return {
            **recommendations,
            "resume_id": resume_id,
            "user_name": result.get('user_name')
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating recommendations: {str(e)}"
        )


@app.post("/api/upskilling-path", tags=["RAG Recommendations"], summary="Get Upskilling Suggestions")
async def get_upskilling_path(request: UpskillingRequest):
    """
    Get upskilling recommendations for a target role.
    
    - **current_skills**: List of skills you currently have
    - **target_role**: Target role name (must exist in knowledge base)
    
    Returns skill gaps categorized by priority and estimated learning time.
    """
    if not rag_engine:
        raise HTTPException(
            status_code=503,
            detail="RAG Engine not available."
        )
    
    try:
        suggestions = rag_engine.suggest_upskilling(
            current_skills=request.current_skills,
            target_role=request.target_role
        )
        
        if suggestions.get('status') == 'error':
            raise HTTPException(
                status_code=404,
                detail=suggestions.get('message', 'Unknown error')
            )
        
        return suggestions
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating upskilling path: {str(e)}"
        )


@app.post("/api/career-progression/{resume_id}", tags=["RAG Recommendations"], summary="Get Career Progression")
async def get_career_progression_for_resume(resume_id: int):
    """
    Suggest career progression paths based on resume data.
    
    - **resume_id**: ID of the resume to analyze
    
    Returns next career steps with required skills and salary information.
    """
    if not rag_engine:
        raise HTTPException(
            status_code=503,
            detail="RAG Engine not available."
        )
    
    try:
        # Get extracted info
        result = doc_db.get_extracted_info(resume_id)
        
        if not result or not result.get('extracted_info'):
            raise HTTPException(
                status_code=404,
                detail="No extracted information found. Please run extraction first."
            )
        
        extracted_data = result['extracted_info']
        skills = extracted_data.get('skills', [])
        
        # Try to determine current role from experience
        current_role = None
        experience = extracted_data.get('experience', [])
        if experience:
            # Use most recent job title as current role
            current_role = experience[0].get('title', '')
        
        if not current_role:
            # Find best matching role from skills
            matches = rag_engine.match_skills(skills, top_k=1)
            if matches:
                current_role = matches[0]['role_name']
        
        progression = rag_engine.get_career_progression(
            current_role=current_role,
            current_skills=skills
        )
        
        return {
            **progression,
            "resume_id": resume_id,
            "user_name": result.get('user_name')
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating career progression: {str(e)}"
        )


@app.get("/api/knowledge-base/roles", tags=["RAG Recommendations"], summary="Get All Available Roles")
async def get_all_available_roles():
    """
    Get list of all job roles in the knowledge base.
    
    Returns role names with categories and summaries.
    """
    if not rag_engine:
        raise HTTPException(
            status_code=503,
            detail="RAG Engine not available."
        )
    
    try:
        roles = rag_engine.get_all_roles()
        return {
            "total_roles": len(roles),
            "roles": roles
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving roles: {str(e)}"
        )


@app.get("/api/knowledge-base/skills", tags=["RAG Recommendations"], summary="Get All Recognized Skills")
async def get_all_recognized_skills():
    """
    Get all unique skills from the knowledge base, categorized by type.
    
    Returns skills grouped into core_skills, advanced_skills, and tools_and_technologies.
    """
    if not rag_engine:
        raise HTTPException(
            status_code=503,
            detail="RAG Engine not available."
        )
    
    try:
        skills = rag_engine.get_all_skills()
        total_skills = (
            len(skills.get('core_skills', [])) +
            len(skills.get('advanced_skills', [])) +
            len(skills.get('tools_and_technologies', []))
        )
        
        return {
            "total_skills": total_skills,
            "skills_by_category": skills
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error retrieving skills: {str(e)}"
        )
