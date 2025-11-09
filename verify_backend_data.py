"""
Script to verify what data the backend is actually returning
and help debug frontend data display issues
"""
import sys
from pathlib import Path
import requests
import json

project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

BACKEND_URL = "http://localhost:8000"

def check_backend_data():
    """Check what data the backend is returning"""
    print("=" * 70)
    print("VERIFYING BACKEND DATA FOR FRONTEND")
    print("=" * 70)
    
    # Check cauldrons
    print("\n1. CAULDRONS:")
    print("-" * 70)
    try:
        response = requests.get(f"{BACKEND_URL}/api/cauldrons")
        if response.status_code == 200:
            cauldrons = response.json()
            print(f"   ✅ Found {len(cauldrons)} cauldrons")
            if cauldrons:
                sample = cauldrons[0]
                print(f"\n   Sample cauldron structure:")
                print(f"   {json.dumps(sample, indent=2)}")
                print(f"\n   Key fields to check:")
                print(f"   - id: {sample.get('id', 'MISSING')}")
                print(f"   - cauldron_id: {sample.get('cauldron_id', 'MISSING')}")
                print(f"   - latitude: {sample.get('latitude', 'MISSING')}")
                print(f"   - longitude: {sample.get('longitude', 'MISSING')}")
                print(f"   - max_volume: {sample.get('max_volume', 'MISSING')}")
                print(f"   - capacity: {sample.get('capacity', 'MISSING')}")
        else:
            print(f"   ❌ Error: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Check latest levels
    print("\n2. LATEST LEVELS:")
    print("-" * 70)
    try:
        response = requests.get(f"{BACKEND_URL}/api/data/latest")
        if response.status_code == 200:
            levels = response.json()
            print(f"   ✅ Found {len(levels)} latest levels")
            if levels:
                sample = levels[0]
                print(f"\n   Sample level structure:")
                print(f"   {json.dumps(sample, indent=2)}")
                print(f"\n   Key fields to check:")
                print(f"   - id: {sample.get('id', 'MISSING')}")
                print(f"   - cauldron_id: {sample.get('cauldron_id', 'MISSING')}")
                print(f"   - level: {sample.get('level', 'MISSING')}")
                
                # Calculate average
                if levels:
                    avg_level = sum(l.get('level', 0) for l in levels) / len(levels)
                    print(f"\n   Average level (raw): {avg_level:.2f}")
                    
                    # Try to match with cauldrons to calculate percentage
                    cauldrons_resp = requests.get(f"{BACKEND_URL}/api/cauldrons")
                    if cauldrons_resp.status_code == 200:
                        cauldrons = cauldrons_resp.json()
                        cauldron_map = {c.get('id') or c.get('cauldron_id'): c for c in cauldrons}
                        
                        percentages = []
                        for level in levels:
                            cid = level.get('cauldron_id') or level.get('id')
                            cauldron = cauldron_map.get(cid)
                            if cauldron:
                                capacity = cauldron.get('capacity') or cauldron.get('max_volume') or 1000
                                pct = (level.get('level', 0) / capacity) * 100
                                percentages.append(pct)
                        
                        if percentages:
                            avg_pct = sum(percentages) / len(percentages)
                            print(f"   Average level (percentage): {avg_pct:.1f}%")
        else:
            print(f"   ❌ Error: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Check ID matching
    print("\n3. ID MATCHING CHECK:")
    print("-" * 70)
    try:
        cauldrons_resp = requests.get(f"{BACKEND_URL}/api/cauldrons")
        levels_resp = requests.get(f"{BACKEND_URL}/api/data/latest")
        
        if cauldrons_resp.status_code == 200 and levels_resp.status_code == 200:
            cauldrons = cauldrons_resp.json()
            levels = levels_resp.json()
            
            cauldron_ids = set()
            for c in cauldrons:
                if c.get('id'):
                    cauldron_ids.add(c.get('id'))
                if c.get('cauldron_id'):
                    cauldron_ids.add(c.get('cauldron_id'))
            
            level_ids = set()
            for l in levels:
                if l.get('cauldron_id'):
                    level_ids.add(l.get('cauldron_id'))
                if l.get('id'):
                    level_ids.add(l.get('id'))
            
            print(f"   Cauldron IDs: {sorted(cauldron_ids)[:5]}... ({len(cauldron_ids)} total)")
            print(f"   Level IDs: {sorted(level_ids)[:5]}... ({len(level_ids)} total)")
            
            matched = cauldron_ids & level_ids
            print(f"   ✅ Matched IDs: {len(matched)}/{len(cauldron_ids)}")
            
            if len(matched) < len(cauldron_ids):
                unmatched_cauldrons = cauldron_ids - level_ids
                unmatched_levels = level_ids - cauldron_ids
                if unmatched_cauldrons:
                    print(f"   ⚠️  Cauldrons without levels: {sorted(unmatched_cauldrons)[:3]}...")
                if unmatched_levels:
                    print(f"   ⚠️  Levels without cauldrons: {sorted(unmatched_levels)[:3]}...")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    print("\n" + "=" * 70)
    print("HOW TO VERIFY IN BROWSER:")
    print("=" * 70)
    print("1. Open browser DevTools (F12)")
    print("2. Go to Console tab - look for:")
    print("   - '✅ Backend is healthy'")
    print("   - '✅ WebSocket connected'")
    print("   - Any error messages")
    print("3. Go to Network tab:")
    print("   - Filter by 'Fetch/XHR'")
    print("   - Look for requests to /api/cauldrons and /api/data/latest")
    print("   - Click on them to see the response data")
    print("4. In Console, type:")
    print("   window.__POTION_STORE__ = usePotionStore.getState()")
    print("   console.log(window.__POTION_STORE__.cauldrons)")
    print("   This will show the current cauldron data in the store")

if __name__ == "__main__":
    check_backend_data()

