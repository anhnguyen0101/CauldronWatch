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
        const avg = Math.round(msg.data.reduce((a,d)=>a+(d.level || 0),0)/msg.data.length)
        msg.data.forEach(u=> {
          if(u.id && u.level != null){
            setCauldronLevel(u.id, u.level)
          }
        })
        
        // Push history snapshot (limited to avoid memory issues)
        const currentHistory = usePotionStore.getState().history || []
        if(currentHistory.length < 500){
          pushHistorySnapshot({ time: new Date().toLocaleTimeString(), avgLevel: avg })
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
        addAlert({
          id: `drain_${msg.data.cauldron_id}_${msg.timestamp}`,
          title: `Drain Event: ${msg.data.cauldron_id}`,
          message: `Drained ${msg.data.volume || 0}L at ${new Date(msg.timestamp).toLocaleString()}`,
          severity: 'info',
          timestamp: msg.timestamp
        })
      }
    } else if(msg.type === 'discrepancy'){
      // Handle discrepancy from WebSocket
      console.log('🚨 Discrepancy received:', msg.data)
      if(msg.data){
        addAlert({
          id: `disc_${msg.data.ticket_id}_${msg.timestamp}`,
          title: `Discrepancy: ${msg.data.severity || 'warning'}`,
          message: `${msg.data.cauldron_id}: Ticket ${msg.data.ticket_id} - ${msg.data.discrepancy_percent?.toFixed(1) || 0}% off`,
          severity: msg.data.severity || 'warning',
          timestamp: msg.timestamp
        })
      }
    } else if(msg.type === 'connected'){
      console.log('✅ WebSocket connected:', msg.message)
    }
  })

  return sock
}
