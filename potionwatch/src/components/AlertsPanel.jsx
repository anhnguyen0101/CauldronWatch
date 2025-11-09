import React from 'react'
import usePotionStore from '../store/usePotionStore'
import { AlertTriangle, XCircle } from 'lucide-react'

export default function AlertsPanel(){
  const alerts = usePotionStore(s => s.alerts)

  const formatTime = (timestamp) => {
    if (!timestamp) return new Date().toLocaleTimeString()
    try {
      return new Date(timestamp).toLocaleTimeString()
    } catch {
      return timestamp
    }
  }

  const getIcon = (alert) => {
    if (alert.severity === 'critical' || (alert.title && alert.title.toLowerCase().includes('critical'))) {
      return <AlertTriangle className="text-red-400" size={18} />
    } else if (alert.severity === 'warning' || (alert.title && alert.title.toLowerCase().includes('warning'))) {
      return <AlertTriangle className="text-yellow-400" size={18} />
    } else if (alert.title && alert.title.includes('💧')) {
      return <XCircle className="text-blue-400" size={18} />
    } else {
      return <XCircle className="text-gray-400" size={18} />
    }
  }

  return (
    <aside className="w-80 ml-6">
      <div className="card">
        <h3 className="panel-title mb-2">Live Alerts ({alerts.length})</h3>
        <div className="space-y-2 max-h-96 overflow-auto">
          {alerts.length === 0 && <div className="text-gray-400 text-center py-4">No alerts</div>}
          {alerts.map(a=> (
            <div key={a.id} className="p-3 rounded-lg bg-neutral-800/40 border border-neutral-800 flex items-start gap-3 justify-between hover:bg-neutral-800/60 transition-colors">
              <div className="flex items-start gap-3 flex-1">
                <div className="mt-0.5 flex-shrink-0">
                  {getIcon(a)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-100">{a.title}</div>
                  <div className="text-sm text-gray-400">{a.message}</div>
                </div>
              </div>
              <div className="text-xs text-neutral-400 flex-shrink-0 ml-2">
                {formatTime(a.timestamp || a.time)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
