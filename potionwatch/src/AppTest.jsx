// Simple test component to debug white screen
import React from 'react'

export default function AppTest() {
  return (
    <div style={{ padding: '20px', background: '#1e1e1e', color: 'white', minHeight: '100vh' }}>
      <h1>✅ React is working!</h1>
      <p>If you see this, React is mounting correctly.</p>
      <p>Check browser console (F12) for any errors.</p>
    </div>
  )
}

