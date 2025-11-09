"""
Drain Detector Module

Detects drain events from time series cauldron level data.
"""

import pandas as pd
import numpy as np
from typing import List, Dict, Tuple
from datetime import datetime, timedelta


class DrainEvent:
    """Represents a detected drain event"""

    def __init__(self,
                 start_time: datetime,
                 end_time: datetime,
                 start_level: float,
                 end_level: float,
                 cauldron_id: str):
        self.start_time = start_time
        self.end_time = end_time
        self.start_level = start_level
        self.end_level = end_level
        self.cauldron_id = cauldron_id

        # Calculated fields
        self.duration_minutes = (end_time - start_time).total_seconds() / 60
        self.level_drop = start_level - end_level
        self.true_volume = None  # Set by rate_calculator
        self.fill_rate = None  # Set by analyzer (fill rate at time of drain)

    def to_dict(self) -> Dict:
        start_iso = self.start_time.isoformat() if isinstance(self.start_time, datetime) else str(self.start_time)
        end_iso = self.end_time.isoformat() if isinstance(self.end_time, datetime) else str(self.end_time)
        date_str = (
            self.start_time.date().strftime('%Y-%m-%d')
            if isinstance(self.start_time, datetime)
            else pd.to_datetime(self.start_time).date().strftime('%Y-%m-%d')
        )

        return {
            'cauldron_id': self.cauldron_id,
            'start_time': start_iso,
            'end_time': end_iso,
            'start_level': float(self.start_level),
            'end_level': float(self.end_level),
            'duration_minutes': float(self.duration_minutes),
            'level_drop': float(self.level_drop),
            'true_volume': float(self.true_volume) if self.true_volume is not None else None,
            'volume_drained': float(self.true_volume) if self.true_volume is not None else None,
            'fill_rate': float(self.fill_rate) if self.fill_rate is not None else None,
            'date': date_str,  # ← STRING, not datetime.date
        }


class DrainDetector:
    """Detect drain events from time series level data"""

    def __init__(self,
                 min_drop: float = 10.0,
                 max_duration_minutes: int = 30,
                 detection_method: str = 'derivative',
                 drain_threshold: float = -2.0):
        """
        Args:
            min_drop: Minimum level drop to consider a drain (liters)
            max_duration_minutes: Maximum time for a drain event
            detection_method: 'derivative' or 'threshold'
            drain_threshold: Rate threshold for drain detection (L/min, negative = draining)
        """
        self.min_drop = min_drop
        self.max_duration_minutes = max_duration_minutes
        self.detection_method = detection_method
        self.drain_threshold = drain_threshold

    def detect_drains(self, df: pd.DataFrame, cauldron_id: str) -> List[DrainEvent]:
        """
        Main detection algorithm - finds all drain events

        Strategy:
        1. Calculate rate of change (derivative)
        2. Find periods with large negative rate
        3. Group consecutive negative points into drain events
        4. Validate each event (minimum drop, reasonable duration)

        Args:
            df: DataFrame with columns ['timestamp', 'level']
            cauldron_id: ID of the cauldron

        Returns:
            List of DrainEvent objects
        """
        if df is None or len(df) < 2:
            return []

        # Ensure timestamp is datetime
        df = df.copy()
        if not pd.api.types.is_datetime64_any_dtype(df['timestamp']):
            df['timestamp'] = pd.to_datetime(df['timestamp'])

        df = df.sort_values('timestamp').reset_index(drop=True)

        # Remove duplicate timestamps
        df = df.drop_duplicates(subset=['timestamp']).reset_index(drop=True)

        if self.detection_method == 'derivative':
            return self._detect_by_derivative(df, cauldron_id)
        else:
            return self._detect_by_threshold(df, cauldron_id)

    def _detect_by_derivative(self, df: pd.DataFrame, cauldron_id: str) -> List[DrainEvent]:
        """
        Derivative-based detection (RECOMMENDED)

        Finds sharp downward slopes in the level data
        """
        if len(df) < 2:
            return []

        # Calculate time differences (in minutes)
        df['time_diff'] = df['timestamp'].diff().dt.total_seconds() / 60
        df['level_diff'] = df['level'].diff()
        
        # Calculate rate of change (L/min)
        df['rate'] = df['level_diff'] / df['time_diff'].replace(0, np.nan)

        # Mark drain points (negative rate below threshold)
        df['is_draining'] = df['rate'] < self.drain_threshold

        # Find drain event boundaries
        drains = []
        in_drain = False
        drain_start_idx = None

        for idx in df.index:
            row = df.loc[idx]
            
            if pd.isna(row['is_draining']):
                continue

            if row['is_draining'] and not in_drain:
                # Drain starts
                drain_start_idx = idx
                in_drain = True
            elif not row['is_draining'] and in_drain:
                # Drain ends
                drain_end_idx = idx - 1
                if drain_end_idx >= drain_start_idx:
                    drains.append((drain_start_idx, drain_end_idx))
                in_drain = False

        # Handle case where drain continues to end of data
        if in_drain and drain_start_idx is not None:
            drains.append((drain_start_idx, len(df) - 1))

        # Convert to DrainEvent objects
        events = []
        for start_idx, end_idx in drains:
            if start_idx >= len(df) or end_idx >= len(df):
                continue

            start_row = df.iloc[start_idx]
            end_row = df.iloc[end_idx]

            # Validate event
            level_drop = start_row['level'] - end_row['level']
            duration = (end_row['timestamp'] - start_row['timestamp']).total_seconds() / 60

            # Check minimum drop and reasonable duration
            if level_drop >= self.min_drop and 0 < duration <= self.max_duration_minutes:
                event = DrainEvent(
                    start_time=start_row['timestamp'],
                    end_time=end_row['timestamp'],
                    start_level=start_row['level'],
                    end_level=end_row['level'],
                    cauldron_id=cauldron_id
                )
                events.append(event)

        return events

    def _detect_by_threshold(self, df: pd.DataFrame, cauldron_id: str) -> List[DrainEvent]:
        """
        Alternative: Threshold-based detection

        Looks for any significant level drop over a short period
        """
        events = []
        window_size = 15  # Look at 15-minute windows
        processed_ranges = set()  # Avoid duplicate detections

        for i in range(len(df) - window_size):
            window = df.iloc[i:i+window_size]
            
            # Calculate time span of window
            time_span = (window['timestamp'].iloc[-1] - window['timestamp'].iloc[0]).total_seconds() / 60
            
            # Skip if window is too short or too long
            if time_span < 1 or time_span > 60:
                continue

            level_drop = window['level'].iloc[0] - window['level'].iloc[-1]

            if level_drop >= self.min_drop:
                # Check if this range overlaps with already detected drains
                range_key = (window['timestamp'].iloc[0], window['timestamp'].iloc[-1])
                if range_key in processed_ranges:
                    continue
                processed_ranges.add(range_key)

                # Found a potential drain
                event = DrainEvent(
                    start_time=window['timestamp'].iloc[0],
                    end_time=window['timestamp'].iloc[-1],
                    start_level=window['level'].iloc[0],
                    end_level=window['level'].iloc[-1],
                    cauldron_id=cauldron_id
                )
                events.append(event)

                # Skip ahead to avoid detecting same drain multiple times
                i += window_size - 1

        return events

