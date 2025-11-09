import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Navbar from './components/Navbar'
import Overview from './pages/Overview'
import History from './pages/History'
import Discrepancies from './pages/Discrepancies'
import Forecast from './pages/Forecast'
import useInit from './boot/useInit'

export default function App() {
  // initialize backend connection and websocket on app mount
  useInit()
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Navbar />
        <main className="px-6 pt-4 pb-6 min-w-0 max-w-full flex-1">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/history" element={<History />} />
            <Route path="/discrepancies" element={<Discrepancies />} />
            <Route path="/forecast" element={<Forecast />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
