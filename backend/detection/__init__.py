"""
Person 3: Ticket Matching & Discrepancy Detection
"""
from .ticket_matcher import match_tickets_to_drains, Ticket, DrainEvent, MatchResult
from .discrepancy import classify, confidence
from .config import TOL_ABS, TOL_PCT

__all__ = [
    'match_tickets_to_drains',
    'Ticket',
    'DrainEvent',
    'MatchResult',
    'classify',
    'confidence',
    'TOL_ABS',
    'TOL_PCT',
]

