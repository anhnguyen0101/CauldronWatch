# Testing Person 2 & Person 3 in Swagger (localhost:8000/docs)

## Prerequisites
1. Backend server is running: `uvicorn backend.api.main:app --reload`
2. Database is populated: `python backend/populate_database.py` (if not already done)
3. Open Swagger UI: http://localhost:8000/docs

---

## 🧪 Person 2: Drain Detection Testing

### Test 1: Analyze Single Cauldron
**Endpoint:** `GET /api/analysis/cauldrons/{cauldron_id}`

**Steps:**
1. Find the endpoint in Swagger
2. Click "Try it out"
3. Enter parameters:
   - `cauldron_id`: `cauldron_001` (or any valid cauldron ID)
   - `start`: Leave empty OR use format: `2025-11-08T00:00:00`
   - `end`: Leave empty OR use format: `2025-11-09T23:59:59`
   - `use_cache`: `true` (default)
4. Click "Execute"

**Expected Response:**
```json
{
  "cauldron_id": "cauldron_001",
  "fill_rate": 12.5,
  "num_drains": 3,
  "drain_events": [
    {
      "cauldron_id": "cauldron_001",
      "start_time": "2025-11-08T10:30:00",
      "end_time": "2025-11-08T10:45:00",
      "volume_drained": 150.5,
      "drain_rate": -10.2
    }
  ],
  "avg_level": 65.3,
  "min_level": 45.0,
  "max_level": 85.0
}
```

**What to Check:**
- ✅ `num_drains` > 0 (if drains exist in data)
- ✅ `drain_events` array contains drain events
- ✅ `fill_rate` is calculated
- ✅ `avg_level`, `min_level`, `max_level` are present

---

### Test 2: Analyze All Cauldrons
**Endpoint:** `GET /api/analysis/cauldrons`

**Steps:**
1. Find the endpoint
2. Click "Try it out"
3. Enter parameters:
   - `start`: Leave empty OR `2025-11-08T00:00:00`
   - `end`: Leave empty OR `2025-11-09T23:59:59`
   - `use_cache`: `true`
4. Click "Execute"

**Expected Response:**
```json
{
  "cauldron_001": {
    "cauldron_id": "cauldron_001",
    "fill_rate": 12.5,
    "num_drains": 3,
    ...
  },
  "cauldron_002": {
    "cauldron_id": "cauldron_002",
    ...
  }
}
```

**What to Check:**
- ✅ Returns analysis for multiple cauldrons
- ✅ Each cauldron has drain detection results

---

### Test 3: Daily Drain Summary (For Person 3 Integration)
**Endpoint:** `GET /api/analysis/drains/{cauldron_id}/{date}`

**Steps:**
1. Find the endpoint
2. Click "Try it out"
3. Enter parameters:
   - `cauldron_id`: `cauldron_001`
   - `date`: `2025-11-09` (format: YYYY-MM-DD)
   - `use_cache`: `true`
4. Click "Execute"

**Expected Response:**
```json
{
  "cauldron_id": "cauldron_001",
  "date": "2025-11-09",
  "total_volume_drained": 450.5,
  "num_drains": 2,
  "drain_events": [
    {
      "cauldron_id": "cauldron_001",
      "start_time": "2025-11-09T10:30:00",
      "end_time": "2025-11-09T10:45:00",
      "volume_drained": 250.0,
      "drain_rate": -12.5
    },
    {
      "cauldron_id": "cauldron_001",
      "start_time": "2025-11-09T14:20:00",
      "end_time": "2025-11-09T14:35:00",
      "volume_drained": 200.5,
      "drain_rate": -10.2
    }
  ]
}
```

**What to Check:**
- ✅ `total_volume_drained` = sum of all drain events for that day
- ✅ `num_drains` matches length of `drain_events` array
- ✅ All drain events are on the specified date

---

## 🎫 Person 3: Ticket Matching & Discrepancy Detection

### Test 1: Detect Discrepancies (All Cauldrons)
**Endpoint:** `POST /api/discrepancies/detect`

**Steps:**
1. Find the endpoint
2. Click "Try it out"
3. Enter parameters:
   - `start_date`: Leave empty OR `2025-11-08T00:00:00`
   - `end_date`: Leave empty OR `2025-11-09T23:59:59`
   - `use_cache`: `true`
4. Click "Execute"

**Expected Response:**
```json
{
  "discrepancies": [
    {
      "ticket_id": "ticket_123",
      "cauldron_id": "cauldron_001",
      "drain_event_id": "drain_456",
      "ticket_volume": 150.0,
      "drain_volume": 145.5,
      "difference": 4.5,
      "difference_percent": 3.0,
      "severity": "warning",
      "confidence": 0.85,
      "description": "Volume mismatch: ticket shows 150.0L but drain detected 145.5L"
    }
  ],
  "total_discrepancies": 1,
  "critical_count": 0,
  "warning_count": 1,
  "info_count": 0
}
```

