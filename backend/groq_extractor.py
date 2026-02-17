"""
Alternative LLM Extractor using Groq API (Cloud-based - FREE tier available)
Use this if your system doesn't have enough RAM for local models
"""

import httpx
import json
import os
from typing import Dict, Optional, Tuple
from pydantic import BaseModel, Field, ValidationError


# Same schema models as llm_extractor.py
class EducationEntry(BaseModel):
    degree: str = ""
    institution: str = ""
    year: str = ""
    details: str = ""


class ProjectEntry(BaseModel):
    name: str = ""
    description: str = ""
    technologies: str = ""
    duration: str = ""


class ExperienceEntry(BaseModel):
    title: str = ""
    company: str = ""
    duration: str = ""
    responsibilities: str = ""


class ResumeData(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    education: list[EducationEntry] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    projects: list[ProjectEntry] = Field(default_factory=list)
    experience: list[ExperienceEntry] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)


class GroqLLMExtractor:
    """Cloud-based LLM extractor using Groq API (FREE tier available)"""
    
    def __init__(self, api_key: str = None):
        """
        Initialize Groq LLM Extractor
        
        Args:
            api_key: Groq API key (get free at https://console.groq.com)
                    If not provided, reads from GROQ_API_KEY environment variable
        """
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError("Groq API key required. Set GROQ_API_KEY env var or pass api_key parameter")
        
        self.api_endpoint = "https://api.groq.com/openai/v1/chat/completions"
        self.model = "llama-3.1-8b-instant"  # Fast and free
        
        # Same enhanced prompt as local version
        self.system_prompt = """You are a resume information extraction engine designed for precise data extraction.

TASK: Extract structured resume data from the provided OCR text.

CRITICAL RULES:
1. Extract ONLY explicitly mentioned information - DO NOT infer or hallucinate
2. If information is not present, use empty string "" or empty list []
3. Output MUST be strictly valid JSON matching the schema
4. Do NOT include explanations, comments, or markdown formatting
5. Preserve exact spelling and formatting from source text
6. For dates, extract as-is from the document
7. For lists (education, skills, etc.), extract all items mentioned

JSON SCHEMA:
{
  "name": "",
  "email": "",
  "phone": "",
  "education": [{"degree": "", "institution": "", "year": "", "details": ""}],
  "skills": [],
  "projects": [{"name": "", "description": "", "technologies": "", "duration": ""}],
  "experience": [{"title": "", "company": "", "duration": "", "responsibilities": ""}],
  "certifications": []
}

IMPORTANT FIELD TYPES:
- skills: Array of STRINGS (e.g., ["Python", "Java", "React"])
- certifications: Array of STRINGS (e.g., ["AWS Certified", "PMP"])
- education, projects, experience: Arrays of OBJECTS with specified fields

RETURN ONLY THE JSON OBJECT. NO OTHER TEXT."""

        print(f"[LLM] Initialized Groq API with model: {self.model}")
    
    def extract_information(
        self, 
        ocr_text: str
    ) -> Tuple[bool, Optional[Dict], str]:
        """Extract structured information from OCR text using Groq API"""
        
        if not ocr_text or not ocr_text.strip():
            return False, None, "No OCR text provided"
        
        print(f"[LLM] Starting extraction from {len(ocr_text)} characters of OCR text")
        
        try:
            # Prepare API request
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": f"RESUME TEXT:\n{ocr_text}\n\nJSON OUTPUT:"}
                ],
                "temperature": 0.1,
                "max_tokens": 2000
            }
            
            # Call Groq API
            print("[LLM] Calling Groq API...")
            with httpx.Client(timeout=30.0) as client:
                response = client.post(self.api_endpoint, headers=headers, json=payload)
                
                if response.status_code != 200:
                    return False, None, f"API returned status {response.status_code}: {response.text}"
                
                result = response.json()
                response_text = result["choices"][0]["message"]["content"]
                
                # Parse and validate
                print(f"[LLM] Parsing response ({len(response_text)} chars)")
                success, parsed_data, parse_msg = self._parse_and_validate(response_text)
                
                if success:
                    print(f"[LLM] ✅ Extraction successful")
                    return True, parsed_data, "Extraction completed successfully"
                else:
                    return False, None, f"Parsing failed: {parse_msg}"
                    
        except Exception as e:
            return False, None, f"Extraction error: {str(e)}"
    
    def _parse_and_validate(self, response_text: str) -> Tuple[bool, Optional[Dict], str]:
        """Parse and validate LLM response"""
        try:
            # Clean response
            cleaned = response_text.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
            
            # Find JSON
            start_idx = cleaned.find("{")
            end_idx = cleaned.rfind("}")
            
            if start_idx == -1 or end_idx == -1:
                return False, None, "No JSON object found in response"
            
            json_str = cleaned[start_idx:end_idx + 1]
            parsed = json.loads(json_str)
            
            # Validate
            validated = ResumeData(**parsed)
            result_dict = validated.model_dump()
            
            print(f"[LLM] Validated: name='{result_dict.get('name')}', email='{result_dict.get('email')}'")
            
            return True, result_dict, ""
            
        except json.JSONDecodeError as e:
            return False, None, f"Invalid JSON: {str(e)}"
        except ValidationError as e:
            return False, None, f"Schema validation failed: {str(e)}"
        except Exception as e:
            return False, None, f"Parsing error: {str(e)}"
