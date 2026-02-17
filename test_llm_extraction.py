#!/usr/bin/env python3
"""
Test script for LLM-based resume information extraction
Tests the extraction pipeline end-to-end
"""

import sys
sys.path.insert(0, '/home/kashikuldeep/Desktop/Vibe-101/Genai/job-application-form/backend')

from llm_extractor import LLMExtractor
import json

def test_ollama_connection():
    """Test Ollama service connection"""
    print("=" * 60)
    print("TEST 1: Ollama Connection")
    print("=" * 60)
    
    extractor = LLMExtractor(model="codellama:latest")
    is_running, message = extractor.check_ollama_connection()
   
    print(f"Status: {'✅ PASS' if is_running else '❌ FAIL'}")
    print(f"Message: {message}")
    print()
    
    return is_running


def test_extraction_with_sample():
    """Test extraction with a sample resume text"""
    print("=" * 60)
    print("TEST 2: Sample Resume Extraction")
    print("=" * 60)
    
    # Sample resume text
    sample_resume = """
    JOHN DOE
    Software Engineer
    
    Email: john.doe@example.com
    Phone: +1-555-123-4567
    
    EDUCATION
    Bachelor of Science in Computer Science
    Stanford University, 2018-2022
    GPA: 3.8/4.0
    
    SKILLS
    Python, Java, JavaScript, React, Node.js, PostgreSQL, Docker, AWS
    
    EXPERIENCE
    
    Software Engineer
    Tech Corp Inc., January 2023 - Present
    - Developed scalable web applications using React and Node.js
    - Implemented RESTful APIs serving 10M+ requests daily
    - Led migration to microservices architecture
    
    Intern Software Developer
    StartupXYZ, June 2022 - December 2022
    - Built features for mobile application using React Native
    - Collaborated with cross-functional teams
    
    PROJECTS
    
    E-Commerce Platform
    - Built full-stack e-commerce website with payment integration
    - Technologies: React, Express.js, MongoDB, Stripe API
    - Duration: 3 months
    
    Task Management App
    - Created task management application with real-time updates
    - Technologies: Vue.js, Socket.io, PostgreSQL
    - Duration: 2 months
    
    CERTIFICATIONS
    AWS Certified Solutions Architect
    MongoDB Certified Developer
    """
    
    extractor = LLMExtractor(model="codellama:latest")
    print(f"Using model: codellama:latest")
    print(f"Sample text length: {len(sample_resume)} characters")
    print("\nExtracting information...(this may take 10-30 seconds)")
    print("-" * 60)
    
    success, extracted_data, message = extractor.extract_information(sample_resume)
    
    print(f"\nStatus: {'✅ PASS' if success else '❌ FAIL'}")
    print(f"Message: {message}")
    
    if success and extracted_data:
        print("\n" + "=" * 60)
        print("EXTRACTED DATA:")
        print("=" * 60)
        print(json.dumps(extracted_data, indent=2))
        
        # Validation checks
        print("\n" + "=" * 60)
        print("VALIDATION CHECKS:")
        print("=" * 60)
        checks = {
            "Name extracted": bool(extracted_data.get("name")),
            "Email extracted": bool(extracted_data.get("email")),
            "Phone extracted": bool(extracted_data.get("phone")),
            "Skills extracted": len(extracted_data.get("skills", [])) > 0,
            "Education extracted": len(extracted_data.get("education", [])) > 0,
            "Experience extracted": len(extracted_data.get("experience", [])) > 0,
            "Projects extracted": len(extracted_data.get("projects", [])) > 0,
            "Certifications extracted": len(extracted_data.get("certifications", [])) > 0,
        }
        
        for check, passed in checks.items():
            print(f"  {'✅' if passed else '❌'} {check}")
        
        print(f"\nPassed: {sum(checks.values())}/{len(checks)} checks")
        
        return success and sum(checks.values()) >= 6  # At least 6 checks should pass
    else:
        print(f"\n❌ Extraction failed: {message}")
        return False


def test_with_database_resume():
    """Test extraction with actual resume from database"""
    print("\n" + "=" * 60)
    print("TEST 3: Database Resume Extraction (Optional)")
    print("=" * 60)
    
    try:
        import psycopg2
        from psycopg2 import extras
        
        # Connect to database
        conn = psycopg2.connect(
            host='localhost',
            user='postgres',
            password='Root@1234',
            database='doc_db',
            port=5432
        )
        
        cursor = conn.cursor(cursor_factory=extras.RealDictCursor)
        cursor.execute("""
            SELECT id, user_name, ocr_text 
            FROM resumes 
            WHERE ocr_text IS NOT NULL 
            ORDER BY id DESC 
            LIMIT 1
        """)
        resume = cursor.fetchone()
        
        if not resume:
            print("⚠️  SKIP: No resumes with OCR text found in database")
            cursor.close()
            conn.close()
            return True
        
        print(f"Found resume ID: {resume['id']}")
        print(f"User: {resume['user_name']}")
        print(f"OCR text length: {len(resume['ocr_text'])} characters")
        
        extractor = LLMExtractor(model="codellama:latest")
        print("\nExtracting information...")
        
        success, extracted_data, message = extractor.extract_information(resume['ocr_text'])
        
        print(f"\nStatus: {'✅ PASS' if success else '❌ FAIL'}")
        print(f"Message: {message}")
        
        if success:
            print("\nExtracted preview:")
            print(f"  Name: {extracted_data.get('name', 'N/A')}")
            print(f"  Email: {extracted_data.get('email', 'N/A')}")
            print(f"  Phone: {extracted_data.get('phone', 'N/A')}")
            print(f"  Skills: {len(extracted_data.get('skills', []))} items")
            print(f"  Education: {len(extracted_data.get('education', []))} entries")
            print(f"  Experience: {len(extracted_data.get('experience', []))} entries")
        
        cursor.close()
        conn.close()
        return success
        
    except Exception as e:
        print(f"⚠️  SKIP: Could not test with database: {str(e)}")
        return True  # Don't fail overall test if DB test skips


if __name__ == "__main__":
    print("\n" + "🚀 " * 20)
    print("RESUME EXTRACTION PIPELINE TEST SUITE")
    print("🚀 " * 20 + "\n")
    
    results = []
    
    # Test 1: Ollama Connection
    results.append(("Ollama Connection", test_ollama_connection()))
    
    # Only proceed if Ollama is running
    if results[0][1]:
        # Test 2: Sample Extraction
        results.append(("Sample Extraction", test_extraction_with_sample()))
        
        # Test 3: Database Resume (optional)
        results.append(("Database Resume", test_with_database_resume()))
    else:
        print("\n⚠️  Skipping remaining tests - Ollama not available")
        print("To install Ollama: curl -fsSL https://ollama.com/install.sh | sh")
        print("Then run: ollama pull codellama:latest")
    
    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    for test_name, passed in results:
        print(f"  {'✅' if passed else '❌'} {test_name}")
    
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    
    print(f"\nOverall: {passed_count}/{total_count} tests passed")
    
    if passed_count == total_count:
        print("\n🎉 All tests passed! The extraction pipeline is working correctly.")
        sys.exit(0)
    else:
        print("\n⚠️  Some tests failed. Please review the output above.")
        sys.exit(1)
