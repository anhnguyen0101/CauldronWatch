import React, { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { Sun, Moon } from 'lucide-react'
import logo from '../assets/logo.png'

const links = [
  { to: '/', label: 'Overview' },
  { to: '/history', label: 'History' },
  { to: '/discrepancies', label: 'Discrepancies' },
  { to: '/forecast', label: 'Forecast & Routes' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(true)
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') || 'dark' } catch(e){ return 'dark' }
  })

  useEffect(() => {
    try {
      if(theme === 'light'){
        document.documentElement.classList.remove('dark')
        localStorage.setItem('theme', 'light')
      } else {
        document.documentElement.classList.add('dark')
        localStorage.setItem('theme', 'dark')
      }
    } catch(e){}
  }, [theme])

  return (
    <aside className={`relative flex flex-col h-screen bg-neutral-200 dark:bg-neutral-950 text-black dark:text-gray-200 border-r border-neutral-300 dark:border-neutral-800 transition-all duration-200 ${collapsed ? 'w-20' : 'w-64'}`}>
      {/* Logo and Name Section */}
      <div className="p-4 flex items-center justify-between border-b border-neutral-300 dark:border-neutral-800 gap-2">
        {!collapsed ? (
          <>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <img src={logo} alt="CauldronWatch logo" className="w-12 h-12 object-contain rounded-md flex-shrink-0" />
              <div className="text-lg font-bold text-black dark:text-gray-200 whitespace-nowrap truncate">FlowGuard AI</div>
            </div>
            <button
              aria-label="Collapse sidebar"
              onClick={() => setCollapsed(s => !s)}
              className="p-2 rounded-md hover:bg-neutral-800/40 text-black dark:text-gray-300"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block">
                <path d="M6 6l12 12" />
                <path d="M18 6L6 18" />
              </svg>
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center w-full gap-2">
            <img src={logo} alt="CauldronWatch logo" className="w-12 h-12 object-contain rounded-md" />
            <button
              aria-label="Open sidebar"
              onClick={() => setCollapsed(s => !s)}
              className="p-2 rounded-md hover:bg-neutral-800/40 text-black dark:text-gray-300"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block">
                <path d="M3 12h18" />
                <path d="M3 6h18" opacity="0.6" />
                <path d="M3 18h18" opacity="0.6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={`px-2 pt-2 space-y-2 flex-1 ${collapsed ? 'hidden' : ''}`}>
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              `block px-4 py-2 rounded-lg ${isActive ? 'bg-neutral-800/60 text-white' : 'hover:bg-neutral-800/40 text-black dark:text-gray-300'}`
            }
            end
          >
            {l.label}
            <span className="sr-only">{l.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Theme Toggle at Bottom */}
      <div className="mt-auto border-t border-neutral-300 dark:border-neutral-800 p-4 flex-shrink-0">
        {!collapsed ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {theme === 'dark' ? (
                <Moon className="w-5 h-5 text-black dark:text-gray-300" />
              ) : (
                <Sun className="w-5 h-5 text-black dark:text-gray-300" />
              )}
              <span className="text-sm text-black dark:text-gray-300">
                {theme === 'dark' ? 'Dark' : 'Light'} Mode
              </span>
            </div>
            <button
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                theme === 'dark' ? 'bg-neutral-700' : 'bg-neutral-300'
              }`}
              aria-label="Toggle theme"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                theme === 'dark' ? 'bg-neutral-700' : 'bg-neutral-300'
              }`}
              aria-label="Toggle theme"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            {theme === 'dark' ? (
              <Moon className="w-4 h-4 text-black dark:text-gray-300" />
            ) : (
              <Sun className="w-4 h-4 text-black dark:text-gray-300" />
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
