import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Overview' },
  { to: '/history', label: 'History' },
  { to: '/discrepancies', label: 'Discrepancies' },
  { to: '/forecast', label: 'Forecast & Routes' },
  { to: '/settings', label: 'Settings' }
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(true)

  return (
    <aside className={`relative bg-neutral-950 text-gray-200 border-r border-neutral-800 transition-all duration-200 ${collapsed ? 'w-20' : 'w-64'}`}>
      <div className="p-4 flex items-start justify-between">
        <button
          aria-label={collapsed ? 'Open sidebar' : 'Collapse sidebar'}
          onClick={() => setCollapsed(s => !s)}
          className="p-2 rounded-md hover:bg-neutral-800/40 text-gray-300"
        >
          {collapsed ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block">
              <path d="M3 12h18" />
              <path d="M3 6h18" opacity="0.6" />
              <path d="M3 18h18" opacity="0.6" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          )}
        </button>
      </div>

      {/* header spacer: hide when collapsed so nothing appears under the hamburger */}
      {!collapsed && <div className="p-6" />}

      {/* hide navigation when collapsed so nothing appears under the hamburger */}
      {!collapsed && (
        <nav className="px-2 space-y-2">
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
              <span className="sr-only">{l.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </aside>
  )
}
