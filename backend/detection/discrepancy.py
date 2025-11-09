# backend/detection/discrepancy.py
from .config import TOL_ABS, TOL_PCT

def classify(diff: float, drained_sum: float, *, cross_day=False) -> str:
    """
    diff = ticket_volume - actual_drained
    drained_sum = actual_drained
    """
    base_ok = abs(diff) <= max(TOL_ABS, TOL_PCT * max(drained_sum, 1.0))
    if base_ok:
        return "cross_day_valid" if cross_day else "valid"
    if diff > 0:
        return "cross_day_suspicious_over" if cross_day else "suspicious_over"
    return "cross_day_suspicious_under" if cross_day else "suspicious_under"

def confidence(diff: float, denom: float, bundle_size: int) -> float:
    pct = abs(diff) / max(denom, 1.0)
    return max(0.0, min(1.0, 1.0 - pct - 0.05 * max(0, bundle_size - 1)))
