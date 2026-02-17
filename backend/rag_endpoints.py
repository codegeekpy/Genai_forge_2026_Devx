

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
            detail=" RAG Engine not available."
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
