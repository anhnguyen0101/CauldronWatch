import React, { useEffect, useState } from 'react'
import { RefreshCw, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react'
import { fetchAISummary } from '../services/api'

export default function AISummary() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchSummary = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAISummary("24 hours")
      setSummary(data)
    } catch (err) {
      console.error('Error fetching AI summary:', err)
      setError('Failed to load AI summary')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSummary()
    // Refresh every 5 minutes
    const interval = setInterval(fetchSummary, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const getRiskColor = (riskLevel) => {
    const level = riskLevel?.toUpperCase() || 'UNKNOWN'
    switch (level) {
      case 'CRITICAL':
        return 'bg-red-500/20 text-red-400 border-red-500/50'
      case 'HIGH':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/50'
      case 'MEDIUM':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
      case 'LOW':
        return 'bg-green-500/20 text-green-400 border-green-500/50'
      default:
        return 'bg-neutral-500/20 text-neutral-400 border-neutral-500/50'
    }
  }

  if (loading && !summary) {
    return (
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🤖</span>
          <h3 className="panel-title">AI Executive Summary</h3>
        </div>
        <div className="text-center py-8 text-text-light dark:text-gray-400">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full mb-2"></div>
          <div>AI analyzing data...</div>
        </div>
      </div>
    )
  }

  if (error && !summary) {
    return (
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🤖</span>
          <h3 className="panel-title">AI Executive Summary</h3>
        </div>
        <div className="text-center py-8 text-red-400">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <div>{error}</div>
          <button
            onClick={fetchSummary}
            className="mt-4 px-4 py-2 bg-accent hover:bg-accent/80 rounded-md text-white text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!summary) return null

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          <h3 className="panel-title">AI Executive Summary</h3>
          {summary.risk_level && (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRiskColor(summary.risk_level)}`}>
              {summary.risk_level}
            </span>
          )}
        </div>
        <button
          onClick={fetchSummary}
          disabled={loading}
          className="p-2 rounded-md bg-neutral-800/40 hover:bg-neutral-800/60 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refresh analysis"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-4">
        {/* Summary Text */}
        <div className="bg-neutral-800/40 rounded-lg p-4 border border-neutral-700">
          <p className="text-sm leading-relaxed text-text-light dark:text-gray-300">
            {summary.summary}
          </p>
        </div>

        {/* Key Findings */}
        {summary.key_findings && summary.key_findings.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" />
              Key Findings
            </h4>
            <ul className="space-y-2">
              {summary.key_findings.map((finding, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-light dark:text-gray-400">
                  <span className="text-blue-400 mt-0.5">🔍</span>
                  <span>{finding}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {summary.recommendations && summary.recommendations.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              Recommendations
            </h4>
            <ol className="space-y-2">
              {summary.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-light dark:text-gray-400">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-semibold">
                    {i + 1}
                  </span>
                  <span>{rec}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-700 text-xs text-text-light dark:text-gray-500">
          <small>
            Generated: {summary.generated_at ? new Date(summary.generated_at).toLocaleString() : 'Just now'}
          </small>
          {summary.note && (
            <small className="text-yellow-400 italic">{summary.note}</small>
          )}
        </div>
      </div>
    </div>
  )
}

