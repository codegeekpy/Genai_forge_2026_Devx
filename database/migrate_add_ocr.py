#!/usr/bin/env python3
"""
Database migration script to add OCR columns to existing resumes table
"""
import os
import sys
from dotenv import load_dotenv
import psycopg2

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
if not os.path.exists(env_path):
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=env_path)

# Connection parameters from .env
DB_CONFIG = {
    'host': os.getenv('DOC_DB_HOST', 'localhost'),
    'user': os.getenv('DOC_DB_USER', 'postgres'),
    'password': os.getenv('DOC_DB_PASSWORD', ''),
    'database': os.getenv('DOC_DB_NAME', 'doc_db'),
    'port': os.getenv('DOC_DB_PORT', '5432')
}

def migrate():
    """Add OCR columns to resumes table"""
    try:
        # Connect to database
        print(f"Connecting to database: {DB_CONFIG['database']}...")
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Add OCR columns
        print("Adding OCR columns to resumes table...")
        alter_query = """
            ALTER TABLE resumes 
            ADD COLUMN IF NOT EXISTS ocr_text TEXT,
            ADD COLUMN IF NOT EXISTS ocr_processed_time TIMESTAMP;
        """
        cursor.execute(alter_query)
        conn.commit()
        
        # Verify columns were added
        print("Verifying columns...")
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'resumes' 
            ORDER BY ordinal_position;
        """)
        
        columns = cursor.fetchall()
        print("\nCurrent table structure:")
        for col_name, col_type in columns:
            print(f"  - {col_name}: {col_type}")
        
        cursor.close()
        conn.close()
        
        print("\n✅ Migration completed successfully!")
        return True
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        return False

if __name__ == "__main__":
    success = migrate()
    sys.exit(0 if success else 1)
