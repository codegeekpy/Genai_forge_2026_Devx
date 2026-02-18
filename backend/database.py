import psycopg2
from psycopg2 import Error, extras
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import os
from dotenv import load_dotenv

# Load .env file from the backend directory
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=env_path)

class Database:
    def __init__(self):
        self.host = os.getenv('DB_HOST', 'localhost')
        self.user = os.getenv('DB_USER', 'root')
        self.password = os.getenv('DB_PASSWORD', '')
        self.database = os.getenv('DB_NAME', 'job_applications')
        self.port = os.getenv('DB_PORT', '5432')
        self.connection = None
    
    def connect(self):
        """Establish database connection"""
        try:
            self.connection = psycopg2.connect(
                host=self.host,
                user=self.user,
                password=self.password,
                database=self.database,
                port=self.port
            )
            print("Successfully connected to PostgreSQL database")
            return True
        except Error as e:
            print(f"Error connecting to PostgreSQL: {e}")
            return False
    
    def disconnect(self):
        """Close database connection"""
        if self.connection:
            self.connection.close()
            print("PostgreSQL connection closed")
    
    def insert_applicant(self, name, email, password, job_roles):
        """Insert new applicant into database"""
        try:
            import json
            cursor = self.connection.cursor()
            query = """
                INSERT INTO applicants (name, email, password, job_roles)
                VALUES (%s, %s, %s, %s)
            """
            # Convert list to JSON string
            job_roles_json = json.dumps(job_roles)
            values = (name, email, password, job_roles_json)
            cursor.execute(query, values)
            self.connection.commit()
            cursor.close()
            return True, "Application submitted successfully!"
        except psycopg2.IntegrityError:
            self.connection.rollback()
            return False, "Email already exists in the system"
        except Error as e:
            self.connection.rollback()
            return False, f"Database error: {str(e)}"
    
    def get_all_applicants(self):
        """Retrieve all applicants (for admin purposes)"""
        try:
            import json
            cursor = self.connection.cursor(cursor_factory=extras.RealDictCursor)
            query = "SELECT id, name, email, job_roles, created_at FROM applicants"
            cursor.execute(query)
            results = cursor.fetchall()
            # Parse JSON job_roles for each applicant
            for result in results:
                if result['job_roles']:
                    result['job_roles'] = json.loads(result['job_roles'])
            cursor.close()
            return results
        except Error as e:
            print(f"Error retrieving applicants: {e}")
            return []
    
    def delete_applicant(self, applicant_id):
        """Delete applicant by ID"""
        try:
            cursor = self.connection.cursor()
            query = "DELETE FROM applicants WHERE id = %s RETURNING id"
            cursor.execute(query, (applicant_id,))
            deleted = cursor.fetchone()
            self.connection.commit()
            cursor.close()
            
            if deleted:
                return True, "Applicant deleted successfully"
            else:
                return False, "Applicant not found"
        except Error as e:
            self.connection.rollback()
            print(f"Error deleting applicant: {e}")
            return False, f"Database error: {str(e)}"


