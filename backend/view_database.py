"""
View database contents and statistics
Quick script to see what's in the database
"""
import sys
from pathlib import Path
from sqlalchemy import text

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.database.db import get_db_session


def view_database_stats():
    """Show database statistics"""
    print("=" * 70)
    print("DATABASE STATISTICS")
    print("=" * 70)
    
    db = get_db_session()
    
    try:
        # Get table counts
        tables = [
            'cauldrons',
            'historical_data',
            'tickets',
            'market',
            'couriers',
            'cache_metadata'
        ]
        
        print("\n📊 Table Record Counts:")
        for table in tables:
            try:
                result = db.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = result.scalar()
                print(f"   {table:20s}: {count:,} records")
            except Exception as e:
                print(f"   {table:20s}: Error - {e}")
        
        # Sample data from each table
        print("\n" + "=" * 70)
        print("SAMPLE DATA")
        print("=" * 70)
        
        # Cauldrons
        print("\n📦 Cauldrons (first 3):")
        result = db.execute(text("SELECT id, name, max_volume FROM cauldrons LIMIT 3"))
        for row in result:
            print(f"   {row[0]}: {row[1]} - {row[2]}L capacity")
        
        # Historical data
        print("\n📈 Historical Data (first 3):")
        result = db.execute(text("""
            SELECT cauldron_id, timestamp, level 
            FROM historical_data 
            ORDER BY timestamp 
            LIMIT 3
        """))
        for row in result:
            print(f"   {row[0]}: {row[2]:.2f}L at {row[1]}")
        
        # Tickets
        print("\n🎫 Tickets (first 3):")
        result = db.execute(text("""
            SELECT ticket_id, cauldron_id, date, amount_collected 
            FROM tickets 
            LIMIT 3
        """))
        for row in result:
            print(f"   {row[0]}: {row[1]} - {row[3]:.2f}L on {row[2]}")
        
        # Market
        print("\n🏪 Market:")
        result = db.execute(text("SELECT id, name FROM market LIMIT 1"))
        row = result.fetchone()
        if row:
            print(f"   {row[0]}: {row[1]}")
        
        # Couriers
        print("\n🚚 Couriers:")
        result = db.execute(text("SELECT courier_id, name FROM couriers LIMIT 3"))
        rows = result.fetchall()
        if rows:
            for row in rows:
                print(f"   {row[0]}: {row[1] if row[1] else 'N/A'}")
        else:
            print("   No couriers in database")
        
        # Date ranges
        print("\n" + "=" * 70)
        print("DATE RANGES")
        print("=" * 70)
        
        # Historical data date range
        result = db.execute(text("""
            SELECT MIN(timestamp), MAX(timestamp) 
            FROM historical_data
        """))
        row = result.fetchone()
        if row and row[0]:
            print(f"\n📅 Historical Data:")
            print(f"   From: {row[0]}")
            print(f"   To:   {row[1]}")
        
        # Tickets date range
        result = db.execute(text("""
            SELECT MIN(date), MAX(date) 
            FROM tickets
        """))
        row = result.fetchone()
        if row and row[0]:
            print(f"\n📅 Tickets:")
            print(f"   From: {row[0]}")
            print(f"   To:   {row[1]}")
        
        print("\n" + "=" * 70)
        print("✅ Database ready for viewing in DB Browser")
        print("=" * 70)
        print("\n📂 File: data/cauldronwatch.db")
        print("\n💡 Open with:")
        print("   - DB Browser for SQLite")
        print("   - VS Code: Install 'SQLite Viewer' extension")
        print("   - Command line: sqlite3 data/cauldronwatch.db")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    view_database_stats()

