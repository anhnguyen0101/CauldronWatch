import React from 'react'

export default function Settings(){
  return (
    <div className="card">
      <h3 className="font-semibold mb-4">Settings</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm text-white/70">Overfill Threshold</label>
          <input type="range" min="50" max="120" defaultValue={100} className="w-full" />
        </div>
        <div>
          <label className="block text-sm text-white/70">Alert Preferences</label>
          <select className="w-full p-2 rounded-md bg-white/6">
            <option>All alerts</option>
            <option>Critical only</option>
          </select>
        </div>
      </div>
    </div>
  )
}
