import React from 'react'

export default function Forecast(){
  return (
    <div>
      <div className="card mb-4">
        <h3 className="font-semibold">Predicted Overflows</h3>
        <ul className="mt-3 space-y-2">
          <li className="p-2 bg-white/4 rounded-md">Cauldron A1 — predicted overflow in 12m</li>
          <li className="p-2 bg-white/4 rounded-md">Cauldron C2 — predicted overflow in 45m</li>
        </ul>
      </div>
      <div className="card">
        <h3 className="font-semibold">Optimized Courier Routes</h3>
        <div className="mt-3">Route optimization placeholder — integrate with routing API later.</div>
      </div>
    </div>
  )
}
