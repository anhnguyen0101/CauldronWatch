import React, { useEffect, useState } from 'react'
import { RefreshCw, Target, TrendingDown, Clock } from 'lucide-react'
import { fetchAIOptimizationPlan } from '../services/api'

export default function OptimizationPlan() {
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchPlan = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAIOptimizationPlan()
      setPlan(data)
    } catch (err) {
      console.error('Error fetching optimization plan:', err)
      setError('Failed to load optimization plan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlan()
  }, [])

  if (loading && !plan) {
    return (
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-accent" />
          <h3 className="panel-title">AI Optimization Strategy</h3>
        </div>
        <div className="text-center py-8 text-text-light dark:text-gray-400">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full mb-2"></div>
          <div>Analyzing optimization opportunities...</div>
        </div>
      </div>
    )
  }

  if (error && !plan) {
    return (
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-accent" />
          <h3 className="panel-title">AI Optimization Strategy</h3>
        </div>
        <div className="text-center py-8 text-red-400">
          <div>{error}</div>
          <button
            onClick={fetchPlan}
            className="mt-4 px-4 py-2 bg-accent hover:bg-accent/80 rounded-md text-white text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!plan) return null

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-accent" />
          <h3 className="panel-title">AI Optimization Strategy</h3>
        </div>
        <button
          onClick={fetchPlan}
          disabled={loading}
          className="p-2 rounded-md bg-neutral-800/40 hover:bg-neutral-800/60 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refresh plan"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-4">
        {/* Plan Overview */}
        <div className="bg-neutral-800/40 rounded-lg p-4 border border-neutral-700">
          <p className="text-sm leading-relaxed text-text-light dark:text-gray-300">
            {plan.plan}
          </p>
        </div>

        {/* Savings Metrics */}
        {plan.expected_savings && (
          <div className="grid grid-cols-3 gap-3">
            {plan.witch_allocation?.witches_needed !== undefined && (
              <div className="bg-neutral-800/40 rounded-lg p-3 border border-neutral-700">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-accent" />
                  <span className="text-xs text-text-light dark:text-gray-400">Witches Needed</span>
                </div>
                <div className="text-2xl font-bold text-accent">
                  {plan.witch_allocation.witches_needed}
                </div>
              </div>
            )}
            {plan.expected_savings.witch_hours_saved && (
              <div className="bg-neutral-800/40 rounded-lg p-3 border border-neutral-700">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-text-light dark:text-gray-400">Hours Saved</span>
                </div>
                <div className="text-lg font-semibold text-blue-400">
                  {plan.expected_savings.witch_hours_saved}
                </div>
              </div>
            )}
            {plan.expected_savings.cost_reduction && (
              <div className="bg-neutral-800/40 rounded-lg p-3 border border-neutral-700">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-text-light dark:text-gray-400">Cost Reduction</span>
                </div>
                <div className="text-lg font-semibold text-green-400">
                  {plan.expected_savings.cost_reduction}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Rationale */}
        {plan.witch_allocation?.rationale && (
          <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/30">
            <p className="text-xs text-blue-300 italic">
              💡 {plan.witch_allocation.rationale}
            </p>
          </div>
        )}

        {/* Implementation Steps */}
        {plan.implementation_steps && plan.implementation_steps.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Implementation Steps</h4>
            <div className="space-y-2">
              {plan.implementation_steps.map((step, i) => (
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

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-700 text-xs text-text-light dark:text-gray-500">
          <small>
            Generated: {plan.generated_at ? new Date(plan.generated_at).toLocaleString() : 'Just now'}
          </small>
          {plan.note && (
            <small className="text-yellow-400 italic">{plan.note}</small>
          )}
        </div>
      </div>
    </div>
  )
}

