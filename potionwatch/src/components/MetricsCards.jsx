import React from 'react'
import cauldronIcon from '../assets/cauldron.png'

export default function MetricsCards({stats}){
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {stats.map(s=> (
        s.title === 'Cauldrons' ? (
          <div key={s.title} className="flex items-center gap-4 p-2">
            <img src={cauldronIcon} alt="cauldrons" className="w-20 h-20" />
            <div>
              <div className="text-sm text-text-light dark:text-gray-400">{s.title}</div>
              <div className="text-2xl font-semibold text-text-light dark:text-gray-100">{s.value}</div>
            </div>
          </div>
        ) : (
          <div key={s.title} className="card">
            <div className="text-sm text-text-light dark:text-gray-400">{s.title}</div>
            <div className="text-2xl font-semibold text-text-light dark:text-gray-100">{s.value}</div>
          </div>
        )
      ))}
    </div>
  )
}
