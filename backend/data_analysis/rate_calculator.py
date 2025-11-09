"""
Rate Calculator Module

Calculates fill and drain rates for cauldrons, accounting for
continuous filling during drainage events.
"""

import pandas as pd
import numpy as np
from typing import Dict, Tuple
from scipy.stats import linregress


class RateCalculator:
    """Calculate fill and drain rates for cauldrons"""

    def __init__(self, tolerance: float = 0.1):
        """
        Args:
            tolerance: Minimum rate change to consider (liters/min)
        """
        self.tolerance = tolerance

    def calculate_fill_rate(self, df: pd.DataFrame) -> float:
        """
        Calculate average fill rate during stable filling periods

        Strategy:
        1. Find periods with steady positive slope
        2. Calculate rate using linear regression
        3. Return median rate (robust to outliers)

        Args:
            df: DataFrame with columns ['timestamp', 'level']

        Returns:
            Fill rate in liters/minute
        """
        if df is None or len(df) < 2:
            return 0.0

        # Convert timestamp to minutes from start
        df = df.copy()
        df = df.sort_values('timestamp').reset_index(drop=True)
        df['minutes'] = (df['timestamp'] - df['timestamp'].iloc[0]).dt.total_seconds() / 60

        # Calculate rolling derivative (rate of change)
        window = 5  # 5-minute window
        df['rate'] = df['level'].diff() / df['minutes'].diff().replace(0, np.nan)

        # Filter for positive rates (filling periods)
        # Exclude very high rates (those are drains in reverse)
        # Also exclude negative rates and NaN values
        filling_rates = df[
            (df['rate'] > self.tolerance) &
            (df['rate'] < 10) &  # Adjust threshold based on data
            (df['rate'].notna())
        ]

        if len(filling_rates) < 10:
            # Not enough data, use simple linear regression on all data
            try:
                # Filter out NaN values for regression
                valid_data = df[df['minutes'].notna() & df['level'].notna()]
                if len(valid_data) < 2:
                    return 0.0

                slope, _, _, _, _ = linregress(valid_data['minutes'], valid_data['level'])
                return max(0, slope)
            except Exception:
                # Fallback: use median of positive differences
                positive_diffs = df[df['level'].diff() > 0]['level'].diff()
                if len(positive_diffs) > 0:
                    return positive_diffs.median() / df['minutes'].diff().median() if df['minutes'].diff().median() > 0 else 0.0
                return 0.0

        # Return median fill rate (robust to outliers)
        median_rate = filling_rates['rate'].median()
        return max(0, median_rate) if not pd.isna(median_rate) else 0.0

    def calculate_drain_rate(self,
                            start_level: float,
                            end_level: float,
                            duration_minutes: float) -> float:
        """
        Calculate drain rate for a specific drain event

        This is the OBSERVED drain rate (level drop / time)
        NOT the true volume drained (which includes filling)

        Args:
            start_level: Level at drain start (liters)
            end_level: Level at drain end (liters)
            duration_minutes: Time taken (minutes)

        Returns:
            Observed drain rate in liters/minute (negative value)
        """
        if duration_minutes == 0:
            return 0

        return (end_level - start_level) / duration_minutes

    def calculate_true_drain_volume(self,
                                   start_level: float,
                                   end_level: float,
                                   duration_minutes: float,
                                   fill_rate: float) -> float:
        """
        🔑 CRITICAL FUNCTION - Accounts for filling during drainage!

        Total drained = Level drop + Potion added during drain

        Example:
        - Start: 100L, End: 60L → Dropped 40L
        - Drain took 10 minutes
        - Fill rate is 2 L/min
        - Filled during drain: 2 * 10 = 20L
        - TRUE drain volume: 40 + 20 = 60L

        Args:
            start_level: Level at drain start
            end_level: Level at drain end
            duration_minutes: Drain duration
            fill_rate: Cauldron fill rate (L/min)

        Returns:
            True volume drained (liters)
        """
        level_drop = start_level - end_level
        potion_added_during_drain = fill_rate * duration_minutes

        return level_drop + potion_added_during_drain

