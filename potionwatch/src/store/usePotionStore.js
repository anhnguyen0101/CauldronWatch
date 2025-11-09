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

  updateCauldronLevels: (updates) => set(state => {
    // updates is an array of {id, level} objects
    const updateMap = new Map(updates.map(u => [u.id, u.level]))
    return {
      cauldrons: state.cauldrons.map(c => {
        const newLevel = updateMap.get(c.id)
        return newLevel !== undefined ? {...c, level: newLevel} : c
      })
    }
  }),

  setSelectedHistoryIndex: (index) => set(state => ({ selectedHistoryIndex: index })),

  // Apply a historical snapshot to the live cauldrons view (simple mapping)
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
        })
      }))
      return
    }

    // fallback to avgLevel for older snapshots
    const base = snapshot.avgLevel ?? 50
    set(state => ({
      cauldrons: state.cauldrons.map((c, i) => ({
        ...c,
        level: Math.max(0, Math.min(100, Math.round(base + ((i - state.cauldrons.length/2) * 6))))
      }))
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
    console.log(`📜 pushHistorySnapshot called:`, {
      time: snapshot.time,
      hasCauldrons: !!snapshot.cauldrons,
      cauldronsCount: snapshot.cauldrons?.length || 0,
      avgLevel: snapshot.avgLevel,
      snapshot: snapshot
    })
    set(state => {
      const newHistory = [...state.history, snapshot].slice(-500)
      console.log(`  📜 History now has ${newHistory.length} snapshots`)
      return { history: newHistory }
    })
  }
}))

export default usePotionStore
