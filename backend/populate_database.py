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
from backend.database.models import NetworkEdgeCache, CauldronCache, MarketCache


def verify_data_completeness(db):
    """Verify that all data is saved correctly with all fields populated"""
    print("\n" + "=" * 70)
    print("VERIFYING DATA COMPLETENESS")
    print("=" * 70)
    
    cache = CacheManager(db)
    issues = []
    warnings = []
    
    # 1. Verify cauldrons
    cauldrons = cache.get_cached_cauldrons(max_age_minutes=999999)
    if not cauldrons or len(cauldrons) == 0:
        issues.append("❌ No cauldrons found in database")
    else:
        print(f"   ✅ Cauldrons: {len(cauldrons)} records")
        # Check for missing coordinates
        for c in cauldrons:
            if c.latitude is None or c.longitude is None:
                issues.append(f"❌ Cauldron {c.id} missing coordinates")
    
    # 2. Verify market
    market = cache.get_cached_market(max_age_minutes=999999)
    if not market:
        issues.append("❌ No market found in database")
    else:
        print(f"   ✅ Market: 1 record")
        if market.latitude is None or market.longitude is None:
            issues.append(f"❌ Market {market.id} missing coordinates")
    
    # 3. Verify network edges
    network = cache.get_cached_network(max_age_minutes=999999)
    if not network or len(network.edges) == 0:
        issues.append("❌ No network edges found in database")
    else:
        print(f"   ✅ Network edges: {len(network.edges)} records")
        # Check for missing weight and distance
        edges_without_weight = 0
        edges_without_distance = 0
        edges_without_coords = 0
        
        # Query directly to check NULL values
        edges = db.query(NetworkEdgeCache).all()
        for edge in edges:
            if edge.weight is None:
                edges_without_weight += 1
            if edge.distance is None:
                edges_without_distance += 1
                # Check if coordinates exist for this edge
                from_node_exists = db.query(CauldronCache).filter_by(id=edge.from_node).first() or \
                                  db.query(MarketCache).filter_by(id=edge.from_node).first()
                to_node_exists = db.query(CauldronCache).filter_by(id=edge.to_node).first() or \
                                db.query(MarketCache).filter_by(id=edge.to_node).first()
                if not from_node_exists or not to_node_exists:
                    edges_without_coords += 1
        
        if edges_without_weight > 0:
            warnings.append(f"⚠️  {edges_without_weight} edges missing weight (should be set to travel_time_minutes)")
        if edges_without_distance > 0:
            if edges_without_coords > 0:
                issues.append(f"❌ {edges_without_coords} edges missing distance (coordinates not found)")
            else:
                warnings.append(f"⚠️  {edges_without_distance} edges missing distance (coordinates available but not calculated)")
        
        if edges_without_weight == 0 and edges_without_distance == 0:
            print(f"      ✅ All edges have weight and distance calculated")
    
    # 4. Verify couriers
    couriers = cache.get_cached_couriers(max_age_minutes=999999)
    if not couriers or len(couriers) == 0:
        issues.append("❌ No couriers found in database")
    else:
        print(f"   ✅ Couriers: {len(couriers)} records")
    
    # 5. Verify tickets
    tickets = cache.get_cached_tickets(max_age_minutes=999999)
    if not tickets or len(tickets) == 0:
        issues.append("❌ No tickets found in database")
    else:
        print(f"   ✅ Tickets: {len(tickets)} records")
    
    # 6. Verify historical data
    historical = cache.get_cached_historical_data()
    if not historical or len(historical) == 0:
        warnings.append("⚠️  No historical data found (this is optional)")
    else:
        print(f"   ✅ Historical data: {len(historical)} records")
    
    # Print summary
    print("\n" + "=" * 70)
    if issues:
        print("❌ ISSUES FOUND:")
        for issue in issues:
            print(f"   {issue}")
    if warnings:
        print("⚠️  WARNINGS:")
        for warning in warnings:
            print(f"   {warning}")
    if not issues and not warnings:
        print("✅ ALL DATA VERIFIED - Everything looks good!")
    print("=" * 70)
    
    return len(issues) == 0


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
        cache = CacheManager(db)
        
        print("\n" + "=" * 70)
        print("FETCHING DATA FROM EOG API")
        print("=" * 70)
        
        # 1. Fetch and cache cauldrons (MUST be first - needed for network distance calculation)
        print("\n1️⃣  Fetching cauldrons...")
        cauldrons = client.get_cauldrons(use_cache=False)  # Force fresh fetch
        print(f"   ✅ Fetched {len(cauldrons)} cauldrons")
        # Verify they're cached
        cached_cauldrons = cache.get_cached_cauldrons(max_age_minutes=999999)
        print(f"   💾 Verified: {len(cached_cauldrons) if cached_cauldrons else 0} cauldrons in database")
        for c in cauldrons[:3]:
            print(f"      - {c.name} ({c.cauldron_id})")
        
        # 2. Fetch and cache market (MUST be before network - needed for network distance calculation)
        print("\n2️⃣  Fetching market information...")
        market = client.get_market(use_cache=False)
        print(f"   ✅ Market: {market.name} ({market.id})")
        # Verify it's cached
        cached_market = cache.get_cached_market(max_age_minutes=999999)
        print(f"   💾 Verified: {1 if cached_market else 0} market in database")
        
        # 2.5. Fetch and cache network (AFTER cauldrons and market - needs coordinates)
        print("\n2.5️⃣ Fetching network graph...")
        print("   ℹ️  Note: Network will be cached with calculated weight and distance")
        network = client.get_network(use_cache=False)
        print(f"   ✅ Network: {len(network.edges)} edges")
        print(f"      Nodes: {len(network.all_nodes)} unique nodes")
        # Verify network is cached and check computed fields
        cached_network = cache.get_cached_network(max_age_minutes=999999)
        if cached_network:
            print(f"   💾 Verified: {len(cached_network.edges)} edges in database")
            # Check weight and distance
            edges = db.query(NetworkEdgeCache).all()
            edges_with_weight = sum(1 for e in edges if e.weight is not None)
            edges_with_distance = sum(1 for e in edges if e.distance is not None)
            print(f"      Weight calculated: {edges_with_weight}/{len(edges)} edges")
            print(f"      Distance calculated: {edges_with_distance}/{len(edges)} edges")
            if edges_with_weight < len(edges) or edges_with_distance < len(edges):
                print(f"      ⚠️  Warning: Some edges missing computed fields")
        
        # 3. Fetch and cache couriers
        print("\n3️⃣  Fetching couriers...")
        couriers = client.get_couriers(use_cache=False)
        print(f"   ✅ Fetched {len(couriers)} couriers")
        # Verify they're cached
        cached_couriers = cache.get_cached_couriers(max_age_minutes=999999)
        print(f"   💾 Verified: {len(cached_couriers) if cached_couriers else 0} couriers in database")
        
        # 4. Fetch and cache tickets
        print("\n4️⃣  Fetching tickets...")
        tickets = client.get_tickets(use_cache=False)
        print(f"   ✅ Fetched {len(tickets.tickets)} tickets")
        print(f"      Date range: {tickets.metadata.date_range.start.date()} to {tickets.metadata.date_range.end.date()}")
        # Verify they're cached
        cached_tickets = cache.get_cached_tickets(max_age_minutes=999999)
        print(f"   💾 Verified: {len(cached_tickets) if cached_tickets else 0} tickets in database")
        
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
        print("\n   💾 Caching historical data...")
        cache.cache_historical_data(all_data, clear_old=False)
        print(f"   ✅ Cached {len(all_data)} data points")
        # Verify
        cached_historical = cache.get_cached_historical_data()
        print(f"   💾 Verified: {len(cached_historical)} historical records in database")
        
        # 6. Fetch and cache data metadata
        print("\n6️⃣  Fetching data metadata...")
        metadata = client.get_data_metadata(use_cache=False)
        print(f"   ✅ Data metadata: {metadata.start_date.date()} to {metadata.end_date.date()}")
        print(f"      Interval: {metadata.interval_minutes} minutes, Unit: {metadata.unit}")
        
        # Final verification
        print("\n" + "=" * 70)
        print("DATABASE SUMMARY")
        print("=" * 70)
        
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
        
        # Count network edges with details
        network_cached = cache.get_cached_network(max_age_minutes=999999)
        if network_cached:
            edges = db.query(NetworkEdgeCache).all()
            edges_with_weight = sum(1 for e in edges if e.weight is not None)
            edges_with_distance = sum(1 for e in edges if e.distance is not None)
            print(f"   Network edges: {len(network_cached.edges)} records")
            print(f"      - Weight populated: {edges_with_weight}/{len(edges)}")
            print(f"      - Distance populated: {edges_with_distance}/{len(edges)}")
        else:
            print(f"   Network edges: 0 records")
        
        # Count couriers
        couriers_cached = cache.get_cached_couriers(max_age_minutes=999999)
        print(f"   Couriers: {len(couriers_cached) if couriers_cached else 0} records")
        
        # Run comprehensive verification
        is_complete = verify_data_completeness(db)
        
        print("\n" + "=" * 70)
        if is_complete:
            print("✅ DATABASE POPULATION COMPLETE - ALL DATA SAVED")
        else:
            print("⚠️  DATABASE POPULATION COMPLETE - BUT SOME ISSUES FOUND")
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
        print("   - network_edges (with weight and distance)")
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

