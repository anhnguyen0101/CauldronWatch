#!/bin/bash
# Quick script to start the FastAPI server
echo "Starting CauldronWatch API server..."
echo "Server will be available at: http://localhost:8000"
echo "API docs at: http://localhost:8000/docs"
echo ""
uvicorn backend.api.main:app --reload --port 8000

