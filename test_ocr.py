#!/usr/bin/env python3
"""
Test script to verify OCR functionality with a sample PDF
"""
import sys
sys.path.insert(0, '/home/kashikuldeep/Desktop/Vibe-101/Genai/job-application-form/backend')

from ocr_processor import OCRProcessor
import os

def test_ocr_with_resume():
    """Test OCR with an actual resume file from database"""
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
    
    # Get the most recent resume
    cursor = conn.cursor(cursor_factory=extras.RealDictCursor)
    cursor.execute("SELECT id, user_name, file, file_type FROM resumes ORDER BY id DESC LIMIT 1")
    resume = cursor.fetchone()
    
    if not resume:
        print("❌ No resumes found in database")
        return
    
    print(f"Testing OCR on resume ID: {resume['id']}")
    print(f"User: {resume['user_name']}")
    print(f"Type: {resume['file_type']}")
    print(f"File size: {len(resume['file'])} bytes")
    print("-" * 50)
    
    # Initialize OCR
    print("\n[1] Initializing OCR processor...")
    ocr_processor = OCRProcessor()
    print("✅ OCR processor initialized\n")
    
    # Process the file
    print(f"[2] Processing {resume['file_type']} file...")
    success, text, message = ocr_processor.process_file(
        file_data=resume['file'],
        file_type=resume['file_type']
    )
    
    print("\n" + "=" * 50)
    print("RESULTS:")
    print("=" * 50)
    print(f"Success: {success}")
    print(f"Message: {message}")
    print(f"Text length: {len(text) if text else 0} characters")
    
    if text:
        print(f"\nExtracted text preview (first 500 chars):")
        print("-" * 50)
        print(text[:500])
        print("-" * 50)
    else:
        print("\n❌ No text extracted!")
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    test_ocr_with_resume()
