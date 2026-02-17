#!/bin/bash

echo "🚀 Starting Job Application Form System"
echo "========================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please run ./setup.sh first."
    exit 1
fi

# Activate virtual environment
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Please run ./setup.sh first."
    exit 1
fi

source venv/bin/activate

# Start backend in background
echo "🔧 Starting backend server..."
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

echo "✅ Backend running on http://localhost:8000"
echo "   PID: $BACKEND_PID"
echo ""

# Start frontend server
echo "🎨 Starting frontend server..."
cd frontend
python3 -m http.server 3000 &
FRONTEND_PID=$!
cd ..

echo "✅ Frontend running on http://localhost:3000"
echo "   PID: $FRONTEND_PID"
echo ""

echo "================================================"
echo "✅ Application is running!"
echo "================================================"
echo ""
echo "📝 Application Form: http://localhost:3000"
echo "📚 API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all servers..."
echo ""

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
