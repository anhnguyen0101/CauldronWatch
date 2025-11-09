"""
Cauldron Analyzer Module

Main analysis pipeline that orchestrates drain detection and rate calculation.
"""

import pandas as pd
from typing import Dict, List, Optional
from datetime import datetime, date
from .drain_detector import DrainDetector, DrainEvent
from .rate_calculator import RateCalculator


class CauldronAnalyzer:
    """Main analysis pipeline - orchestrates detection and calculation"""

    def __init__(self, 
                 min_drop: float = 5.0,
                 max_duration_minutes: int = 120,
                 detection_method: str = 'derivative',
                 drain_threshold: float = -8.0):
        """
        Initialize the analyzer with detection parameters

        Args:
            min_drop: Minimum level drop to consider a drain (liters)
            max_duration_minutes: Maximum time for a drain event
            detection_method: 'derivative' or 'threshold'
            drain_threshold: Rate threshold for drain detection (L/min)
        """
        self.rate_calc = RateCalculator()
        self.drain_detector = DrainDetector(
            min_drop=min_drop,
            max_duration_minutes=max_duration_minutes,
            detection_method=detection_method,
            drain_threshold=drain_threshold
        )
        self.cauldron_stats = {}  # Cache fill rates per cauldron

    def analyze_cauldron(self,
                        historical_data: pd.DataFrame,
                        cauldron_id: str) -> Dict:
        """
        Complete analysis for one cauldron

        Args:
            historical_data: DataFrame with ['timestamp', 'level']
            cauldron_id: Cauldron identifier

        Returns:
            Dict with fill_rate, drain_events, and statistics
        """
        try:
            # Ensure data is in correct format
            if historical_data is None or len(historical_data) == 0:
                return {
                    'cauldron_id': cauldron_id,
                    'error': 'No data provided',
                    'fill_rate': 0.0,
                    'num_drains': 0,
                    'total_volume_drained': 0.0,
                    'avg_drain_volume': 0.0,
                    'drain_events': []
                }

            # Ensure timestamp column exists and is datetime
            if 'timestamp' not in historical_data.columns:
                raise ValueError("DataFrame must have 'timestamp' column")
            if 'level' not in historical_data.columns:
                raise ValueError("DataFrame must have 'level' column")

            # Step 1: Calculate fill rate
            fill_rate = self.rate_calc.calculate_fill_rate(historical_data)

            # Step 2: Detect drain events
            drains = self.drain_detector.detect_drains(historical_data, cauldron_id)
            # Fallback: if none found, try a more permissive second pass
            if not drains:
                print(f"[Analyzer] No drains for {cauldron_id} with strict params; retrying with relaxed thresholds...")
                original = self.drain_detector
                try:
                    self.drain_detector = DrainDetector(
                        min_drop=max(2.0, getattr(original, "min_drop", 5.0) / 2),
                        max_duration_minutes=max(180, getattr(original, "max_duration_minutes", 120)),
                        detection_method='derivative',
                        drain_threshold=-0.3
                    )
                    drains = self.drain_detector.detect_drains(historical_data, cauldron_id)
                finally:
                    self.drain_detector = original
            # Step 3: Calculate true volumes for each drain
            for drain in drains:
                drain.true_volume = self.rate_calc.calculate_true_drain_volume(
                    start_level=drain.start_level,
                    end_level=drain.end_level,
                    duration_minutes=drain.duration_minutes,
                    fill_rate=fill_rate
                )
                # Also store fill_rate on drain event for compatibility
                drain.fill_rate = fill_rate

            # Step 4: Compile statistics
            total_volume = sum(d.true_volume for d in drains if d.true_volume is not None)
            avg_volume = total_volume / len(drains) if drains else 0.0

            stats = {
                'cauldron_id': cauldron_id,
                'fill_rate': float(fill_rate),
                'num_drains': len(drains),
                'total_volume_drained': float(total_volume),
                'avg_drain_volume': float(avg_volume),
                'drain_events': [d.to_dict() for d in drains]
            }

            # Cache for later use
            self.cauldron_stats[cauldron_id] = stats

            return stats

        except Exception as e:
            error_msg = f"Error analyzing {cauldron_id}: {str(e)}"
            print(error_msg)
            return {
                'cauldron_id': cauldron_id,
                'error': error_msg,
                'fill_rate': 0.0,
                'num_drains': 0,
                'total_volume_drained': 0.0,
                'avg_drain_volume': 0.0,
                'drain_events': []
            }

    def analyze_all_cauldrons(self,
                             cauldron_data: Dict[str, pd.DataFrame]) -> Dict:
        """
        Analyze all cauldrons at once

        Args:
            cauldron_data: Dict mapping cauldron_id -> DataFrame

        Returns:
            Dict mapping cauldron_id -> analysis results
        """
        results = {}

        for cauldron_id, df in cauldron_data.items():
            results[cauldron_id] = self.analyze_cauldron(df, cauldron_id)

        return results

    def get_drains_by_date(self, cauldron_id: str, target_date: str) -> List[Dict]:
        """
        Get all drains for a specific cauldron on a specific date

        Critical for ticket matching (Person 3 needs this!)

        Args:
            cauldron_id: Cauldron identifier
            target_date: Date string (YYYY-MM-DD) or date object

        Returns:
            List of drain event dictionaries for that date
        """
        if cauldron_id not in self.cauldron_stats:
            return []

        drains = self.cauldron_stats[cauldron_id]['drain_events']

        # Convert target_date to date object if string
        if isinstance(target_date, str):
            target_date = pd.to_datetime(target_date).date()
        elif isinstance(target_date, datetime):
            target_date = target_date.date()

        # Filter drains by date
        matching_drains = []
        for drain in drains:
            drain_date = pd.to_datetime(drain['start_time']).date()
            if drain_date == target_date:
                matching_drains.append(drain)

        return matching_drains

    def get_daily_drain_summary(self, cauldron_id: str, target_date: str) -> Dict:
        """
        Get summary of all drains for a specific cauldron on a specific date

        This is what Person 3 (Ticket Matcher) needs for matching!

        Args:
            cauldron_id: Cauldron identifier
            target_date: Date string (YYYY-MM-DD)

        Returns:
            Dict with summary statistics:
            {
                'cauldron_id': 'C001',
                'date': '2025-01-15',
                'total_volume_drained': 245.8,
                'num_drains': 3,
                'drain_events': [...]
            }
        """
        drains = self.get_drains_by_date(cauldron_id, target_date)

        total_volume = sum(d.get('true_volume', 0) for d in drains if d.get('true_volume'))

        return {
            'cauldron_id': cauldron_id,
            'date': str(target_date) if not isinstance(target_date, str) else target_date,
            'total_volume_drained': float(total_volume),
            'num_drains': len(drains),
            'drain_events': drains
        }

    def get_fill_rate(self, cauldron_id: str) -> Optional[float]:
        """
        Get cached fill rate for a cauldron

        Args:
            cauldron_id: Cauldron identifier

        Returns:
            Fill rate in L/min, or None if not analyzed
        """
        if cauldron_id in self.cauldron_stats:
            return self.cauldron_stats[cauldron_id].get('fill_rate')
        return None

    def clear_cache(self):
        """Clear the cached cauldron statistics"""
        self.cauldron_stats = {}

