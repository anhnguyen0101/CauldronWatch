"""
Update existing network_edges table with weight and distance values
"""
import sys
from pathlib import Path
from math import radians, sin, cos, sqrt, atan2

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.database.db import init_db, get_db_session
from backend.database.models import NetworkEdgeCache, CauldronCache, MarketCache


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in kilometers using Haversine formula"""
    R = 6371.0  # Earth radius in km
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    return R * c


def update_network_edges():
    """Update weight and distance for all network edges"""
    print("=" * 70)
    print("UPDATING NETWORK EDGES WITH WEIGHT AND DISTANCE")
    print("=" * 70)
    
    db = get_db_session()
    
    try:
        # Get all node coordinates
        node_coords = {}
        
        # Get cauldron coordinates
        cauldrons = db.query(CauldronCache).all()
        for cauldron in cauldrons:
            node_coords[cauldron.id] = (cauldron.latitude, cauldron.longitude)
        print(f"   📍 Loaded {len(cauldrons)} cauldron coordinates")
        
        # Get market coordinates
        market = db.query(MarketCache).first()
        if market:
            node_coords[market.id] = (market.latitude, market.longitude)
            print(f"   📍 Loaded market coordinates: {market.id}")
        
        # Get all edges
        edges = db.query(NetworkEdgeCache).all()
        print(f"   🔗 Found {len(edges)} network edges to update")
        
        # Update each edge
        updated_count = 0
        for edge in edges:
            # Set weight = travel_time_minutes if not set
            if edge.weight is None and edge.travel_time_minutes is not None:
                edge.weight = edge.travel_time_minutes
            
            # Calculate distance if coordinates available
            if edge.from_node in node_coords and edge.to_node in node_coords:
                from_lat, from_lon = node_coords[edge.from_node]
                to_lat, to_lon = node_coords[edge.to_node]
                edge.distance = haversine_distance(from_lat, from_lon, to_lat, to_lon)
                updated_count += 1
            else:
                missing_nodes = []
                if edge.from_node not in node_coords:
                    missing_nodes.append(edge.from_node)
                if edge.to_node not in node_coords:
                    missing_nodes.append(edge.to_node)
                print(f"   ⚠️  Warning: Missing coordinates for nodes: {missing_nodes}")
        
        # Commit changes
        db.commit()
        print(f"   ✅ Updated {updated_count} edges with distance calculations")
        print(f"   ✅ Set weight = travel_time_minutes for all edges")
        
        print("\n" + "=" * 70)
        print("✅ UPDATE COMPLETE")
        print("=" * 70)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    update_network_edges()
