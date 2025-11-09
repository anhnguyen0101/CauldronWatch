import React, { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import usePotionStore from '../store/usePotionStore'
import { motion } from 'framer-motion'

export default function History(){
  const [playing, setPlaying] = useState(false)
  const history = usePotionStore(s => s.history)
  const [index, setIndex] = useState(0)

  useEffect(()=>{
    let t
    if(playing){
      t = setInterval(()=>{
        setIndex(i => Math.min(history.length-1, i+1))
      }, 800)
    }
    return ()=> clearInterval(t)
  }, [playing, history.length])

  return (
    <div>
      <div className="card mb-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Potion Levels Playback</h3>
          <div className="flex items-center gap-2">
            <button onClick={()=>setPlaying(p=>!p)} className="px-3 py-1 rounded-md bg-neutral-800/40 hover:bg-neutral-800/60">{playing ? 'Pause' : 'Play'}</button>
            <button onClick={()=>setIndex(0)} className="px-3 py-1 rounded-md bg-neutral-800/40 hover:bg-neutral-800/60">Restart</button>
          </div>
        </div>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}
              margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <XAxis dataKey="time" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="avgLevel" stroke="#38bdf8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <motion.div layout className="mt-3">
          <div className="h-2 bg-neutral-800 rounded-full overflow-hidden border border-neutral-800">
            <div className="h-full bg-accent" style={{width: `${(index/(Math.max(1, history.length-1)))*100}%`}} />
          </div>
        </motion.div>
      </div>
    </div>
  )
}
