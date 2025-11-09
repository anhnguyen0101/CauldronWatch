# CauldronWatch - Complete Hackathon Guide

## 🎯 Quick Start Checklist

### Hour 0 (Setup)
- [ ] Run `python explore_api.py` to understand EOG's API structure
- [ ] Read `API_EXPLORATION_GUIDE.md` for manual exploration
- [ ] Set up GitHub repo
- [ ] Assign roles to 5 team members
- [ ] Install dependencies

### Hour 1-3 (Foundation)
- [ ] Document API endpoints in shared doc
- [ ] Backend: Fetch and cache data
- [ ] Data Analysis: Study historical patterns
- [ ] Frontend: Set up React app
- [ ] Detection: Design matching algorithm
- [ ] Optimization: Plan routing approach

### Hour 4-7 (Integration)
- [ ] Connect frontend to backend
- [ ] Implement drain detection
- [ ] Build ticket matching
- [ ] Create visualizations
- [ ] Add optimization features

### Hour 8-9 (Polish)
- [ ] End-to-end testing
- [ ] UI improvements
- [ ] Demo preparation
- [ ] Practice presentation

---

## 📁 Resource Files

### 1. API Exploration
- **`explore_api.py`** - Automated API endpoint discovery script
- **`API_EXPLORATION_GUIDE.md`** - Manual exploration guide with Swagger tips

### 2. Project Structure
- **`PROJECT_STRUCTURE.md`** - Complete folder structure and team division
  - Role assignments for 5 people
  - Code templates for each role
  - Tech stack recommendations
  - Communication protocols

### 3. Algorithms
- **`ALGORITHMS.md`** - Detailed pseudocode for core challenges
  - Drain event detection (accounting for continuous filling)
  - Ticket matching (date-only to timestamp mapping)
  - Route optimization (minimum witches calculation)
  - Real-time monitoring architecture
  - Testing strategies

### 4. Demo Preparation
- **`DEMO_SCRIPT.md`** - Complete presentation guide
  - 5-7 minute demo flow
  - Live demo walkthrough
  - Q&A preparation
  - Backup plans
  - Success metrics

---

## 🎨 Team Structure (5 People)

### Person 1: Backend API & Integration
**Focus:** Fetch EOG data, cache locally, provide clean API

**Key responsibilities:**
- EOG API client
- FastAPI endpoints
- WebSocket for real-time
- Database setup

**Files to create:**
- `backend/api/main.py`
- `backend/api/eog_client.py`
- `backend/api/websocket.py`
- `backend/models/*.py`

---

### Person 2: Data Analysis & Drain Detection
**Focus:** Analyze time series, detect drain events

**Key responsibilities:**
- Drain detection algorithm
- Fill rate calculation
- Account for continuous filling during drainage
- Historical data processing

**Files to create:**
- `data-analysis/drain_detector.py`
- `data-analysis/rate_calculator.py`
- `data-analysis/analyzer.py`

**Critical insight:** Potion continues filling DURING drainage!
```
Total drained = actual_drop + (fill_rate × drain_duration)
```

---

### Person 3: Ticket Matching & Discrepancy Detection
**Focus:** Match tickets to drains, flag suspicious activity

**Key responsibilities:**
- Dynamic ticket matching (adapts to changing data)
- Match date-only tickets to timestamped drains
- Calculate discrepancies
- Categorize alert severity

**Files to create:**
- `detection/ticket_matcher.py`
- `detection/discrepancy.py`
- `detection/validator.py`

**Critical challenge:** Tickets have DATE only, drains have TIMESTAMP
```
Solution: Group drains by date, sum volumes, compare
```

---

### Person 4: Frontend Visualization & Dashboard
**Focus:** Interactive map, real-time updates, historical playback

**Key responsibilities:**
- React dashboard
- Leaflet map with cauldron markers
- Real-time WebSocket connection
- Historical playback controls
- Alert displays

**Files to create:**
- `frontend/src/components/Map.jsx`
- `frontend/src/components/Timeline.jsx`
- `frontend/src/components/AlertPanel.jsx`
- `frontend/src/hooks/useWebSocket.js`

---

### Person 5: Route Optimization (Bonus)
**Focus:** Calculate minimum witches, optimal routes

**Key responsibilities:**
- Calculate time to overflow
- Greedy scheduling algorithm
- Route optimization (TSP)
- Account for travel time + unload time

