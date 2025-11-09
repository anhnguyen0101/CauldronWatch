"""
Verify that x, y coordinates are stored in the database
Quick script to check if precomputed coordinates exist
"""
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.database.db import get_db_session
from backend.database.models import CauldronCache, MarketCache
from sqlalchemy import text


def verify_xy_coordinates():
    """Check if x, y coordinates are stored in the database"""
    print("=" * 70)
    print("VERIFYING X, Y COORDINATES IN DATABASE")
    print("=" * 70)
    
    db = get_db_session()
    
    try:
        # Check cauldrons
        cauldrons = db.query(CauldronCache).all()
        print(f"\n📦 Cauldrons: {len(cauldrons)} total")
        
        if len(cauldrons) == 0:
            print("   ❌ No cauldrons found in database")
            print("   💡 Run: python backend/populate_database.py")
            return
        
        cauldrons_with_xy = []
        cauldrons_without_xy = []
        
        for c in cauldrons:
            if c.x is not None and c.y is not None:
                cauldrons_with_xy.append(c)
            else:
                cauldrons_without_xy.append(c)
        
        print(f"   ✅ With x, y coordinates: {len(cauldrons_with_xy)}/{len(cauldrons)}")
        if len(cauldrons_without_xy) > 0:
            print(f"   ❌ Without x, y coordinates: {len(cauldrons_without_xy)}/{len(cauldrons)}")
            print(f"      Missing IDs: {[c.id for c in cauldrons_without_xy]}")
        
        # Show sample data
        if len(cauldrons_with_xy) > 0:
            sample = cauldrons_with_xy[0]
            print(f"\n   📊 Sample cauldron with coordinates:")
            print(f"      ID: {sample.id}")
            print(f"      Name: {sample.name}")
            print(f"      Latitude: {sample.latitude}, Longitude: {sample.longitude}")
            print(f"      X: {sample.x:.6f}, Y: {sample.y:.6f}")
        
        # Check market
        market = db.query(MarketCache).first()
        print(f"\n🏪 Market: {'Found' if market else 'Not found'}")
        
        if market:
            if market.x is not None and market.y is not None:
                print(f"   ✅ Has x, y coordinates")
                print(f"      ID: {market.id}")
                print(f"      Name: {market.name}")
                print(f"      Latitude: {market.latitude}, Longitude: {market.longitude}")
                print(f"      X: {market.x:.6f}, Y: {market.y:.6f}")
            else:
                print(f"   ❌ Missing x, y coordinates")
                print(f"      Latitude: {market.latitude}, Longitude: {market.longitude}")
        
        # Summary
        print("\n" + "=" * 70)
        if len(cauldrons_with_xy) == len(cauldrons) and market and market.x is not None and market.y is not None:
            print("✅ ALL NODES HAVE X, Y COORDINATES - Database is ready!")
            print("   Frontend will use fast precomputed coordinates")
        else:
            print("⚠️  SOME NODES MISSING X, Y COORDINATES")
            print("   Frontend will fall back to calculating from lat/lng (slower)")
            print("\n   To fix, run:")
            print("   python backend/populate_database.py")
            print("   OR")
            print("   python start_server.py (auto-populates on startup)")
        print("=" * 70)
        
    except Exception as e:
        print(f"❌ Error verifying coordinates: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    verify_xy_coordinates()

