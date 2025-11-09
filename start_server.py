#!/usr/bin/env python3
"""
Start server with automatic database population
This script sets AUTO_POPULATE_DB=true and starts the server
"""
import os
import sys
from pathlib import Path

# Set auto-populate flag
os.environ["AUTO_POPULATE_DB"] = "true"

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

print("=" * 70)
print("CauldronWatch Server - Auto-Populate Mode")
print("=" * 70)
print("AUTO_POPULATE_DB=true - Database will be populated on startup")
print("=" * 70)
print()

# Start uvicorn
if __name__ == "__main__":
    import uvicorn
    
    # Get port from environment or default to 8000
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    reload = os.getenv("RELOAD", "true").lower() == "true"
    
    print(f"Starting server on http://{host}:{port}")
    print(f"Reload: {reload}")
    print()
    
    uvicorn.run(
        "backend.api.main:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info"
    )

