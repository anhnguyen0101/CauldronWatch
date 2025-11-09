import React, { useEffect, useState, useMemo } from 'react'
import { fetchDiscrepancies, detectDiscrepancies } from '../services/api'
import { AlertTriangle, AlertCircle, Info, RefreshCw } from 'lucide-react'

export default function Discrepancies() {
  const [allDiscrepancies, setAllDiscrepancies] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterSeverity, setFilterSeverity] = useState(null)
  const [filterCauldron, setFilterCauldron] = useState(null)
  const [lastFetchTime, setLastFetchTime] = useState(null)
  const [timeRange, setTimeRange] = useState('7d') // '1d' | '7d' | '15d'

  const getWindowForRange = (range) => {
    const end = new Date()
    let start

    switch (range) {
      case '1d':
        start = new Date(end.getTime() - 1 * 24 * 60 * 60 * 1000)
        break
      case '15d':
        start = new Date(end.getTime() - 15 * 24 * 60 * 60 * 1000)
        break
      case '7d':
      default:
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
    }

    return {
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    }
  }

  // Load discrepancies whenever timeRange changes
  useEffect(() => {
    async function loadDiscrepancies() {
      try {
        setLoading(true)
        console.log(`🔍 Loading discrepancies for range: ${timeRange}`)

        const window = getWindowForRange(timeRange)

        // ✅ detect with correct payload
        const detectResult = await detectDiscrepancies(window)
        console.log('✅ Detection complete:', detectResult)

        const result = await fetchDiscrepancies(null, null)
        console.log('📊 Fetched discrepancies:', result.discrepancies?.length || 0, 'items')

        setAllDiscrepancies(result.discrepancies || [])
        setLastFetchTime(new Date())
      } catch (error) {
        console.error('❌ Error loading discrepancies:', error)
        setAllDiscrepancies([])
      } finally {
        setLoading(false)
      }
    }

    loadDiscrepancies()
  }, [timeRange])

  // Manual refresh (honors current timeRange)
  const handleRefresh = async () => {
    try {
      setLoading(true)
      console.log(`🔄 Refreshing discrepancies for range: ${timeRange}`)

      const window = getWindowForRange(timeRange)

      const detectResult = await detectDiscrepancies(window)
      console.log('✅ Detection complete:', detectResult)

      const result = await fetchDiscrepancies(null, null)
      console.log('📊 Refreshed discrepancies:', result.discrepancies?.length || 0, 'items')

      setAllDiscrepancies(result.discrepancies || [])
      setLastFetchTime(new Date())
    } catch (error) {
      console.error('❌ Error refreshing discrepancies:', error)
    } finally {
      setLoading(false)
    }
  }

  // Apply date range + severity + cauldron filters on client
  const filteredDiscrepancies = useMemo(() => {
    if (!allDiscrepancies || allDiscrepancies.length === 0) return []

    const { start_time, end_time } = getWindowForRange(timeRange)
    const startDate = new Date(start_time)
    const endDate = new Date(end_time)

    let filtered = allDiscrepancies.filter((d) => {
      if (!d.date) return false
      const rowDate = new Date(d.date)
      return rowDate >= startDate && rowDate <= endDate
    })

    if (filterSeverity) {
      filtered = filtered.filter((d) => d.severity === filterSeverity)
    }

    if (filterCauldron) {
      const searchTerm = filterCauldron.toLowerCase()
      filtered = filtered.filter((d) =>
        d.cauldron_id?.toLowerCase().includes(searchTerm)
      )
    }

    return filtered
  }, [allDiscrepancies, filterSeverity, filterCauldron, timeRange])

  const summary = useMemo(() => {
    const total = filteredDiscrepancies.length
    const critical = filteredDiscrepancies.filter((d) => d.severity === 'critical').length
    const warning = filteredDiscrepancies.filter((d) => d.severity === 'warning').length
    const info = filteredDiscrepancies.filter((d) => d.severity === 'info').length
    return { total, critical, warning, info }
  }, [filteredDiscrepancies])

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

  if (loading) {
    return (
      <div className="card">
        <h3 className="panel-title mb-4">Ticket–Drain Discrepancies</h3>
        <div className="text-center py-8 text-gray-400">Loading discrepancies...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
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

          {/* Time range */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm"
          >
            <option value="1d">Last 1 day</option>
            <option value="7d">Last 7 days</option>
            <option value="15d">Last 15 days</option>
          </select>

          {/* Severity */}
          <select
            value={filterSeverity || ''}
            onChange={(e) => setFilterSeverity(e.target.value || null)}
            className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>

          {/* Cauldron */}
          <input
            type="text"
            placeholder="Filter by Cauldron ID..."
            value={filterCauldron || ''}
            onChange={(e) => setFilterCauldron(e.target.value || null)}
            className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm flex-1 min-w-[200px]"
          />

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title="Refresh discrepancies data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          {lastFetchTime && (
            <span className="text-xs text-gray-400">
              Last updated: {lastFetchTime.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="panel-title">Discrepancies</h3>
          <span className="text-sm text-gray-400">
            Showing {filteredDiscrepancies.length} of {allDiscrepancies.length}
          </span>
        </div>

        {filteredDiscrepancies.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            {allDiscrepancies.length === 0
              ? 'No discrepancies found for this time range.'
              : 'No discrepancies match the current filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-auto text-left">
              <thead>
                <tr className="text-gray-400 text-sm border-b border-neutral-800">
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
                    className="border-t border-neutral-800 hover:bg-neutral-800/50 transition-colors"
                  >
                    <td className="px-3 py-3">
                      <div className={`flex items-center gap-2 px-2 py-1 rounded ${getSeverityColor(d.severity)}`}>
                        {getSeverityIcon(d.severity)}
                        <span className="text-xs font-medium capitalize">
                          {d.severity}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-100 font-mono text-sm">
                      {d.cauldron_id?.replace('cauldron_', '').toUpperCase() ||
                        d.cauldron_id}
                    </td>
                    <td className="px-3 py-3 text-gray-300 font-mono text-xs">
                      {d.ticket_id}
                    </td>
                    <td className="px-3 py-3 text-gray-300 text-sm">
                      {d.date || '-'}
                    </td>
                    <td className="px-3 py-3 text-gray-100">
                      {Math.round(d.ticket_volume || 0)} L
                    </td>
                    <td className="px-3 py-3 text-gray-100">
                      {Math.round(d.actual_drained || 0)} L
                    </td>
                    <td
                      className={`px-3 py-3 font-semibold ${(d.discrepancy || 0) > 0
                        ? 'text-green-400'
                        : (d.discrepancy || 0) < 0
                          ? 'text-red-400'
                          : 'text-gray-400'
                        }`}
                    >
                      {(d.discrepancy || 0) > 0 ? '+' : ''}
                      {Math.round(d.discrepancy || 0)} L
                    </td>
                    <td
                      className={`px-3 py-3 font-semibold ${Math.abs(d.discrepancy_percent || 0) > 20
                        ? 'text-red-400'
                        : Math.abs(d.discrepancy_percent || 0) > 5
                          ? 'text-yellow-400'
                          : 'text-gray-400'
                        }`}
                    >
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
