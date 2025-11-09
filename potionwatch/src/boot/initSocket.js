import { startSocket } from '../services/websocket'
import usePotionStore from '../store/usePotionStore'

export function initSocket(){
  const setCauldronLevel = usePotionStore.getState().setCauldronLevel || ((id, level)=>{})
  const addAlert = usePotionStore.getState().addAlert || ((a)=>{})
  const pushHistorySnapshot = usePotionStore.getState().pushHistorySnapshot || (()=>{})

  const sock = startSocket((msg)=>{
    if(msg.type === 'connected'){
      console.log('✅ Connected to backend:', msg.message)
    }
    
    if(msg.type === 'levels'){
      console.log(`📨 WebSocket: Received ${msg.data.length} cauldron updates`)
      
      // Use batch update for better performance and reactivity
      const updateCauldronLevels = usePotionStore.getState().updateCauldronLevels
      if (updateCauldronLevels) {
        // Batch update all levels at once
        updateCauldronLevels(msg.data.map(u => ({ id: u.id, level: u.level })))
        console.log(`✅ Batch updated ${msg.data.length} cauldron levels`)
      } else {
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
      })
    }
    
    if(msg.type === 'drain_event'){
      console.log('💧 Adding drain alert to store')
      const volume = msg.data.volume_drained ? `${Math.round(msg.data.volume_drained)}L` : 'volume unknown'
      const alert = {
        id: `drain-${msg.data.cauldron_id}-${Date.now()}`,
        title: '💧 Drain Event Detected',
        message: `${msg.data.cauldron_id?.replace('cauldron_', '').toUpperCase() || msg.data.cauldron_id}: ${volume} drained`,
        severity: 'info',
        timestamp: msg.timestamp || new Date().toISOString()
      }
      console.log('💧 Alert object:', alert)
      addAlert(alert)
      console.log('💧 Alert added, current alerts:', usePotionStore.getState().alerts.length)
    }
    
    if(msg.type === 'discrepancy'){
      console.log('🚨 Adding discrepancy alert to store')
      const severity = msg.data.severity || 'warning'
      const cauldron = msg.data.cauldron_id?.replace('cauldron_', '').toUpperCase() || msg.data.cauldron_id
      const alert = {
        id: `discrepancy-${msg.data.ticket_id}-${Date.now()}`,
        title: `🚨 ${severity === 'critical' ? 'Critical' : 'Warning'} Discrepancy`,
        message: msg.data.message || `${cauldron}: Ticket ${msg.data.ticket_id} mismatch`,
        severity: severity,
        timestamp: msg.timestamp || new Date().toISOString()
      }
      console.log('🚨 Alert object:', alert)
      addAlert(alert)
      console.log('🚨 Alert added, current alerts:', usePotionStore.getState().alerts.length)
    }
  })

  return sock
}
