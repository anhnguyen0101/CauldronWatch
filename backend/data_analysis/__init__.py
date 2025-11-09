"""
Data Analysis Module for CauldronWatch

This module provides functionality for:
- Detecting drain events from time series data
- Calculating fill and drain rates
- Analyzing cauldron behavior over time
"""

from .rate_calculator import RateCalculator
from .drain_detector import DrainDetector, DrainEvent
from .analyzer import CauldronAnalyzer

__all__ = [
    'RateCalculator',
    'DrainDetector',
    'DrainEvent',
    'CauldronAnalyzer',
]

