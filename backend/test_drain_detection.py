"""
Test script for drain detection and analysis
Tests with sample data and shows detailed calculation logs
"""
import sys
from pathlib import Path
from datetime import datetime, timedelta
import pandas as pd

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.data_analysis.drain_detector import DrainDetector, DrainEvent
from backend.data_analysis.rate_calculator import RateCalculator
from backend.data_analysis.analyzer import CauldronAnalyzer


def create_test_data_with_drain():
    """
    Create test data with a known drain event
    Simulates: Cauldron filling at 0.5 L/min, then draining 50L over 10 minutes
    """
    print("=" * 70)
    print("CREATING TEST DATA")
    print("=" * 70)
    
    # Test scenario:
    # - Cauldron starts at 200L
    # - Fills at 0.5 L/min for 20 minutes (200 -> 210L)
    # - Drains 50L over 10 minutes (210 -> 160L) - but continues filling!
    # - Fills again at 0.5 L/min for 20 minutes (160 -> 170L)
    
    start_time = datetime(2025, 10, 30, 10, 0, 0)
    fill_rate = 0.5  # L/min
    data_points = []
    
    # Phase 1: Normal filling (20 minutes)
    print("\n📊 Phase 1: Normal filling (20 minutes)")
    print(f"   Start level: 200L, Fill rate: {fill_rate} L/min")
    current_level = 200.0
    for i in range(20):
        timestamp = start_time + timedelta(minutes=i)
        data_points.append({
            'timestamp': timestamp,
            'level': current_level
        })
        current_level += fill_rate
        if i % 5 == 0:
            print(f"   {timestamp.strftime('%H:%M')}: {current_level:.2f}L")
    
    # Phase 2: Drain event (10 minutes)
    # During drain: level drops 5L/min, but still fills at 0.5 L/min
    # Net drop: 4.5 L/min
    print("\n💧 Phase 2: Drain event (10 minutes)")
    print("   Drain rate: -5.0 L/min, Fill rate: +0.5 L/min")
    print("   Net change: -4.5 L/min")
    drain_rate = -5.0  # L/min drain rate
    net_rate = drain_rate + fill_rate  # -4.5 L/min
    
    for i in range(10):
        timestamp = start_time + timedelta(minutes=20 + i)
        current_level += net_rate
        data_points.append({
            'timestamp': timestamp,
            'level': current_level
        })
        if i % 2 == 0:
            print(f"   {timestamp.strftime('%H:%M')}: {current_level:.2f}L (draining)")
    
    # Phase 3: Normal filling again (20 minutes)
    print("\n📊 Phase 3: Normal filling again (20 minutes)")
    for i in range(20):
        timestamp = start_time + timedelta(minutes=30 + i)
        current_level += fill_rate
        data_points.append({
            'timestamp': timestamp,
            'level': current_level
        })
        if i % 5 == 0:
            print(f"   {timestamp.strftime('%H:%M')}: {current_level:.2f}L")
    
    df = pd.DataFrame(data_points)
    print(f"\n✅ Created {len(df)} data points")
    print(f"   Time range: {df['timestamp'].min()} to {df['timestamp'].max()}")
    print(f"   Level range: {df['level'].min():.2f}L to {df['level'].max():.2f}L")
    
    return df


def test_drain_detection():
    """Test drain detection with detailed logging"""
    print("\n" + "=" * 70)
    print("TEST 1: DRAIN DETECTION")
    print("=" * 70)
    
    # Create test data
    df = create_test_data_with_drain()
    
    # Initialize detector
    detector = DrainDetector(
        min_drop=10.0,  # Minimum 10L drop
        max_duration_minutes=30,
        detection_method='derivative',
        drain_threshold=-2.0  # Detect if rate < -2.0 L/min
    )
    
    print("\n🔍 Running drain detection...")
    events = detector.detect_drains(df, "test_cauldron_001")
    
    print(f"\n✅ Detected {len(events)} drain event(s)")
    
    for i, event in enumerate(events, 1):
        print(f"\n--- Drain Event {i} ---")
        print(f"Cauldron ID: {event.cauldron_id}")
        print(f"Start time: {event.start_time}")
        print(f"End time: {event.end_time}")
        print(f"Duration: {event.duration_minutes:.2f} minutes")
        print(f"Start level: {event.start_level:.2f}L")
        print(f"End level: {event.end_level:.2f}L")
        print(f"Level drop: {event.level_drop:.2f}L")
        print(f"True volume (not yet calculated): {event.true_volume}")
    
    return events


def test_rate_calculation():
    """Test fill rate calculation"""
    print("\n" + "=" * 70)
    print("TEST 2: FILL RATE CALCULATION")
    print("=" * 70)
    
    df = create_test_data_with_drain()
    
    # Calculate fill rate
    calculator = RateCalculator()
    print("\n📈 Calculating fill rate...")
    
    fill_rate = calculator.calculate_fill_rate(df)
    print(f"\n✅ Calculated fill rate: {fill_rate:.4f} L/min")
    print(f"   Expected: ~0.5 L/min (during non-drain periods)")
    
    # Show calculation details
    print("\n📊 Calculation details:")
    print("   Method: Linear regression on non-draining periods")
    print("   Formula: level = fill_rate * time + intercept")
    
    return fill_rate


