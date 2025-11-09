#!/bin/bash
# Script to start both backend and frontend for development

echo "🚀 Starting CauldronWatch Development Environment"
echo ""

# Check if backend is already running
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Backend is already running at http://localhost:8000"
else
    echo "📦 Starting backend server..."
    # Start backend in background
    uvicorn backend.api.main:app --reload --port 8000 > backend.log 2>&1 &
    BACKEND_PID=$!
    echo "   Backend PID: $BACKEND_PID"
    echo "   Logs: backend.log"
    
    # Wait for backend to start
    echo "   Waiting for backend to start..."
    for i in {1..10}; do
        if curl -s http://localhost:8000/health > /dev/null 2>&1; then
            echo "   ✅ Backend is ready!"
            break
        fi
        sleep 1
    done
fi

echo ""
echo "📦 Starting frontend server..."
cd potionwatch

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "   Installing dependencies..."
    npm install
fi

echo "   Starting Vite dev server..."
echo ""
echo "🌐 Frontend will be available at: http://localhost:5173"
echo "🌐 Backend API will be available at: http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Start frontend (this will block)
npm run dev

# Cleanup on exit
trap "kill $BACKEND_PID 2>/dev/null" EXIT

