"""
Test script to verify backend and frontend connection
Tests API endpoints and WebSocket
"""
import sys
from pathlib import Path
import requests
import json
from datetime import datetime

project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

BACKEND_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000/ws"

def test_backend_endpoints():
    """Test backend API endpoints"""
    print("=" * 70)
    print("TESTING BACKEND API ENDPOINTS")
    print("=" * 70)
    
    tests = [
        ("Health Check", f"{BACKEND_URL}/health"),
        ("Get Cauldrons", f"{BACKEND_URL}/api/cauldrons"),
        ("Get Latest Levels", f"{BACKEND_URL}/api/data/latest"),
        ("Get Tickets", f"{BACKEND_URL}/api/tickets"),
        ("Get Market", f"{BACKEND_URL}/api/market"),
    ]
    
    results = []
    for name, url in tests:
        try:
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                data = response.json()
                print(f"✅ {name}: OK")
                if isinstance(data, list):
                    print(f"   Returned {len(data)} items")
                elif isinstance(data, dict):
                    print(f"   Keys: {list(data.keys())[:5]}")
                results.append((name, True))
            else:
                print(f"❌ {name}: Status {response.status_code}")
                results.append((name, False))
        except requests.exceptions.ConnectionError:
            print(f"❌ {name}: Backend not running at {BACKEND_URL}")
            results.append((name, False))
        except Exception as e:
            print(f"❌ {name}: Error - {e}")
            results.append((name, False))
        print()
    
    return results

def test_websocket():
    """Test WebSocket connection"""
    print("=" * 70)
    print("TESTING WEBSOCKET CONNECTION")
    print("=" * 70)
    
    try:
        import websockets
        import asyncio
        
        async def test_ws():
            try:
                uri = WS_URL
                async with websockets.connect(uri) as websocket:
                    print(f"✅ WebSocket connected to {uri}")
                    
                    # Wait for initial message
                    try:
                        message = await asyncio.wait_for(websocket.recv(), timeout=5)
                        data = json.loads(message)
                        print(f"✅ Received message: {data.get('type', 'unknown')}")
                        return True
                    except asyncio.TimeoutError:
                        print("⚠️  No message received (might be normal)")
                        return True
            except Exception as e:
                print(f"❌ WebSocket error: {e}")
                return False
        
        result = asyncio.run(test_ws())
        return result
    except ImportError:
        print("⚠️  websockets library not installed")
        print("   Install with: pip install websockets")
        return None
    except Exception as e:
        print(f"❌ WebSocket test error: {e}")
        return False

def test_frontend_api_config():
    """Check if frontend API service is configured correctly"""
    print("=" * 70)
    print("CHECKING FRONTEND API CONFIGURATION")
    print("=" * 70)
    
    api_file = project_root / "potionwatch" / "src" / "services" / "api.js"
    ws_file = project_root / "potionwatch" / "src" / "services" / "websocket.js"
    
    if api_file.exists():
        content = api_file.read_text()
        if "localhost:8000" in content or "API_BASE_URL" in content:
            print("✅ Frontend API service configured")
        else:
            print("⚠️  Frontend API service might not be configured")
    else:
        print("❌ Frontend API service file not found")
    
    if ws_file.exists():
        content = ws_file.read_text()
        if "localhost:8000" in content or "VITE_WS_URL" in content:
            print("✅ Frontend WebSocket service configured")
        else:
            print("⚠️  Frontend WebSocket service might not be configured")
    else:
        print("❌ Frontend WebSocket service file not found")

def main():
    print("\n" + "🧪" * 35)
    print("BACKEND-FRONTEND CONNECTION TEST")
    print("🧪" * 35 + "\n")
    
    # Check frontend config
    test_frontend_api_config()
    print()
    
    # Test backend endpoints
    results = test_backend_endpoints()
    
    # Test WebSocket
    ws_result = test_websocket()
    print()
    
    # Summary
    print("=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    print(f"API Endpoints: {passed}/{total} passed")
    
    if ws_result is True:
        print("WebSocket: ✅ Connected")
    elif ws_result is False:
        print("WebSocket: ❌ Failed")
    else:
        print("WebSocket: ⚠️  Not tested (websockets library needed)")
    
    print("\n💡 To test frontend:")
    print("   1. Start backend: uvicorn backend.api.main:app --reload")
    print("   2. Start frontend: cd potionwatch && npm run dev")
    print("   3. Open browser: http://localhost:5173")
    print("   4. Check browser console for connection logs")

if __name__ == "__main__":
    main()

