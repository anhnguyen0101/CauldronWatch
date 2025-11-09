import { startMockSocket } from '../services/websocket'
import usePotionStore from '../store/usePotionStore'

export function initSocket(){
  const setCauldronLevel = usePotionStore.getState().setCauldronLevel || ((id, level)=>{})
  const addAlert = usePotionStore.getState().addAlert || ((a)=>{})
  const pushHistorySnapshot = usePotionStore.getState().pushHistorySnapshot || (()=>{})

  const sock = startMockSocket((msg)=>{
    if(msg.type === 'levels'){
      const avg = Math.round(msg.data.reduce((a,d)=>a+d.level,0)/msg.data.length)
      msg.data.forEach(u=> setCauldronLevel(u.id, u.level))
      // Only push a limited number of history snapshots for deterministic playback
      const currentHistory = usePotionStore.getState().history || []
      if(currentHistory.length < 10){
        pushHistorySnapshot({ time: new Date().toLocaleTimeString(), avgLevel: avg })
      }

      // simple alert rule
      msg.data.forEach(u=>{
        if(u.level > 95){
          addAlert({ id: Date.now()+u.id, title: `Overfill ${u.id}`, message: `${u.id} is above 95% (${u.level}%)` })
        }
      })
    }
  })

  return sock
}
