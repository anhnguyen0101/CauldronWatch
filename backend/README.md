# CauldronWatch Backend API

Backend API for Person 1 - Backend API & Integration

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Test EOG API Connection

From the project root:
```bash
python run_test.py
```

Or from the backend directory:
```bash
cd backend
python test_eog_connection.py
```

This will test all EOG API endpoints to ensure they're accessible.

### 3. Run the FastAPI Server

From the project root:
```bash
uvicorn backend.api.main:app --reload --port 8000
```

Or using Python directly:
```bash
python -m uvicorn backend.api.main:app --reload --port 8000
```

The API will be available at:
- **API**: http://localhost:8000
- **Docs**: http://localhost:8000/docs (Swagger UI)
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

### Information Endpoints
- `GET /api/cauldrons` - Get all cauldrons
- `GET /api/cauldrons/{cauldron_id}` - Get specific cauldron
- `GET /api/market` - Get market information
- `GET /api/couriers` - Get all couriers
- `GET /api/network` - Get network graph
- `GET /api/graph/neighbors/{node_id}` - Get graph neighbors

### Data Endpoints
- `GET /api/data` - Get historical data
  - Query params: `start`, `end`, `cauldron_id`
- `GET /api/data/metadata` - Get data metadata

### Ticket Endpoints
- `GET /api/tickets` - Get all tickets

### WebSocket
- `WS /ws` - Real-time updates connection

### Health Check
- `GET /health` - Health check endpoint

## Project Structure

```
backend/
├── api/
│   ├── main.py          # FastAPI application
│   ├── eog_client.py    # EOG API client
│   └── websocket.py     # WebSocket handler
├── models/
│   └── schemas.py       # Pydantic data models
├── test_eog_connection.py  # Test script
└── README.md
```

## EOG API Endpoints (External)

The backend connects to these EOG API endpoints:

- `GET /api/Data` - Historical data
- `GET /api/Data/metadata` - Data metadata
- `GET /api/Information/network` - Network info
- `GET /api/Information/market` - Market info
- `GET /api/Information/couriers` - Couriers
- `GET /api/Information/cauldrons` - Cauldrons
- `GET /api/Information/graph/neighbors/{nodeId}` - Undirected neighbors
- `GET /api/Information/graph/neighbors/directed/{nodeId}` - Directed neighbors
- `GET /api/Tickets` - Tickets

## Database Caching

The backend now includes SQLite database caching to:
- Reduce EOG API calls
- Speed up responses
- Store historical data locally

### Initialize Database

```bash
python backend/init_database.py
```

Or the database will be auto-initialized when the FastAPI server starts.

### Test Caching

```bash
python backend/test_cache.py
```

### Cache Location

Database is stored at: `data/cauldronwatch.db`

### Cache TTL

Default cache TTL is 5 minutes. You can adjust this when creating a `CachedEOGClient`:

```python
client = CachedEOGClient(db, cache_ttl_minutes=10)
```

## Analysis Endpoints

The backend now includes data analysis endpoints:

- `GET /api/analysis/cauldrons/{cauldron_id}` - Analyze a specific cauldron
- `GET /api/analysis/cauldrons` - Analyze all cauldrons
- `GET /api/analysis/drains/{cauldron_id}/{date}` - Get daily drain summary (for ticket matching)

See the Swagger UI at http://localhost:8000/docs for full documentation.

## Next Steps

1. ✅ Test API connection
2. ✅ Set up database for caching
3. ✅ Integrate with Person 2's drain detection
4. ⏳ Implement periodic data fetching (background task)
5. ⏳ Add error handling and retry logic
6. ⏳ Integrate with Person 3's ticket matching
7. ⏳ Connect WebSocket to real-time updates

## Notes

- The EOG API base URL is: `https://hackutd2025.eog.systems`
- All responses are JSON
- WebSocket broadcasts updates every 5 seconds (configurable)
- CORS is enabled for localhost:5173 and localhost:3000 (React dev servers)

