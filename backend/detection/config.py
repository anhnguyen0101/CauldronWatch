# Matching tolerances (what counts as "valid")
TOL_PCT: float = 0.20     # 20% of basis
TOL_ABS: float = 12.0     # 12 L absolute

# Severity split once a diff is beyond tolerance
WARN_PCT: float = 0.30    # ≤30% off => warning; >30% => critical
