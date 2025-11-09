import React, { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import usePotionStore from '../store/usePotionStore'
import { motion } from 'framer-motion'
import { startSocket } from '../services/websocket'

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

  // Track drain events and alerts per cauldron for status calculation
  const drainEventsRef = useRef(new Map()) // cauldron_id -> latest drain event
  const alertsRef = useRef(new Map()) // cauldron_id -> alert count
  const discrepanciesRef = useRef(new Map()) // cauldron_id -> has discrepancy

  // live socket subscription: collect incoming updates into minute-keyed columns
  useEffect(()=>{
    if(!isLive) return

    const minuteKey = (ts) => { const d = new Date(ts); return d.toISOString().slice(0,16) }
    const MAX_POINTS = 20

    // Helper to calculate status based on level and events
    const calculateStatus = (level, cauldronId) => {
      if (level > 95) return 'overfill'
      if (level < 10) return 'underfill'
      // Check if there's a recent drain event (within last 10 minutes for better visibility)
      const drainEvent = drainEventsRef.current.get(cauldronId)
      if (drainEvent) {
        const timeSinceDrain = Date.now() - drainEvent.timestamp
        if (timeSinceDrain < 10 * 60 * 1000) { // 10 minutes
          console.log(`💧 TimelineHeatmap: ${cauldronId} is draining (${Math.round(timeSinceDrain/1000)}s ago)`)
          return 'draining'
        }
      }
      // Check if level is increasing (filling)
      // For now, default to normal unless we have more data
      return 'normal'
    }

    const processCauldronUpdate = (cauldronData, timestamp) => {
      const key = minuteKey(timestamp)
      const map = columnsMapRef.current
      let col = map.get(key)
      if(!col){
        col = { time: new Date(timestamp).toLocaleTimeString(), cauldrons: [] }
        map.set(key, col)
      }

      // Process each cauldron in the update
      cauldronData.forEach(c => {
        const cauldronId = c.cauldron_id || c.id
        const level = c.level || 0
        const fillPercent = Math.round(level)
        // Recalculate status each time to ensure drain events are reflected
        const status = calculateStatus(fillPercent, cauldronId)
        const drainEvent = drainEventsRef.current.get(cauldronId)
        const drainVolume = drainEvent ? drainEvent.volume_drained || 0 : 0
        const alertCount = alertsRef.current.get(cauldronId) || 0
        const hasDiscrepancy = discrepanciesRef.current.get(cauldronId) || false

        const existing = col.cauldrons.find(c => c.id === cauldronId)
        const newMetrics = { 
          id: cauldronId, 
          name: cauldronId.replace('cauldron_', '').toUpperCase(), 
          status, 
          fillPercent, 
          drainVolume, 
          alertCount, 
          discrepancy: hasDiscrepancy ? 1 : 0 
        }
        if(existing) {
          // Force update to ensure status changes are reflected
          Object.assign(existing, newMetrics)
          // Log status changes for debugging
          if (existing.status !== status) {
            console.log(`💧 TimelineHeatmap: Status changed for ${cauldronId}: ${existing.status} -> ${status}`)
          }
        } else {
          col.cauldrons.push(newMetrics)
        }
      })

      // enforce max points
      while(map.size > MAX_POINTS){
        const k = map.keys().next().value
        map.delete(k)
      }

      const arr = Array.from(map.values())
      setColumns(arr)

      // mark updated cells briefly
      const colIndex = arr.length - 1
      cauldronData.forEach(c => {
        const cauldronId = c.cauldron_id || c.id
        setUpdatedCell({ colIndex, cauldronId })
        setTimeout(()=> setUpdatedCell(null), 900)
      })
      
      // auto-scroll to rightmost
      const el = scrollRef.current
      if(el) el.scrollTo({ left: Math.max(0, el.scrollWidth - el.clientWidth), behavior: 'smooth' })
    }

    const handleMessage = (msg) => {
      if (msg.type === 'levels' && Array.isArray(msg.data)) {
        // Process cauldron level updates (from initSocket transformation)
        // msg.data is already an array of {id, level} objects with percentages
        const timestamp = Date.now()
        const cauldronData = msg.data.map(u => ({
          cauldron_id: u.id,
          id: u.id,
          level: u.level // Already a percentage
        }))
        processCauldronUpdate(cauldronData, timestamp)
      } else if (msg.type === 'cauldron_update' && msg.data && Array.isArray(msg.data.cauldrons)) {
        // Process backend cauldron_update format directly from WebSocket
        const timestamp = msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now()
        // Backend sends raw levels, need to convert to percentage
        const cauldronData = msg.data.cauldrons.map(c => {
          const cauldronId = c.cauldron_id || c.id
          const rawLevel = c.level || 0
          const maxVolume = c.max_volume || c.capacity || 1000
          const levelPercent = Math.round((rawLevel / maxVolume) * 100)
          return {
            cauldron_id: cauldronId,
            id: cauldronId,
            level: levelPercent
          }
        })
        processCauldronUpdate(cauldronData, timestamp)
      } else if (msg.type === 'drain_event' && msg.data) {
        // Track drain event for status calculation
        console.log('💧 TimelineHeatmap: Received drain event', msg.data)
        const cauldronId = msg.data.cauldron_id
        if (cauldronId) {
          const drainTimestamp = msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now()
          drainEventsRef.current.set(cauldronId, {
            timestamp: drainTimestamp,
            volume_drained: msg.data.volume_drained || 0
          })
          console.log(`💧 TimelineHeatmap: Tracked drain for ${cauldronId}, volume: ${msg.data.volume_drained}L`)
          
          // Force re-render of all columns to update status colors
          // Get current columns and update the affected cauldron's status
          const currentColumns = Array.from(columnsMapRef.current.values())
          const updatedColumns = currentColumns.map(col => {
            const updatedCauldrons = col.cauldrons.map(c => {
              if (c.id === cauldronId) {
                // Recalculate status with new drain event
                const level = c.fillPercent || 0
                const status = calculateStatus(level, cauldronId)
                const drainEvent = drainEventsRef.current.get(cauldronId)
                return {
                  ...c,
                  status,
                  drainVolume: drainEvent ? drainEvent.volume_drained || 0 : 0
                }
              }
              return c
            })
            return { ...col, cauldrons: updatedCauldrons }
          })
          
          // Update the map and state
          // Keep existing keys, just update the columns
          updatedColumns.forEach(col => {
            // Find the existing key for this column by matching time
            for (const [key, existingCol] of columnsMapRef.current.entries()) {
              if (existingCol.time === col.time) {
                columnsMapRef.current.set(key, col)
                break
              }
            }
          })
          setColumns(updatedColumns)
          
          // Also process a new update to add a new column with drain status
          const cauldrons = usePotionStore.getState().cauldrons
          const cauldron = cauldrons.find(c => c.id === cauldronId)
          if (cauldron) {
            processCauldronUpdate([{ 
              cauldron_id: cauldronId, 
              id: cauldronId, 
              level: cauldron.level || 0 
            }], drainTimestamp)
            console.log(`💧 TimelineHeatmap: Updated timeline for ${cauldronId} with drain status (orange)`)
          } else {
            console.warn(`💧 TimelineHeatmap: Cauldron ${cauldronId} not found in store`)
          }
        }
      } else if (msg.type === 'discrepancy' && msg.data) {
        // Track discrepancy
        const cauldronId = msg.data.cauldron_id
        if (cauldronId) {
          discrepanciesRef.current.set(cauldronId, true)
          // Update alert count
          const current = alertsRef.current.get(cauldronId) || 0
          alertsRef.current.set(cauldronId, current + 1)
          // Process update to show discrepancy
          const timestamp = msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now()
          const cauldrons = usePotionStore.getState().cauldrons
          const cauldron = cauldrons.find(c => c.id === cauldronId)
          if (cauldron) {
            processCauldronUpdate([{ cauldron_id: cauldronId, id: cauldronId, level: cauldron.level || 0 }], timestamp)
          }
        }
      }
    }

    const stop = startSocket(handleMessage)
    return ()=>{ 
      if(stop && typeof stop.close === 'function') stop.close() 
    }
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
