#!/bin/bash

# PostgreSQL Setup Script for Job Application Form
# This script helps set up the PostgreSQL databases

echo "========================================="
echo "PostgreSQL Database Setup"
echo "========================================="
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed."
    echo "Please install PostgreSQL first:"
    echo "  Ubuntu/Debian: sudo apt install postgresql postgresql-contrib"
    echo "  MacOS: brew install postgresql"
    exit 1
fi

echo "✅ PostgreSQL is installed"
echo ""

# Function to create database
create_database() {
    local db_name=$1
    local host=${2:-localhost}
    local port=${3:-5432}
    
    echo "Creating database: $db_name on $host:$port"
    
    # Try to create database
    sudo -u postgres psql -h $host -p $port -c "CREATE DATABASE $db_name;" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ Database '$db_name' created successfully"
    else
        echo "⚠️  Database '$db_name' may already exist or couldn't be created"
    fi
}

# Function to create tables
setup_main_database() {
    echo ""
    echo "Setting up main database (job_applications)..."
    
    sudo -u postgres psql -d job_applications <<EOF
-- Create applicants table
CREATE TABLE IF NOT EXISTS applicants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    job_roles TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_applicants_email ON applicants(email);

EOF
    
    if [ $? -eq 0 ]; then
        echo "✅ Main database tables created successfully"
    else
        echo "❌ Error creating main database tables"
    fi
}

setup_document_database() {
    local host=${1:-localhost}
    
    echo ""
    echo "Setting up document database (doc_db) on $host..."
    
    if [ "$host" = "localhost" ]; then
        sudo -u postgres psql -d doc_db <<EOF
-- Create resumes table
CREATE TABLE IF NOT EXISTS resumes (
    id SERIAL PRIMARY KEY,
    user_name VARCHAR(255) NOT NULL,
    file BYTEA NOT NULL,
    file_type VARCHAR(10) NOT NULL,
    file_uploaded_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_resumes_user_name ON resumes(user_name);
CREATE INDEX IF NOT EXISTS idx_resumes_upload_time ON resumes(file_uploaded_time);

EOF
        
        if [ $? -eq 0 ]; then
            echo "✅ Document database tables created successfully"
        else
            echo "❌ Error creating document database tables"
        fi
    else
        echo "⚠️  Document database is on remote host: $host"
        echo "Please create the database and tables manually on that host"
        echo "SQL commands are in database/init_doc_db.sql"
    fi
}

# Main execution
echo "This script will create the following databases:"
echo "  1. job_applications (on localhost:5432)"
echo "  2. doc_db (on Gen_Ai:5432 or localhost for testing)"
echo ""

read -p "Do you want to proceed? (y/n): " confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Setup cancelled."
    exit 0
fi

# Create databases
create_database "job_applications" "localhost" "5432"

# Ask about document database location
echo ""
read -p "Is the document database on localhost for testing? (y/n): " local_doc_db

if [ "$local_doc_db" = "y" ] || [ "$local_doc_db" = "Y" ]; then
    create_database "doc_db" "localhost" "5432"
    DOC_DB_HOST="localhost"
else
    echo "You'll need to create doc_db on Gen_Ai host manually"
    DOC_DB_HOST="Gen_Ai"
fi

# Setup tables
setup_main_database

if [ "$local_doc_db" = "y" ] || [ "$local_doc_db" = "Y" ]; then
    setup_document_database "localhost"
    
    # Update .env if using localhost
    echo ""
    read -p "Update .env to use localhost for DOC_DB_HOST? (y/n): " update_env
    if [ "$update_env" = "y" ] || [ "$update_env" = "Y" ]; then
        sed -i 's/DOC_DB_HOST=Gen_Ai/DOC_DB_HOST=localhost/' .env
        echo "✅ Updated .env file"
    fi
else
    setup_document_database "Gen_Ai"
fi

echo ""
echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Install Python dependencies: pip install -r requirements.txt"
echo "2. Update .env file with your database credentials if needed"
echo "3. Start the backend: cd backend && uvicorn main:app --reload"
echo "4. Open frontend/index.html in your browser"
echo ""
