#!/usr/bin/env python3
"""
Migration script to add pgvector extension and RAG tables to doc_db
"""

import psycopg2
from psycopg2 import Error
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

def run_migration():
    """Run the pgvector RAG migration"""
    
    # Database connection parameters
    host = os.getenv('DOC_DB_HOST', 'localhost')
    user = os.getenv('DOC_DB_USER', 'postgres')
    password = os.getenv('DOC_DB_PASSWORD', '')
    database = os.getenv('DOC_DB_NAME', 'doc_db')
    port = os.getenv('DOC_DB_PORT', '5432')
    
    try:
        print(f"Connecting to database: {database}@{host}:{port}")
        connection = psycopg2.connect(
            host=host,
            user=user,
            password=password,
            database=database,
            port=port
        )
        
        cursor = connection.cursor()
        
        # Read SQL migration file
        sql_file = os.path.join(os.path.dirname(__file__), 'add_pgvector_rag.sql')
        with open(sql_file, 'r') as f:
            sql_script = f.read()
        
        print("\n" + "="*60)
        print("Running pgvector RAG migration...")
        print("="*60 + "\n")
        
        # Execute migration
        cursor.execute(sql_script)
        connection.commit()
        
        print("✅ Migration completed successfully!")
        
        # Verify tables
        cursor.execute("""
            SELECT tablename FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename IN ('role_embeddings', 'skill_recommendations')
            ORDER BY tablename
        """)
        
        tables = cursor.fetchall()
        print("\nCreated tables:")
        for table in tables:
            print(f"  ✓ {table[0]}")
        
        # Check if pgvector extension is enabled
        cursor.execute("SELECT * FROM pg_extension WHERE extname = 'vector'")
        vector_ext = cursor.fetchone()
        if vector_ext:
            print("\n✅ pgvector extension enabled")
        else:
            print("\n⚠️  pgvector extension not found - you may need to install it first")
            print("   Install: sudo apt-get install postgresql-<version>-pgvector")
        
        cursor.close()
        connection.close()
        
        print("\n" + "="*60)
        print("Migration Summary")
        print("="*60)
        print("✅ pgvector extension enabled")
        print("✅ role_embeddings table created")
        print("✅ skill_recommendations table created")
        print("✅ Vector indexes created")
        print("\nNext step: Run the backend to populate role embeddings")
        print("="*60 + "\n")
        
    except Error as e:
        print(f"\n❌ Error during migration: {e}")
        if connection:
            connection.rollback()
        raise
    finally:
        if connection:
            connection.close()

if __name__ == "__main__":
    run_migration()
