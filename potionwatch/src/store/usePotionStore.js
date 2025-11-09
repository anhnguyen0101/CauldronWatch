import { create } from 'zustand'

const usePotionStore = create((set, get) => ({
  cauldrons: [], // Cauldrons are loaded from backend on app initialization
  alerts: [],
  history: [],
  // playback / selection state
  selectedHistoryIndex: null,

  setCauldronLevel: (id, level) => {
    console.log(`🔧 setCauldronLevel called: id=${id}, level=${level}`)
    set(state => {
      const updated = state.cauldrons.map(c => {
        if (c.id === id) {
          console.log(`  ✅ Updating cauldron ${id}: ${c.level}% → ${level}%`)
          return {...c, level}
        }
        return c
      })
      console.log(`  📊 Updated cauldrons:`, updated.map(c => `${c.id}: ${c.level}%`))
      return { cauldrons: updated }
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
    // Check if alert with same ID already exists to prevent duplicates
    const existingIds = new Set(state.alerts.map(a => a.id))
    if (existingIds.has(alert.id)) {
      // Alert already exists, don't add duplicate
      return state
    }
    // Add new alert at the beginning and limit to 50
    return { alerts: [alert, ...state.alerts].slice(0, 50) }
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
