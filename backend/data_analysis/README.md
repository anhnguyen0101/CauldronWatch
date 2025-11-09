# Data Analysis Module (Integrated into Backend)

This module is now integrated into the CauldronWatch backend system.

## Location

The module is located at: `backend/data_analysis/`

## Usage

### Via API Endpoints

The analysis functionality is exposed through REST API endpoints:

#### Analyze a Single Cauldron
```
GET /api/analysis/cauldrons/{cauldron_id}
```
Query parameters:
- `start` (optional): Start datetime for data range
- `end` (optional): End datetime for data range
- `use_cache` (optional, default: true): Use cached data

#### Analyze All Cauldrons
```
GET /api/analysis/cauldrons
```
Query parameters:
- `start` (optional): Start datetime for data range
- `end` (optional): End datetime for data range
- `use_cache` (optional, default: true): Use cached data

#### Get Daily Drain Summary (for Ticket Matching)
```
GET /api/analysis/drains/{cauldron_id}/{date}
```
Where `date` is in YYYY-MM-DD format.

### Via Python Code

```python
from backend.data_analysis.analyzer import CauldronAnalyzer
import pandas as pd

# Create analyzer
analyzer = CauldronAnalyzer()

# Analyze cauldron data
df = pd.DataFrame({
    'timestamp': [...],  # datetime objects
    'level': [...]       # float values
})

results = analyzer.analyze_cauldron(df, cauldron_id='C001')
```

## Integration with Backend

The analysis service (`backend/api/analysis_service.py`) bridges the API and analysis modules:

1. Fetches historical data from EOG API (via `CachedEOGClient`)
2. Converts data to pandas DataFrame
3. Runs analysis using `CauldronAnalyzer`
4. Converts results to Pydantic DTOs for API responses

## API Response Models

- `CauldronAnalysisDto`: Analysis results for a cauldron
- `DrainEventDto`: Individual drain event information
- `DailyDrainSummaryDto`: Daily summary for ticket matching

See `backend/models/schemas.py` for full model definitions.

## Key Features

- ✅ Fill rate calculation
- ✅ Drain event detection
- ✅ True volume calculation (accounts for filling during drainage)
- ✅ Daily summaries for ticket matching
- ✅ Caching for performance
- ✅ Error handling

## Testing

To test the integration:

1. Start the backend server:
```bash
uvicorn backend.api.main:app --reload --port 8000
```

2. Visit Swagger UI: http://localhost:8000/docs

3. Test the analysis endpoints:
- `GET /api/analysis/cauldrons/{cauldron_id}` - Analyze a cauldron
- `GET /api/analysis/drains/{cauldron_id}/{date}` - Get daily summary

## Notes

- The module uses relative imports within the backend package
- All analysis results are cached per cauldron for performance
- The service automatically handles data format conversion
- Error handling is built-in and returns error messages in responses

