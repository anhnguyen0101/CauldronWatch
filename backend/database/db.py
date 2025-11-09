"""
Database connection and session management
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from pathlib import Path
import os

from backend.database.models import Base

# Database file path
DB_PATH = Path(__file__).parent.parent.parent / "data" / "cauldronwatch.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

# Create database URL
DATABASE_URL = f"sqlite:///{DB_PATH}"

# Create engine
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},  # Needed for SQLite
    echo=False  # Set to True for SQL query logging
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Initialize database - create all tables"""
    Base.metadata.create_all(bind=engine)
    print(f"✅ Database initialized at: {DB_PATH}")
    
    # Run migration to add x, y columns if they don't exist (for existing databases)
    try:
        from backend.database.migrate_add_xy_coordinates import migrate_add_xy_columns
        migrate_add_xy_columns()
    except Exception:
        # Migration failures are non-fatal - columns might already exist
        pass


def get_db() -> Session:
    """
    Dependency function for FastAPI to get database session
    Usage: @app.get("/endpoint")
          def endpoint(db: Session = Depends(get_db)):
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_db_session() -> Session:
    """
    Get a database session for direct use
    Remember to close it when done!
    """
    return SessionLocal()

