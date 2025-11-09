import React, { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import logo from '../assets/logo.png'

export default function Navbar(){
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') || 'dark' } catch(e){ return 'dark' }
  })

  useEffect(()=>{
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
    <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-transparent">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <img src={logo} alt="FlowGuard AI logo" className="w-[120px] h-[120px] md:w-20.05 md:h-20.05 object-contain rounded-md" />
          <div>
            <h2 className="text-lg font-semibold">FlowGuard AI</h2>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button
          aria-label="Toggle theme"
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg bg-neutral-800/30 hover:bg-neutral-800/60"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <img src="https://avatars.dicebear.com/api/pixel-art-neutral/cauldron.svg" alt="avatar" className="w-8 h-8 rounded-full" />
      </div>
    </header>
  )
}
