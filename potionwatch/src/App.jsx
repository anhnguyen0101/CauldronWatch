import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Navbar from './components/Navbar'
import Overview from './pages/Overview'
import History from './pages/History'
import Discrepancies from './pages/Discrepancies'
import Forecast from './pages/Forecast'
import Settings from './pages/Settings'
import useInit from './boot/useInit'

export default function App() {
  // initialize backend connection and websocket on app mount
  useInit()
  return (
    <div className="min-h-screen flex overflow-x-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className="p-6 min-w-0 max-w-full">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/history" element={<History />} />
            <Route path="/discrepancies" element={<Discrepancies />} />
            <Route path="/forecast" element={<Forecast />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
