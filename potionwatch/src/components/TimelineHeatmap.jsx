import React, { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import usePotionStore from '../store/usePotionStore'
import { motion } from 'framer-motion'
import { RefreshCw } from 'lucide-react'
import { fetchHistoryOptimized, invalidateHistoryCache, prefetchNextRange } from '../services/optimizedApi'

const statusColorMap = {
  normal: 'border-cyan-400 bg-cyan-700',
  filling: 'border-sky-400 bg-sky-700',
  draining: 'border-orange-400 bg-orange-700',
  overfill: 'border-red-400 bg-red-700',
  underfill: 'border-gray-400 bg-gray-700'
}

export default function TimelineHeatmap({ onCellClick } = {}) {
  const history = usePotionStore(s => s.history)
  const cauldrons = usePotionStore(s => s.cauldrons)
  const applySnapshot = usePotionStore(s => s.applyHistorySnapshot)
  const setSelectedIndex = usePotionStore(s => s.setSelectedHistoryIndex)

  const [playing, setPlaying] = useState(false)
  const [hoveredCauldron, setHoveredCauldron] = useState(null)
  const [hoveredCell, setHoveredCell] = useState(null)
  const [isLive, setIsLive] = useState(true)
  const [timeRange, setTimeRange] = useState('24h')
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [lastFetchTime, setLastFetchTime] = useState(null)

  // ✅ OPTIMIZATION: Use refs to track state without causing re-renders
  const timerRef = useRef(null)
  const scrollRef = useRef(null)
  const hasLoadedRef = useRef(false)
  const liveUpdateTimeoutRef = useRef(null)
  const loadingRangeRef = useRef(null) // Track which range is currently loading

  // ✅ CRITICAL: Separate historical columns from live column
  // This prevents historical data from fighting with live updates
  const [historicalColumns, setHistoricalColumns] = useState([])
  const [liveColumn, setLiveColumn] = useState(null)

  // Time range options
  const timeRangeOptions = React.useMemo(() => [
    { value: '1h', label: 'Last 1 Hour', hours: 1 },
    { value: '6h', label: 'Last 6 Hours', hours: 6 },
    { value: '24h', label: 'Last 24 Hours', hours: 24 },
    { value: '7d', label: 'Last 7 Days', hours: 24 * 7 },
    { value: '30d', label: 'Last 30 Days', hours: 24 * 30 },
  ], [])

  // ✅ OPTIMIZATION 1: Load data only for selected time range (not all 7 days upfront)
  const loadHistoryForRange = useCallback(async (range) => {
    if (cauldrons.length === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log('⏳ Waiting for cauldrons to load...')
      }
      return
    }

    // Prevent duplicate loads for the same range
    if (loadingRangeRef.current === range) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`⏭️  Skipping duplicate load for ${range} (already loading)`)
      }
      return
    }

    loadingRangeRef.current = range
    setIsLoadingHistory(true)
    const cauldronsMap = new Map(cauldrons.map(c => [c.id, c]))

    try {
      const snapshots = await fetchHistoryOptimized(range, cauldronsMap)
      
      // Update store with fetched history
      const push = usePotionStore.getState().pushHistorySnapshot
      usePotionStore.setState({ history: [] })
      snapshots.forEach(s => push(s))
      
      setLastFetchTime(new Date())
      
      // Prefetch next range in background for faster switching
      prefetchNextRange(range, cauldronsMap)
      
    } catch (err) {
      console.error(`❌ Error loading ${range}:`, err)
    } finally {
      setIsLoadingHistory(false)
      hasLoadedRef.current = true
      loadingRangeRef.current = null // Clear loading flag
    }
  }, [cauldrons])

  // ✅ Initial load: Only fetch default time range (24h)
  useEffect(() => {
    if (hasLoadedRef.current || cauldrons.length === 0) return
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Initial load: fetching 24h of data')
    }
    loadHistoryForRange('24h')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cauldrons.length]) // Only depend on cauldrons.length, not the callback

  // ✅ Reload when time range changes
  useEffect(() => {
    if (!hasLoadedRef.current) return // Don't load on mount (initial load handles it)
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Time range changed to ${timeRange}, fetching...`)
    }
    loadHistoryForRange(timeRange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]) // Only depend on timeRange, not the callback

  // ✅ OPTIMIZATION 2: Separate historical data from live updates
  // Historical columns = immutable snapshots from history
  // Live column = always reflects current store state
  useEffect(() => {
    // Process historical columns
    const historical = (history || []).map(h => ({
      time: h.time,
      timestamp: h.timestamp,
      cauldrons: h.cauldrons || [],
      isHistorical: true
    }))
    
    setHistoricalColumns(historical)
  }, [history])

  // ✅ OPTIMIZATION 3: Update live column immediately when cauldrons change
  // This ensures the rightmost column ALWAYS shows current state (matches graph)
  useEffect(() => {
    if (cauldrons.length === 0) {
      setLiveColumn(null)
      return
    }

    // Debounce rapid updates to prevent excessive re-renders
    if (liveUpdateTimeoutRef.current) {
      clearTimeout(liveUpdateTimeoutRef.current)
    }

    liveUpdateTimeoutRef.current = setTimeout(() => {
      const now = new Date()
      setLiveColumn({
        time: now.toLocaleTimeString(),
        timestamp: now.getTime(),
        cauldrons: cauldrons.map(c => ({
          id: c.id,
          level: c.level ?? 0,
          fillPercent: c.level ?? 0,
          status: c.status || 'normal',
          name: c.name,
          drainVolume: c.drainVolume ?? 0,
          discrepancy: c.discrepancy ?? 0,
          alertCount: c.alertCount ?? 0
        })),
        isLive: true
      })
    }, 100) // 100ms debounce

    return () => {
      if (liveUpdateTimeoutRef.current) {
        clearTimeout(liveUpdateTimeoutRef.current)
      }
    }
  }, [cauldrons]) // Update whenever cauldrons change

  // ✅ Combine historical + live columns for display
  const allColumns = React.useMemo(() => {
    const columns = [...historicalColumns]
    if (liveColumn) {
      columns.push(liveColumn)
    }
    return columns
  }, [historicalColumns, liveColumn])

  // Auto-scroll to rightmost (live) column
  useEffect(() => {
    if (!isLive || allColumns.length === 0) return

    const el = scrollRef.current
    if (!el) return

    // Small delay to ensure DOM is updated
    setTimeout(() => {
      el.scrollTo({
        left: Math.max(0, el.scrollWidth - el.clientWidth),
        behavior: 'smooth'
      })
    }, 50)
  }, [isLive, allColumns.length])

  // Manual refresh
  const handleRefresh = async () => {
    invalidateHistoryCache()
    await loadHistoryForRange(timeRange)
  }

  // Helper to get metrics for a cauldron in a column
  const getMetrics = useCallback((column, cauldronId) => {
    return column?.cauldrons?.find(c => c.id === cauldronId) || null
  }, [])

  // Handle cell click
  const handleCellClick = useCallback((colIndex, cauldronId) => {
    // Don't apply snapshot if clicking live column
    if (colIndex === allColumns.length - 1 && allColumns[colIndex]?.isLive) {
      console.log('Clicked live column, no snapshot to apply')
      return
    }

    if (history && history[colIndex]) {
      applySnapshot(colIndex)
      setSelectedIndex(colIndex)
    }
    
    if (onCellClick) {
      onCellClick({ colIndex, cauldronId })
    }
  }, [allColumns, history, applySnapshot, setSelectedIndex, onCellClick])

  // Playback functionality
  useEffect(() => {
    if (!playing) return
    if (!history || history.length === 0) {
      setPlaying(false)
      return
    }

    let idx = 0
    timerRef.current = setInterval(() => {
      applySnapshot(idx)
      
      const el = scrollRef.current
      const col = el?.querySelectorAll('.pw-col')?.[idx]
      if (col && el) {
        col.scrollIntoView({ behavior: 'smooth', inline: 'center' })
      }

      idx += 1
      if (idx >= history.length) {
        clearInterval(timerRef.current)
        timerRef.current = null
        setPlaying(false)
      }
    }, 700)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [playing, history, applySnapshot])

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={() => setPlaying(p => !p)}
            className="p-2 rounded-md bg-neutral-800/40 hover:bg-neutral-800/60"
          >
            {playing ? '⏸' : '▶'}
          </button>
          
          <button
            aria-label={isLive ? 'Pause live' : 'Resume live'}
            onClick={() => setIsLive(v => !v)}
            className="p-2 rounded-md bg-neutral-800/40 hover:bg-neutral-800/60"
          >
            {isLive ? '⏸ Pause Live' : '▶ Resume Live'}
          </button>
          
          {/* Time Range Selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-text-light dark:text-gray-400">Time Range:</label>
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
              <span className="text-xs text-text-light dark:text-gray-400">Loading...</span>
            )}
            
            {lastFetchTime && !isLoadingHistory && (
              <span className="text-xs text-gray-500">
                (Updated {lastFetchTime.toLocaleTimeString()})
              </span>
            )}
            
            <button
              onClick={handleRefresh}
              disabled={isLoadingHistory}
              className="px-2 py-1.5 text-sm rounded-md bg-neutral-800/60 border border-neutral-700 text-white hover:bg-neutral-800/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              title="Refresh timeline data"
            >
              <RefreshCw size={14} className={isLoadingHistory ? 'animate-spin' : ''} />
            </button>
          </div>
          
<<<<<<< HEAD
          <div className="text-sm text-gray-400">
            Heatmap (live on right). Click a cell to apply snapshot.
          </div>
        </div>
      </div>

      <div className="relative w-full min-w-0 overflow-hidden rounded-xl bg-neutral-900 border border-neutral-700" style={{ height: 'auto' }}>
        {isLoadingHistory && allColumns.length === 0 && (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-2"></div>
              <div className="text-sm">Loading timeline data...</div>
            </div>
          </div>
        )}
        
        <div
          ref={scrollRef}
          className="overflow-x-auto overflow-y-hidden w-full h-full scroll-smooth scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
          style={{ maxWidth: '100%' }}
        >
          <div className="inline-flex space-x-2 p-2" style={{ minWidth: 'min-content' }}>
            {allColumns.length === 0 && !isLoadingHistory && cauldrons.length > 0 && (
              <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
                No timeline data available yet. Waiting for history...
=======
          <div className="text-sm text-text-light dark:text-gray-400">Heatmap (latest on right). Click a cell to apply snapshot.</div>
        </div>
      </div>

      <div className="relative w-full min-w-0 overflow-hidden rounded-xl bg-panel-light dark:bg-neutral-900 border border-border-light dark:border-neutral-700" style={{ height: 'auto' }}>
        <div ref={scrollRef} className="overflow-x-auto overflow-y-hidden w-full h-full scroll-smooth scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent" style={{ maxWidth: '100%' }}>
          <div className="inline-flex space-x-2 p-2" style={{ minWidth: 'min-content' }}>
            {columns.map((day, colIndex) => (
              <div key={day.time + colIndex} className={`pw-col flex-shrink-0 px-1`} style={{ minWidth: 96 }}>
                <div className="sticky top-0 bg-transparent z-10 text-xs text-center text-text-light dark:text-neutral-300 mb-2">{day.time}</div>

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
                      <div key={c.id} className={`${rowIndex % 2 === 0 ? 'bg-panel-light/0' : 'bg-panel-light/5'} rounded-md p-1`}> 
                        <div
                          onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHoveredCauldron(c.id); setHoveredCell({ colIndex, cauldronId: c.id, rect: r, metrics: m, day }) }}
                          onMouseLeave={() => { setHoveredCauldron(null); setHoveredCell(null) }}
                          onClick={() => handleCellClick(colIndex, c.id)}
                          role="button"
                          className={`flex flex-col items-center justify-center text-text-light dark:text-white text-xs w-16 h-16 rounded-md border ${colorClass} ${isLatestCol ? 'ring-2 ring-accent/80 shadow' : ''} ${hoveredCauldron === c.id ? 'scale-105 ring-2 ring-accent/50' : ''} cursor-pointer relative`}
                          title={`${c.name}\n${fill}% — ${drain}L`}
                        >
                          <div className="text-[10px] font-medium">{c.name}</div>
                          <div className="text-sm font-semibold mt-1">{fill}%</div>
                          <div className="text-[10px] text-text-light dark:text-neutral-200 mt-1">{drain}L</div>
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
>>>>>>> 1652a26 (make all pages align with lightmode)
              </div>
            )}
            
            {allColumns.map((column, colIndex) => {
              const isLiveCol = column.isLive === true
              
              return (
                <div
                  key={`${column.time}-${colIndex}`}
                  className="pw-col flex-shrink-0 px-1"
                  style={{ minWidth: 96 }}
                >
                  <div className="sticky top-0 bg-transparent z-10 text-xs text-center text-neutral-300 mb-2 flex flex-col items-center">
                    <span>{column.time}</span>
                    {isLiveCol && (
                      <span className="text-[10px] text-accent mt-0.5 font-semibold">● LIVE</span>
                    )}
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
                      const colorClass = statusColorMap[status] || statusColorMap.normal
                      const drain = m?.drainVolume ?? 0
                      const alertCount = m?.alertCount ?? 0

                      return (
                        <div
                          key={c.id}
                          className={`${rowIndex % 2 === 0 ? 'bg-neutral-900/0' : 'bg-neutral-900/5'} rounded-md p-1`}
                        >
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
                            className={`flex flex-col items-center justify-center text-white text-xs w-16 h-16 rounded-md border ${colorClass} ${
                              isLiveCol ? 'ring-2 ring-accent/80 shadow-lg' : ''
                            } ${
                              hoveredCauldron === c.id ? 'scale-105 ring-2 ring-accent/50' : ''
                            } cursor-pointer relative transition-all`}
                            title={`${c.name}\n${fill}% — ${drain}L${isLiveCol ? ' (LIVE)' : ''}`}
                          >
                            <div className="text-[10px] font-medium">{c.name}</div>
                            <div className="text-sm font-semibold mt-1">{Math.round(fill)}%</div>
                            <div className="text-[10px] text-neutral-200 mt-1">{drain}L</div>
                            
                            {alertCount > 0 && (
                              <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: [1.05, 1, 1.05], opacity: 1 }}
                                transition={{ repeat: Infinity, duration: 1.2 }}
                                className={`absolute -top-2 -right-2 w-5 h-5 rounded-full text-xs text-white font-bold flex items-center justify-center shadow-lg ring-2 ${
                                  alertCount >= 3
                                    ? 'bg-orange-500 ring-orange-300'
                                    : 'bg-rose-500 ring-red-300'
                                }`}
                                title={`${alertCount} unresolved alerts`}
                              >
                                {alertCount}
                              </motion.div>
                            )}
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

        <div className="absolute left-0 top-0 h-full w-6 pointer-events-none bg-gradient-to-r from-neutral-900/90 to-transparent" />
        <div className="absolute right-0 top-0 h-full w-6 pointer-events-none bg-gradient-to-l from-neutral-900/90 to-transparent" />
      </div>

      {/* Tooltip */}
      {hoveredCell && hoveredCell.metrics && hoveredCell.rect && createPortal(((() => {
        const r = hoveredCell.rect
        const left = Math.min(window.innerWidth - 260, r.right + 8)
        const top = Math.max(8, r.top - 8)
        const isLiveCol = hoveredCell.column?.isLive === true
        
        return (
          <div
            style={{ position: 'fixed', left, top, zIndex: 60 }}
            className="w-64 bg-neutral-900/95 text-white p-3 rounded-md shadow-lg"
          >
            <div className="font-semibold flex items-center justify-between">
              <span>{hoveredCell.metrics.name ?? hoveredCell.cauldronId}</span>
              {isLiveCol && (
                <span className="text-xs text-accent font-bold">● LIVE</span>
              )}
            </div>
            <div className="text-xs text-neutral-300">Time: {hoveredCell.column?.time}</div>
            <div className="mt-1 text-sm">
              Status: <span className="font-medium">{hoveredCell.metrics.status}</span>
            </div>
            <div className="text-xs">Fill: {hoveredCell.metrics.fillPercent ?? hoveredCell.metrics.level}%</div>
            <div className="text-xs">Drain volume: {hoveredCell.metrics.drainVolume}L</div>
            <div className="text-xs">Alerts: {hoveredCell.metrics.alertCount}</div>
          </div>
        )
      })()), document.body)}
    </div>
  )
}