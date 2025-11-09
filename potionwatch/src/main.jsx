document.documentElement.classList.add('dark')
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Initialize theme from localStorage (default to dark)
const initTheme = () => {
  try {
    const t = localStorage.getItem('theme')
    if (t === 'light') {
      document.documentElement.classList.remove('dark')
    } else {
      document.documentElement.classList.add('dark')
    }
  } catch (e) {
    document.documentElement.classList.add('dark')
  }
}

initTheme()

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
