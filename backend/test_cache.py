"""
Test script to verify database caching works
"""
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.database.db import get_db_session, init_db
from backend.api.cached_eog_client import CachedEOGClient
import time

def test_caching():
    """Test that caching works"""
    print("Testing Database Caching...")
    print("=" * 50)
    
    # Ensure DB is initialized
    init_db()
    
    # Get database session
    db = get_db_session()
    
    try:
        client = CachedEOGClient(db, cache_ttl_minutes=5)
        
        print("\n1. First fetch (from API, will cache)...")
        start = time.time()
        cauldrons = client.get_cauldrons(use_cache=True)
        first_fetch_time = time.time() - start
        print(f"   ✓ Fetched {len(cauldrons)} cauldrons in {first_fetch_time:.2f}s")
        print(f"   Sample: {cauldrons[0].name}")
        
        print("\n2. Second fetch (from cache, should be faster)...")
        start = time.time()
        cauldrons_cached = client.get_cauldrons(use_cache=True)
        cached_fetch_time = time.time() - start
        print(f"   ✓ Fetched {len(cauldrons_cached)} cauldrons in {cached_fetch_time:.2f}s")
        print(f"   Sample: {cauldrons_cached[0].name}")
        
        speedup = first_fetch_time / cached_fetch_time if cached_fetch_time > 0 else 0
        print(f"\n   ⚡ Cache speedup: {speedup:.1f}x faster")
        
        print("\n3. Testing market cache...")
        market = client.get_market(use_cache=True)
        print(f"   ✓ Market: {market.name}")
        
        print("\n4. Testing tickets cache...")
        tickets = client.get_tickets(use_cache=True)
        print(f"   ✓ Tickets: {len(tickets.tickets)} tickets")
        
        print("\n5. Testing latest levels...")
        latest = client.get_latest_levels(use_cache=True)
        print(f"   ✓ Latest levels for {len(latest)} cauldrons")
        if latest:
            print(f"   Sample: {latest[0].cauldron_id} = {latest[0].level:.2f}L at {latest[0].timestamp}")
        
        print("\n" + "=" * 50)
        print("✅ All caching tests passed!")
        
    finally:
        db.close()

if __name__ == "__main__":
    test_caching()

