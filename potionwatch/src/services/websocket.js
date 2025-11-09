// Simple WebSocket simulator that emits level updates
export function startMockSocket(onMessage){
  const ids = ['a1','b4','c2']
  let closed = false
  const interval = setInterval(()=>{
    if(closed) return
    const updates = ids.map(id => ({
      id,
      level: Math.max(0, Math.min(100, Math.round(50 + (Math.random()-0.5)*40)))
    }))
    onMessage({ type: 'levels', data: updates })
  }, 1500)

  return {
    close: ()=> { closed = true; clearInterval(interval) }
  }
}
