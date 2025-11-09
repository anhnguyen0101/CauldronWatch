"""
Migration script to add x, y coordinate columns to cauldrons and market tables
Run this once to update existing databases
"""
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.database.db import get_db_session
from sqlalchemy import text, inspect


def migrate_add_xy_columns():
    """Add x, y columns to cauldrons and market tables if they don't exist"""
    db = get_db_session()
    
    try:
        # Use SQLAlchemy inspector to check if columns exist
        inspector = inspect(db.bind)
        
        # Check cauldrons table
        try:
            cauldrons_columns = [col['name'] for col in inspector.get_columns('cauldrons')]
            cauldrons_has_xy = 'x' in cauldrons_columns and 'y' in cauldrons_columns
        except Exception:
            cauldrons_has_xy = False
        
        # Check market table
        try:
            market_columns = [col['name'] for col in inspector.get_columns('market')]
            market_has_xy = 'x' in market_columns and 'y' in market_columns
        except Exception:
            market_has_xy = False
        
        # Add columns if they don't exist
        if not cauldrons_has_xy:
            try:
                db.execute(text("ALTER TABLE cauldrons ADD COLUMN x FLOAT"))
                db.execute(text("ALTER TABLE cauldrons ADD COLUMN y FLOAT"))
                db.commit()
            except Exception as e:
                db.rollback()
                # Column might already exist from a previous migration attempt
                pass
        
        if not market_has_xy:
            try:
                db.execute(text("ALTER TABLE market ADD COLUMN x FLOAT"))
                db.execute(text("ALTER TABLE market ADD COLUMN y FLOAT"))
                db.commit()
            except Exception as e:
                db.rollback()
                # Column might already exist from a previous migration attempt
                pass
        
        # Recalculate positions for all nodes if we have data but missing positions
        try:
            from backend.database.cache import CacheManager
            cache = CacheManager(db)
            
            # Check if positions need to be calculated
            cauldrons_count = db.execute(text("SELECT COUNT(*) FROM cauldrons WHERE x IS NULL OR y IS NULL")).scalar()
            market_count = db.execute(text("SELECT COUNT(*) FROM market WHERE x IS NULL OR y IS NULL")).scalar()
            
            if cauldrons_count > 0 or market_count > 0:
                cache.calculate_and_store_node_positions()
        except Exception as e:
            # Non-fatal - positions will be calculated on next cache update
            pass
        
    except Exception as e:
        # Migration failures are non-fatal
        db.rollback()
        pass
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 70)
    print("MIGRATION: Adding x, y coordinate columns")
    print("=" * 70)
    migrate_add_xy_columns()
    print("✅ Migration complete")
    print("=" * 70)
