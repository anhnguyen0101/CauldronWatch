"""
Populate database with all data from EOG API
Fetches and caches all data so you can view it in DB Browser
"""
import sys
from pathlib import Path
from datetime import datetime

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.database.db import init_db, get_db_session
from backend.api.cached_eog_client import CachedEOGClient
from backend.database.cache import CacheManager


def populate_all_data():
    """Fetch and cache all data from EOG API"""
    print("=" * 70)
    print("POPULATING DATABASE WITH ALL EOG API DATA")
    print("=" * 70)
    
    # Initialize database
    print("\n📦 Initializing database...")
    init_db()
    
    # Get database session
    db = get_db_session()
    
    try:
        client = CachedEOGClient(db, cache_ttl_minutes=999999)  # Long TTL to force fetch
        
        print("\n" + "=" * 70)
        print("FETCHING DATA FROM EOG API")
        print("=" * 70)
        
        # 1. Fetch and cache cauldrons
        print("\n1️⃣  Fetching cauldrons...")
        cauldrons = client.get_cauldrons(use_cache=False)  # Force fresh fetch
        print(f"   ✅ Fetched {len(cauldrons)} cauldrons")
        for c in cauldrons[:3]:
            print(f"      - {c.name} ({c.cauldron_id})")
        
        # 2. Fetch and cache market
        print("\n2️⃣  Fetching market information...")
        market = client.get_market(use_cache=False)
        print(f"   ✅ Market: {market.name} ({market.id})")
        
        # 2.5. Fetch and cache network
        print("\n2.5️⃣ Fetching network graph...")
        network = client.get_network(use_cache=False)
        print(f"   ✅ Network: {len(network.edges)} edges")
        print(f"      Nodes: {len(network.all_nodes)} unique nodes")
        
        # 3. Fetch and cache couriers
        print("\n3️⃣  Fetching couriers...")
        couriers = client.get_couriers(use_cache=False)
        print(f"   ✅ Fetched {len(couriers)} couriers")
        # Explicitly cache couriers (in case use_cache=False doesn't cache)
        if couriers:
            cache = CacheManager(db)
            cache.cache_couriers(couriers)
            print(f"   💾 Cached {len(couriers)} couriers")
        
        # 4. Fetch and cache tickets
        print("\n4️⃣  Fetching tickets...")
        tickets = client.get_tickets(use_cache=False)
        print(f"   ✅ Fetched {len(tickets.tickets)} tickets")
        print(f"      Date range: {tickets.metadata.date_range.start.date()} to {tickets.metadata.date_range.end.date()}")
        
        # 5. Fetch and cache historical data (this might take a while)
        print("\n5️⃣  Fetching historical data...")
        print("   ⏳ This may take a minute (fetching all historical data)...")
        
        # Fetch all historical data
        all_data = client.get_data(use_cache=False)  # Force fresh fetch, no date filter = all data
        print(f"   ✅ Fetched {len(all_data)} historical data points")
        
        if all_data:
            print(f"      Time range: {all_data[0].timestamp.date()} to {all_data[-1].timestamp.date()}")
            print(f"      Cauldrons: {len(set(d.cauldron_id for d in all_data))} unique cauldrons")
        
        # Cache the historical data
        cache = CacheManager(db)
        print("\n   💾 Caching historical data...")
        cache.cache_historical_data(all_data, clear_old=False)
        print(f"   ✅ Cached {len(all_data)} data points")
        
        # 6. Fetch and cache data metadata
        print("\n6️⃣  Fetching data metadata...")
        metadata = client.get_data_metadata(use_cache=False)
        print(f"   ✅ Data metadata: {metadata.start_date.date()} to {metadata.end_date.date()}")
        print(f"      Interval: {metadata.interval_minutes} minutes, Unit: {metadata.unit}")
        
        print("\n" + "=" * 70)
        print("DATABASE SUMMARY")
        print("=" * 70)
        
        # Show what's in the database
        cache = CacheManager(db)
        
        print("\n📊 Database Contents:")
        
        # Count cauldrons
        cauldrons_cached = cache.get_cached_cauldrons(max_age_minutes=999999)
        print(f"   Cauldrons: {len(cauldrons_cached) if cauldrons_cached else 0} records")
        
        # Count historical data
        historical_count = len(cache.get_cached_historical_data())
        print(f"   Historical data: {historical_count} records")
        
        # Count tickets
        tickets_cached = cache.get_cached_tickets(max_age_minutes=999999)
        print(f"   Tickets: {len(tickets_cached) if tickets_cached else 0} records")
        
        # Count market
        market_cached = cache.get_cached_market(max_age_minutes=999999)
        print(f"   Market: {1 if market_cached else 0} record")
        
        # Count network edges
        network_cached = cache.get_cached_network(max_age_minutes=999999)
        print(f"   Network edges: {len(network_cached.edges) if network_cached else 0} records")
        
        # Count couriers
        couriers_cached = cache.get_cached_couriers(max_age_minutes=999999)
        print(f"   Couriers: {len(couriers_cached) if couriers_cached else 0} records")
        
        print("\n" + "=" * 70)
        print("✅ DATABASE POPULATION COMPLETE")
        print("=" * 70)
        print("\n📂 Database location: data/cauldronwatch.db")
        print("\n💡 You can now open this file in:")
        print("   - DB Browser for SQLite (https://sqlitebrowser.org/)")
        print("   - VS Code SQLite extension")
        print("   - Any SQLite viewer")
        print("\n📋 Tables to check:")
        print("   - cauldrons")
        print("   - historical_data")
        print("   - tickets")
        print("   - market")
        print("   - network_edges")
        print("   - couriers")
        print("   - cache_metadata")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    populate_all_data()

