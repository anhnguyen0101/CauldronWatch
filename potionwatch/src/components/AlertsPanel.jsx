import React from 'react'
import usePotionStore from '../store/usePotionStore'
import { AlertTriangle, XCircle } from 'lucide-react'

export default function AlertsPanel() {
  const alerts = usePotionStore(s => s.alerts)

  const hasAlerts = alerts && alerts.length > 0
  const hasCritical = alerts.some(a => (a.title || '').toLowerCase().includes('overfill') || (a.severity || '') === 'critical')

  // Debug: Log alerts whenever they change
  React.useEffect(() => {
    console.log('📊 AlertsPanel: Current alerts:', alerts.length, alerts.map(a => ({ id: a.id, title: a.title })))
  }, [alerts.length, alerts.map(a => a.id).join(',')])

  return (
    <div className={`card h-full flex flex-col overflow-hidden ${hasAlerts ? 'border-red-400 bg-red-50 dark:bg-red-900/20' : ''} ${hasCritical ? 'animate-pulse' : ''}`}>
      <h3 className="panel-title mb-3 flex-shrink-0 flex items-center gap-3">
        {hasAlerts && (
          <AlertTriangle className={`w-5 h-5 ${hasCritical ? 'text-red-500' : 'text-yellow-400'} ${hasCritical ? 'animate-pulse' : ''}`} />
        )}
        <span>Live Alerts ({alerts.length})</span>
      </h3>
      {alerts.length === 0 ? (
        <div className="text-gray-400 text-sm py-4 flex-1 flex items-center justify-center">No alerts</div>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0 pr-2">
          <div className="space-y-2">
            {alerts.map(a=> (
              <div key={a.id} className="p-3 rounded-lg bg-panel-light border border-border-light dark:bg-neutral-800/40 dark:border-neutral-800 flex items-start gap-3 justify-between">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="mt-0.5 flex-shrink-0">
                    {a.title && a.title.toLowerCase().includes('overfill') ? (
                      <AlertTriangle className="text-warning w-5 h-5" />
                    ) : (
                      <XCircle className="text-danger w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-text-light dark:text-gray-100 truncate">{a.title}</div>
                    <div className="text-sm text-text-light dark:text-gray-400 line-clamp-2">{a.message}</div>
                  </div>
                </div>
                <div className="text-xs text-text-light dark:text-neutral-400 flex-shrink-0 ml-2 whitespace-nowrap">{a.time || new Date().toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
