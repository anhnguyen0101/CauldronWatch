"""
Quick test script to verify EOG API connection
Run this to test if the API endpoints are accessible
"""
import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.api.eog_client import EOGClient
import json


def test_eog_api():
    """Test all EOG API endpoints"""
    client = EOGClient()
    
    print("Testing EOG API Connection...")
    print("=" * 50)
    
    try:
        # Test Information endpoints
        print("\n1. Testing /api/Information/cauldrons...")
        cauldrons = client.get_cauldrons()
        print(f"   ✓ Found {len(cauldrons)} cauldrons")
        if cauldrons:
            print(f"   Sample: {cauldrons[0].cauldron_id}")
        
        print("\n2. Testing /api/Information/market...")
        market = client.get_market()
        print(f"   ✓ Market: {market.market_id}")
        
        print("\n3. Testing /api/Information/couriers...")
        couriers = client.get_couriers()
        print(f"   ✓ Found {len(couriers)} couriers")
        
        print("\n4. Testing /api/Information/network...")
        network = client.get_network()
        nodes = network.all_nodes if hasattr(network, 'all_nodes') else (network.nodes or [])
        print(f"   ✓ Network: {len(nodes)} nodes, {len(network.edges)} edges")
        
        # Test Data endpoints
        print("\n5. Testing /api/Data/metadata...")
        metadata = client.get_data_metadata()
        print(f"   ✓ Metadata retrieved")
        
        print("\n6. Testing /api/Data...")
        data = client.get_data()
        print(f"   ✓ Retrieved {len(data)} data points")
        
        # Test Ticket endpoints
        print("\n7. Testing /api/Tickets...")
        tickets = client.get_tickets()
        print(f"   ✓ Found {len(tickets.tickets)} tickets")
        
        print("\n" + "=" * 50)
        print("✅ All API endpoints are accessible!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    test_eog_api()

