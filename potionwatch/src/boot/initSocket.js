import { startSocket } from '../services/websocket'
import usePotionStore from '../store/usePotionStore'

export function initSocket(){
  const setCauldronLevel = usePotionStore.getState().setCauldronLevel
  const addAlert = usePotionStore.getState().addAlert
  const pushHistorySnapshot = usePotionStore.getState().pushHistorySnapshot

  const sock = startSocket((msg)=>{
    if(msg.type === 'levels'){
      // Update cauldron levels from WebSocket
      if(msg.data && Array.isArray(msg.data)){
        console.log(`📨 Processing ${msg.data.length} level updates from WebSocket`)
        
        const avg = Math.round(msg.data.reduce((a,d)=>a+(d.level || 0),0)/msg.data.length)
        let updated = 0
        
        msg.data.forEach(u=> {
          if(u.id && u.level != null){
            console.log(`   ✅ WebSocket: Updating ${u.id} to ${u.level}% (raw: ${u.rawLevel}L)`)
            setCauldronLevel(u.id, u.level)
            updated++
          } else {
            console.warn(`   ⚠️  WebSocket: Invalid update data:`, u)
          }
        })
        
        console.log(`✅ WebSocket: Updated ${updated}/${msg.data.length} cauldron levels (avg: ${avg}%)`)
        
        // Push history snapshot with per-cauldron data (limited to avoid memory issues)
        const currentHistory = usePotionStore.getState().history || []
        if(currentHistory.length < 500){
          // Include per-cauldron data in history snapshot for TimelineHeatmap
          const store = usePotionStore.getState()
          const cauldronSnapshots = store.cauldrons.map(c => ({
            id: c.id,
            name: c.name,
            level: c.level,
            fillPercent: c.level, // Use level as fillPercent for compatibility
            status: c.level > 95 ? 'overfill' : c.level < 20 ? 'underfill' : 'normal'
          }))
          
          console.log(`📜 Creating history snapshot with ${cauldronSnapshots.length} cauldrons:`, cauldronSnapshots.map(c => `${c.id}: ${c.level}%`))
          
          pushHistorySnapshot({ 
            time: new Date().toLocaleTimeString(), 
            avgLevel: avg,
            cauldrons: cauldronSnapshots
          })
        }

        // Alert rule: overfill detection
        msg.data.forEach(u=>{
          if(u.level > 95){
            addAlert({ 
              id: Date.now() + (u.id || ''), 
              title: `Overfill ${u.id}`, 
              message: `${u.id} is above 95% (${u.level}%)`,
              severity: 'warning',
              timestamp: new Date().toISOString()
            })
          }
        })
      }
    } else if(msg.type === 'drain_event'){
      // Handle drain event from WebSocket
      console.log('💧 Drain event received:', msg.data)
      if(msg.data){
        // Create unique ID using cauldron_id and start_time to avoid duplicates
        // Use a consistent format so duplicates are properly detected
        const startTime = msg.data.start_time || msg.timestamp
        const uniqueId = `drain_${msg.data.cauldron_id}_${startTime}`
        addAlert({
          id: uniqueId,
          title: `Drain Event: ${msg.data.cauldron_id}`,
          message: `Drained ${msg.data.volume_drained || msg.data.volume || 0}L at ${new Date(startTime).toLocaleString()}`,
          severity: 'info',
          timestamp: startTime,
          time: new Date(startTime).toLocaleTimeString()
        })
      }
    } else if(msg.type === 'discrepancy'){
      // Handle discrepancy from WebSocket
      console.log('🚨 Discrepancy received:', msg.data)
      if(msg.data){
        // Create unique ID using ticket_id and cauldron_id (consistent format for deduplication)
        const uniqueId = `disc_${msg.data.ticket_id}_${msg.data.cauldron_id}`
        addAlert({
          id: uniqueId,
          title: `Discrepancy: ${msg.data.severity || 'warning'}`,
          message: `${msg.data.cauldron_id}: Ticket ${msg.data.ticket_id} - ${msg.data.discrepancy_percent?.toFixed(1) || 0}% off`,
          severity: msg.data.severity || 'warning',
          timestamp: msg.timestamp,
          time: new Date(msg.timestamp).toLocaleTimeString()
        })
      }
    } else if(msg.type === 'connected'){
      console.log('✅ WebSocket connected:', msg.message)
    }
  })

  return sock
}
