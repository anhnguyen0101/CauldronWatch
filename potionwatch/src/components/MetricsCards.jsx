import React from 'react'
import cauldronIcon from '../assets/cauldron.png'
import usePotionStore from '../store/usePotionStore'
import { AlertTriangle } from 'lucide-react'

export default function MetricsCards({stats}){
  const alerts = usePotionStore(state => state.alerts)
  const hasAlerts = alerts && alerts.length > 0
  const hasCritical = alerts && alerts.some(a => (a.severity === 'critical') || ((a.title || '').toLowerCase().includes('overfill')))

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {stats.map(s => {
        if (s.title === 'Cauldrons') {
          return (
            <div key={s.title} className="flex items-center gap-4 p-2">
              <img src={cauldronIcon} alt="cauldrons" className="w-20 h-20" />
              <div>
                <div className="text-sm text-text-light dark:text-gray-400">{s.title}</div>
                <div className="text-2xl font-semibold text-text-light dark:text-gray-100">{s.value}</div>
              </div>
            </div>
          )
        }

        if (s.title === 'Alerts') {
          return (
            <div key={s.title} className="flex items-center gap-4 p-2">
              <AlertTriangle className={`w-10 h-10 ${hasCritical ? 'text-red-500 animate-pulse' : hasAlerts ? 'text-yellow-400 animate-bounce' : 'text-gray-400'}`} />
              <div>
                <div className="text-sm text-text-light dark:text-gray-400">{s.title}</div>
                <div className="text-2xl font-semibold text-text-light dark:text-gray-100">{s.value}</div>
              </div>
            </div>
          )
        }

        return (
          <div key={s.title} className="card">
            <div className="text-sm text-text-light dark:text-gray-400">{s.title}</div>
            <div className="text-2xl font-semibold text-text-light dark:text-gray-100">{s.value}</div>
          </div>
        )
      })}
    </div>
  )
}
