"""
LLM-based Resume Information Extraction Service
Uses Ollama API to extract structured information from OCR text
"""

import httpx
import json
import time
from typing import Dict, Optional, Tuple
from pydantic import BaseModel, Field, ValidationError
from datetime import datetime


# JSON Schema Models for Validation
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


class LLMExtractor:
    """Service to extract structured resume information using Ollama"""
    
    def __init__(
        self, 
        model: str = "tinyllama:latest",
        ollama_url: str = "http://localhost:11434"
    ):
        """
        Initialize LLM Extractor
        
        Args:
            model: Ollama model name (default: tinyllama:latest)
            ollama_url: Ollama API base URL
        """
        self.model = model
        self.ollama_url = ollama_url
        self.api_endpoint = f"{ollama_url}/api/generate"
        
        # Enhanced system prompt for precise extraction
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
  "education": [
    {
      "degree": "",
      "institution": "",
      "year": "",
      "details": ""
    }
  ],
  "skills": [],
  "projects": [
    {
      "name": "",
      "description": "",
      "technologies": "",
      "duration": ""
    }
  ],
  "experience": [
    {
      "title": "",
      "company": "",
      "duration": "",
      "responsibilities": ""
    }
  ],
  "certifications": []
}

EXTRACTION GUIDELINES:
- Name: Look for name at the top of resume or in contact section
- Email: Extract complete email address including domain
- Phone: Include country code and format as shown
- Education: Extract degree, institution, year, and any honors/GPA
- Skills: Extract all technical and soft skills mentioned
- Projects: Include academic, personal, and professional projects
- Experience: Extract in reverse chronological order
- Certifications: Include professional certifications and licenses

RETURN ONLY THE JSON OBJECT. NO OTHER TEXT."""
        
        print(f"[LLM] Initialized with model: {self.model}")
    
    def check_ollama_connection(self) -> Tuple[bool, str]:
        """
        Check if Ollama service is running
        
        Returns:
            Tuple of (is_running, message)
        """
        try:
            response = httpx.get(f"{self.ollama_url}/api/tags", timeout=5.0)
            if response.status_code == 200:
                models = response.json().get("models", [])
                model_names = [m.get("name") for m in models]
                
                if self.model in model_names:
                    return True, f"Ollama is running with model {self.model}"
                else:
                    return False, f"Model {self.model} not found. Available models: {model_names}"
            else:
                return False, f"Ollama responded with status {response.status_code}"
                
        except httpx.ConnectError:
            return False, "Cannot connect to Ollama. Is it running?"
        except Exception as e:
            return False, f"Error checking Ollama: {str(e)}"
    
    def extract_information(
        self, 
        ocr_text: str, 
        max_retries: int = 3
    ) -> Tuple[bool, Optional[Dict], str]:
        """
        Extract structured information from OCR text
        
        Args:
            ocr_text: Raw OCR text from resume
            max_retries: Maximum number of retry attempts
            
        Returns:
            Tuple of (success, extracted_data_dict, message)
        """
        if not ocr_text or not ocr_text.strip():
            return False, None, "No OCR text provided"
        
        # Check Ollama connection first
        is_running, conn_message = self.check_ollama_connection()
        if not is_running:
            return False, None, conn_message
        
        print(f"[LLM] Starting extraction from {len(ocr_text)} characters of OCR text")
        
        # Construct prompt
        user_prompt = f"{self.system_prompt}\n\nRESUME TEXT:\n{ocr_text}\n\nJSON OUTPUT:"
        
        # Retry logic with exponential backoff
        for attempt in range(max_retries):
            try:
                print(f"[LLM] Extraction attempt {attempt + 1}/{max_retries}")
                
                # Call Ollama API
                success, response_text, error_msg = self._call_ollama_api(user_prompt)
                
                if not success:
                    if attempt < max_retries - 1:
                        wait_time = 2 ** attempt  # Exponential backoff
                        print(f"[LLM] Retrying in {wait_time}s... ({error_msg})")
                        time.sleep(wait_time)
                        continue
                    else:
                        return False, None, f"API call failed: {error_msg}"
                
                # Parse and validate JSON
                print(f"[LLM] Parsing response ({len(response_text)} chars)")
                success, parsed_data, parse_msg = self._parse_and_validate(response_text)
                
                if success:
                    print(f"[LLM] ✅ Extraction successful")
                    return True, parsed_data, "Extraction completed successfully"
                else:
                    if attempt < max_retries - 1:
                        print(f"[LLM] Parsing failed: {parse_msg}, retrying...")
                        time.sleep(1)
                        continue
                    else:
                        return False, None, f"Parsing failed: {parse_msg}"
                        
            except Exception as e:
                print(f"[LLM] Error during extraction: {str(e)}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)
                    continue
                else:
                    return False, None, f"Extraction error: {str(e)}"
        
        return False, None, "Max retries exceeded"
    
    def _call_ollama_api(self, prompt: str) -> Tuple[bool, str, str]:
        """
        Call Ollama API to generate response
        
        Returns:
            Tuple of (success, response_text, error_message)
        """
        try:
            payload = {
                "model": self.model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.1,  # Lower temperature for more deterministic output
                    "top_p": 0.9,
                }
            }
            
            # Use longer timeout for LLM processing
            with httpx.Client(timeout=120.0) as client:
                response = client.post(self.api_endpoint, json=payload)
                
                if response.status_code == 200:
                    result = response.json()
                    response_text = result.get("response", "")
                    return True, response_text, ""
                else:
                    return False, "", f"API returned status {response.status_code}"
                    
        except httpx.TimeoutException:
            return False, "", "Request timeout - LLM took too long"
        except Exception as e:
            return False, "", f"API call error: {str(e)}"
    
    def _parse_and_validate(self, response_text: str) -> Tuple[bool, Optional[Dict], str]:
        """
        Parse LLM response and validate against schema
        
        Returns:
            Tuple of (success, parsed_dict, error_message)
        """
        try:
            # Clean response - remove markdown code blocks if present
            cleaned = response_text.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
            
            # Find JSON object in response
            start_idx = cleaned.find("{")
            end_idx = cleaned.rfind("}")
            
            if start_idx == -1 or end_idx == -1:
                return False, None, "No JSON object found in response"
            
            json_str = cleaned[start_idx:end_idx + 1]
            
            # Parse JSON
            parsed = json.loads(json_str)
            
            # Validate against Pydantic model
            validated = ResumeData(**parsed)
            
            # Convert back to dict for storage
            result_dict = validated.model_dump()
            
            print(f"[LLM] Validated: name='{result_dict.get('name')}', email='{result_dict.get('email')}'")
            
            return True, result_dict, ""
            
        except json.JSONDecodeError as e:
            return False, None, f"Invalid JSON: {str(e)}"
        except ValidationError as e:
            return False, None, f"Schema validation failed: {str(e)}"
        except Exception as e:
            return False, None, f"Parsing error: {str(e)}"
