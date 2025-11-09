import create from 'zustand'

// Start with empty array - will be populated from backend
const initialCauldrons = []

const usePotionStore = create((set, get) => ({
  cauldrons: initialCauldrons,
  alerts: [],
  history: [],
  // playback / selection state
  selectedHistoryIndex: null,
  // Update timestamp - changes on every WebSocket update to trigger re-renders
  lastUpdate: Date.now(),

  setCauldronLevel: (id, level) => {
    set(state => {
      const updated = state.cauldrons.map(c => c.id === id ? {...c, level} : c)
      return { 
        cauldrons: updated,
        lastUpdate: Date.now() // Update timestamp to trigger reactivity
      }
    })
  },
  
  // Batch update multiple cauldrons at once (for WebSocket updates)
  updateCauldronLevels: (updates) => {
    set(state => {
      const updated = state.cauldrons.map(c => {
        const update = updates.find(u => u.id === c.id)
        return update ? {...c, level: update.level} : c
      })
      return { 
        cauldrons: updated,
        lastUpdate: Date.now() // Single timestamp update for batch
      }
    })
  },

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

  addAlert: (alert) => set(state => ({ alerts: [alert, ...state.alerts].slice(0,50) })),

  pushHistorySnapshot: (snapshot) => set(state => ({ history: [...state.history, snapshot].slice(-500) }))
}))

export default usePotionStore