def test_full_analysis():
    """Test complete analysis pipeline"""
    print("\n" + "=" * 70)
    print("TEST 3: FULL ANALYSIS PIPELINE")
    print("=" * 70)
    
    df = create_test_data_with_drain()
    
    analyzer = CauldronAnalyzer(
        min_drop=10.0,
        max_duration_minutes=30,
        detection_method='derivative',
        drain_threshold=-2.0
    )
    
    print("\n🔄 Running full analysis...")
    print("   Step 1: Detect drains")
    print("   Step 2: Calculate fill rate")
    print("   Step 3: Calculate true volume drained (accounting for filling)")
    
    results = analyzer.analyze_cauldron(df, "test_cauldron_001")
    
    print("\n" + "=" * 70)
    print("ANALYSIS RESULTS")
    print("=" * 70)
    print(f"Cauldron ID: {results['cauldron_id']}")
    print(f"Fill rate: {results['fill_rate']:.4f} L/min")
    print(f"Number of drains: {results['num_drains']}")
    print(f"Total volume drained: {results['total_volume_drained']:.2f}L")
    print(f"Average drain volume: {results['avg_drain_volume']:.2f}L")
    
    print("\n--- Drain Events ---")
    for i, event in enumerate(results['drain_events'], 1):
        print(f"\nDrain Event {i}:")
        print(f"  Start: {event['start_time']}")
        print(f"  End: {event['end_time']}")
        print(f"  Duration: {event['duration_minutes']:.2f} minutes")
        print(f"  Level drop: {event['level_drop']:.2f}L")
        print(f"  Fill rate during drain: {event.get('fill_rate', 'N/A')} L/min")
        print(f"  True volume drained: {event.get('true_volume', 'N/A'):.2f}L" if event.get('true_volume') else "  True volume drained: N/A")
        
        # Show calculation
        if event.get('true_volume') and event.get('fill_rate'):
            level_drop = event['level_drop']
            duration = event['duration_minutes']
            fill_during_drain = event['fill_rate'] * duration
            true_volume = event['true_volume']
            
            print(f"\n  📐 Calculation:")
            print(f"     Level drop: {level_drop:.2f}L")
            print(f"     Fill during drain: {fill_during_drain:.2f}L ({event['fill_rate']:.4f} L/min × {duration:.2f} min)")
            print(f"     True volume = Level drop + Fill during drain")
            print(f"     True volume = {level_drop:.2f}L + {fill_during_drain:.2f}L = {true_volume:.2f}L")
    
    return results


def test_with_real_data():
    """Test with real data from database"""
    print("\n" + "=" * 70)
    print("TEST 4: REAL DATA FROM DATABASE")
    print("=" * 70)
    
    try:
        from backend.database.db import get_db_session
        from backend.api.cached_eog_client import CachedEOGClient
        from backend.api.analysis_service import AnalysisService
        
        db = get_db_session()
        service = AnalysisService(db)
        
        print("\n📥 Fetching real data from database...")
        
        # Get a cauldron
        client = CachedEOGClient(db)
        cauldrons = client.get_cauldrons(use_cache=True)
        
        if not cauldrons:
            print("❌ No cauldrons found in database")
            db.close()
            return
        
        test_cauldron = cauldrons[0]
        print(f"✅ Testing with: {test_cauldron.name} ({test_cauldron.cauldron_id})")
        
        # Get data for last 2 days
        end_date = datetime.now()
        start_date = end_date - timedelta(days=2)
        
        print(f"   Date range: {start_date.date()} to {end_date.date()}")
        
        # Analyze
        print("\n🔄 Running analysis...")
        analysis = service.analyze_cauldron(
            cauldron_id=test_cauldron.cauldron_id,
            start=start_date,
            end=end_date,
            use_cache=True
        )
        
        print("\n" + "=" * 70)
        print("REAL DATA ANALYSIS RESULTS")
        print("=" * 70)
        print(f"Cauldron: {analysis.cauldron_id}")
        print(f"Fill rate: {analysis.fill_rate:.4f} L/min")
        print(f"Number of drains detected: {analysis.num_drains}")
        print(f"Total volume drained: {analysis.total_volume_drained:.2f}L")
        print(f"Average drain volume: {analysis.avg_drain_volume:.2f}L")
        
        if analysis.drain_events:
            print(f"\n--- First 3 Drain Events ---")
            for i, event in enumerate(analysis.drain_events[:3], 1):
                print(f"\nDrain {i}:")
                print(f"  Date: {event.date}")
                print(f"  Time: {event.start_time.strftime('%H:%M')} - {event.end_time.strftime('%H:%M')}")
                print(f"  Duration: {event.duration_minutes:.2f} min")
                print(f"  Level drop: {event.level_drop:.2f}L")
                print(f"  True volume: {event.volume_drained:.2f}L")
                if event.fill_rate:
                    print(f"  Fill rate: {event.fill_rate:.4f} L/min")
                    print(f"  Calculation: {event.level_drop:.2f}L + ({event.fill_rate:.4f} × {event.duration_minutes:.2f}) = {event.volume_drained:.2f}L")
        
        db.close()
        
    except Exception as e:
        print(f"❌ Error testing with real data: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    print("\n" + "🧪" * 35)
    print("DRAIN DETECTION TEST SUITE")
    print("🧪" * 35)
    
    # Test 1: Drain Detection
    events = test_drain_detection()
    
    # Test 2: Rate Calculation
    fill_rate = test_rate_calculation()
    
    # Test 3: Full Analysis
    results = test_full_analysis()
    
    # Test 4: Real Data
    test_with_real_data()
    
    print("\n" + "=" * 70)
    print("✅ ALL TESTS COMPLETE")
    print("=" * 70)
    print("\nReview the calculations above to verify:")
    print("1. Drain events are detected correctly")
    print("2. Fill rate is calculated accurately")
    print("3. True volume accounts for filling during drain")
    print("4. Calculations match expected values")

