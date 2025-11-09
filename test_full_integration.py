"""
Comprehensive integration test for Frontend + Person 2 + Person 3
Tests all components working together
"""
import sys
from pathlib import Path
import requests
import json
from datetime import datetime, timedelta

project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

BACKEND_URL = "http://localhost:8000"

def print_section(title):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)

def test_person_2_drain_detection():
    """Test Person 2's drain detection"""
    print_section("PERSON 2: DRAIN DETECTION")
    
    results = []
    
    # Test 1: Analyze single cauldron
    print("\n1. Testing single cauldron analysis:")
    try:
        response = requests.get(f"{BACKEND_URL}/api/analysis/cauldrons/cauldron_001", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Cauldron analysis successful")
            print(f"      Fill rate: {data.get('fill_rate', 0):.3f} L/min")
            print(f"      Drain events: {data.get('num_drains', 0)}")
            print(f"      Total volume drained: {data.get('total_volume_drained', 0):.2f} L")
            results.append(("Single cauldron analysis", True))
        else:
            print(f"   ❌ Error: Status {response.status_code}")
            results.append(("Single cauldron analysis", False))
    except Exception as e:
        print(f"   ❌ Error: {e}")
        results.append(("Single cauldron analysis", False))
    
    # Test 2: Analyze all cauldrons
    print("\n2. Testing all cauldrons analysis:")
    try:
        response = requests.get(f"{BACKEND_URL}/api/analysis/cauldrons", timeout=30)
        if response.status_code == 200:
            data = response.json()
            total_drains = sum(ca.get('num_drains', 0) for ca in data.values())
            print(f"   ✅ All cauldrons analyzed")
            print(f"      Cauldrons: {len(data)}")
            print(f"      Total drain events: {total_drains}")
            results.append(("All cauldrons analysis", True))
        else:
            print(f"   ❌ Error: Status {response.status_code}")
            results.append(("All cauldrons analysis", False))
    except Exception as e:
        print(f"   ❌ Error: {e}")
        results.append(("All cauldrons analysis", False))
    
    # Test 3: Daily drain summary (for Person 3)
    print("\n3. Testing daily drain summary:")
    try:
        date = "2025-10-30"  # Use a date that has data
        response = requests.get(f"{BACKEND_URL}/api/analysis/drains/cauldron_001/{date}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Daily summary successful")
            print(f"      Date: {data.get('date')}")
            print(f"      Drain events: {data.get('num_drains', 0)}")
            print(f"      Total volume: {data.get('total_volume_drained', 0):.2f} L")
            results.append(("Daily drain summary", True))
        else:
            print(f"   ❌ Error: Status {response.status_code}")
            results.append(("Daily drain summary", False))
    except Exception as e:
        print(f"   ❌ Error: {e}")
        results.append(("Daily drain summary", False))
    
    return results

def test_person_3_ticket_matching():
    """Test Person 3's ticket matching and discrepancy detection"""
    print_section("PERSON 3: TICKET MATCHING & DISCREPANCY DETECTION")
    
    results = []
    
    # Test 1: Detect discrepancies
    print("\n1. Testing discrepancy detection:")
    try:
        response = requests.post(f"{BACKEND_URL}/api/discrepancies/detect", timeout=60)
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Discrepancy detection successful")
            print(f"      Total discrepancies: {data.get('total_discrepancies', 0)}")
            print(f"      Critical: {data.get('critical_count', 0)}")
            print(f"      Warning: {data.get('warning_count', 0)}")
            print(f"      Info: {data.get('info_count', 0)}")
            
            # Show sample discrepancies
            discrepancies = data.get('discrepancies', [])
            if discrepancies:
                sample = discrepancies[0]
                print(f"\n      Sample discrepancy:")
                print(f"         Ticket: {sample.get('ticket_id')}")
                print(f"         Cauldron: {sample.get('cauldron_id')}")
                print(f"         Difference: {sample.get('discrepancy', 0):.2f} L")
                print(f"         Severity: {sample.get('severity')}")
            
            results.append(("Discrepancy detection", True))
        else:
            print(f"   ❌ Error: Status {response.status_code}")
            print(f"      Response: {response.text[:200]}")
            results.append(("Discrepancy detection", False))
    except Exception as e:
        print(f"   ❌ Error: {e}")
        results.append(("Discrepancy detection", False))
    
    # Test 2: Get all discrepancies
    print("\n2. Testing get discrepancies:")
    try:
        response = requests.get(f"{BACKEND_URL}/api/discrepancies", timeout=60)
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Get discrepancies successful")
            print(f"      Total: {data.get('total_discrepancies', 0)}")
            print(f"      Critical: {data.get('critical_count', 0)}")
            print(f"      Warning: {data.get('warning_count', 0)}")
            print(f"      Info: {data.get('info_count', 0)}")
            results.append(("Get discrepancies", True))
        else:
            print(f"   ❌ Error: Status {response.status_code}")
            results.append(("Get discrepancies", False))
    except Exception as e:
        print(f"   ❌ Error: {e}")
        results.append(("Get discrepancies", False))
    
    # Test 3: Filter by severity
    print("\n3. Testing filter by severity:")
    try:
        response = requests.get(f"{BACKEND_URL}/api/discrepancies?severity=critical", timeout=60)
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Filter by severity successful")
            print(f"      Critical discrepancies: {data.get('critical_count', 0)}")
            results.append(("Filter by severity", True))
        else:
            print(f"   ❌ Error: Status {response.status_code}")
            results.append(("Filter by severity", False))
    except Exception as e:
        print(f"   ❌ Error: {e}")
        results.append(("Filter by severity", False))
    
    return results

def test_frontend_endpoints():
    """Test endpoints that frontend uses"""
    print_section("FRONTEND: API ENDPOINTS")
    
    results = []
    
    endpoints = [
        ("Health check", "/health"),
        ("Get cauldrons", "/api/cauldrons"),
        ("Get latest levels", "/api/data/latest"),
        ("Get tickets", "/api/tickets"),
        ("Get market", "/api/market"),
    ]
    
    for name, endpoint in endpoints:
        try:
            response = requests.get(f"{BACKEND_URL}{endpoint}", timeout=5)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    print(f"   ✅ {name}: {len(data)} items")
                elif isinstance(data, dict):
                    print(f"   ✅ {name}: OK")
                results.append((name, True))
            else:
                print(f"   ❌ {name}: Status {response.status_code}")
                results.append((name, False))
        except Exception as e:
            print(f"   ❌ {name}: {e}")
            results.append((name, False))
    
    return results

def test_data_flow():
    """Test the complete data flow"""
    print_section("DATA FLOW: END-TO-END TEST")
    
    print("\nTesting complete flow:")
    print("  1. Get cauldrons → 2. Get drain events → 3. Get tickets → 4. Match & detect discrepancies")
    
    try:
        # Step 1: Get cauldrons
        print("\n   Step 1: Getting cauldrons...")
        cauldrons_resp = requests.get(f"{BACKEND_URL}/api/cauldrons", timeout=5)
        if cauldrons_resp.status_code != 200:
            print(f"      ❌ Failed to get cauldrons")
            return False
        cauldrons = cauldrons_resp.json()
        print(f"      ✅ Got {len(cauldrons)} cauldrons")
        
        # Step 2: Get drain events (Person 2)
        print("\n   Step 2: Getting drain events (Person 2)...")
        analysis_resp = requests.get(f"{BACKEND_URL}/api/analysis/cauldrons/cauldron_001", timeout=10)
        if analysis_resp.status_code != 200:
            print(f"      ❌ Failed to get drain events")
            return False
        analysis = analysis_resp.json()
        print(f"      ✅ Got {analysis.get('num_drains', 0)} drain events")
        
        # Step 3: Get tickets
        print("\n   Step 3: Getting tickets...")
        tickets_resp = requests.get(f"{BACKEND_URL}/api/tickets", timeout=5)
        if tickets_resp.status_code != 200:
            print(f"      ❌ Failed to get tickets")
            return False
        tickets_data = tickets_resp.json()
        tickets = tickets_data.get('transport_tickets', [])
        print(f"      ✅ Got {len(tickets)} tickets")
        
        # Step 4: Detect discrepancies (Person 3)
        print("\n   Step 4: Detecting discrepancies (Person 3)...")
        discrepancies_resp = requests.post(f"{BACKEND_URL}/api/discrepancies/detect", timeout=60)
        if discrepancies_resp.status_code != 200:
            print(f"      ❌ Failed to detect discrepancies")
            print(f"      Status: {discrepancies_resp.status_code}")
            print(f"      Response: {discrepancies_resp.text[:300]}")
            return False
        discrepancies = discrepancies_resp.json()
        print(f"      ✅ Detected {discrepancies.get('total_discrepancies', 0)} discrepancies")
        
        print("\n   ✅ Complete data flow successful!")
        return True
        
    except Exception as e:
        print(f"   ❌ Error in data flow: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    print("\n" + "🧪" * 35)
    print("FULL INTEGRATION TEST: Frontend + Person 2 + Person 3")
    print("🧪" * 35)
    
    # Check if backend is running
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=2)
        if response.status_code != 200:
            print("\n❌ Backend is not running!")
            print("   Start it with: uvicorn backend.api.main:app --reload")
            return
    except:
        print("\n❌ Backend is not running!")
        print("   Start it with: uvicorn backend.api.main:app --reload")
        return
    
    print("\n✅ Backend is running")
    
    # Run all tests
    p2_results = test_person_2_drain_detection()
    p3_results = test_person_3_ticket_matching()
    frontend_results = test_frontend_endpoints()
    data_flow_ok = test_data_flow()
    
    # Summary
    print_section("TEST SUMMARY")
    
    print("\nPerson 2 (Drain Detection):")
    for name, passed in p2_results:
        status = "✅" if passed else "❌"
        print(f"   {status} {name}")
    
    print("\nPerson 3 (Ticket Matching):")
    for name, passed in p3_results:
        status = "✅" if passed else "❌"
        print(f"   {status} {name}")
    
    print("\nFrontend Endpoints:")
    for name, passed in frontend_results:
        status = "✅" if passed else "❌"
        print(f"   {status} {name}")
    
    print(f"\nData Flow: {'✅ Passed' if data_flow_ok else '❌ Failed'}")
    
    # Overall status
    all_p2 = all(r[1] for r in p2_results)
    all_p3 = all(r[1] for r in p3_results)
    all_frontend = all(r[1] for r in frontend_results)
    
    print("\n" + "=" * 70)
    if all_p2 and all_p3 and all_frontend and data_flow_ok:
        print("🎉 ALL TESTS PASSED - Integration is working!")
    else:
        print("⚠️  Some tests failed - check errors above")
    print("=" * 70)
    
    print("\n💡 Next steps:")
    print("   1. Start frontend: cd potionwatch && npm run dev")
    print("   2. Open browser: http://localhost:5173")
    print("   3. Check browser console for connection logs")
    print("   4. Test real-time updates (should update every 1 second)")

if __name__ == "__main__":
    main()