**Files to create:**
- `optimization/route_optimizer.py`
- `optimization/scheduler.py`
- `optimization/graph_utils.py`

**Key constraint:** 15 minute unload time at market

---

## 🔑 Key Technical Insights

### 1. The Filling During Drainage Problem
**Challenge:** When a cauldron is being drained, potion continues to fill!

**Solution:**
```python
# Don't just use level drop
volume_drained = start_level - end_level  # WRONG!

# Account for filling during drain
drain_duration = end_time - start_time
fill_during_drain = fill_rate * drain_duration
volume_drained = (start_level - end_level) + fill_during_drain  # CORRECT!
```

### 2. The Date-Only Ticket Problem
**Challenge:** Tickets only have dates, drains have timestamps

**Solution:**
```python
# Group by date
drains_on_date = filter(drains, date(timestamp) == ticket.date)
total_drained = sum(drain.volume for drain in drains_on_date)

# Compare
if abs(total_drained - ticket.volume) > tolerance:
    flag_as_suspicious()
```

### 3. The Dynamic Data Problem
**Challenge:** "Ticket data may change during judging"

**Solution:**
- Never hardcode ticket IDs or assumptions
- Recalculate matching on every API fetch
- Build robust matching logic that handles new patterns

### 4. The Optimization Constraint
**Challenge:** Witches take 15 minutes to unload at market

**Solution:**
```python
total_time = (
    travel_to_cauldron + 
    drain_time + 
    travel_to_market + 
    UNLOAD_TIME  # Don't forget this!
)

# Must finish before overflow
assert completion_time < time_to_overflow
```

---

## 🛠️ Tech Stack Recommendations

### Backend
```bash
pip install fastapi uvicorn sqlalchemy pydantic pandas requests websockets
```

**Core:**
- FastAPI - API server
- Pandas - Time series analysis
- SQLAlchemy - Database ORM
- WebSockets - Real-time updates

### Frontend
```bash
npm install react leaflet react-leaflet recharts axios
```

**Core:**
- React - UI framework
- Leaflet - Interactive maps
- Recharts - Charts and graphs
- Axios - API calls

### Optimization
```bash
pip install networkx scipy
```

**Core:**
- NetworkX - Graph algorithms
- SciPy - Optimization routines

---

## 📊 Expected Results

After 9 hours, you should have:

### Core Features
✅ Real-time dashboard monitoring 20+ cauldrons
✅ Interactive map with color-coded urgency
✅ Historical playback with timeline controls
✅ Automatic drain event detection
✅ Dynamic ticket matching
✅ Discrepancy alerts (Critical/Warning/Info)

### Bonus Features
✅ Minimum witches calculation
✅ Optimized route visualization
✅ Overflow prevention scheduling

### Metrics to Show
```
✅ Cauldrons monitored: 23
✅ Historical data points: 10,080 (1 week × 1,440 min/day)
✅ Drain events detected: ~150
✅ Tickets matched: ~140
✅ Discrepancies found: ~10 (6-7%)
✅ Minimum witches needed: 3-4
✅ Overflows prevented: 100%
```

---

## 🎯 Judging Criteria Strategy

### Innovation (25%)
**Highlight:**
- Dynamic ticket matching algorithm
- Accounting for continuous filling during drainage
- Adaptive to changing data

### Technical Complexity (25%)
**Highlight:**
- Time series analysis
- Graph algorithms for optimization
- Real-time WebSocket architecture
- Constraint satisfaction for scheduling

### Completeness (25%)
**Highlight:**
- All required features ✅
- Bonus optimization ✅
- Robust error handling ✅
- Well-tested algorithms ✅

### User Experience (15%)
**Highlight:**
- Intuitive color coding
- Interactive map
- Clear alert explanations
- Historical investigation tools

### Presentation (10%)
**Highlight:**
- Clear narrative
- Live demo
- Real discrepancies shown
- Q&A preparation

---

## ⚠️ Common Pitfalls to Avoid

### 1. Not Accounting for Filling During Drainage
❌ Wrong: `drained = start_level - end_level`
✅ Right: `drained = (start_level - end_level) + (fill_rate × duration)`

### 2. Hardcoding Ticket Matching
❌ Wrong: `if ticket.id == "T123": match_to_drain_456()`
✅ Right: Dynamic matching that works with any ticket data

