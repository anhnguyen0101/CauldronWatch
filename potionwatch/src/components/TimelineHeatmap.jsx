import React, { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import usePotionStore from '../store/usePotionStore'
import { motion } from 'framer-motion'
import { startMockSocket } from '../services/websocket'

const statusColorMap = {
  normal: 'border-cyan-400 bg-cyan-700',
  filling: 'border-sky-400 bg-sky-700',
  draining: 'border-orange-400 bg-orange-700',
  overfill: 'border-red-400 bg-red-700',
  underfill: 'border-gray-400 bg-gray-700'
}

export default function TimelineHeatmap({ onCellClick } = {}){
  const history = usePotionStore(s => s.history)
  const cauldrons = usePotionStore(s => s.cauldrons)
  const applySnapshot = usePotionStore(s => s.applyHistorySnapshot)
  const setSelectedIndex = usePotionStore(s => s.setSelectedHistoryIndex)

  const [playing, setPlaying] = useState(false)
  const [hoveredCauldron, setHoveredCauldron] = useState(null)
  const [hoveredCell, setHoveredCell] = useState(null)
  const [isLive, setIsLive] = useState(true)
  const [updatedCell, setUpdatedCell] = useState(null)

  const [columns, setColumns] = useState(() => (history || []).map(h => ({ time: h.time, cauldrons: h.cauldrons || [] })))
  const columnsMapRef = useRef(new Map())

  const timerRef = useRef(null)
  const scrollRef = useRef(null)

  // init from history
  useEffect(()=>{
    const initial = (history || []).map(h => ({ time: h.time, cauldrons: h.cauldrons || [] }))
    setColumns(initial)
    columnsMapRef.current = new Map(initial.map(c => [c.time, c]))
    // scroll to rightmost
    const el = scrollRef.current
    setTimeout(()=>{
      if(el) el.scrollTo({ left: Math.max(0, el.scrollWidth - el.clientWidth), behavior: 'smooth' })
    }, 30)
  }, [history?.length])

  // helper to read metrics for a cauldron in a column/day
  const getMetrics = (day, id) => {
    return (day?.cauldrons || []).find(c => c.id === id) || null
  }

  // apply snapshot when clicking a cell
  const handleCellClick = (colIndex, cauldronId) => {
    // if history contains same-length snapshot, call applySnapshot with index
    if(history && history[colIndex]){
      applySnapshot(colIndex)
      setSelectedIndex(colIndex)
    }
    if(onCellClick) onCellClick({ colIndex, cauldronId })
  }

  // playback (simple)
  useEffect(()=>{
    if(!playing) return
    if(!history || history.length === 0){ setPlaying(false); return }
    let idx = 0
    timerRef.current = setInterval(()=>{
      applySnapshot(idx)
      const el = scrollRef.current
      const col = el?.querySelectorAll('.pw-col')?.[idx]
      if(col && el) col.scrollIntoView({ behavior: 'smooth', inline: 'center' })
      idx += 1
      if(idx >= history.length){ clearInterval(timerRef.current); timerRef.current = null; setPlaying(false) }
    }, 700)
    return ()=>{ if(timerRef.current){ clearInterval(timerRef.current); timerRef.current = null } }
  }, [playing, history])

  // live socket subscription: collect incoming updates into minute-keyed columns
  useEffect(()=>{
    const minuteKey = (ts) => { const d = new Date(ts); return d.toISOString().slice(0,16) }
    const MAX_POINTS = 20

    const processEntry = (entry) => {
      if(!isLive) return
      const key = minuteKey(entry.timestamp ?? Date.now())
      const map = columnsMapRef.current
      let col = map.get(key)
      if(!col){
        col = { time: new Date(entry.timestamp ?? Date.now()).toLocaleTimeString(), cauldrons: [] }
        map.set(key, col)
      }
      const existing = col.cauldrons.find(c => c.id === entry.cauldron)
      const newMetrics = { id: entry.cauldron, name: entry.cauldron.toUpperCase(), status: entry.status, fillPercent: entry.fillPercent, drainVolume: entry.drainVolume, alertCount: entry.alertCount, discrepancy: entry.discrepancy }
      if(existing) Object.assign(existing, newMetrics)
      else col.cauldrons.push(newMetrics)

      // enforce max points
      while(map.size > MAX_POINTS){
        const k = map.keys().next().value
        map.delete(k)
      }

      const arr = Array.from(map.values())
      setColumns(arr)

      // mark updated cell briefly
      const colIndex = arr.length - 1
      setUpdatedCell({ colIndex, cauldronId: entry.cauldron })
      setTimeout(()=> setUpdatedCell(null), 900)
      // auto-scroll to rightmost
      const el = scrollRef.current
      if(el) el.scrollTo({ left: Math.max(0, el.scrollWidth - el.clientWidth), behavior: 'smooth' })
    }

    const wrapped = (msg) => {
      // support mock that emits a batch of levels
      if(msg && Array.isArray(msg.data)){
        msg.data.forEach(u => processEntry({ timestamp: Date.now(), cauldron: u.id, fillPercent: u.level, status: 'normal', drainVolume: 0, alertCount: 0 }))
      } else {
        processEntry(msg)
      }
    }
    const stop = startMockSocket(wrapped)
    return ()=>{ if(stop && typeof stop.close === 'function') stop.close() }
  }, [isLive])

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <button aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(p => !p)} className="p-2 rounded-md bg-neutral-800/40 hover:bg-neutral-800/60">{playing ? '⏸' : '▶'}</button>
          <button aria-label={isLive ? 'Pause live' : 'Resume live'} onClick={() => setIsLive(v => !v)} className="p-2 rounded-md bg-neutral-800/40 hover:bg-neutral-800/60">{isLive ? '⏸ Pause Live' : '▶ Resume Live'}</button>
          <div className="text-sm text-gray-400">Heatmap (latest on right). Click a cell to apply snapshot.</div>
        </div>
        <div className="text-sm text-neutral-400">Legend: <span className="inline-block w-3 h-3 bg-cyan-500 rounded-full ml-2 mr-1"/>Normal <span className="inline-block w-3 h-3 bg-sky-500 rounded-full ml-2 mr-1"/>Filling <span className="inline-block w-3 h-3 bg-orange-500 rounded-full ml-2 mr-1"/>Draining <span className="inline-block w-3 h-3 bg-red-500 rounded-full ml-2 mr-1"/>Overfill</div>
      </div>

      <div className="relative w-full max-w-full overflow-hidden rounded-xl bg-neutral-900 border border-neutral-700" style={{ height: 'auto' }}>
        <div ref={scrollRef} className="overflow-x-auto overflow-y-hidden w-full h-full scroll-smooth scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <div className="inline-flex min-w-max space-x-2 p-2">
            {columns.map((day, colIndex) => (
              <div key={day.time + colIndex} className={`pw-col flex-shrink-0 px-1`} style={{ minWidth: 96 }}>
                <div className="sticky top-0 bg-transparent z-10 text-xs text-center text-neutral-300 mb-2">{day.time}</div>

                <div className="grid gap-2" style={{ gridTemplateRows: `repeat(${cauldrons.length}, minmax(0, 1fr))` }}>
                  {cauldrons.map((c, rowIndex) => {
                    const m = getMetrics(day, c.id)
                    const status = m?.status || 'normal'
                    const colorClass = statusColorMap[status] || statusColorMap.normal
                    const fill = m?.fillPercent ?? (m?.level ?? 0)
                    const drain = m?.drainVolume ?? 0
                    const discrepancy = m?.discrepancy ?? 0
                    const alertCount = m?.alertCount ?? 0
                    const isLatestCol = colIndex === (columns.length - 1)

                    return (
                      <div key={c.id} className={`${rowIndex % 2 === 0 ? 'bg-neutral-900/0' : 'bg-neutral-900/5'} rounded-md p-1`}> 
                        <div
                          onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHoveredCauldron(c.id); setHoveredCell({ colIndex, cauldronId: c.id, rect: r, metrics: m, day }) }}
                          onMouseLeave={() => { setHoveredCauldron(null); setHoveredCell(null) }}
                          onClick={() => handleCellClick(colIndex, c.id)}
                          role="button"
                          className={`flex flex-col items-center justify-center text-white text-xs w-16 h-16 rounded-md border ${colorClass} ${isLatestCol ? 'ring-2 ring-accent/80 shadow' : ''} ${hoveredCauldron === c.id ? 'scale-105 ring-2 ring-accent/50' : ''} cursor-pointer relative`}
                          title={`${c.name}\n${fill}% — ${drain}L`}
                        >
                          <div className="text-[10px] font-medium">{c.name}</div>
                          <div className="text-sm font-semibold mt-1">{fill}%</div>
                          <div className="text-[10px] text-neutral-200 mt-1">{drain}L</div>
                          {alertCount > 0 && (
                            <motion.div
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={ updatedCell && updatedCell.colIndex === colIndex && updatedCell.cauldronId === c.id ? { scale: [1.3, 1, 1.15, 1], x: [0, -3, 3, 0], opacity: 1 } : { scale: [1.05, 1, 1.05], opacity: 1 } }
                              transition={ updatedCell && updatedCell.colIndex === colIndex && updatedCell.cauldronId === c.id ? { duration: 0.9 } : { repeat: Infinity, duration: 1.2 } }
                              className={`absolute -top-2 -right-2 w-5 h-5 rounded-full text-xs text-white font-bold flex items-center justify-center shadow-lg ring-2 ${alertCount >= 3 ? 'bg-orange-500 ring-orange-300' : 'bg-rose-500 ring-red-300'}`}
                              title={`${alertCount} unresolved alerts`}
                            >
                              {alertCount}
                            </motion.div>
                          )}
                          {discrepancy > 0 && (<div className="absolute inset-0 rounded-md ring-2 ring-red-500/60 pointer-events-none" />)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute left-0 top-0 h-full w-6 pointer-events-none bg-gradient-to-r from-neutral-900/90 to-transparent" />
        <div className="absolute right-0 top-0 h-full w-6 pointer-events-none bg-gradient-to-l from-neutral-900/90 to-transparent" />
      </div>

      {hoveredCell && hoveredCell.metrics && hoveredCell.rect && createPortal((() => {
        const r = hoveredCell.rect
        const left = Math.min(window.innerWidth - 260, r.right + 8)
        const top = Math.max(8, r.top - 8)
        return (
          <div style={{ position: 'fixed', left, top, zIndex: 60 }} className="w-64 bg-neutral-900/95 text-white p-3 rounded-md shadow-lg">
            <div className="font-semibold">{hoveredCell.metrics.name ?? hoveredCell.cauldronId}</div>
            <div className="text-xs text-neutral-300">Day: {hoveredCell.day?.time}</div>
            <div className="mt-1 text-sm">Status: <span className="font-medium">{hoveredCell.metrics.status}</span></div>
            <div className="text-xs">Fill: {hoveredCell.metrics.fillPercent ?? hoveredCell.metrics.level}%</div>
            <div className="text-xs">Drain volume: {hoveredCell.metrics.drainVolume}L</div>
            <div className="text-xs">Discrepancy: {hoveredCell.metrics.discrepancy}</div>
            <div className="text-xs">Alerts: {hoveredCell.metrics.alertCount}</div>
            <div className="text-xs">Predicted overflow: {hoveredCell.day?.forecast?.find(f=>f.id===hoveredCell.cauldronId)?.predictedOverflow ? 'Yes' : 'No'}</div>
          </div>
        )
      })(), document.body)}
    </div>
  )
}
