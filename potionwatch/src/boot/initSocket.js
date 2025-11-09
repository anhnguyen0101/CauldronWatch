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
        // Backend sends level in LITERS and max_volume/capacity
        // Convert to percentage for display
        const updates = msg.data.map(u => {
          const levelLiters = u.level || 0
          const capacity = u.max_volume || u.capacity || 1000
          const percentage = Math.round((levelLiters / capacity) * 100)
          
          if (process.env.NODE_ENV === 'development' && percentage > 90) {
            console.log(`📊 High level WS update: ${u.id} = ${levelLiters}L / ${capacity}L = ${percentage}%`)
          }
          
          return { id: u.id, level: percentage }
        })
        console.log('📨 initSocket: Updating store with', updates.length, 'cauldron updates')
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
        timestamp: new Date().toISOString(),
        cauldrons: msg.data.map(u => ({ id: u.id, level: u.level }))
      })

      // Alert rules: check for various conditions
      // Get cauldron names from store for better alert messages
      const currentStore = usePotionStore.getState()
      const cauldronMap = new Map(currentStore.cauldrons.map(c => [c.id, c]))
      const removeAlert = currentStore.removeAlert
      
      msg.data.forEach(u=>{
        // Look up cauldron name from store
        const cauldron = cauldronMap.get(u.id)
        const cauldronName = cauldron?.name || u.id
        
        // Overfill alert: level > 95%
        if(u.level > 95){
          // Use a stable ID based on cauldron ID to prevent duplicates
          const alertId = `overfill_${u.id}`
          console.log(`🚨 Creating/updating overfill alert for ${cauldronName}: ${u.level}%`)
          addAlert({ 
            id: alertId,
            title: `⚠️ Overfill Alert: ${cauldronName}`, 
            message: `${cauldronName} is above 95% (${u.level}%)`,
            severity: 'critical',
            timestamp: new Date().toISOString(),
            time: new Date().toLocaleTimeString()
          })
          // Remove underfill alert if it exists (cauldron recovered)
          removeAlert(`underfill_${u.id}`)
        }
        // Underfill alert: level < 20%
        else if(u.level < 20){
          // Use a stable ID based on cauldron ID to prevent duplicates
          const alertId = `underfill_${u.id}`
          console.log(`⚠️ Creating/updating underfill alert for ${cauldronName}: ${u.level}%`)
          addAlert({ 
            id: alertId,
            title: `⚠️ Underfill Alert: ${cauldronName}`, 
            message: `${cauldronName} is below 20% (${u.level}%)`,
            severity: 'warning',
            timestamp: new Date().toISOString(),
            time: new Date().toLocaleTimeString()
          })
          // Remove overfill alert if it exists (cauldron drained)
          removeAlert(`overfill_${u.id}`)
        }
        // Normal level: remove any existing alerts for this cauldron
        // (removeAlert will check if alert exists internally)
        else {
          removeAlert(`overfill_${u.id}`)
          removeAlert(`underfill_${u.id}`)
        }
      })
    } else if(msg.type === 'drain_event'){
      // Handle drain event from WebSocket
      console.log('💧 Drain event received:', msg.data)
      if(msg.data){
        // Get cauldron name from store
        const store = usePotionStore.getState()
        const cauldron = store.cauldrons.find(c => c.id === msg.data.cauldron_id)
        const cauldronName = cauldron?.name || msg.data.cauldron_id
        
        // Create unique ID using cauldron_id and start_time to avoid duplicates
        // Use a consistent format so duplicates are properly detected
        const startTime = msg.data.start_time || msg.timestamp
        const uniqueId = `drain_${msg.data.cauldron_id}_${startTime}`
        addAlert({
          id: uniqueId,
          title: `💧 Drain Event: ${cauldronName}`,
          message: `${cauldronName} drained ${msg.data.volume_drained || msg.data.volume || 0}L at ${new Date(startTime).toLocaleString()}`,
          severity: 'info',
          timestamp: startTime,
          time: new Date(startTime).toLocaleTimeString()
        })
      }
    } else if(msg.type === 'discrepancy'){
      // Handle discrepancy from WebSocket
      console.log('🚨 Discrepancy received:', msg.data)
      if(msg.data){
        // Get cauldron name from store
        const store = usePotionStore.getState()
        const cauldron = store.cauldrons.find(c => c.id === msg.data.cauldron_id)
        const cauldronName = cauldron?.name || msg.data.cauldron_id
        
        // Create unique ID using ticket_id and cauldron_id (consistent format for deduplication)
        const uniqueId = `disc_${msg.data.ticket_id}_${msg.data.cauldron_id}`
        addAlert({
          id: uniqueId,
          title: `🚨 Discrepancy: ${msg.data.severity || 'warning'}`,
          message: `${cauldronName}: Ticket ${msg.data.ticket_id} - ${msg.data.discrepancy_percent?.toFixed(1) || 0}% off`,
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
