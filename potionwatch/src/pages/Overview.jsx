import React from 'react'
import { motion } from 'framer-motion'
import MapView from '../components/MapView'
import PotionNetworkSVG from '../components/PotionNetworkSVG'
import AlertsPanel from '../components/AlertsPanel'
import MetricsCards from '../components/MetricsCards'
import TicketsTable from '../components/TicketsTable'
import TimelineHeatmap from '../components/TimelineHeatmap'
import usePotionStore from '../store/usePotionStore'

export default function Overview(){
  const cauldrons = usePotionStore(s => s.cauldrons)
  const stats = [
    {title: 'Cauldrons', value: cauldrons.length},
    {title: 'Alerts', value: usePotionStore.getState().alerts.length},
    {title: 'Avg Level', value: Math.round(cauldrons.reduce((a,c)=>a+c.level,0)/Math.max(1,cauldrons.length)) + '%'}
  ]

  return (
    <div className="space-y-6">
      <MetricsCards stats={stats} />

      {/* Two-column responsive grid: Map | Alerts + Tickets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} transition={{duration:0.35}} className="lg:col-span-2">
          <PotionNetworkSVG />
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