**What to Check:**
- ✅ `discrepancies` array contains matched tickets and drains
- ✅ `severity` is one of: `"critical"`, `"warning"`, `"info"`
- ✅ `confidence` is between 0.0 and 1.0
- ✅ `difference` and `difference_percent` are calculated
- ✅ Counts match the severity breakdown

---

### Test 2: Get Discrepancies (Filtered)
**Endpoint:** `GET /api/discrepancies`

**Steps:**
1. Find the endpoint
2. Click "Try it out"
3. Enter parameters:
   - `severity`: Leave empty OR `"critical"` OR `"warning"` OR `"info"`
   - `cauldron_id`: Leave empty OR `"cauldron_001"`
   - `use_cache`: `true`
4. Click "Execute"

**Test Cases:**

**Case A: Get All Discrepancies**
- Leave `severity` and `cauldron_id` empty
- Should return all discrepancies

**Case B: Filter by Severity**
- Set `severity`: `"critical"`
- Should return only critical discrepancies

**Case C: Filter by Cauldron**
- Set `cauldron_id`: `"cauldron_001"`
- Should return only discrepancies for that cauldron

**Case D: Combined Filter**
- Set `severity`: `"warning"`
- Set `cauldron_id`: `"cauldron_001"`
- Should return only warning discrepancies for that cauldron

**Expected Response:**
```json
{
  "discrepancies": [...],
  "total_discrepancies": 5,
  "critical_count": 1,
  "warning_count": 3,
  "info_count": 1
}
```

**What to Check:**
- ✅ Filtering works correctly
- ✅ Counts match filtered results
- ✅ All returned discrepancies match the filter criteria

---

## 🔍 How to Find Valid Test Values

### Get Available Cauldron IDs
**Endpoint:** `GET /api/Information/cauldrons`

1. Execute this endpoint first
2. Look at the response for `id` or `cauldron_id` fields
3. Use these IDs in Person 2/3 tests

**Example Response:**
```json
[
  {
    "id": "cauldron_001",
    "name": "Cauldron 1",
    "latitude": 40.7128,
    "longitude": -73.9352,
    "max_volume": 1000
  }
]
```

### Get Available Dates
**Endpoint:** `GET /api/Data/metadata`

1. Execute this endpoint
2. Look for `start_date` and `end_date` in the response
3. Use dates within this range for testing

**Example Response:**
```json
{
  "start_date": "2025-11-08T00:00:00",
  "end_date": "2025-11-09T23:59:59",
  "total_records": 1440
}
```

### Get Available Tickets
**Endpoint:** `GET /api/Tickets`

1. Execute this endpoint
2. Look for ticket IDs and dates
3. Use these to verify Person 3 matching

---

## 🐛 Troubleshooting

### Issue: "No drains found"
**Possible Causes:**
- Data doesn't contain drain events (normal if cauldrons are only filling)
- Date range doesn't include drain events
- Try a different cauldron or date range

### Issue: "No discrepancies found"
**Possible Causes:**
- Tickets and drains match perfectly (good!)
- No tickets exist for the date range
- No drains exist for the date range
- Try expanding the date range

### Issue: "500 Internal Server Error"
**Check:**
1. Backend console for error messages
2. Database is populated: `python backend/populate_database.py`
3. All dependencies installed: `pip install -r requirements.txt`

### Issue: "Empty response"
**Check:**
- Date format is correct: `YYYY-MM-DD` for date parameter
- DateTime format is correct: `YYYY-MM-DDTHH:MM:SS` for start/end
- Cauldron ID exists: Use `/api/Information/cauldrons` to verify

---

## ✅ Success Criteria

### Person 2 (Drain Detection) ✅
- [ ] `/api/analysis/cauldrons/{cauldron_id}` returns drain events
- [ ] `/api/analysis/cauldrons` returns analysis for all cauldrons
- [ ] `/api/analysis/drains/{cauldron_id}/{date}` returns daily summary
- [ ] `num_drains` and `drain_events` are consistent
- [ ] `fill_rate` is calculated correctly

### Person 3 (Ticket Matching) ✅
- [ ] `/api/discrepancies/detect` returns matched tickets and drains
- [ ] `/api/discrepancies` returns filtered results
- [ ] `severity` classification works (critical/warning/info)
- [ ] `confidence` scores are between 0.0 and 1.0
- [ ] Filtering by `severity` and `cauldron_id` works
- [ ] Counts match the actual discrepancies returned

---

## 📝 Quick Test Checklist

1. ✅ Get cauldron IDs: `GET /api/Information/cauldrons`
2. ✅ Test Person 2: `GET /api/analysis/cauldrons/cauldron_001`
3. ✅ Test Person 2 (all): `GET /api/analysis/cauldrons`
4. ✅ Test Person 2 (daily): `GET /api/analysis/drains/cauldron_001/2025-11-09`
5. ✅ Test Person 3 (detect): `POST /api/discrepancies/detect`
6. ✅ Test Person 3 (get all): `GET /api/discrepancies`
7. ✅ Test Person 3 (filter): `GET /api/discrepancies?severity=critical`

