import React, { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import usePotionStore from '../store/usePotionStore'
import { AIHelpButton } from './AIExplanation'
import { motion } from 'framer-motion'
import { startSocket } from '../services/websocket'
import { fetchHistory } from '../services/api'
import { RefreshCw } from 'lucide-react'

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
  const [timeRange, setTimeRange] = useState('24h') // Default: 24 hours
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  
  // Store ALL fetched history data (7 days) - fetched once
  const [allHistoryData, setAllHistoryData] = useState([])
  const [lastFetchTime, setLastFetchTime] = useState(null)

  const [columns, setColumns] = useState(() => (history || []).map(h => ({ time: h.time, cauldrons: h.cauldrons || [] })))
  const columnsMapRef = useRef(new Map())

  // DEBUG: Log cauldrons and history data
  useEffect(() => {
    console.log('🔍 TimelineHeatmap DEBUG:')
    console.log('  📊 Cauldrons in store:', cauldrons.length, cauldrons.map(c => ({ id: c.id, name: c.name, level: c.level })))
    console.log('  📜 History snapshots:', history.length, history.map(h => ({ time: h.time, hasCauldrons: !!h.cauldrons, cauldronsCount: h.cauldrons?.length || 0, avgLevel: h.avgLevel })))
    console.log('  📦 Columns data:', columns.length, columns.map(col => ({ time: col.time, cauldrons: col.cauldrons.length })))
  }, [cauldrons, history, columns])

  const timerRef = useRef(null)
  const scrollRef = useRef(null)
  const hasLoadedRef = useRef(false)

  // Time range options (memoized to prevent unnecessary re-renders)
  const timeRangeOptions = React.useMemo(() => [
    { value: '1h', label: 'Last 1 Hour', hours: 1 },
    { value: '6h', label: 'Last 6 Hours', hours: 6 },
    { value: '24h', label: 'Last 24 Hours', hours: 24 },
    { value: '7d', label: 'Last 7 Days', hours: 24 * 7 },
    { value: '30d', label: 'Last 30 Days', hours: 24 * 30 },
  ], [])

  // Fetch 7 days of data once on mount (covers all time range options)
  useEffect(() => {
    if (hasLoadedRef.current) return
    
    async function loadAllHistory() {
      setIsLoadingHistory(true)
      const endDate = new Date()
      // Fetch 7 days to cover all time range options (1h, 6h, 24h, 7d)
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
      
      // Get cauldrons from store for capacity calculation
      const store = usePotionStore.getState()
      const cauldronsMap = new Map(store.cauldrons.map(c => [c.id, c]))
      
      console.log('📊 Loading 7 days of timeline data (cached for all ranges)...')
      try {
        const h = await fetchHistory(null, startDate.toISOString(), endDate.toISOString(), cauldronsMap)
        if (h && Array.isArray(h)) {
          console.log(`📊 Loaded ${h.length} history snapshots (7 days) - ready for client-side filtering`)
          setAllHistoryData(h)
          setLastFetchTime(new Date())
          hasLoadedRef.current = true
          
          // Apply default 24h filter initially
          applyTimeRangeFilter('24h', h)
        }
      } catch (err) {
        console.error('❌ Error loading history:', err)
      } finally {
        setIsLoadingHistory(false)
      }
    }
    
    // Only load if we don't have data yet and cauldrons are loaded
    const store = usePotionStore.getState()
    if (store.cauldrons.length > 0) {
      loadAllHistory()
    }
  }, [cauldrons.length]) // Re-run if cauldrons are loaded

  // Helper function to filter history by time range (client-side, no API call)
  const applyTimeRangeFilter = React.useCallback((rangeValue, dataToFilter) => {
    const selectedRange = timeRangeOptions.find(opt => opt.value === rangeValue)
    const data = dataToFilter || allHistoryData
    if (!selectedRange || !data || data.length === 0) return

    const endTime = Date.now()
    const startTime = endTime - (selectedRange.hours * 60 * 60 * 1000)
    
    // Filter client-side by timestamp (now stored in each snapshot)
    const filtered = data.filter(snapshot => {
      const snapshotTime = snapshot.timestamp || 0
      return snapshotTime >= startTime && snapshotTime <= endTime
    })
    
    console.log(`📊 Filtered to ${filtered.length} snapshots for ${selectedRange.label} (from ${data.length} total)`)
    
    // Update store with filtered data
    const push = usePotionStore.getState().pushHistorySnapshot
    usePotionStore.setState({ history: [] })
    filtered.forEach(s => push(s))
  }, [allHistoryData, timeRangeOptions])

  // Apply filter when time range changes (client-side, no API call)
  useEffect(() => {
    if (!hasLoadedRef.current || allHistoryData.length === 0) return
    
    applyTimeRangeFilter(timeRange)
  }, [timeRange, allHistoryData.length, applyTimeRangeFilter]) // Re-filter when range changes or data is loaded

  // Manual refresh function
  const handleRefresh = async () => {
    setIsLoadingHistory(true)
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000)
    
    const store = usePotionStore.getState()
    const cauldronsMap = new Map(store.cauldrons.map(c => [c.id, c]))
    
    console.log('🔄 Refreshing timeline data (7 days)...')
    try {
      const h = await fetchHistory(null, startDate.toISOString(), endDate.toISOString(), cauldronsMap)
      if (h && Array.isArray(h)) {
        console.log(`📊 Refreshed ${h.length} history snapshots`)
        setAllHistoryData(h)
        setLastFetchTime(new Date())
        // Re-apply current filter
        applyTimeRangeFilter(timeRange, h)
      }
    } catch (err) {
      console.error('❌ Error refreshing history:', err)
    } finally {
      setIsLoadingHistory(false)
    }
  }

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

  // Subscribe to store updates for live updates
  // The main socket connection in useInit already updates the store's history
  // This effect just ensures the timeline updates when history changes
  useEffect(()=>{
    if(!isLive) return
    
    // History updates are already handled by the main useEffect above
    // Just ensure we scroll to the rightmost column when new data arrives
    const el = scrollRef.current
    if(el && columns.length > 0){
      setTimeout(()=>{
        el.scrollTo({ left: Math.max(0, el.scrollWidth - el.clientWidth), behavior: 'smooth' })
      }, 100)
    }
  }, [isLive, columns.length, history?.length])

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <AIHelpButton 
            componentName="Timeline Heatmap"
            data={{
              snapshots: history?.length || 0,
              cauldrons: columns.length > 0 ? columns[0]?.cauldrons?.length || 0 : 0,
              time_range: timeRange,
              is_live: isLive
            }}
          />
          <button aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(p => !p)} className="p-2 rounded-md bg-neutral-800/40 hover:bg-neutral-800/60">{playing ? '⏸' : '▶'}</button>
          <button aria-label={isLive ? 'Pause live' : 'Resume live'} onClick={() => setIsLive(v => !v)} className="p-2 rounded-md bg-neutral-800/40 hover:bg-neutral-800/60">{isLive ? '⏸ Pause Live' : '▶ Resume Live'}</button>
          
          {/* Time Range Selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Time Range:</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              disabled={isLoadingHistory}
              className="px-3 py-1.5 text-sm rounded-md bg-neutral-800/60 border border-neutral-700 text-white hover:bg-neutral-800/80 focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {timeRangeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {isLoadingHistory && (
              <span className="text-xs text-gray-400">Loading...</span>
            )}
            {lastFetchTime && !isLoadingHistory && (
              <span className="text-xs text-gray-500">
                ({allHistoryData.length} snapshots cached)
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={isLoadingHistory}
              className="px-2 py-1.5 text-sm rounded-md bg-neutral-800/60 border border-neutral-700 text-white hover:bg-neutral-800/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              title="Refresh timeline data (7 days)"
            >
              <RefreshCw size={14} className={isLoadingHistory ? 'animate-spin' : ''} />
            </button>
          </div>
          
          <div className="text-sm text-gray-400">Heatmap (latest on right). Click a cell to apply snapshot.</div>
        </div>
      </div>

      <div className="relative w-full min-w-0 overflow-hidden rounded-xl bg-neutral-900 border border-neutral-700" style={{ height: 'auto' }}>
        <div ref={scrollRef} className="overflow-x-auto overflow-y-hidden w-full h-full scroll-smooth scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent" style={{ maxWidth: '100%' }}>
          <div className="inline-flex space-x-2 p-2" style={{ minWidth: 'min-content' }}>
            {columns.map((day, colIndex) => (
              <div key={day.time + colIndex} className={`pw-col flex-shrink-0 px-1`} style={{ minWidth: 96 }}>
                <div className="sticky top-0 bg-transparent z-10 text-xs text-center text-neutral-300 mb-2">{day.time}</div>

                <div className="grid gap-2" style={{ gridTemplateRows: `repeat(${cauldrons.length}, minmax(0, 1fr))` }}>
                  {cauldrons.map((c, rowIndex) => {
                    const m = getMetrics(day, c.id)
                    
                    // DEBUG: Log metrics for first few cells to diagnose
                    if (rowIndex === 0 && colIndex < 3) {
                      console.log(`🔍 Timeline Cell [${colIndex}] (${c.id}, ${day.time}):`, {
                        hasMetrics: !!m,
                        metricsLevel: m?.level,
                        storeLevel: c.level,
                        dayCauldronsCount: day.cauldrons?.length,
                        dayCauldrons: day.cauldrons?.slice(0, 2)
                      })
                    }
                    
                    // Use historical snapshot level if available, otherwise fallback to store level
                    // m?.level is the percentage from the historical snapshot
                    const fill = m?.level ?? c.level ?? 0
                    const status = m?.status || (fill > 95 ? 'overfill' : fill < 20 ? 'underfill' : 'normal')
                    const colorClass = statusColorMap[status] || statusColorMap.normal
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
                          {drain > 0 && (
                            <div className="text-[10px] text-neutral-200 mt-1">{drain}L</div>
                          )}
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
