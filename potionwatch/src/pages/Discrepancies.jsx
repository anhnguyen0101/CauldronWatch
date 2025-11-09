import React, { useEffect, useState, useMemo } from 'react'
import { fetchDiscrepancies, detectDiscrepancies } from '../services/api'
import { AlertTriangle, AlertCircle, Info, RefreshCw } from 'lucide-react'
import { AIHelpButton } from '../components/AIExplanation'
import usePotionStore from '../store/usePotionStore'

export default function Discrepancies(){
  // Store discrepancies for current time range
  const [allDiscrepancies, setAllDiscrepancies] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterSeverity, setFilterSeverity] = useState(null)
  const [filterCauldron, setFilterCauldron] = useState(null)
  const [timeRange, setTimeRange] = useState('7d') // Default: 7 days
  const [lastFetchTime, setLastFetchTime] = useState(null)

  // Calculate date range based on selected timeRange
  const getDateRange = React.useCallback((range) => {
    const end = new Date()
    const endDateOnly = end.toISOString().split('T')[0]
    let start
    let startDateOnly
    
    switch (range) {
      case '1d':
        // For "Last 24 Hours", use today's date only (not yesterday)
        startDateOnly = endDateOnly
        break
      case '3d':
        start = new Date(end.getTime() - 3 * 24 * 60 * 60 * 1000)
        startDateOnly = start.toISOString().split('T')[0]
        break
      case '7d':
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)
        startDateOnly = start.toISOString().split('T')[0]
        break
      case '30d':
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)
        startDateOnly = start.toISOString().split('T')[0]
        break
      default:
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)
        startDateOnly = start.toISOString().split('T')[0]
    }
    
    console.log(`📅 Date range for ${range}:`, startDateOnly, 'to', endDateOnly)
    
    return {
      startDate: startDateOnly,
      endDate: endDateOnly
    }
  }, [])

  // Fetch discrepancies for selected time range
  useEffect(() => {
    async function loadDiscrepancies() {
      try {
        const { startDate, endDate } = getDateRange(timeRange)
        const dateRangeKey = `${startDate}_${endDate}`
        
        // Check store cache first (persists across navigation)
        const store = usePotionStore.getState()
        const cached = store.getCachedDiscrepancies(dateRangeKey, 5 * 60 * 1000) // 5 min cache
        
        if (cached) {
          console.log(`✅ Using cached discrepancies for ${timeRange} (from store)`)
          setAllDiscrepancies(cached)
          setLastFetchTime(new Date())
          setLoading(false)
          return
        }
        
        setLoading(true)
        console.log(`🔍 Loading discrepancies for ${timeRange} (${startDate} to ${endDate})...`)
        
        // OPTIMIZATION: Always try detection first (backend caches results)
        const detectResult = await detectDiscrepancies(startDate, endDate)
        console.log('✅ Detection complete:', detectResult.total_discrepancies || 0, 'discrepancies')
        
        const discrepancies = detectResult.discrepancies || []
        setAllDiscrepancies(discrepancies)
        setLastFetchTime(new Date())
        
        // Cache in store for cross-page navigation
        store.setCachedDiscrepancies(dateRangeKey, discrepancies)
        
        setLoading(false)
      } catch (error) {
        console.error('❌ Error loading discrepancies:', error)
        // On error, try to fetch cached results as fallback
        try {
          const { startDate, endDate } = getDateRange(timeRange)
          const result = await fetchDiscrepancies(null, null, startDate, endDate)
          const discrepancies = result.discrepancies || []
          setAllDiscrepancies(discrepancies)
          setLastFetchTime(new Date())
          
          // Cache in store even on fallback
          const dateRangeKey = `${startDate}_${endDate}`
          usePotionStore.getState().setCachedDiscrepancies(dateRangeKey, discrepancies)
        } catch (fetchError) {
          setAllDiscrepancies([])
        }
        setLoading(false)
      }
    }
    
    loadDiscrepancies()
  }, [timeRange, getDateRange]) // Re-fetch when time range changes

  // Filter discrepancies client-side (no API call)
  const filteredDiscrepancies = useMemo(() => {
    let filtered = [...allDiscrepancies]
    
    if (filterSeverity) {
      filtered = filtered.filter(d => d.severity === filterSeverity)
    }
    
    if (filterCauldron) {
      const searchTerm = filterCauldron.toLowerCase()
      filtered = filtered.filter(d => 
        d.cauldron_id?.toLowerCase().includes(searchTerm)
      )
    }
    
    return filtered
  }, [allDiscrepancies, filterSeverity, filterCauldron])

  // Calculate summary from filtered results
  const summary = useMemo(() => {
    const total = filteredDiscrepancies.length
    const critical = filteredDiscrepancies.filter(d => d.severity === 'critical').length
    const warning = filteredDiscrepancies.filter(d => d.severity === 'warning').length
    const info = filteredDiscrepancies.filter(d => d.severity === 'info').length
    
    return { total, critical, warning, info }
  }, [filteredDiscrepancies])

  // Manual refresh function
  const handleRefresh = async () => {
    try {
      setLoading(true)
      const { startDate, endDate } = getDateRange(timeRange)
      console.log(`🔄 Refreshing discrepancies for ${timeRange}...`)
      
      const detectResult = await detectDiscrepancies(startDate, endDate)
      console.log('✅ Detection complete:', detectResult)
      
      const result = await fetchDiscrepancies(null, null, startDate, endDate)
      console.log('📊 Refreshed discrepancies:', result.discrepancies?.length || 0, 'items')
      
      const discrepancies = result.discrepancies || []
      setAllDiscrepancies(discrepancies)
      setLastFetchTime(new Date())
      
      // Update cache
      const dateRangeKey = `${startDate}_${endDate}`
      usePotionStore.getState().setCachedDiscrepancies(dateRangeKey, discrepancies)
    } catch (error) {
      console.error('❌ Error refreshing discrepancies:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="text-red-400" size={16} />
      case 'warning':
        return <AlertCircle className="text-yellow-400" size={16} />
      case 'info':
        return <Info className="text-blue-400" size={16} />
      default:
        return <Info className="text-gray-400" size={16} />
    }
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'text-red-400 bg-red-400/10 border-red-400/20'
      case 'warning':
        return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
      case 'info':
        return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
      default:
        return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
    }
  }

  // OPTIMIZATION: Show layout with loading skeletons instead of blocking entire page
  const LoadingSkeleton = () => (
    <div className="space-y-6">
      {/* Summary Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card animate-pulse">
            <div className="h-4 bg-neutral-700 rounded w-24 mb-2"></div>
            <div className="h-8 bg-neutral-700 rounded w-16"></div>
          </div>
        ))}
      </div>
      
      {/* Filters Skeleton */}
      <div className="card">
        <div className="h-6 bg-neutral-700 rounded w-32 mb-4"></div>
        <div className="flex gap-4">
          <div className="h-10 bg-neutral-700 rounded w-32"></div>
          <div className="h-10 bg-neutral-700 rounded w-32"></div>
          <div className="h-10 bg-neutral-700 rounded flex-1"></div>
        </div>
      </div>
      
      {/* Table Skeleton */}
      <div className="card">
        <div className="h-6 bg-neutral-700 rounded w-48 mb-4"></div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 bg-neutral-700 rounded"></div>
          ))}
        </div>
      </div>
    </div>
  )

  if (loading) {
    return <LoadingSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Total</div>
          <div className="text-2xl font-semibold">{summary.total}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-400 mb-1 flex items-center gap-2">
            <AlertTriangle className="text-red-400" size={14} />
            Critical
          </div>
          <div className="text-2xl font-semibold text-red-400">{summary.critical}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-400 mb-1 flex items-center gap-2">
            <AlertCircle className="text-yellow-400" size={14} />
            Warning
          </div>
          <div className="text-2xl font-semibold text-yellow-400">{summary.warning}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-400 mb-1 flex items-center gap-2">
            <Info className="text-blue-400" size={14} />
            Info
          </div>
          <div className="text-2xl font-semibold text-blue-400">{summary.info}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <h3 className="panel-title">Filters</h3>
          
          {/* Time Range Selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            disabled={loading}
            className="px-3 py-2 bg-panel-light dark:bg-panel-dark border border-border-light dark:border-border-dark rounded-lg text-sm disabled:opacity-50"
          >
            <option value="1d">Last 24 Hours</option>
            <option value="3d">Last 3 Days</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          
          {/* Severity Filter */}
          <select
            value={filterSeverity || ''}
            onChange={(e) => setFilterSeverity(e.target.value || null)}
            className="px-3 py-2 bg-panel-light dark:bg-panel-dark border border-border-light dark:border-border-dark rounded-lg text-sm"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
          
          {/* Cauldron Filter */}
          <input
            type="text"
            placeholder="Filter by Cauldron ID..."
            value={filterCauldron || ''}
            onChange={(e) => setFilterCauldron(e.target.value || null)}
            className="px-3 py-2 bg-panel-light dark:bg-panel-dark border border-border-light dark:border-border-dark rounded-lg text-sm flex-1 min-w-[200px]"
          />
          
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-3 py-2 bg-panel-light dark:bg-panel-dark border border-border-light dark:border-border-dark rounded-lg text-sm hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title="Run detection & refresh data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          
          {lastFetchTime && (
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Last updated: {lastFetchTime.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Discrepancies Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="panel-title">Discrepancies</h3>
            <AIHelpButton 
              componentName="Discrepancies Table"
              data={{
                total_discrepancies: allDiscrepancies.length,
                critical: summary.critical,
                warning: summary.warning,
                info: summary.info,
                time_range: timeRange,
                sample_discrepancies: filteredDiscrepancies.slice(0, 3).map(d => ({
                  severity: d.severity,
                  cauldron_id: d.cauldron_id,
                  discrepancy_percent: d.discrepancy_percent
                }))
              }}
            />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredDiscrepancies.length} of {allDiscrepancies.length}
            </span>
          </div>
        </div>
        {filteredDiscrepancies.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            {allDiscrepancies.length === 0
              ? "No discrepancies found. All tickets match drain events perfectly!"
              : "No discrepancies match the current filters."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-auto text-left">
              <thead>
                <tr className="text-sm border-b border-border-light dark:border-border-dark text-gray-600 dark:text-gray-400">
                  <th className="px-3 py-2">Severity</th>
                  <th className="px-3 py-2">Cauldron</th>
                  <th className="px-3 py-2">Ticket ID</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Ticket Volume</th>
                  <th className="px-3 py-2">Actual Drained</th>
                  <th className="px-3 py-2">Difference</th>
                  <th className="px-3 py-2">% Off</th>
                </tr>
              </thead>
              <tbody>
                {filteredDiscrepancies.map((d, idx) => (
                  <tr
                    key={`${d.ticket_id}_${idx}`}
                    className="border-t border-border-light dark:border-border-dark hover:bg-panel-light/50 dark:hover:bg-panel-dark/50 transition-colors"
                  >
                    <td className="px-3 py-3">
                      <div className={`flex items-center gap-2 px-2 py-1 rounded ${getSeverityColor(d.severity)}`}>
                        {getSeverityIcon(d.severity)}
                        <span className="text-xs font-medium capitalize text-text-light dark:text-text-dark">
                          {d.severity}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-text-light dark:text-text-dark font-mono text-sm">
                      {d.cauldron_id
                        ?.replace('cauldron_', '')
                        .toUpperCase() || d.cauldron_id}
                    </td>
                    <td className="px-3 py-3 text-text-light/70 dark:text-text-dark/70 font-mono text-xs">
                      {d.ticket_id}
                    </td>
                    <td className="px-3 py-3 text-text-light/70 dark:text-text-dark/70 text-sm">
                      {d.date || '-'}
                    </td>
                    <td className="px-3 py-3 text-text-light dark:text-text-dark">
                      {Math.round(d.ticket_volume || 0)} L
                    </td>
                    <td className="px-3 py-3 text-text-light dark:text-text-dark">
                      {Math.round(d.actual_drained || 0)} L
                    </td>
                    <td className={`px-3 py-3 font-semibold ${
                      (d.discrepancy || 0) > 0 ? 'text-green-400' : 
                      (d.discrepancy || 0) < 0 ? 'text-red-400' : 'text-gray-400'
                    }`} title={`Raw difference: ${(d.discrepancy || 0).toFixed(2)}L`}>
                      {(d.discrepancy || 0) > 0 ? '+' : ''}{Math.round(d.discrepancy || 0)} L
                    </td>
                    <td className={`px-3 py-3 font-semibold ${
                      Math.abs(d.discrepancy_percent || 0) > 20 ? 'text-red-400' : 
                      Math.abs(d.discrepancy_percent || 0) > 5 ? 'text-yellow-400' : 'text-gray-400'
                    }`} title={`Calculation: abs(${(d.discrepancy || 0).toFixed(2)}) / max(${(d.ticket_volume || 0).toFixed(2)}, ${(d.actual_drained || 0).toFixed(2)}, 1.0) * 100 = ${(d.discrepancy_percent || 0).toFixed(2)}%`}>
                      {Math.abs(d.discrepancy_percent || 0).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
