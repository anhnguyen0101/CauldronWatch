# API Documentation for Person 2 & Person 3

## 🚀 Quick Start

The backend API is running at: **http://localhost:8000**

### Start the Server

```bash
# From project root
uvicorn backend.api.main:app --reload --port 8000

# Or use the script
./start_server.sh
```

### API Documentation (Swagger UI)

Visit: **http://localhost:8000/docs** for interactive API documentation

---

## 📊 Endpoints for Person 2 (Data Analysis & Drain Detection)

### Get All Cauldrons
```bash
GET /api/cauldrons
```
Returns: List of all cauldrons with locations, capacities, etc.

**Example:**
```python
import requests
response = requests.get("http://localhost:8000/api/cauldrons")
cauldrons = response.json()
```

### Get Historical Data
```bash
GET /api/data?cauldron_id={id}&start={start_date}&end={end_date}
```

**Parameters:**
- `cauldron_id` (optional): Filter by specific cauldron
- `start` (optional): Start date (ISO format)
- `end` (optional): End date (ISO format)
- `use_cache` (optional, default: true): Use cached data

**Example:**
```python
# Get all historical data
response = requests.get("http://localhost:8000/api/data")

# Get data for specific cauldron
response = requests.get("http://localhost:8000/api/data?cauldron_id=cauldron_001")

# Get data for date range
response = requests.get(
    "http://localhost:8000/api/data",
    params={
        "start": "2025-10-30T00:00:00Z",
        "end": "2025-11-01T23:59:59Z",
        "cauldron_id": "cauldron_001"
    }
)
data = response.json()
# Returns: [{"cauldron_id": "...", "timestamp": "...", "level": 123.45}, ...]
```

### Get Latest Levels
```bash
GET /api/data/latest
```
Returns: Latest level for each cauldron (useful for real-time monitoring)

**Example:**
```python
response = requests.get("http://localhost:8000/api/data/latest")
latest_levels = response.json()
```

### Get Data Metadata
```bash
GET /api/data/metadata
```
Returns: Information about available data (date range, interval, etc.)

---

## 🎫 Endpoints for Person 3 (Ticket Matching & Discrepancy Detection)

### Get All Tickets
```bash
GET /api/tickets
```

**Example:**
```python
response = requests.get("http://localhost:8000/api/tickets")
tickets_data = response.json()
# Returns: {
#   "transport_tickets": [...],
#   "metadata": {...}
# }
```

**Ticket Structure:**
```json
{
  "ticket_id": "TT_20251030_001",
  "cauldron_id": "cauldron_012",
  "date": "2025-10-30",
  "amount_collected": 94.37,
  "courier_id": "courier_witch_01"
}
```

### Get Historical Data (for matching)
```bash
GET /api/data?start={date}&end={date}
```
Use this to get drain events for a specific date to match against tickets.

**Example - Get data for a specific date:**
```python
# Get all data for Oct 30, 2025
response = requests.get(
    "http://localhost:8000/api/data",
    params={
        "start": "2025-10-30T00:00:00Z",
        "end": "2025-10-30T23:59:59Z"
    }
)
oct_30_data = response.json()
```

### Get Cauldron by ID
```bash
GET /api/cauldrons/{cauldron_id}
```

**Example:**
```python
response = requests.get("http://localhost:8000/api/cauldrons/cauldron_001")
cauldron = response.json()
```

---

## 🔄 WebSocket for Real-Time Updates

### Connect to WebSocket
```javascript
// Frontend example
const ws = new WebSocket('ws://localhost:8000/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'cauldron_update') {
    // Handle cauldron level updates
    console.log('Updated cauldrons:', data.data.cauldrons);
  }
};
```

**Message Types:**
- `connected` - Connection established
- `cauldron_update` - Latest cauldron levels
- `drain_event` - Drain event detected (when Person 2 integrates)
- `discrepancy` - Discrepancy alert (when Person 3 integrates)

---

## 📝 Data Models

### CauldronDto
```json
{
  "id": "cauldron_001",
  "cauldron_id": "cauldron_001",  // Alias for id
  "name": "Crimson Brew Cauldron",
  "latitude": 33.2148,
  "longitude": -97.1331,
  "max_volume": 1000.0,
  "capacity": 1000.0  // Alias for max_volume
}
```

### HistoricalDataDto
```json
{
  "cauldron_id": "cauldron_001",
  "timestamp": "2025-10-30T00:00:00+00:00",
  "level": 226.98,
  "fill_rate": null  // Optional
}
```

### TicketDto
```json
{
  "ticket_id": "TT_20251030_001",
  "cauldron_id": "cauldron_012",
  "date": "2025-10-30",
  "amount_collected": 94.37,
  "volume": 94.37,  // Alias for amount_collected
  "courier_id": "courier_witch_01"
}
```

---

## 🛠️ Python Client Example

```python
import requests
from datetime import datetime

BASE_URL = "http://localhost:8000"

# Get all cauldrons
cauldrons = requests.get(f"{BASE_URL}/api/cauldrons").json()

# Get historical data for analysis
start_date = datetime(2025, 10, 30)
end_date = datetime(2025, 11, 1)
data = requests.get(
    f"{BASE_URL}/api/data",
    params={
        "start": start_date.isoformat(),
        "end": end_date.isoformat()
    }
).json()

# Get tickets for matching
tickets = requests.get(f"{BASE_URL}/api/tickets").json()
```

---

## ⚠️ Important Notes for Person 2 & 3

### For Person 2 (Drain Detection):
1. Use `/api/data` to get historical time series
2. Data is cached - first call may be slower, subsequent calls are fast
3. Data points are at 1-minute intervals
4. Each record has: `cauldron_id`, `timestamp`, `level`
5. Remember: Potion continues filling DURING drainage!

### For Person 3 (Ticket Matching):
1. Tickets have `date` only (YYYY-MM-DD format)
2. Historical data has `timestamp` (full datetime)
3. Group drains by date to match against tickets
4. Use `amount_collected` field from tickets (same as `volume`)
5. Tickets may change during judging - always fetch fresh!

---

## 🐛 Troubleshooting

### Server not starting?
```bash
# Check if port 8000 is in use
lsof -i :8000

# Install dependencies
pip install -r requirements.txt
```

### API returns empty data?
- Check if EOG API is accessible: `python run_test.py`
- Check database is initialized: `python backend/init_database.py`

### Caching issues?
- Add `?use_cache=false` to bypass cache
- Cache TTL is 5 minutes by default

---

## 📞 Need Help?

- Check Swagger UI: http://localhost:8000/docs
- Check backend README: `backend/README.md`
- Ask Person 1 (Tom) for API questions

---

**Last Updated:** When Person 1 pushes the code
**API Version:** 1.0.0

