import { create } from 'zustand'

const usePotionStore = create((set, get) => ({
  cauldrons: [], // Cauldrons are loaded from backend on app initialization
  links: [], // Network edges (from -> to) loaded from backend
  market: null, // Market hub info
  alerts: [],
  history: [],
  // playback / selection state
  selectedHistoryIndex: null,
  // Update timestamp - changes on every WebSocket update to trigger re-renders
  lastUpdate: Date.now(),
  // Queue for updates that arrive before cauldrons are loaded
  pendingUpdates: [],
  // Cached data for cross-page navigation (persists across route changes)
  cachedDiscrepancies: {}, // { "dateRange": { data: [...], timestamp: Date } }
  cachedForecast: null, // { minWitches: {...}, schedule: {...}, timestamp: Date }

  setCauldronLevel: (id, level) => {
    set(state => {
      const updated = state.cauldrons.map(c => c.id === id ? {...c, level} : c)
      return { 
        cauldrons: updated,
        lastUpdate: Date.now() // Update timestamp to trigger reactivity
      }
    })
  },

  // Network links setter
  setLinks: (links) => set(state => ({ links })),

  // Market setter
  setMarket: (market) => set(state => ({ market })),
  
  // Batch update multiple cauldrons at once (for WebSocket updates)
  updateCauldronLevels: (updates) => {
    console.log('🔄 Store: updateCauldronLevels called with', updates.length, 'updates')
    set(state => {
      if (state.cauldrons.length === 0) {
        console.warn('⚠️ Store: No cauldrons in store to update. Queuing updates for later.', updates)
        // Queue updates to apply when cauldrons are loaded
        return { 
          ...state,
          pendingUpdates: [...state.pendingUpdates, ...updates]
        }
      }
      
      // Apply any pending updates first
      let updatesToApply = [...state.pendingUpdates, ...updates]
      if (state.pendingUpdates.length > 0) {
        console.log(`📦 Store: Applying ${state.pendingUpdates.length} pending updates`)
      }
      
      const updated = state.cauldrons.map(c => {
        const update = updatesToApply.find(u => u.id === c.id)
        if (update) {
          console.log(`   ✅ Updating ${c.id}: ${c.level}% -> ${update.level}%`)
          return {...c, level: update.level}
        }
        return c
      })
      const newState = { 
        cauldrons: updated,
        lastUpdate: Date.now(), // Single timestamp update for batch
        pendingUpdates: [] // Clear pending updates after applying
      }
      console.log('🔄 Store: State updated. New lastUpdate:', newState.lastUpdate)
      return newState
    })
  },

  setCauldrons: (cauldrons) => set(state => ({ cauldrons })),

  setSelectedHistoryIndex: (index) => set(state => ({ selectedHistoryIndex: index })),

  // Apply a historical snapshot to the live cauldrons view (simple mapping)
  // ✅ FIX: Add lastUpdate timestamp to trigger graph re-renders
  applyHistorySnapshot: (index) => {
    const history = get().history
    if(!history || index == null || index < 0 || index >= history.length) return
    const snapshot = history[index]
    // If snapshot includes per-cauldron metrics, apply them by id.
    if(snapshot.cauldrons && Array.isArray(snapshot.cauldrons) && snapshot.cauldrons.length){
      const byId = snapshot.cauldrons.reduce((acc, item) => { acc[item.id] = item; return acc }, {})
      set(state => ({
        cauldrons: state.cauldrons.map(c => {
          const s = byId[c.id]
          if(!s) return c
          return { ...c, level: Math.max(0, Math.min(100, s.level ?? s.fillPercent ?? c.level)) }
        }),
        lastUpdate: Date.now() // ✅ Trigger graph re-render
      }))
      return
    }

    // fallback to avgLevel for older snapshots
    const base = snapshot.avgLevel ?? 50
    set(state => ({
      cauldrons: state.cauldrons.map((c, i) => ({
        ...c,
        level: Math.max(0, Math.min(100, Math.round(base + ((i - state.cauldrons.length/2) * 6))))
      })),
      lastUpdate: Date.now() // ✅ Trigger graph re-render
    }))
  },

  addAlert: (alert) => set(state => {
    console.log('🚨 addAlert called:', alert)
    // Check if alert with same ID already exists to prevent duplicates
    const existingIds = new Set(state.alerts.map(a => a.id))
    if (existingIds.has(alert.id)) {
      // Alert already exists - update it with new timestamp/message instead of skipping
      console.log('⚠️ Alert already exists, updating:', alert.id)
      const updatedAlerts = state.alerts.map(a => 
        a.id === alert.id ? { ...a, ...alert, timestamp: alert.timestamp, time: alert.time } : a
      )
      return { alerts: updatedAlerts }
    }
    // Add new alert at the beginning and limit to 50
    const newAlerts = [alert, ...state.alerts].slice(0, 50)
    console.log(`✅ Alert added. Total alerts: ${newAlerts.length}`)
    return { alerts: newAlerts }
  }),

  removeAlert: (alertId) => set(state => {
    const exists = state.alerts.some(a => a.id === alertId)
    if (!exists) {
      // Alert doesn't exist, no need to remove - skip silently
      return state
    }
    console.log('🗑️ removeAlert called:', alertId)
    const filtered = state.alerts.filter(a => a.id !== alertId)
    console.log(`✅ Alert removed. Total alerts: ${filtered.length}`)
    return { alerts: filtered }
  }),

  pushHistorySnapshot: (snapshot) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`📜 pushHistorySnapshot called:`, {
        time: snapshot.time,
        timestamp: snapshot.timestamp,
        hasCauldrons: !!snapshot.cauldrons,
        cauldronsCount: snapshot.cauldrons?.length || 0,
        avgLevel: snapshot.avgLevel
      })
    }
    set(state => {
      // ✅ Deduplicate by timestamp to prevent duplicates (from main branch - better logic)
      const existingIndex = state.history.findIndex(h => 
        h.timestamp === snapshot.timestamp || 
        (h.time === snapshot.time && Math.abs((h.timestamp || 0) - (snapshot.timestamp || 0)) < 60000)
      )
      
      let newHistory
      if (existingIndex >= 0) {
        // Replace existing snapshot with same timestamp
        newHistory = [...state.history]
        newHistory[existingIndex] = snapshot
      } else {
        // Add new snapshot
        newHistory = [...state.history, snapshot]
      }
      
      // Sort by timestamp and limit to last 1000 snapshots
      newHistory = newHistory
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
        .slice(-1000)
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`  📜 History now has ${newHistory.length} snapshots`)
      }
      return { history: newHistory }
    })
  },

  // Cache discrepancies by date range (persists across navigation)
  setCachedDiscrepancies: (dateRange, discrepancies) => {
    set(state => ({
      cachedDiscrepancies: {
        ...state.cachedDiscrepancies,
        [dateRange]: {
          data: discrepancies,
          timestamp: Date.now()
        }
      }
    }))
  },

  getCachedDiscrepancies: (dateRange, maxAgeMs = 60 * 60 * 1000) => { // 1 hour default (increased from 5 min)
    const state = get()
    const cached = state.cachedDiscrepancies[dateRange]
    if (cached && (Date.now() - cached.timestamp) < maxAgeMs) {
      return cached.data
    }
    return null
  },

  // Cache forecast data (persists across navigation)
  setCachedForecast: (forecastData) => {
    set(state => ({
      cachedForecast: {
        ...forecastData,
        timestamp: Date.now()
      }
    }))
  },

  getCachedForecast: (maxAgeMs = 60 * 60 * 1000) => { // 1 hour default (increased from 3 min)
    const state = get()
    if (state.cachedForecast && (Date.now() - state.cachedForecast.timestamp) < maxAgeMs) {
      return {
        minWitches: state.cachedForecast.minWitches,
        schedule: state.cachedForecast.schedule
      }
    }
    return null
  }
}))

export default usePotionStore