### 3. Forgetting Unload Time
❌ Wrong: `time = travel + drain`
✅ Right: `time = travel + drain + return + 15_min_unload`

### 4. Not Handling Edge Cases
- Multiple drains per day
- No tickets for a drain (unlogged)
- Multiple tickets for one drain
- Measurement tolerance

### 5. Over-engineering
- Don't build complex ML models (simple detection works!)
- Don't optimize prematurely
- Focus on working features over perfect code

---

## 🚀 First Steps (Right Now!)

1. **Run the API explorer:**
```bash
python explore_api.py
```

2. **While that runs, divide into teams:**
- Assign the 5 roles
- Create shared Google Doc for API documentation
- Set up GitHub repo

3. **Read the relevant guide for your role:**
- Backend → `PROJECT_STRUCTURE.md` (Person 1 section)
- Data Analysis → `ALGORITHMS.md` (Drain Detection)
- Detection → `ALGORITHMS.md` (Ticket Matching)
- Frontend → `PROJECT_STRUCTURE.md` (Person 4 section)
- Optimization → `ALGORITHMS.md` (Route Optimization)

4. **Hour 1 sync-up:**
- Share API findings
- Finalize data models
- Set up communication channels
- Define API contracts between backend/frontend

---

## 📞 Communication Plan

### Slack/Discord Channels
- `#general` - Team coordination
- `#backend` - Person 1
- `#data-analysis` - Person 2
- `#detection` - Person 3
- `#frontend` - Person 4
- `#optimization` - Person 5
- `#api-docs` - Shared API documentation

### Hourly Check-ins (5 min max)
- **Hour 1:** API documented? Roles clear?
- **Hour 3:** Can fetch data? Drain detection working?
- **Hour 5:** Frontend connected? Matching logic ready?
- **Hour 7:** Integration complete? Optimization working?
- **Hour 8:** Demo practice run
- **Hour 8.5:** Final polish

### Critical Communication
- **Blockers:** Post immediately, don't wait
- **API changes:** Update shared doc
- **Breaking changes:** Warn other team members
- **Success:** Share wins to keep morale up!

---

## 🎉 Success Indicators

You're on track if by:

**Hour 3:**
- [ ] All EOG endpoints documented
- [ ] Can fetch and display cauldron list
- [ ] Historical data loading
- [ ] Basic React app running

**Hour 5:**
- [ ] Drain detection algorithm working
- [ ] Frontend showing map with cauldrons
- [ ] Backend API returning data to frontend
- [ ] Ticket data loaded

**Hour 7:**
- [ ] Discrepancies being detected
- [ ] Real-time updates working
- [ ] Historical playback functional
- [ ] Alerts displaying

**Hour 9:**
- [ ] Full demo run-through complete
- [ ] All features working
- [ ] Team practiced presentation
- [ ] Backup plans ready

---

## 💪 You Got This!

Your team has strong backgrounds in:
- Backend development (Tom: FastAPI experience)
- Machine learning (Tom: PyTorch, TensorFlow)
- Full-stack (internship experience)
- Problem-solving (CS coursework)

This challenge is absolutely achievable in 9 hours with 5 people!

**Key to success:**
1. ✅ Clear communication
2. ✅ Parallel work (minimal dependencies)
3. ✅ Focus on working features over perfection
4. ✅ Test early, test often
5. ✅ Practice the demo!

---

## 📚 Quick Reference

### File Overview
```
explore_api.py              # Run this first!
API_EXPLORATION_GUIDE.md    # Manual API exploration
PROJECT_STRUCTURE.md        # Team roles & code templates
ALGORITHMS.md               # Core algorithm pseudocode
DEMO_SCRIPT.md             # Presentation guide
```

### Key URLs
- Challenge: https://hackutd2025.eog.systems/
- Swagger: https://hackutd2025.eog.systems/swagger/index.html
- (Your backend will run on: http://localhost:8000)
- (Your frontend will run on: http://localhost:5173)

### Important Constants
```python
UNLOAD_TIME = 15  # minutes at market
TOLERANCE = 5.0   # 5% volume difference acceptable
UPDATE_INTERVAL = 5  # seconds for real-time updates
```

---

Good luck! 🧙‍♀️✨

Remember: The goal isn't perfection, it's a working demo that shows you understood the problem and built a creative solution. You can do this! 💪
