import React, { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import usePotionStore from '../store/usePotionStore'
import { AIHelpButton } from './AIExplanation'
import { motion } from 'framer-motion'
import { startSocket } from '../services/websocket'
import { fetchHistory } from '../services/api'
import { RefreshCw } from 'lucide-react'

const statusColorMap = {
  // Blue → Green: use emerald/green tones for normal/filling states so they read green in light mode
  normal: 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-700/80',
  filling: 'border-emerald-400 bg-emerald-400/10 dark:bg-emerald-600/80',
  draining: 'border-orange-400 bg-orange-400/10 dark:bg-orange-700/80',
  overfill: 'border-red-400 bg-red-400/10 dark:bg-red-700/80',
  underfill: 'border-gray-400 bg-gray-400/10 dark:bg-gray-700/80'
}

// Map fill percentage to color classes per requested ranges.
// Assumption: keep underfill (<20) and overfill (>=95) using existing alert colors.
// For normal range:
//  - >20% and <=50% -> light/medium green
//  - >50% and <95% -> darker green
const fillPercentToColorClass = (fill, status) => {
  // Preserve explicit statuses first
  if (status === 'overfill') return statusColorMap.overfill
  if (status === 'underfill') return statusColorMap.underfill

  const pct = Number(fill) || 0

  if (pct >= 95) return statusColorMap.overfill

  if (pct > 50 && pct < 95) {
    // Even darker green for higher fills
    return 'border-emerald-800 bg-emerald-800/10 dark:bg-emerald-900/80'
  }

  if (pct > 20 && pct <= 50) {
    // Medium / light green
    return 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-700/80'
  }

  // Fallback: keep default normal
  return statusColorMap.normal
}

// Return an rgba shadow color for the glow effect based on fill/status
const fillPercentToGlowColor = (fill, status) => {
  if (status === 'overfill') return 'rgba(239,68,68,0.32)' // red-500-ish
  if (status === 'underfill') return 'rgba(107,114,128,0.22)' // gray-500-ish

  const pct = Number(fill) || 0
  if (pct >= 95) return 'rgba(239,68,68,0.32)'
  if (pct > 50 && pct < 95) return 'rgba(4,120,87,0.34)' // darker emerald
  if (pct > 20 && pct <= 50) return 'rgba(16,185,129,0.28)' // medium emerald

  return 'rgba(16,185,129,0.16)'
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
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-text-light dark:text-gray-400">Time Line Series Heat Map</div>
          {isLive && (
            <div className="flex items-center gap-1.5 ml-2">
              <div className="relative flex items-center justify-center">
                {/* Pulsing ring effect */}
                <motion.div
                  className="absolute w-2 h-2 rounded-full bg-red-500"
                  animate={{
                    scale: [1, 2.5, 2.5],
                    opacity: [0.8, 0, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeOut",
                  }}
                />
                {/* Main dot */}
                <motion.div
                  className="relative w-2 h-2 rounded-full bg-red-500"
                  animate={{
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </div>
              <span className="text-xs font-medium text-red-500 dark:text-red-400">LIVE</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <AIHelpButton 
            componentName="Timeline Heatmap"
            data={{
              snapshots: history?.length || 0,
              cauldrons: columns.length > 0 ? columns[0]?.cauldrons?.length || 0 : 0,
              time_range: timeRange,
              is_live: isLive
            }}
            className="p-2.5"
            iconSize="w-5 h-5"
          />
          <button aria-label={isLive ? 'Pause live' : 'Resume live'} onClick={() => setIsLive(v => !v)} className="p-2 rounded-md bg-neutral-800/40 hover:bg-neutral-800/60">{isLive ? '⏸ Pause Live' : '▶ Resume Live'}</button>
          
          {/* Time Range Selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Time Range:</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              disabled={isLoadingHistory}
              className="px-3 py-1.5 text-sm rounded-md bg-panel-light dark:bg-neutral-800/60 border border-border-light dark:border-neutral-700 text-text-light dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800/80 focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

      <div className="flex items-center gap-4 flex-wrap mb-2">
        <div className="text-xs text-text-light/70 dark:text-gray-400">Heatmap (latest on right). Click a cell to apply snapshot.</div>
        
        {/* Color Legend */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border border-gray-400 bg-gray-400/10 dark:bg-gray-700/80" title="Underfill: &lt;20%"></div>
            <span className="text-xs text-text-light/70 dark:text-gray-400">&lt;20%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border border-emerald-500 bg-emerald-500/10 dark:bg-emerald-700/80" title="Normal: 20-50%"></div>
            <span className="text-xs text-text-light/70 dark:text-gray-400">20-50%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border border-emerald-800 bg-emerald-800/10 dark:bg-emerald-900/80" title="Normal: 50-95%"></div>
            <span className="text-xs text-text-light/70 dark:text-gray-400">50-95%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border border-red-400 bg-red-400/10 dark:bg-red-700/80" title="Overfill: ≥95%"></div>
            <span className="text-xs text-text-light/70 dark:text-gray-400">≥95%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border border-orange-400 bg-orange-400/10 dark:bg-orange-700/80" title="Draining"></div>
            <span className="text-xs text-text-light/70 dark:text-gray-400">Draining</span>
          </div>
        </div>
      </div>

      <div className="relative w-full min-w-0 overflow-hidden rounded-xl bg-panel-light dark:bg-neutral-900 border border-border-light dark:border-neutral-700" style={{ height: 'auto' }}>
        <div ref={scrollRef} className="overflow-x-auto overflow-y-hidden w-full h-full scroll-smooth scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent" style={{ maxWidth: '100%' }}>
          <div className="inline-flex space-x-2 p-2" style={{ minWidth: 'min-content' }}>
           
            {columns.map((column, colIndex) => {
              const isLiveCol = column.isLive === true
              
              return (
                <div
                  key={`${column.time}-${colIndex}`}
                  className="pw-col flex-shrink-0 px-1"
                  style={{ minWidth: 96 }}
                >
                  <div className="sticky top-0 bg-transparent z-10 text-xs text-center text-text-light/70 dark:text-text-dark/70 mb-2 flex flex-col items-center">
                    <span>{column.time}</span>
                  </div>

                  <div className="grid gap-2" style={{ gridTemplateRows: `repeat(${cauldrons.length}, minmax(0, 1fr))` }}>
                    {cauldrons.map((c, rowIndex) => {
                      const m = getMetrics(column, c.id)
                      
                      // ✅ FIX: For live column, ALWAYS use current store state
                      // For historical columns, use snapshot data
                      const fill = isLiveCol
                        ? (c.level ?? 0)  // Live: always current
                        : (m?.level ?? m?.fillPercent ?? 0)  // Historical: use snapshot
                      
                      const status = m?.status || (fill > 95 ? 'overfill' : fill < 20 ? 'underfill' : 'normal')
                      const colorClass = fillPercentToColorClass(fill, status)
                      const glowColor = fillPercentToGlowColor(fill, status)
                      const drain = m?.drainVolume ?? 0
                      const discrepancy = m?.discrepancy ?? 0
                      const alertCount = m?.alertCount ?? 0
                      const isLatestCol = colIndex === (columns.length - 1)

                      return (
                        <div key={c.id} className={`${rowIndex % 2 === 0 ? 'bg-panel-light/0 dark:bg-panel-dark/0' : 'bg-panel-light/5 dark:bg-panel-dark/5'} rounded-md p-1`}>
                          <div
                            onMouseEnter={(e) => {
                              const r = e.currentTarget.getBoundingClientRect()
                              setHoveredCauldron(c.id)
                              setHoveredCell({
                                colIndex,
                                cauldronId: c.id,
                                rect: r,
                                metrics: m,
                                column
                              })
                            }}
                            onMouseLeave={() => {
                              setHoveredCauldron(null)
                              setHoveredCell(null)
                            }}
                            onClick={() => handleCellClick(colIndex, c.id)}
                            role="button"
                            className={`flex flex-col items-center justify-center text-text-light dark:text-text-dark text-xs w-16 h-16 rounded-md border ${colorClass} ${
                              isLiveCol ? 'ring-2 ring-accent/80 shadow-lg' : ''
                            } ${
                              hoveredCauldron === c.id ? 'scale-105 ring-2 ring-accent/50' : ''
                            } cursor-pointer relative transition-all`}
                            style={{ boxShadow: `0 0 10px 3px ${glowColor}`, WebkitBoxShadow: `0 0 10px 3px ${glowColor}` }}
                            title={`${c.name}\n${fill}% — ${drain}L`}
                          >
                            <div className="text-[10px] font-medium">{c.name}</div>
                            <div className="text-sm font-semibold mt-1">{Math.round(fill)}%</div>
                            {drain ? (
                              <div className="text-[10px] text-text-light/70 dark:text-text-dark/70 mt-1">{drain}L</div>
                            ) : null}
                            
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
              )
            })}
          </div>
        </div>
      </div>

      {hoveredCell && hoveredCell.metrics && hoveredCell.rect && createPortal(
        (() => {
          const r = hoveredCell.rect
          const left = Math.min(window.innerWidth - 260, r.right + 8)
          const top = Math.max(8, r.top - 8)
          const isLiveCol = hoveredCell.colIndex === (columns.length - 1)
          return (
            <div
              style={{ position: 'fixed', left, top, zIndex: 60 }}
              className="w-64 bg-panel-light dark:bg-panel-dark text-text-light dark:text-text-dark p-3 rounded-md shadow-lg border border-border-light dark:border-border-dark"
            >
              <div className="font-semibold flex items-center justify-between">
                <span>{hoveredCell.metrics.name ?? hoveredCell.cauldronId}</span>
                {isLiveCol && (
                  <span className="text-xs text-accent font-bold">● LIVE</span>
                )}
              </div>
              <div className="text-xs text-neutral-300">Time: {hoveredCell.column?.time || hoveredCell.day?.time}</div>
              <div className="mt-1 text-sm">
                Status: <span className="font-medium">{hoveredCell.metrics.status}</span>
              </div>
              <div className="text-xs">Fill: {hoveredCell.metrics.fillPercent ?? hoveredCell.metrics.level}%</div>
              <div className="text-xs">Drain volume: {hoveredCell.metrics.drainVolume}L</div>
              <div className="text-xs">Discrepancy: {hoveredCell.metrics.discrepancy}</div>
              <div className="text-xs">Alerts: {hoveredCell.metrics.alertCount}</div>
              <div className="text-xs">Predicted overflow: {hoveredCell.day?.forecast?.find(f=>f.id===hoveredCell.cauldronId)?.predictedOverflow ? 'Yes' : 'No'}</div>
            </div>
          )
        })(),
        document.body
      )}
    </div>
  )
}
