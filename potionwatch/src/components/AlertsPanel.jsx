import React from 'react'
import usePotionStore from '../store/usePotionStore'
import { AlertTriangle, XCircle } from 'lucide-react'

export default function AlertsPanel(){
  const alerts = usePotionStore(s => s.alerts)

  return (
    <div className="card">
      <h3 className="panel-title mb-2">Live Alerts</h3>
      <div className="space-y-2 max-h-96 overflow-auto">
        {alerts.length === 0 && <div className="text-gray-400">No alerts</div>}
        {alerts.map(a=> (
          <div key={a.id} className="p-3 rounded-lg bg-neutral-800/40 border border-neutral-800 flex items-start gap-3 justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {a.title && a.title.toLowerCase().includes('overfill') ? (
                  <AlertTriangle className="text-warning" />
                ) : (
                  <XCircle className="text-danger" />
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-100">{a.title}</div>
                <div className="text-sm text-gray-400">{a.message}</div>
              </div>
            </div>
            <div className="text-sm text-neutral-400">{a.time || new Date().toLocaleTimeString()}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
