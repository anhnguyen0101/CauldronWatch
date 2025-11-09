# Forecast Requirements Verification

## Requirements from Project Manager

1. **Minimum witches needed**: Calculate the minimum number of witches needed to prevent any cauldron from overflowing, even well into the future (not just for the provided data range).

2. **Fill rate consideration**: Take into account the fill rate for each cauldron and ensure it is taken care of during drains (cauldron continues filling while being drained).

3. **Daily pickup schedule**: Create a daily pickup schedule for witches that they can follow to ensure all potion is accounted for and does not overflow.

4. **Graph structure**:
   - Every cauldron has a direct path to/from the market
   - Travel times are defined in the network JSON
   - Treat as undirected edges (same time both ways)
   - Collected potion goes to the market
   - There's always one market
   - Treat as an undirected graph - all edges are two ways

5. **Drain events**: Two separate draining events from a single cauldron would be two separate tickets.

## Current Implementation Status

### ✅ Already Implemented

1. **Fill rate during drains**: The backend already accounts for fill rate during drains:
   - `backend/data_analysis/rate_calculator.py`: `calculate_true_drain_volume()` accounts for filling during drainage
   - Formula: `Total drained = Level drop + (fill_rate × drain_duration)`
   - This is used in drain event detection and discrepancy calculation

2. **Network structure**: 
   - All cauldrons have direct paths to market (verified: 12/12 cauldrons)
   - Network edges are stored and can be queried
   - Backend has `directed=False` parameter for undirected queries

3. **Fill rate in predictions**: 
   - Frontend uses fill_rate to calculate `minutesToOverflow`
   - Formula: `minutesToOverflow = remaining_capacity / fill_rate`

### ⚠️ Needs Modification

1. **Minimum witches calculation**: 
   - Current: Just assigns routes to available couriers
   - Needed: Calculate minimum number of witches required to prevent all overflows

2. **Daily pickup schedule**: 
   - Current: Shows immediate routes only
   - Needed: Generate a full daily schedule with times and routes

3. **Graph as undirected**: 
   - Current: Edges stored as directed (from -> to)
   - Needed: Ensure forecast treats edges as bidirectional with same travel time both ways

4. **Future prediction**: 
   - Current: Only "today" and "tomorrow" modes
   - Needed: Predict well into the future (not just data range)

5. **Fill rate during drain simulation**: 
   - Current: Only calculates overflow time if nothing is done
   - Needed: Simulate drain events accounting for fill rate during drain

## Required Changes

### 1. Backend: Ensure Network Edges are Treated as Undirected

**File**: `backend/api/cached_eog_client.py` or `backend/api/main.py`

- When querying neighbors or building routes, ensure edges are bidirectional
- Travel time should be the same in both directions

### 2. Backend: Add Minimum Witches Calculation Endpoint

**New endpoint**: `/api/forecast/minimum-witches`

- Simulate future cauldron levels accounting for fill rates
- Calculate when each cauldron will overflow
- Determine minimum number of witches needed to prevent all overflows
- Consider:
  - Travel time to cauldron
  - Travel time to market
  - Drain duration (accounting for fill rate during drain)
  - Courier capacity
  - Time between pickups

### 3. Backend: Add Daily Schedule Generation Endpoint

**New endpoint**: `/api/forecast/daily-schedule`

- Generate a full day's schedule for each witch
- Include:
  - Pickup times
  - Cauldron locations
  - Travel routes
  - Expected volumes
  - Market delivery times

### 4. Frontend: Update Forecast to Use New Endpoints

**File**: `potionwatch/src/components/forecast/forecastUtils.js`

- Fetch minimum witches count
- Display daily schedule
- Show long-term predictions (not just today/tomorrow)

### 5. Frontend: Add Schedule Visualization

**New component**: `potionwatch/src/components/forecast/DailySchedule.jsx`

- Display daily schedule in a calendar/timeline format
- Show witch assignments
- Show pickup times and routes

## Implementation Plan

1. ✅ Verify current fill rate handling (already correct)
2. ⏳ Modify network edge handling to be undirected
3. ⏳ Add minimum witches calculation
4. ⏳ Add daily schedule generation
5. ⏳ Update frontend to display new features

