import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import useInit from './entrypoint'

// Default dark theme
document.documentElement.classList.add('dark')

function Root(){
  useInit()
  return (
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  )
}

createRoot(document.getElementById('root')).render(<Root />)
