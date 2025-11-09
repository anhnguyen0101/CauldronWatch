import React from 'react'

export default function MetricsCards({stats}){
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {stats.map(s=> (
        <div key={s.title} className="card">
          <div className="text-sm text-text-light dark:text-gray-400">{s.title}</div>
          <div className="text-2xl font-semibold text-text-light dark:text-gray-100">{s.value}</div>
        </div>
      ))}
    </div>
  )
}
