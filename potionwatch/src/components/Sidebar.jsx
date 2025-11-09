import React from 'react'
import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Overview' },
  { to: '/history', label: 'History' },
  { to: '/discrepancies', label: 'Discrepancies' },
  { to: '/forecast', label: 'Forecast & Routes' },
  { to: '/settings', label: 'Settings' }
]

export default function Sidebar() {
  return (
    <aside className="w-64 p-6 border-r border-neutral-800 bg-neutral-950 text-gray-200">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">PotionWatch</h1>
        <p className="text-sm text-gray-400">Real-time potion flow monitoring</p>
      </div>

      <nav className="space-y-2">
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              `block px-4 py-2 rounded-lg ${isActive ? 'bg-neutral-800/60 text-white' : 'hover:bg-neutral-800/40 text-gray-300'}`
            }
            end
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