class DocumentDatabase:
    """Database class specifically for handling resume documents"""
    def __init__(self):
        self.host = os.getenv('DOC_DB_HOST', 'Gen_Ai')
        self.user = os.getenv('DOC_DB_USER', 'root')
        self.password = os.getenv('DOC_DB_PASSWORD', '')
        self.database = os.getenv('DOC_DB_NAME', 'doc_db')
        self.port = os.getenv('DOC_DB_PORT', '5432')
        self.connection = None
    
    def connect(self):
        """Establish database connection"""
        try:
            self.connection = psycopg2.connect(
                host=self.host,
                user=self.user,
                password=self.password,
                database=self.database,
                port=self.port
            )
            print("Successfully connected to Document PostgreSQL database")
            return True
        except Error as e:
            print(f"Error connecting to Document PostgreSQL: {e}")
            return False
    
    def disconnect(self):
        """Close database connection"""
        if self.connection:
            self.connection.close()
            print("Document PostgreSQL connection closed")
    
    def create_resumes_table(self):
        """Create users, resumes, and related tables if they don't exist"""
        try:
            cursor = self.connection.cursor()
            
            # Create users table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(100) NOT NULL,
                    email VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create resumes table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS resumes (
                    id SERIAL PRIMARY KEY,
                    user_name VARCHAR(255) NOT NULL,
                    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    file BYTEA NOT NULL,
                    file_type VARCHAR(10) NOT NULL,
                    file_uploaded_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    ocr_text TEXT,
                    ocr_processed_time TIMESTAMP,
                    extracted_info JSONB,
                    extraction_processed_time TIMESTAMP
                )
            """)
            
            # Add user_id column if table already exists without it
            try:
                cursor.execute("""
                    ALTER TABLE resumes ADD COLUMN IF NOT EXISTS
                    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
                """)
            except Exception:
                pass  # Column may already exist
            
            # Create skill_recommendations table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS skill_recommendations (
                    id SERIAL PRIMARY KEY,
                    resume_id INTEGER UNIQUE REFERENCES resumes(id) ON DELETE CASCADE,
                    recommended_roles JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            self.connection.commit()
            cursor.close()
            print("Database tables created successfully (users, resumes, skill_recommendations)")
            return True
        except Error as e:
            print(f"Error creating tables: {e}")
            self.connection.rollback()
            return False
    
    def insert_resume(self, user_name, file_data, file_type, ocr_text=None, user_id=None):
        """Insert resume into database with optional OCR text and user linkage"""
        try:
            from datetime import datetime
            cursor = self.connection.cursor()
            query = """
                INSERT INTO resumes (user_name, user_id, file, file_type, ocr_text, ocr_processed_time)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
            """
            ocr_time = datetime.now() if ocr_text else None
            values = (user_name, user_id, psycopg2.Binary(file_data), file_type, ocr_text, ocr_time)
            cursor.execute(query, values)
            resume_id = cursor.fetchone()[0]
            self.connection.commit()
            cursor.close()
            return True, resume_id, "Resume uploaded successfully!"
        except Error as e:
            self.connection.rollback()
            return False, None, f"Database error: {str(e)}"
    
    def get_resume(self, resume_id):
        """Retrieve resume by ID with file data (use for downloads)"""
        try:
            cursor = self.connection.cursor(cursor_factory=extras.RealDictCursor)
            query = "SELECT id, user_name, file, file_type, file_uploaded_time, ocr_text, ocr_processed_time FROM resumes WHERE id = %s"
            cursor.execute(query, (resume_id,))
            result = cursor.fetchone()
            cursor.close()
            return result
        except Error as e:
            print(f"Error retrieving resume: {e}")
            return None
    
    def get_resume_metadata(self, resume_id):
        """Retrieve resume metadata WITHOUT binary file data (lightweight)"""
        try:
            cursor = self.connection.cursor(cursor_factory=extras.RealDictCursor)
            # Exclude 'file' column to avoid loading large binary data
            query = "SELECT id, user_name, user_id, file_type, file_uploaded_time, ocr_text, ocr_processed_time FROM resumes WHERE id = %s"
            cursor.execute(query, (resume_id,))
            result = cursor.fetchone()
            cursor.close()
            return result
        except Error as e:
            print(f"Error retrieving resume metadata: {e}")
            return None
    
    def delete_resume(self, resume_id):
        """Delete resume by ID"""
        try:
            cursor = self.connection.cursor()
            query = "DELETE FROM resumes WHERE id = %s RETURNING id"
            cursor.execute(query, (resume_id,))
            deleted = cursor.fetchone()
            self.connection.commit()
            cursor.close()
            
            if deleted:
                return True, "Resume deleted successfully"
            else:
                return False, "Resume not found"
        except Error as e:
            self.connection.rollback()
            print(f"Error deleting resume: {e}")
            return False, f"Database error: {str(e)}"
    
    def update_resume(self, resume_id, user_name=None):
        """Update resume metadata (user_name only for now)"""
        try:
            if not user_name:
                return False, "No update data provided"
            
            cursor = self.connection.cursor()
            query = "UPDATE resumes SET user_name = %s WHERE id = %s RETURNING id"
            cursor.execute(query, (user_name, resume_id))
            updated = cursor.fetchone()
            self.connection.commit()
            cursor.close()
            
            if updated:
                return True, "Resume updated successfully"
            else:
                return False, "Resume not found"
        except Error as e:
            self.connection.rollback()
            print(f"Error updating resume: {e}")
            return False, f"Database error: {str(e)}"
    
    def update_extracted_info(self, resume_id, extracted_json):
        """Update extracted resume information in JSONB format"""
        try:
            from datetime import datetime
            import json
            
            cursor = self.connection.cursor()
            query = """
                UPDATE resumes 
                SET extracted_info = %s, 
                    extraction_processed_time = %s 
                WHERE id = %s 
                RETURNING id
            """
            
            # Convert dict to JSON string for JSONB storage
            json_data = json.dumps(extracted_json)
            extraction_time = datetime.now()
            
            cursor.execute(query, (json_data, extraction_time, resume_id))
            updated = cursor.fetchone()
            self.connection.commit()
            cursor.close()
            
            if updated:
                return True, "Extracted information updated successfully"
            else:
                return False, "Resume not found"
                
        except Error as e:
            self.connection.rollback()
            print(f"Error updating extracted info: {e}")
            return False, f"Database error: {str(e)}"
    
    def get_extracted_info(self, resume_id):
        """Get extracted resume information (returns parsed JSON)"""
        try:
            cursor = self.connection.cursor(cursor_factory=extras.RealDictCursor)
            query = """
                SELECT id, user_name, extracted_info, extraction_processed_time 
                FROM resumes 
                WHERE id = %s
            """
            cursor.execute(query, (resume_id,))
            result = cursor.fetchone()
            cursor.close()
            return result
            
        except Error as e:
            print(f"Error retrieving extracted info: {e}")
            return None

    # ── Authentication Methods ──

    def create_user(self, username, email, password_hash):
        """Create a new user account. Returns (success, user_id_or_none, message)."""
        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                INSERT INTO users (username, email, password)
                VALUES (%s, %s, %s)
                RETURNING id, username, email, created_at
            """, (username, email, password_hash))
            row = cursor.fetchone()
            self.connection.commit()
            cursor.close()
            return True, {
                "id": row[0], "username": row[1],
                "email": row[2], "created_at": str(row[3])
            }, "Account created successfully"
        except psycopg2.IntegrityError:
            self.connection.rollback()
            return False, None, "Email already registered"
        except Error as e:
            self.connection.rollback()
            return False, None, f"Database error: {str(e)}"

    def get_user_by_email(self, email):
        """Look up user by email. Returns dict or None."""
        try:
            cursor = self.connection.cursor(cursor_factory=extras.RealDictCursor)
            cursor.execute("""
                SELECT id, username, email, password, created_at
                FROM users WHERE email = %s
            """, (email,))
            user = cursor.fetchone()
            cursor.close()
            return dict(user) if user else None
        except Error as e:
            print(f"Error looking up user: {e}")
            return None

    def get_user_by_id(self, user_id):
        """Look up user by ID. Returns dict or None."""
        try:
            cursor = self.connection.cursor(cursor_factory=extras.RealDictCursor)
            cursor.execute("""
                SELECT id, username, email, created_at
                FROM users WHERE id = %s
            """, (user_id,))
            user = cursor.fetchone()
            cursor.close()
            return dict(user) if user else None
        except Error as e:
            print(f"Error looking up user: {e}")
            return None

    def get_user_resumes(self, user_id):
        """Get all resumes linked to a user."""
        try:
            cursor = self.connection.cursor(cursor_factory=extras.RealDictCursor)
            cursor.execute("""
                SELECT id, user_name, file_type, file_uploaded_time,
                       ocr_text IS NOT NULL AS has_ocr,
                       extracted_info IS NOT NULL AS has_extraction
                FROM resumes WHERE user_id = %s
                ORDER BY file_uploaded_time DESC
            """, (user_id,))
            rows = cursor.fetchall()
            cursor.close()
            return [dict(r) for r in rows]
        except Error as e:
            print(f"Error fetching user resumes: {e}")
            return []

    def verify_resume_ownership(self, resume_id, user_id):
        """Check if a resume belongs to the given user. Returns True/False."""
        try:
            cursor = self.connection.cursor()
            cursor.execute(
                "SELECT user_id FROM resumes WHERE id = %s", (resume_id,)
            )
            row = cursor.fetchone()
            cursor.close()
            if not row:
                return None  # resume not found
            return row[0] == user_id
        except Error as e:
            print(f"Error verifying ownership: {e}")
            return None

    def update_user(self, user_id, username=None, email=None):
        """Update user profile fields. Returns (success, message)."""
        try:
            sets = []
            vals = []
            if username is not None:
                sets.append("username = %s")
                vals.append(username)
            if email is not None:
                sets.append("email = %s")
                vals.append(email)
            if not sets:
                return False, "Nothing to update"
            vals.append(user_id)
            cursor = self.connection.cursor()
            cursor.execute(
                f"UPDATE users SET {', '.join(sets)} WHERE id = %s", tuple(vals)
            )
            self.connection.commit()
            cursor.close()
            return True, "Profile updated"
        except psycopg2.IntegrityError:
            self.connection.rollback()
            return False, "Email already in use"
        except Error as e:
            self.connection.rollback()
            return False, f"Database error: {str(e)}"
