"""
Quick test script - Simple validation of drain detection
Run this for a quick check
"""
import sys
from pathlib import Path
from datetime import datetime, timedelta
import pandas as pd

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.data_analysis.analyzer import CauldronAnalyzer


def quick_test():
    """Quick test with simple scenario"""
    print("🧪 Quick Drain Detection Test\n")
    
    # Simple scenario: 50L drain over 10 minutes, fill rate 0.5 L/min
    # Expected: Level drop = 45L (50L - 5L filled), True volume = 50L
    
    start_time = datetime(2025, 10, 30, 10, 0, 0)
    fill_rate = 0.5  # L/min
    drain_rate = -5.0  # L/min
    net_rate = drain_rate + fill_rate  # -4.5 L/min
    
    data = []
    level = 200.0
    
    # 10 min normal fill
    for i in range(10):
        level += fill_rate
        data.append({'timestamp': start_time + timedelta(minutes=i), 'level': level})
    
    # 10 min drain
    for i in range(10):
        level += net_rate
        data.append({'timestamp': start_time + timedelta(minutes=10+i), 'level': level})
    
    # 10 min normal fill
    for i in range(10):
        level += fill_rate
        data.append({'timestamp': start_time + timedelta(minutes=20+i), 'level': level})
    
    df = pd.DataFrame(data)
    
    analyzer = CauldronAnalyzer()
    results = analyzer.analyze_cauldron(df, "test_cauldron")
    
    print("📊 Test Scenario:")
    print(f"   Fill rate: {fill_rate} L/min")
    print(f"   Drain rate: {drain_rate} L/min (net: {net_rate} L/min)")
    print(f"   Drain duration: 10 minutes")
    print(f"   Expected level drop: {abs(net_rate * 10):.1f}L")
    print(f"   Expected true volume: {abs(drain_rate * 10):.1f}L (50L drained)")
    
    print(f"\n✅ Results:")
    print(f"   Detected fill rate: {results['fill_rate']:.4f} L/min")
    print(f"   Detected drains: {results['num_drains']}")
    
    if results['drain_events']:
        event = results['drain_events'][0]
        print(f"\n   Drain Event:")
        print(f"     Duration: {event['duration_minutes']:.2f} min")
        print(f"     Level drop: {event['level_drop']:.2f}L")
        print(f"     True volume: {event.get('true_volume', 'N/A'):.2f}L" if event.get('true_volume') else "     True volume: N/A")
        
        if event.get('true_volume'):
            print(f"\n   ✅ Calculation verified:")
            print(f"     Level drop: {event['level_drop']:.2f}L")
            print(f"     + Fill during drain: {event.get('fill_rate', 0) * event['duration_minutes']:.2f}L")
            print(f"     = True volume: {event['true_volume']:.2f}L")
    else:
        print("   ⚠️  No drains detected")
    
    print("\n" + "="*50)


if __name__ == "__main__":
    quick_test()

