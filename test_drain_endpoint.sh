#!/bin/bash
# Quick test script for drain analysis endpoint

CAULDRON_ID="cauldron_001"
DATE="2025-11-09"

echo "Testing: GET /api/analysis/drains/${CAULDRON_ID}/${DATE}"
echo ""

curl -s "http://localhost:8000/api/analysis/drains/${CAULDRON_ID}/${DATE}?use_cache=true" | \
  python3 -m json.tool

echo ""
echo "✅ Test complete!"

