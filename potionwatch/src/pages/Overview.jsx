import React, { useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import MapView from '../components/MapView'
import AlertsPanel from '../components/AlertsPanel'
import MetricsCards from '../components/MetricsCards'
import TicketsTable from '../components/TicketsTable'
import TimelineHeatmap from '../components/TimelineHeatmap'
import usePotionStore from '../store/usePotionStore'

export default function Overview(){
  // Subscribe to cauldrons, alerts, and lastUpdate timestamp
  // The lastUpdate timestamp changes on every WebSocket update, ensuring reactivity
  const cauldrons = usePotionStore(s => s.cauldrons)
  const alerts = usePotionStore(s => s.alerts)
  const lastUpdate = usePotionStore(s => s.lastUpdate) // This changes on every WebSocket update
  
  // Calculate average level - recalculates when cauldrons or lastUpdate changes
  const avgLevel = useMemo(() => {
    if (cauldrons.length === 0) return 0
    const sum = cauldrons.reduce((a, c) => a + (c.level || 0), 0)
    const avg = Math.round(sum / cauldrons.length)
    return avg
  }, [cauldrons, lastUpdate]) // lastUpdate ensures recalculation on WebSocket updates
  
  // Debug: Log when average changes (throttled to avoid spam)
  useEffect(() => {
    if (cauldrons.length > 0) {
      console.log(`📊 Dashboard: Avg level = ${avgLevel}% (updated at ${new Date(lastUpdate).toLocaleTimeString()})`)
    }
  }, [avgLevel, lastUpdate, cauldrons.length])
  
  // Create stats array - recalculates when dependencies change
  const stats = useMemo(() => [
    {title: 'Cauldrons', value: cauldrons.length},
    {title: 'Alerts', value: alerts.length},
    {title: 'Avg Level', value: `${avgLevel}%`}
  ], [cauldrons.length, alerts.length, avgLevel])

  return (
    <div className="space-y-6">
      <MetricsCards stats={stats} />

      {/* Two-column responsive grid: Map | Alerts + Tickets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} transition={{duration:0.35}} className="lg:col-span-2">
          <MapView />
        </motion.div>

        <motion.div initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} transition={{duration:0.35, delay:0.05}} className="flex flex-col gap-4">
          <AlertsPanel />
          <TicketsTable />
        </motion.div>
      </div>

      {/* Timeline bar full width */}
      <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{duration:0.4}}>
        <div className="card">
          <div className="flex items-center gap-4">
            {/* Timeline heatmap component */}
            <div className="flex-1">
              <div className="mb-2 text-sm text-gray-400">Timeline</div>
              <div>
                <TimelineHeatmap />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
