"""
RAG (Retrieval-Augmented Generation) Engine for Skill Matching and Career Recommendations

This module provides intelligent skill matching, role recommendations, and upskilling suggestions
using vector embeddings and semantic search with pgvector.
"""

import json
import os
from typing import Dict, List, Optional, Tuple
import numpy as np
from sentence_transformers import SentenceTransformer
import psycopg2
from psycopg2 import extras
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))


class RAGEngine:
    """RAG Engine for skill-based career recommendations"""
    
    def __init__(self, knowledge_base_path: str = "knowledge_base.json"):
        """
        Initialize RAG Engine
        
        Args:
            knowledge_base_path: Path to knowledge base JSON file
        """
        print("[RAG] Initializing RAG Engine...")
        
        # Load sentence transformer model (384-dimensional embeddings)
        self.model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        print(f"[RAG] Loaded embedding model: all-MiniLM-L6-v2 (384 dims)")
        
        # Load knowledge base
        self.knowledge_base_path = knowledge_base_path
        self.knowledge_base = self._load_knowledge_base()
        
        # Database connection parameters
        self.db_host = os.getenv('DOC_DB_HOST', 'localhost')
        self.db_user = os.getenv('DOC_DB_USER', 'postgres')
        self.db_password = os.getenv('DOC_DB_PASSWORD', '')
        self.db_name = os.getenv('DOC_DB_NAME', 'doc_db')
        self.db_port = os.getenv('DOC_DB_PORT', '5432')
        
        print(f"[RAG] Loaded {len(self.knowledge_base.get('roles', []))} roles from knowledge base")
        print("[RAG] RAG Engine initialized successfully")
    
    def _load_knowledge_base(self) -> Dict:
        """Load knowledge base from JSON file"""
        try:
            with open(self.knowledge_base_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"[RAG] Warning: Knowledge base not found at {self.knowledge_base_path}")
            return {"roles": []}
    
    def _get_db_connection(self):
        """Create database connection"""
        return psycopg2.connect(
            host=self.db_host,
            user=self.db_user,
            password=self.db_password,
            database=self.db_name,
            port=self.db_port
        )
    
    def embed_roles(self) -> Tuple[bool, str]:
        """
        Generate and store embeddings for all roles in knowledge base
        This should be run once when setting up or when knowledge base is updated
        
        Returns:
            (success, message)
        """
        try:
            print("[RAG] Starting role embedding process...")
            roles = self.knowledge_base.get('roles', [])
            
            if not roles:
                return False, "No roles found in knowledge base"
            
            conn = self._get_db_connection()
            cursor = conn.cursor()
            
            embedded_count = 0
            skipped_count = 0
            
            for role in roles:
                role_name = role.get('role_name', '')
                category = role.get('category', '')
                
                # Check if embedding already exists
                cursor.execute(
                    "SELECT id FROM role_embeddings WHERE role_name = %s",
                    (role_name,)
                )
                if cursor.fetchone():
                    skipped_count += 1
                    continue
                
                # Create comprehensive text for embedding
                embedding_text = self._create_role_embedding_text(role)
                
                # Generate embedding
                embedding = self.model.encode(embedding_text)
                embedding_list = embedding.tolist()
                
                # Store in database
                cursor.execute("""
                    INSERT INTO role_embeddings (role_name, category, embedding)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (role_name) DO UPDATE
                    SET embedding = EXCLUDED.embedding,
                        category = EXCLUDED.category,
                        created_at = CURRENT_TIMESTAMP
                """, (role_name, category, embedding_list))
                
                embedded_count += 1
            
            conn.commit()
            cursor.close()
            conn.close()
            
            message = f"Embedded {embedded_count} roles (skipped {skipped_count} existing)"
            print(f"[RAG] {message}")
            return True, message
            
        except Exception as e:
            print(f"[RAG] Error embedding roles: {str(e)}")
            return False, f"Error: {str(e)}"
    
    def _create_role_embedding_text(self, role: Dict) -> str:
        """Create comprehensive text representation of role for embedding"""
        parts = []
        
        # Role name and summary
        parts.append(role.get('role_name', ''))
        parts.append(role.get('role_summary', ''))
        
        # Skills
        core_skills = role.get('core_skills', [])
        advanced_skills = role.get('advanced_skills', [])
        tools = role.get('tools_and_technologies', [])
        
        if core_skills:
            parts.append("Core skills: " + ", ".join(core_skills))
        if advanced_skills:
            parts.append("Advanced skills: " + ", ".join(advanced_skills))
        if tools:
            parts.append("Technologies: " + ", ".join(tools))
        
        # Responsibilities
        responsibilities = role.get('responsibilities', [])
        if responsibilities:
            parts.append("Responsibilities: " + ", ".join(responsibilities))
        
        return " | ".join(parts)
    
    def match_skills(self, candidate_skills: List[str], top_k: int = 5) -> List[Dict]:
        """
        Match candidate skills to job roles using semantic similarity
        
        Args:
            candidate_skills: List of skills extracted from resume
            top_k: Number of top matching roles to return
            
        Returns:
            List of matching roles with scores
        """
        try:
            if not candidate_skills:
                return []
            
            # Create candidate embedding from skills
            candidate_text = ", ".join(candidate_skills)
            candidate_embedding = self.model.encode(candidate_text).tolist()
            
            # Query database for similar roles
            conn = self._get_db_connection()
            cursor = conn.cursor(cursor_factory=extras.RealDictCursor)
            
            cursor.execute("""
                SELECT 
                    role_name,
                    category,
                    1 - (embedding <=> %s::vector) AS similarity_score
                FROM role_embeddings
                ORDER BY embedding <=> %s::vector
                LIMIT %s
            """, (candidate_embedding, candidate_embedding, top_k))
            
            results = cursor.fetchall()
            cursor.close()
            conn.close()
            
            # Convert to match percentage (0-100)
            matches = []
            for result in results:
                match_percentage = round(result['similarity_score'] * 100, 2)
                matches.append({
                    'role_name': result['role_name'],
                    'category': result['category'],
                    'match_score': match_percentage
                })
            
            return matches
            
        except Exception as e:
            print(f"[RAG] Error matching skills: {str(e)}")
            return []
    
    def recommend_roles(self, extracted_data: Dict, top_k: int = 5) -> Dict:
        """
        Generate comprehensive role recommendations based on extracted resume data
        
        Args:
            extracted_data: Extracted resume information (name, email, skills, experience, etc.)
            top_k: Number of top roles to recommend
            
        Returns:
            Dictionary with recommendations, match scores, and reasons
        """
        try:
            skills = extracted_data.get('skills', [])
            experience = extracted_data.get('experience', [])
            
            if not skills:
                return {
                    'status': 'error',
                    'message': 'No skills found in resume',
                    'recommendations': []
                }
            
            # Get skill matches
            matches = self.match_skills(skills, top_k=top_k)
            
            # Enrich matches with detailed information
            recommendations = []
            for match in matches:
                role_details = self._get_role_details(match['role_name'])
                if role_details:
                    # Calculate skill overlap
                    overlap = self._calculate_skill_overlap(skills, role_details)
                    
                    recommendations.append({
                        'role_name': match['role_name'],
                        'category': match['category'],
                        'match_score': match['match_score'],
                        'matching_skills': overlap['matching_skills'],
                        'missing_skills': overlap['missing_skills'],
                        'role_summary': role_details.get('role_summary', ''),
                        'experience_level': role_details.get('experience_level', ''),
                        'salary_band': role_details.get('salary_band_india', 'N/A'),
                        'career_progression': role_details.get('career_progression', '')
                    })
            
            return {
                'status': 'success',
                'total_recommendations': len(recommendations),
                'recommendations': recommendations
            }
            
        except Exception as e:
            print(f"[RAG] Error generating recommendations: {str(e)}")
            return {
                'status': 'error',
                'message': str(e),
                'recommendations': []
            }
    
    def _get_role_details(self, role_name: str) -> Optional[Dict]:
        """Get full role details from knowledge base"""
        roles = self.knowledge_base.get('roles', [])
        for role in roles:
            if role.get('role_name') == role_name:
                return role
        return None
    
    def _calculate_skill_overlap(self, candidate_skills: List[str], role_details: Dict) -> Dict:
        """Calculate skill overlap between candidate and role"""
        # Normalize skills to lowercase for comparison
        candidate_skills_lower = [s.lower().strip() for s in candidate_skills]
        
        # Get all required skills for role
        role_core = [s.lower().strip() for s in role_details.get('core_skills', [])]
        role_advanced = [s.lower().strip() for s in role_details.get('advanced_skills', [])]
        role_tools = [s.lower().strip() for s in role_details.get('tools_and_technologies', [])]
        
        all_role_skills = set(role_core + role_advanced + role_tools)
        candidate_skill_set = set(candidate_skills_lower)
        
        # Find matches and gaps
        matching = list(all_role_skills & candidate_skill_set)
        missing = list(all_role_skills - candidate_skill_set)
        
        return {
            'matching_skills': matching,
            'missing_skills': missing[:10]  # Limit to top 10 missing skills
        }
    
    def suggest_upskilling(self, current_skills: List[str], target_role: str) -> Dict:
        """
        Suggest upskilling path for a target role
        
        Args:
            current_skills: List of current skills
            target_role: Target role name
            
        Returns:
            Upskilling suggestions with skill gaps and learning path
        """
        try:
            role_details = self._get_role_details(target_role)
            
            if not role_details:
                return {
                    'status': 'error',
                    'message': f'Role "{target_role}" not found in knowledge base'
                }
            
            overlap = self._calculate_skill_overlap(current_skills, role_details)
            
            # Prioritize skills (core > advanced > tools)
            core_gaps = [s for s in role_details.get('core_skills', []) 
                        if s.lower() in [m.lower() for m in overlap['missing_skills']]]
            advanced_gaps = [s for s in role_details.get('advanced_skills', []) 
                            if s.lower() in [m.lower() for m in overlap['missing_skills']]]
            tool_gaps = [s for s in role_details.get('tools_and_technologies', []) 
                        if s.lower() in [m.lower() for m in overlap['missing_skills']]]
            
            return {
                'status': 'success',
                'target_role': target_role,
                'current_skill_count': len(current_skills),
                'matching_skills': overlap['matching_skills'],
                'skill_gaps': {
                    'core_skills': core_gaps,
                    'advanced_skills': advanced_gaps,
                    'tools_and_technologies': tool_gaps
                },
                'priority_learning': core_gaps[:5],  # Top 5 core skills to learn first
                'estimated_learning_time': self._estimate_learning_time(core_gaps, advanced_gaps, tool_gaps),
                'role_info': {
                    'summary': role_details.get('role_summary', ''),
                    'experience_level': role_details.get('experience_level', ''),
                    'salary_band': role_details.get('salary_band_india', '')
                }
            }
            
        except Exception as e:
            return {
                'status': 'error',
                'message': str(e)
            }
    
    def _estimate_learning_time(self, core_gaps: List, advanced_gaps: List, tool_gaps: List) -> str:
        """Estimate time needed to learn missing skills"""
        total_skills = len(core_gaps) + len(advanced_gaps) + len(tool_gaps)
        
        # Rough estimate: 2 weeks per core skill, 1 week per advanced, 3 days per tool
        weeks = (len(core_gaps) * 2) + len(advanced_gaps) + (len(tool_gaps) * 0.4)
        
        if weeks < 4:
            return f"{int(weeks)} weeks"
        else:
            months = round(weeks / 4, 1)
            return f"{months} months"
    
    def get_career_progression(self, current_role: str, current_skills: List[str]) -> Dict:
        """
        Suggest career progression paths
        
        Args:
            current_role: Current job role
            current_skills: Current skills
            
        Returns:
            Career progression suggestions
        """
        try:
            role_details = self._get_role_details(current_role)
            
            if not role_details:
                # Try to find best matching role based on skills
                matches = self.match_skills(current_skills, top_k=1)
                if matches:
                    role_details = self._get_role_details(matches[0]['role_name'])
            
            if not role_details:
                return {
                    'status': 'error',
                    'message': 'Could not determine current role'
                }
            
            progression = role_details.get('career_progression', '')
            
            # Parse progression path
            next_roles = []
            if '→' in progression:
                parts = progression.split('→')
                next_roles = [p.strip() for p in parts if p.strip()]
            elif progression:
                next_roles = [progression]
            
            # Get details for next roles
            progression_details = []
            for next_role in next_roles:
                next_role_details = self._get_role_details(next_role)
                if next_role_details:
                    overlap = self._calculate_skill_overlap(current_skills, next_role_details)
                    progression_details.append({
                        'role_name': next_role,
                        'skills_needed': overlap['missing_skills'][:5],
                        'experience_level': next_role_details.get('experience_level', ''),
                        'salary_band': next_role_details.get('salary_band_india', '')
                    })
            
            return {
                'status': 'success',
                'current_role': current_role,
                'progression_path': progression,
                'next_steps': progression_details
            }
            
        except Exception as e:
            return {
                'status': 'error',
                'message': str(e)
            }
    
    def get_all_roles(self) -> List[Dict]:
        """Get list of all available roles"""
        roles = self.knowledge_base.get('roles', [])
        return [{
            'role_name': r.get('role_name'),
            'category': r.get('category'),
            'experience_level': r.get('experience_level'),
            'role_summary': r.get('role_summary')
        } for r in roles]
    
    def get_all_skills(self) -> Dict[str, List[str]]:
        """Get all unique skills categorized by type"""
        all_core = set()
        all_advanced = set()
        all_tools = set()
        
        roles = self.knowledge_base.get('roles', [])
        for role in roles:
            all_core.update(role.get('core_skills', []))
            all_advanced.update(role.get('advanced_skills', []))
            all_tools.update(role.get('tools_and_technologies', []))
        
        return {
            'core_skills': sorted(list(all_core)),
            'advanced_skills': sorted(list(all_advanced)),
            'tools_and_technologies': sorted(list(all_tools))
        }
