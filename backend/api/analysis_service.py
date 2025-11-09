"""
Analysis Service

Bridges the backend API with the data analysis module.
Converts API data formats to analysis formats and vice versa.
"""

import pandas as pd
from typing import List, Dict, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from backend.api.cached_eog_client import CachedEOGClient
from backend.data_analysis.analyzer import CauldronAnalyzer
from backend.models.schemas import (
    HistoricalDataDto,
    CauldronAnalysisDto,
    DrainEventDto,
    DailyDrainSummaryDto
)

class AnalysisService:
    """Service for analyzing cauldron data"""

    def __init__(self, db: Session):
        self.db = db
        self.eog_client = CachedEOGClient(db)
        self.analyzer = CauldronAnalyzer()

    def _convert_to_dataframe(self, historical_data: List[HistoricalDataDto]) -> pd.DataFrame:
        """
        Convert list of HistoricalDataDto to pandas DataFrame

        Args:
            historical_data: List of HistoricalDataDto objects

        Returns:
            DataFrame with columns ['timestamp', 'level']
        """
        if not historical_data:
            return pd.DataFrame(columns=['timestamp', 'level'])

        data = [
            {
                'timestamp': item.timestamp,
                'level': item.level
            }
            for item in historical_data
        ]

        df = pd.DataFrame(data)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        return df.sort_values('timestamp').reset_index(drop=True)

    def analyze_cauldron(self,
                        cauldron_id: str,
                        start: Optional[datetime] = None,
                        end: Optional[datetime] = None,
                        use_cache: bool = True) -> CauldronAnalysisDto:
        """
        Analyze a single cauldron

        Args:
            cauldron_id: Cauldron identifier
            start: Start datetime for data range
            end: End datetime for data range
            use_cache: Use cached data

        Returns:
            CauldronAnalysisDto with analysis results
        """
        # Fetch historical data
        historical_data = self.eog_client.get_data(
            start_date=start,
            end_date=end,
            cauldron_id=cauldron_id,
            use_cache=use_cache
        )

        # Convert to DataFrame
        df = self._convert_to_dataframe(historical_data)
        df = self._slice_df(df, start, end)
        # Analyze
        results = self.analyzer.analyze_cauldron(df, cauldron_id)

        # Convert to DTO
        return self._convert_analysis_to_dto(results)

    def analyze_all_cauldrons(self,
                             start: Optional[datetime] = None,
                             end: Optional[datetime] = None,
                             use_cache: bool = True) -> Dict[str, CauldronAnalysisDto]:
        """
        Analyze all cauldrons

        Args:
            start: Start datetime for data range
            end: End datetime for data range
            use_cache: Use cached data

        Returns:
            Dict mapping cauldron_id -> CauldronAnalysisDto
        """
        # Get all cauldrons
        cauldrons = self.eog_client.get_cauldrons(use_cache=use_cache)

        # Get historical data for all cauldrons
        all_data = self.eog_client.get_data(
            start_date=start,
            end_date=end,
            cauldron_id=None,  # Get all cauldrons
            use_cache=use_cache
        )

        # Group by cauldron_id
        cauldron_data = {}
        for item in all_data:
            if item.cauldron_id not in cauldron_data:
                cauldron_data[item.cauldron_id] = []
            cauldron_data[item.cauldron_id].append(item)

        # Convert to DataFrames and analyze
        results = {}
        for cauldron_id, data_list in cauldron_data.items():
            df = self._convert_to_dataframe(data_list)
            df = self._slice_df(df, start, end) 
            analysis_result = self.analyzer.analyze_cauldron(df, cauldron_id)
            results[cauldron_id] = self._convert_analysis_to_dto(analysis_result)

        return results

    def get_daily_drain_summary(self,
                                cauldron_id: str,
                                date: str,
                                use_cache: bool = True) -> DailyDrainSummaryDto:
        """
        Get daily drain summary for a cauldron

        Args:
            cauldron_id: Cauldron identifier
            date: Date string (YYYY-MM-DD)
            use_cache: Use cached data

        Returns:
            DailyDrainSummaryDto with daily summary
        """
        # First, analyze the cauldron if not already analyzed
        # Get data for the date range (full day)
        from datetime import time
        # Handle both date strings (YYYY-MM-DD) and datetime strings
        # Normalize date format - extract just the date part if datetime provided
        if 'T' in date or len(date) > 10:
            # It's a datetime string, extract just the date part
            date_str = date.split('T')[0] if 'T' in date else date[:10]
        else:
            date_str = date
        
        try:
            date_obj = pd.to_datetime(date_str).date()
        except Exception as e:
            # Fallback: try to parse as-is
            date_obj = pd.to_datetime(date).date()
            date_str = date_obj.strftime('%Y-%m-%d')
        
        start = datetime.combine(date_obj, time.min)
        end = datetime.combine(date_obj, time.max)

        # Analyze cauldron for this date range
        analysis = self.analyze_cauldron(
            cauldron_id=cauldron_id,
            start=start,
            end=end,
            use_cache=use_cache
        )

        # Filter drain events to only those on the target date
        # The analysis already has all drains for the date range, so we just filter by date
        target_date_obj = pd.to_datetime(date_str).date()
        drains_for_date = [
            d for d in analysis.drain_events
            if pd.to_datetime(d.start_time).date() == target_date_obj
        ]
        
        # Calculate totals for this date
        total_volume = sum(
            (d.true_volume if d.true_volume is not None else d.volume_drained or 0)
            for d in drains_for_date
        )

        # Convert to DTO directly from analysis results
        return DailyDrainSummaryDto(
            cauldron_id=cauldron_id,
            date=date_str,
            total_volume_drained=float(total_volume),
            num_drains=len(drains_for_date),
            drain_events=[
                self._convert_drain_event_to_dto(d) for d in drains_for_date
            ]
        )

    def _convert_analysis_to_dto(self, analysis_result: Dict) -> CauldronAnalysisDto:
        """Convert analysis result dict to CauldronAnalysisDto"""
        return CauldronAnalysisDto(
            cauldron_id=analysis_result['cauldron_id'],
            fill_rate=analysis_result['fill_rate'],
            num_drains=analysis_result['num_drains'],
            total_volume_drained=analysis_result['total_volume_drained'],
            avg_drain_volume=analysis_result['avg_drain_volume'],
            drain_events=[
                self._convert_drain_event_to_dto(d) for d in analysis_result['drain_events']
            ],
            error=analysis_result.get('error')
        )

    def _convert_drain_event_to_dto(self, drain_event: Dict) -> DrainEventDto:
        """Convert drain event dict to DrainEventDto"""
        true_volume = drain_event.get('true_volume')
        # Ensure both volume_drained and true_volume are set for compatibility
        volume_drained = true_volume if true_volume is not None else drain_event.get('volume_drained')
        
        return DrainEventDto(
            cauldron_id=drain_event['cauldron_id'],
            start_time=pd.to_datetime(drain_event['start_time']),
            end_time=pd.to_datetime(drain_event['end_time']),
            start_level=drain_event['start_level'],
            end_level=drain_event['end_level'],
            duration_minutes=drain_event['duration_minutes'],
            level_drop=drain_event['level_drop'],
            true_volume=true_volume,
            volume_drained=volume_drained,
            fill_rate=drain_event.get('fill_rate'),  # Populated from analysis
            date=drain_event.get('date', pd.to_datetime(drain_event['start_time']).strftime('%Y-%m-%d'))
        )
    def _slice_df(self, df: pd.DataFrame, start: Optional[datetime], end: Optional[datetime]) -> pd.DataFrame:
        if df is None or df.empty:
            return df
        df = df.copy()
        
        # Ensure timestamp column is timezone-aware or timezone-naive consistently
        if 'timestamp' in df.columns:
            # Check if timestamps are timezone-aware
            if pd.api.types.is_datetime64_any_dtype(df['timestamp']):
                # If timezone-aware, convert to UTC then remove timezone for comparison
                if df['timestamp'].dt.tz is not None:
                    df['timestamp'] = df['timestamp'].dt.tz_convert('UTC').dt.tz_localize(None)
                # Ensure it's a datetime64[ns] type
                df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # Normalize start/end to same timezone-naive format
        if start:
            start_ts = pd.to_datetime(start)
            # If timezone-aware, convert to UTC then remove timezone
            if hasattr(start_ts, 'tz') and start_ts.tz is not None:
                start_ts = start_ts.tz_convert('UTC').tz_localize(None)
            elif isinstance(start_ts, pd.Timestamp) and start_ts.tz is not None:
                start_ts = start_ts.tz_convert('UTC').tz_localize(None)
            df = df[df['timestamp'] >= start_ts]
        
        if end:
            end_ts = pd.to_datetime(end)
            # If timezone-aware, convert to UTC then remove timezone
            if hasattr(end_ts, 'tz') and end_ts.tz is not None:
                end_ts = end_ts.tz_convert('UTC').tz_localize(None)
            elif isinstance(end_ts, pd.Timestamp) and end_ts.tz is not None:
                end_ts = end_ts.tz_convert('UTC').tz_localize(None)
            df = df[df['timestamp'] <= end_ts]
        
        return df
