import { useEffect } from 'react'
import { initSocket } from './initSocket'
import { fetchHistory } from '../services/api'
import usePotionStore from '../store/usePotionStore'

export default function useInit(){
  useEffect(()=>{
    // load initial history
    fetchHistory().then(h=>{
      const push = usePotionStore.getState().pushHistorySnapshot
      h.forEach(s=> push(s))
    })

    const sock = initSocket()
    return ()=> sock.close()
  }, [])
}
