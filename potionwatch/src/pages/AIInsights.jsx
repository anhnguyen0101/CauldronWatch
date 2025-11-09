import React, { useState, useEffect } from 'react'
import { RefreshCw, AlertTriangle, Target, Shield, TrendingDown, Clock, Info } from 'lucide-react'
import { fetchAISummary, fetchAIOptimizationPlan, fetchAIFraudAnalysis } from '../services/api'

export default function AIInsights() {
  const [summary, setSummary] = useState(null)
  const [optimizationPlan, setOptimizationPlan] = useState(null)
  const [fraudAnalysis, setFraudAnalysis] = useState(null)
  const [loading, setLoading] = useState({ summary: false, plan: false, fraud: false })
  const [error, setError] = useState({ summary: null, plan: null, fraud: null })

  const fetchAll = async () => {
    // Fetch all AI insights in parallel
    setLoading({ summary: true, plan: true, fraud: true })
    setError({ summary: null, plan: null, fraud: null })

    try {
      const [summaryData, planData, fraudData] = await Promise.all([
        fetchAISummary("24 hours").catch(err => {
          setError(prev => ({ ...prev, summary: 'Failed to load summary' }))
          return null
        }),
        fetchAIOptimizationPlan().catch(err => {
          setError(prev => ({ ...prev, plan: 'Failed to load optimization plan' }))
          return null
        }),
        fetchAIFraudAnalysis().catch(err => {
          setError(prev => ({ ...prev, fraud: 'Failed to load fraud analysis' }))
          return null
        })
      ])

      if (summaryData) setSummary(summaryData)
      if (planData) setOptimizationPlan(planData)
      if (fraudData) setFraudAnalysis(fraudData)
    } finally {
      setLoading({ summary: false, plan: false, fraud: false })
    }
  }

  useEffect(() => {
    fetchAll()
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchAll, 5 * 60 * 1000)
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

  const getRiskScoreColor = (score) => {
    if (score >= 70) return 'text-red-400'
    if (score >= 50) return 'text-orange-400'
    if (score >= 30) return 'text-yellow-400'
    return 'text-green-400'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text dark:text-white flex items-center gap-2">
            <span className="text-3xl">🤖</span>
            AI-Powered Insights
          </h1>
          <p className="text-sm text-text-light dark:text-gray-400 mt-1">
            Comprehensive analysis and recommendations for your potion network
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading.summary || loading.plan || loading.fraud}
          className="px-4 py-2 bg-accent hover:bg-accent/80 rounded-md text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${(loading.summary || loading.plan || loading.fraud) ? 'animate-spin' : ''}`} />
          Refresh All
        </button>
      </div>

      {/* Executive Summary */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold">Executive Summary</h2>
            {summary?.risk_level && (
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRiskColor(summary.risk_level)}`}>
                {summary.risk_level}
              </span>
            )}
          </div>
        </div>

        {loading.summary && !summary ? (
          <div className="text-center py-8 text-text-light dark:text-gray-400">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full mb-2"></div>
            <div>Analyzing system status...</div>
          </div>
        ) : error.summary ? (
          <div className="text-center py-8 text-red-400">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            <div>{error.summary}</div>
          </div>
        ) : summary ? (
          <div className="space-y-4">
            <div className="bg-neutral-800/40 rounded-lg p-4 border border-neutral-700">
              <p className="text-sm leading-relaxed text-text-light dark:text-gray-300">
                {summary.summary}
              </p>
            </div>

            {summary.key_findings && summary.key_findings.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Key Findings</h3>
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

            {summary.recommendations && summary.recommendations.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Recommendations</h3>
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

            {summary.generated_at && (
              <div className="text-xs text-text-light dark:text-gray-500 pt-2 border-t border-neutral-700">
                Generated: {new Date(summary.generated_at).toLocaleString()}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Optimization Plan */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-semibold">Optimization Strategy</h2>
          </div>
        </div>

        {loading.plan && !optimizationPlan ? (
          <div className="text-center py-8 text-text-light dark:text-gray-400">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full mb-2"></div>
            <div>Analyzing optimization opportunities...</div>
          </div>
        ) : error.plan ? (
          <div className="text-center py-8 text-red-400">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            <div>{error.plan}</div>
          </div>
        ) : optimizationPlan ? (
          <div className="space-y-4">
            <div className="bg-neutral-800/40 rounded-lg p-4 border border-neutral-700">
              <p className="text-sm leading-relaxed text-text-light dark:text-gray-300">
                {optimizationPlan.plan}
              </p>
            </div>

            {optimizationPlan.expected_savings && (
              <div className="grid grid-cols-3 gap-3">
                {optimizationPlan.witch_allocation?.witches_needed !== undefined && (
                  <div className="bg-neutral-800/40 rounded-lg p-3 border border-neutral-700">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-4 h-4 text-accent" />
                      <span className="text-xs text-text-light dark:text-gray-400">Witches Needed</span>
                    </div>
                    <div className="text-2xl font-bold text-accent">
                      {optimizationPlan.witch_allocation.witches_needed}
                    </div>
                  </div>
                )}
                {optimizationPlan.expected_savings.witch_hours_saved && (
                  <div className="bg-neutral-800/40 rounded-lg p-3 border border-neutral-700">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-text-light dark:text-gray-400">Hours Saved</span>
                    </div>
                    <div className="text-lg font-semibold text-blue-400">
                      {optimizationPlan.expected_savings.witch_hours_saved}
                    </div>
                  </div>
                )}
                {optimizationPlan.expected_savings.cost_reduction && (
                  <div className="bg-neutral-800/40 rounded-lg p-3 border border-neutral-700">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingDown className="w-4 h-4 text-green-400" />
                      <span className="text-xs text-text-light dark:text-gray-400">Cost Reduction</span>
                    </div>
                    <div className="text-lg font-semibold text-green-400">
                      {optimizationPlan.expected_savings.cost_reduction}
                    </div>
                  </div>
                )}
              </div>
            )}

            {optimizationPlan.witch_allocation?.rationale && (
              <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/30">
                <p className="text-xs text-blue-300 italic">
                  💡 {optimizationPlan.witch_allocation.rationale}
                </p>
              </div>
            )}

            {optimizationPlan.implementation_steps && optimizationPlan.implementation_steps.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Implementation Steps</h3>
                <div className="space-y-2">
                  {optimizationPlan.implementation_steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-3 bg-neutral-800/40 rounded-lg p-3 border border-neutral-700">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-semibold">
                        {i + 1}
                      </span>
                      <span className="text-sm text-text-light dark:text-gray-300 flex-1">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {optimizationPlan.generated_at && (
              <div className="text-xs text-text-light dark:text-gray-500 pt-2 border-t border-neutral-700">
                Generated: {new Date(optimizationPlan.generated_at).toLocaleString()}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Fraud Analysis */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold">Fraud Risk Analysis</h2>
          </div>
        </div>

        {loading.fraud && !fraudAnalysis ? (
          <div className="text-center py-8 text-text-light dark:text-gray-400">
            <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full mb-2"></div>
            <div>Analyzing fraud patterns...</div>
          </div>
        ) : error.fraud ? (
          <div className="text-center py-8 text-red-400">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            <div>{error.fraud}</div>
          </div>
        ) : fraudAnalysis ? (
          <div className="space-y-4">
            {fraudAnalysis.suspicious_patterns && fraudAnalysis.suspicious_patterns.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Suspicious Patterns</h3>
                <ul className="space-y-2">
                  {fraudAnalysis.suspicious_patterns.map((pattern, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-text-light dark:text-gray-400 bg-red-500/10 rounded-lg p-3 border border-red-500/30">
                      <span className="text-red-400 mt-0.5">⚠️</span>
                      <span>{pattern}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {fraudAnalysis.courier_risk_scores && Object.keys(fraudAnalysis.courier_risk_scores).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Courier Risk Scores</h3>
                <div className="space-y-2">
                  {Object.entries(fraudAnalysis.courier_risk_scores).map(([courierId, data]) => (
                    <div key={courierId} className="bg-neutral-800/40 rounded-lg p-3 border border-neutral-700">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-text-light dark:text-gray-300">
                          {courierId}
                        </span>
                        <span className={`text-lg font-bold ${getRiskScoreColor(data.score)}`}>
                          {data.score}/100
                        </span>
                      </div>
                      <p className="text-xs text-text-light dark:text-gray-400 mt-1">
                        {data.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {fraudAnalysis.investigation_priorities && fraudAnalysis.investigation_priorities.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Investigation Priorities</h3>
                <div className="space-y-2">
                  {fraudAnalysis.investigation_priorities.map((item, i) => (
                    <div key={i} className="bg-neutral-800/40 rounded-lg p-3 border border-neutral-700">
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-semibold">
                          {item.priority}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-text-light dark:text-gray-300 mb-1">
                            {item.action}
                          </p>
                          <p className="text-xs text-text-light dark:text-gray-400">
                            {item.reason}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {fraudAnalysis.generated_at && (
              <div className="text-xs text-text-light dark:text-gray-500 pt-2 border-t border-neutral-700">
                Generated: {new Date(fraudAnalysis.generated_at).toLocaleString()}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

