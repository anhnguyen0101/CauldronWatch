"""
Initialize the database
Run this script to create the database tables
"""
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.database.db import init_db

if __name__ == "__main__":
    print("Initializing CauldronWatch database...")
    init_db()
    print("✅ Database initialization complete!")

