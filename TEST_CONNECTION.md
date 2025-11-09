# Testing Backend-Frontend Connection

## ✅ Quick Test Results

All backend endpoints and WebSocket are working correctly!

## 🚀 How to Test the Connection

### Step 1: Start the Backend

```bash
# From project root
uvicorn backend.api.main:app --reload --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

### Step 2: Start the Frontend

```bash
# In a new terminal
cd potionwatch
npm install  # If you haven't already
npm run dev
```

You should see:
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

### Step 3: Open Browser

1. Open http://localhost:5173
2. Open browser DevTools (F12) → Console tab
3. Look for connection logs:

**Expected logs:**
```
✅ Backend is healthy
🔌 Connecting to WebSocket: ws://localhost:8000/ws
✅ WebSocket connected
📨 WebSocket message: cauldron_update
```

### Step 4: Verify Data Flow

1. **Check Network Tab** (DevTools → Network):
   - You should see requests to `http://localhost:8000/api/cauldrons`
   - You should see requests to `http://localhost:8000/api/data/latest`
   - You should see WebSocket connection to `ws://localhost:8000/ws`

2. **Check Application State**:
   - Cauldrons should appear on the map
   - Levels should update in real-time (every 30 seconds)
   - History timeline should show data points

## 🧪 Automated Test

Run the test script:

```bash
python test_backend_frontend.py
```

This will test:
- ✅ All API endpoints
- ✅ WebSocket connection
- ✅ Frontend configuration

## 🔍 Troubleshooting

### Backend not connecting?

1. **Check if backend is running:**
   ```bash
   curl http://localhost:8000/health
   ```
   Should return: `{"status":"healthy","service":"CauldronWatch API"}`

2. **Check backend logs** for errors

3. **Check CORS settings** - Backend should allow `http://localhost:5173`

### Frontend not loading data?

1. **Check browser console** for errors
2. **Check Network tab** - Are requests failing?
3. **Verify API URL** - Should be `http://localhost:8000`

### WebSocket not connecting?

1. **Check WebSocket URL** - Should be `ws://localhost:8000/ws`
2. **Check browser console** for WebSocket errors
3. **Verify backend WebSocket endpoint** is running

## 📊 What Should Work

- ✅ Frontend fetches cauldrons from backend
- ✅ Frontend fetches latest levels from backend
- ✅ Frontend connects to WebSocket for real-time updates
- ✅ Cauldron levels update every 30 seconds via WebSocket
- ✅ History data loads from backend
- ✅ Alerts trigger when levels exceed 95%

## 🎯 Next Steps

Once connection is verified:
1. Test real-time updates (wait 30 seconds for WebSocket broadcast)
2. Test different pages (Overview, History, Discrepancies)
3. Test drain detection integration
4. Test ticket matching integration

