import { startSocket } from '../services/websocket'
import usePotionStore from '../store/usePotionStore'

export function initSocket(){
  const setCauldronLevel = usePotionStore.getState().setCauldronLevel
  const addAlert = usePotionStore.getState().addAlert
  const pushHistorySnapshot = usePotionStore.getState().pushHistorySnapshot

  const sock = startSocket((msg)=>{
    if(msg.type === 'levels'){
      console.log(`📨 initSocket: Received ${msg.data?.length || 0} cauldron updates`, msg.data)
      
      if (!msg.data || !Array.isArray(msg.data) || msg.data.length === 0) {
        console.warn('⚠️ initSocket: No valid data in levels message', msg)
        return
      }
      
      // Use batch update for better performance and reactivity
      const store = usePotionStore.getState()
      const updateCauldronLevels = store.updateCauldronLevels
      
      if (updateCauldronLevels) {
        // Batch update all levels at once
        const updates = msg.data.map(u => ({ id: u.id, level: u.level }))
        console.log('📨 initSocket: Updating store with', updates)
        updateCauldronLevels(updates)
        
        // Verify the update worked
        const updatedStore = usePotionStore.getState()
        console.log(`✅ Batch updated ${msg.data.length} cauldron levels. Store now has ${updatedStore.cauldrons.length} cauldrons`)
        console.log('📊 Sample cauldron levels:', updatedStore.cauldrons.slice(0, 3).map(c => `${c.id}: ${c.level}%`))
      } else {
        console.warn('⚠️ initSocket: updateCauldronLevels not available, using fallback')
        // Fallback to individual updates
        msg.data.forEach(u => setCauldronLevel(u.id, u.level))
      }
      
      // Calculate and log average
      const avg = Math.round(msg.data.reduce((a,d)=>a+d.level,0)/msg.data.length)
      console.log(`📊 WebSocket: New average level = ${avg}%`)
      
      // Push history snapshot
      const currentHistory = usePotionStore.getState().history || []
      pushHistorySnapshot({ 
        time: new Date().toLocaleTimeString(), 
        avgLevel: avg,
        timestamp: new Date().toISOString()
      })

      // Alert rule: warn if level > 95%
      msg.data.forEach(u=>{
        if(u.level > 95){
          addAlert({ 
            id: Date.now()+u.id, 
            title: `⚠️ Overfill Alert: ${u.id}`, 
            message: `${u.id} is above 95% (${u.level}%)`,
            severity: 'critical',
            timestamp: new Date().toISOString()
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
