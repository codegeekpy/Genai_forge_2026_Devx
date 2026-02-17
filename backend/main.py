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


 
 
 
 #   = = = = = = = = = = = = = = = = = = = =   R A G   S Y S T E M   E N D P O I N T S   = = = = = = = = = = = = = = = = = = = = 
 
 
 
 c l a s s   S k i l l M a t c h R e q u e s t ( B a s e M o d e l ) : 
 
         " " " R e q u e s t   m o d e l   f o r   s k i l l   m a t c h i n g " " " 
 
         s k i l l s :   l i s t [ s t r ] 
 
         t o p _ k :   i n t   =   5 
 
         
 
         @ f i e l d _ v a l i d a t o r ( ' s k i l l s ' ) 
 
         @ c l a s s m e t h o d 
 
         d e f   v a l i d a t e _ s k i l l s ( c l s ,   v ) : 
 
                 i f   n o t   v   o r   l e n ( v )   = =   0 : 
 
                         r a i s e   V a l u e E r r o r ( ' P l e a s e   p r o v i d e   a t   l e a s t   o n e   s k i l l ' ) 
 
                 r e t u r n   v 
 
         
 
         @ f i e l d _ v a l i d a t o r ( ' t o p _ k ' ) 
 
         @ c l a s s m e t h o d 
 
         d e f   v a l i d a t e _ t o p _ k ( c l s ,   v ) : 
 
                 i f   v   <   1   o r   v   >   2 0 : 
 
                         r a i s e   V a l u e E r r o r ( ' t o p _ k   m u s t   b e   b e t w e e n   1   a n d   2 0 ' ) 
 
                 r e t u r n   v 
 
 
 
 
 
 c l a s s   U p s k i l l i n g R e q u e s t ( B a s e M o d e l ) : 
 
         " " " R e q u e s t   m o d e l   f o r   u p s k i l l i n g   s u g g e s t i o n s " " " 
 
         c u r r e n t _ s k i l l s :   l i s t [ s t r ] 
 
         t a r g e t _ r o l e :   s t r 
 
         
 
         @ f i e l d _ v a l i d a t o r ( ' c u r r e n t _ s k i l l s ' ) 
 
         @ c l a s s m e t h o d 
 
         d e f   v a l i d a t e _ s k i l l s ( c l s ,   v ) : 
 
                 i f   n o t   v   o r   l e n ( v )   = =   0 : 
 
                         r a i s e   V a l u e E r r o r ( ' P l e a s e   p r o v i d e   a t   l e a s t   o n e   c u r r e n t   s k i l l ' ) 
 
                 r e t u r n   v 
 
 
 
 
 
 @ a p p . o n _ e v e n t ( " s t a r t u p " ) 
 
 a s y n c   d e f   s t a r t u p _ r a g ( ) : 
 
         " " " I n i t i a l i z e   R A G   e m b e d d i n g s   o n   s t a r t u p " " " 
 
         i f   r a g _ e n g i n e : 
 
                 t r y : 
 
                         #   E m b e d   r o l e s   i f   n o t   a l r e a d y   d o n e 
 
                         s u c c e s s ,   m e s s a g e   =   r a g _ e n g i n e . e m b e d _ r o l e s ( ) 
 
                         p r i n t ( f " [ R A G ]   S t a r t u p   e m b e d d i n g :   { m e s s a g e } " ) 
 
                 e x c e p t   E x c e p t i o n   a s   e : 
 
                         p r i n t ( f " [ R A G ]   W a r n i n g   d u r i n g   s t a r t u p   e m b e d d i n g :   { s t r ( e ) } " ) 
 
 
 
 
 
 @ a p p . p o s t ( " / a p i / m a t c h - s k i l l s " ,   t a g s = [ " R A G   R e c o m m e n d a t i o n s " ] ,   s u m m a r y = " M a t c h   S k i l l s   t o   R o l e s " ) 
 
 a s y n c   d e f   m a t c h _ s k i l l s _ t o _ r o l e s ( r e q u e s t :   S k i l l M a t c h R e q u e s t ) : 
 
         " " " 
 
         M a t c h   c a n d i d a t e   s k i l l s   t o   j o b   r o l e s   u s i n g   s e m a n t i c   s i m i l a r i t y . 
 
         
 
         -   * * s k i l l s * * :   L i s t   o f   s k i l l s   t o   m a t c h 
 
         -   * * t o p _ k * * :   N u m b e r   o f   t o p   m a t c h i n g   r o l e s   t o   r e t u r n   ( d e f a u l t :   5 ) 
 
         
 
         R e t u r n s   t o p   m a t c h i n g   r o l e s   w i t h   s i m i l a r i t y   s c o r e s . 
 
         " " " 
 
         i f   n o t   r a g _ e n g i n e : 
 
                 r a i s e   H T T P E x c e p t i o n ( 
 
                         s t a t u s _ c o d e = 5 0 3 , 
 
                         d e t a i l = " R A G   E n g i n e   n o t   a v a i l a b l e .   P l e a s e   c h e c k   s e r v e r   l o g s . " 
 
                 ) 
 
         
 
         t r y : 
 
                 m a t c h e s   =   r a g _ e n g i n e . m a t c h _ s k i l l s ( 
 
                         c a n d i d a t e _ s k i l l s = r e q u e s t . s k i l l s , 
 
                         t o p _ k = r e q u e s t . t o p _ k 
 
                 ) 
 
                 
 
                 r e t u r n   { 
 
                         " s t a t u s " :   " s u c c e s s " , 
 
                         " i n p u t _ s k i l l s " :   r e q u e s t . s k i l l s , 
 
                         " m a t c h e s _ f o u n d " :   l e n ( m a t c h e s ) , 
 
                         " m a t c h e s " :   m a t c h e s 
 
                 } 
 
                 
 
         e x c e p t   E x c e p t i o n   a s   e : 
 
                 r a i s e   H T T P E x c e p t i o n ( 
 
                         s t a t u s _ c o d e = 5 0 0 , 
 
                         d e t a i l = f " E r r o r   m a t c h i n g   s k i l l s :   { s t r ( e ) } " 
 
                 ) 
 
 
 
 
 
 @ a p p . p o s t ( " / a p i / r e c o m m e n d - r o l e s / { r e s u m e _ i d } " ,   t a g s = [ " R A G   R e c o m m e n d a t i o n s " ] ,   s u m m a r y = " G e t   R o l e   R e c o m m e n d a t i o n s " ) 
 
 a s y n c   d e f   r e c o m m e n d _ r o l e s _ f o r _ r e s u m e ( r e s u m e _ i d :   i n t ,   t o p _ k :   i n t   =   5 ) : 
 
         " " " 
 
         G e t   p e r s o n a l i z e d   r o l e   r e c o m m e n d a t i o n s   b a s e d   o n   e x t r a c t e d   r e s u m e   d a t a . 
 
         
 
         -   * * r e s u m e _ i d * * :   I D   o f   t h e   r e s u m e   t o   a n a l y z e 
 
         -   * * t o p _ k * * :   N u m b e r   o f   t o p   r e c o m m e n d a t i o n s   ( d e f a u l t :   5 ) 
 
         
 
         R e t u r n s   r e c o m m e n d e d   r o l e s   w i t h   m a t c h   s c o r e s ,   m a t c h i n g / m i s s i n g   s k i l l s ,   a n d   c a r e e r   i n f o . 
 
         " " " 
 
         i f   n o t   r a g _ e n g i n e : 
 
                 r a i s e   H T T P E x c e p t i o n ( 
 
                         s t a t u s _ c o d e = 5 0 3 , 
 
                         d e t a i l = " R A G   E n g i n e   n o t   a v a i l a b l e . " 
 
                 ) 
 
         
 
         t r y : 
 
                 #   G e t   e x t r a c t e d   i n f o   f r o m   d a t a b a s e 
 
                 r e s u l t   =   d o c _ d b . g e t _ e x t r a c t e d _ i n f o ( r e s u m e _ i d ) 
 
                 
 
                 i f   n o t   r e s u l t   o r   n o t   r e s u l t . g e t ( ' e x t r a c t e d _ i n f o ' ) : 
 
                         r a i s e   H T T P E x c e p t i o n ( 
 
                                 s t a t u s _ c o d e = 4 0 4 , 
 
                                 d e t a i l = " N o   e x t r a c t e d   i n f o r m a t i o n   f o u n d .   P l e a s e   r u n   e x t r a c t i o n   f i r s t . " 
 
                         ) 
 
                 
 
                 e x t r a c t e d _ d a t a   =   r e s u l t [ ' e x t r a c t e d _ i n f o ' ] 
 
                 
 
                 #   G e n e r a t e   r e c o m m e n d a t i o n s 
 
                 r e c o m m e n d a t i o n s   =   r a g _ e n g i n e . r e c o m m e n d _ r o l e s ( 
 
                         e x t r a c t e d _ d a t a = e x t r a c t e d _ d a t a , 
 
                         t o p _ k = t o p _ k 
 
                 ) 
 
                 
 
                 #   S a v e   r e c o m m e n d a t i o n s   t o   d a t a b a s e 
 
                 t r y : 
 
                         d o c _ d b . c o n n e c t i o n . c u r s o r ( ) . e x e c u t e ( " " " 
 
                                 I N S E R T   I N T O   s k i l l _ r e c o m m e n d a t i o n s   ( r e s u m e _ i d ,   r e c o m m e n d e d _ r o l e s ,   c r e a t e d _ a t ) 
 
                                 V A L U E S   ( % s ,   % s ,   C U R R E N T _ T I M E S T A M P ) 
 
                                 O N   C O N F L I C T   ( r e s u m e _ i d )   D O   U P D A T E 
 
                                 S E T   r e c o m m e n d e d _ r o l e s   =   E X C L U D E D . r e c o m m e n d e d _ r o l e s , 
 
                                         u p d a t e d _ a t   =   C U R R E N T _ T I M E S T A M P 
 
                         " " " ,   ( r e s u m e _ i d ,   j s o n . d u m p s ( r e c o m m e n d a t i o n s ) ) ) 
 
                         d o c _ d b . c o n n e c t i o n . c o m m i t ( ) 
 
                 e x c e p t   E x c e p t i o n   a s   e : 
 
                         p r i n t ( f " [ R A G ]   W a r n i n g :   C o u l d   n o t   s a v e   r e c o m m e n d a t i o n s :   { s t r ( e ) } " ) 
 
                 
 
                 r e t u r n   { 
 
                         * * r e c o m m e n d a t i o n s , 
 
                         " r e s u m e _ i d " :   r e s u m e _ i d , 
 
                         " u s e r _ n a m e " :   r e s u l t . g e t ( ' u s e r _ n a m e ' ) 
 
                 } 
 
                 
 
         e x c e p t   H T T P E x c e p t i o n : 
 
                 r a i s e 
 
         e x c e p t   E x c e p t i o n   a s   e : 
 
                 r a i s e   H T T P E x c e p t i o n ( 
 
                         s t a t u s _ c o d e = 5 0 0 , 
 
                         d e t a i l = f " E r r o r   g e n e r a t i n g   r e c o m m e n d a t i o n s :   { s t r ( e ) } " 
 
                 ) 
 
 
 
 
 
 @ a p p . p o s t ( " / a p i / u p s k i l l i n g - p a t h " ,   t a g s = [ " R A G   R e c o m m e n d a t i o n s " ] ,   s u m m a r y = " G e t   U p s k i l l i n g   S u g g e s t i o n s " ) 
 
 a s y n c   d e f   g e t _ u p s k i l l i n g _ p a t h ( r e q u e s t :   U p s k i l l i n g R e q u e s t ) : 
 
         " " " 
 
         G e t   u p s k i l l i n g   r e c o m m e n d a t i o n s   f o r   a   t a r g e t   r o l e . 
 
         
 
         -   * * c u r r e n t _ s k i l l s * * :   L i s t   o f   s k i l l s   y o u   c u r r e n t l y   h a v e 
 
         -   * * t a r g e t _ r o l e * * :   T a r g e t   r o l e   n a m e   ( m u s t   e x i s t   i n   k n o w l e d g e   b a s e ) 
 
         
 
         R e t u r n s   s k i l l   g a p s   c a t e g o r i z e d   b y   p r i o r i t y   a n d   e s t i m a t e d   l e a r n i n g   t i m e . 
 
         " " " 
 
         i f   n o t   r a g _ e n g i n e : 
 
                 r a i s e   H T T P E x c e p t i o n ( 
 
                         s t a t u s _ c o d e = 5 0 3 , 
 
                         d e t a i l = " R A G   E n g i n e   n o t   a v a i l a b l e . " 
 
                 ) 
 
         
 
         t r y : 
 
                 s u g g e s t i o n s   =   r a g _ e n g i n e . s u g g e s t _ u p s k i l l i n g ( 
 
                         c u r r e n t _ s k i l l s = r e q u e s t . c u r r e n t _ s k i l l s , 
 
                         t a r g e t _ r o l e = r e q u e s t . t a r g e t _ r o l e 
 
                 ) 
 
                 
 
                 i f   s u g g e s t i o n s . g e t ( ' s t a t u s ' )   = =   ' e r r o r ' : 
 
                         r a i s e   H T T P E x c e p t i o n ( 
 
                                 s t a t u s _ c o d e = 4 0 4 , 
 
                                 d e t a i l = s u g g e s t i o n s . g e t ( ' m e s s a g e ' ,   ' U n k n o w n   e r r o r ' ) 
 
                         ) 
 
                 
 
                 r e t u r n   s u g g e s t i o n s 
 
                 
 
         e x c e p t   H T T P E x c e p t i o n : 
 
                 r a i s e 
 
         e x c e p t   E x c e p t i o n   a s   e : 
 
                 r a i s e   H T T P E x c e p t i o n ( 
 
                         s t a t u s _ c o d e = 5 0 0 , 
 
                         d e t a i l = f " E r r o r   g e n e r a t i n g   u p s k i l l i n g   p a t h :   { s t r ( e ) } " 
 
                 ) 
 
 
 
 
 
 @ a p p . p o s t ( " / a p i / c a r e e r - p r o g r e s s i o n / { r e s u m e _ i d } " ,   t a g s = [ " R A G   R e c o m m e n d a t i o n s " ] ,   s u m m a r y = " G e t   C a r e e r   P r o g r e s s i o n " ) 
 
 a s y n c   d e f   g e t _ c a r e e r _ p r o g r e s s i o n _ f o r _ r e s u m e ( r e s u m e _ i d :   i n t ) : 
 
         " " " 
 
         S u g g e s t   c a r e e r   p r o g r e s s i o n   p a t h s   b a s e d   o n   r e s u m e   d a t a . 
 
         
 
         -   * * r e s u m e _ i d * * :   I D   o f   t h e   r e s u m e   t o   a n a l y z e 
 
         
 
         R e t u r n s   n e x t   c a r e e r   s t e p s   w i t h   r e q u i r e d   s k i l l s   a n d   s a l a r y   i n f o r m a t i o n . 
 
         " " " 
 
         i f   n o t   r a g _ e n g i n e : 
 
                 r a i s e   H T T P E x c e p t i o n ( 
 
                         s t a t u s _ c o d e = 5 0 3 , 
 
                         d e t a i l = " R A G   E n g i n e   n o t   a v a i l a b l e . " 
 
                 ) 
 
         
 
         t r y : 
 
                 #   G e t   e x t r a c t e d   i n f o 
 
                 r e s u l t   =   d o c _ d b . g e t _ e x t r a c t e d _ i n f o ( r e s u m e _ i d ) 
 
                 
 
                 i f   n o t   r e s u l t   o r   n o t   r e s u l t . g e t ( ' e x t r a c t e d _ i n f o ' ) : 
 
                         r a i s e   H T T P E x c e p t i o n ( 
 
                                 s t a t u s _ c o d e = 4 0 4 , 
 
                                 d e t a i l = " N o   e x t r a c t e d   i n f o r m a t i o n   f o u n d .   P l e a s e   r u n   e x t r a c t i o n   f i r s t . " 
 
                         ) 
 
                 
 
                 e x t r a c t e d _ d a t a   =   r e s u l t [ ' e x t r a c t e d _ i n f o ' ] 
 
                 s k i l l s   =   e x t r a c t e d _ d a t a . g e t ( ' s k i l l s ' ,   [ ] ) 
 
                 
 
                 #   T r y   t o   d e t e r m i n e   c u r r e n t   r o l e   f r o m   e x p e r i e n c e 
 
                 c u r r e n t _ r o l e   =   N o n e 
 
                 e x p e r i e n c e   =   e x t r a c t e d _ d a t a . g e t ( ' e x p e r i e n c e ' ,   [ ] ) 
 
                 i f   e x p e r i e n c e : 
 
                         #   U s e   m o s t   r e c e n t   j o b   t i t l e   a s   c u r r e n t   r o l e 
 
                         c u r r e n t _ r o l e   =   e x p e r i e n c e [ 0 ] . g e t ( ' t i t l e ' ,   ' ' ) 
 
                 
 
                 i f   n o t   c u r r e n t _ r o l e : 
 
                         #   F i n d   b e s t   m a t c h i n g   r o l e   f r o m   s k i l l s 
 
                         m a t c h e s   =   r a g _ e n g i n e . m a t c h _ s k i l l s ( s k i l l s ,   t o p _ k = 1 ) 
 
                         i f   m a t c h e s : 
 
                                 c u r r e n t _ r o l e   =   m a t c h e s [ 0 ] [ ' r o l e _ n a m e ' ] 
 
                 
 
                 p r o g r e s s i o n   =   r a g _ e n g i n e . g e t _ c a r e e r _ p r o g r e s s i o n ( 
 
                         c u r r e n t _ r o l e = c u r r e n t _ r o l e , 
 
                         c u r r e n t _ s k i l l s = s k i l l s 
 
                 ) 
 
                 
 
                 r e t u r n   { 
 
                         * * p r o g r e s s i o n , 
 
                         " r e s u m e _ i d " :   r e s u m e _ i d , 
 
                         " u s e r _ n a m e " :   r e s u l t . g e t ( ' u s e r _ n a m e ' ) 
 
                 } 
 
                 
 
         e x c e p t   H T T P E x c e p t i o n : 
 
                 r a i s e 
 
         e x c e p t   E x c e p t i o n   a s   e : 
 
                 r a i s e   H T T P E x c e p t i o n ( 
 
                         s t a t u s _ c o d e = 5 0 0 , 
 
                         d e t a i l = f " E r r o r   g e n e r a t i n g   c a r e e r   p r o g r e s s i o n :   { s t r ( e ) } " 
 
                 ) 
 
 
 
 
 
 @ a p p . g e t ( " / a p i / k n o w l e d g e - b a s e / r o l e s " ,   t a g s = [ " R A G   R e c o m m e n d a t i o n s " ] ,   s u m m a r y = " G e t   A l l   A v a i l a b l e   R o l e s " ) 
 
 a s y n c   d e f   g e t _ a l l _ a v a i l a b l e _ r o l e s ( ) : 
 
         " " " 
 
         G e t   l i s t   o f   a l l   j o b   r o l e s   i n   t h e   k n o w l e d g e   b a s e . 
 
         
 
         R e t u r n s   r o l e   n a m e s   w i t h   c a t e g o r i e s   a n d   s u m m a r i e s . 
 
         " " " 
 
         i f   n o t   r a g _ e n g i n e : 
 
                 r a i s e   H T T P E x c e p t i o n ( 
 
                         s t a t u s _ c o d e = 5 0 3 , 
 
                         d e t a i l = "   R A G   E n g i n e   n o t   a v a i l a b l e . " 
 
                 ) 
 
         
 
         t r y : 
 
                 r o l e s   =   r a g _ e n g i n e . g e t _ a l l _ r o l e s ( ) 
 
                 r e t u r n   { 
 
                         " t o t a l _ r o l e s " :   l e n ( r o l e s ) , 
 
                         " r o l e s " :   r o l e s 
 
                 } 
 
         e x c e p t   E x c e p t i o n   a s   e : 
 
                 r a i s e   H T T P E x c e p t i o n ( 
 
                         s t a t u s _ c o d e = 5 0 0 , 
 
                         d e t a i l = f " E r r o r   r e t r i e v i n g   r o l e s :   { s t r ( e ) } " 
 
                 ) 
 
 
 
 
 
 @ a p p . g e t ( " / a p i / k n o w l e d g e - b a s e / s k i l l s " ,   t a g s = [ " R A G   R e c o m m e n d a t i o n s " ] ,   s u m m a r y = " G e t   A l l   R e c o g n i z e d   S k i l l s " ) 
 
 a s y n c   d e f   g e t _ a l l _ r e c o g n i z e d _ s k i l l s ( ) : 
 
         " " " 
 
         G e t   a l l   u n i q u e   s k i l l s   f r o m   t h e   k n o w l e d g e   b a s e ,   c a t e g o r i z e d   b y   t y p e . 
 
         
 
         R e t u r n s   s k i l l s   g r o u p e d   i n t o   c o r e _ s k i l l s ,   a d v a n c e d _ s k i l l s ,   a n d   t o o l s _ a n d _ t e c h n o l o g i e s . 
 
         " " " 
 
         i f   n o t   r a g _ e n g i n e : 
 
                 r a i s e   H T T P E x c e p t i o n ( 
 
                         s t a t u s _ c o d e = 5 0 3 , 
 
                         d e t a i l = " R A G   E n g i n e   n o t   a v a i l a b l e . " 
 
                 ) 
 
         
 
         t r y : 
 
                 s k i l l s   =   r a g _ e n g i n e . g e t _ a l l _ s k i l l s ( ) 
 
                 t o t a l _ s k i l l s   =   ( 
 
                         l e n ( s k i l l s . g e t ( ' c o r e _ s k i l l s ' ,   [ ] ) )   + 
 
                         l e n ( s k i l l s . g e t ( ' a d v a n c e d _ s k i l l s ' ,   [ ] ) )   + 
 
                         l e n ( s k i l l s . g e t ( ' t o o l s _ a n d _ t e c h n o l o g i e s ' ,   [ ] ) ) 
 
                 ) 
 
                 
 
                 r e t u r n   { 
 
                         " t o t a l _ s k i l l s " :   t o t a l _ s k i l l s , 
 
                         " s k i l l s _ b y _ c a t e g o r y " :   s k i l l s 
 
                 } 
 
         e x c e p t   E x c e p t i o n   a s   e : 
 
                 r a i s e   H T T P E x c e p t i o n ( 
 
                         s t a t u s _ c o d e = 5 0 0 , 
 
                         d e t a i l = f " E r r o r   r e t r i e v i n g   s k i l l s :   { s t r ( e ) } " 
 
                 ) 
 
 