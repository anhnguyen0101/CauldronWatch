import React from 'react'
import { motion } from 'framer-motion'
import MapView from '../components/MapView'
import PotionNetworkGraph from '../components/PotionNetworkGraph'
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
    {title: 'Avg Level', value: cauldrons.length > 0 
      ? Math.round(cauldrons.reduce((a,c)=>a+(c.level || 0),0)/cauldrons.length) + '%'
      : '--'}
  ]

  const links = usePotionStore(s => s.links)
  const market = usePotionStore(s => s.market)

  // Build data object expected by PotionNetworkGraph ({ nodes, links })
  const nodes = cauldrons.map(c => ({
    // Support multiple possible id/field names from backend
    id: c.cauldron_id || c.id || c.cauldronId,
    name: c.name || c.label || (`${c.cauldron_id || c.id}`),
    // convert store level (0..100) to fillPercent for graph
    fillPercent: c.level ?? c.fillPercent ?? 0,
    status: c.status || 'normal',
    // include both lat/lng and latitude/longitude, in case backend used either
    lat: typeof c.lat === 'number' ? c.lat : (typeof c.latitude === 'number' ? c.latitude : undefined),
    lng: typeof c.lng === 'number' ? c.lng : (typeof c.longitude === 'number' ? c.longitude : undefined),
    // expose normalized x/y (0..1) if desired by other components
    x: (typeof (c.lng ?? c.longitude) === 'number' ? ( ((c.lng ?? c.longitude) + 180) / 360 ) : undefined),
    y: (typeof (c.lat ?? c.latitude) === 'number' ? ( (90 - (c.lat ?? c.latitude)) / 180 ) : undefined),
    isMarket: false
  }))

  if (market) {
    nodes.push({
      id: market.id || 'market_001',
      name: market.name || 'Market',
      fillPercent: 0,
      status: 'normal',
      x: (typeof market.longitude === 'number' ? ((market.longitude + 180) / 360) : (market.lng && typeof market.lng === 'number' ? ((market.lng + 180)/360) : undefined)),
      y: (typeof market.latitude === 'number' ? ((90 - market.latitude) / 180) : (market.lat && typeof market.lat === 'number' ? ((90 - market.lat)/180) : undefined)),
      isMarket: true
    })
  }

  // Convert backend link cost (HH:MM:SS or minutes) to travel_time_minutes expected by the graph
  const parseCostToMinutes = (cost) => {
    if (cost == null) return null
    if (typeof cost === 'number') return cost
    // if already a numeric string
    if (!isNaN(Number(cost))) return Number(cost)
    // format like 00:45:00 or 0:45:00
    const parts = String(cost).split(':').map(p => Number(p))
    if (parts.length === 3) {
      return parts[0]*60 + parts[1] + parts[2]/60
    }
    if (parts.length === 2) {
      return parts[0]*60 + parts[1]
    }
    return null
  }

  const mappedLinks = (links || []).map(l => ({
    from: l.from || l.node_id || l.source,
    to: l.to || l.node_id || l.target,
    travel_time_minutes: parseCostToMinutes(l.cost || l.travel_time_minutes || l.time || null),
    distance: l.distance ?? null,
    weight: l.weight ?? null
  }))

  const dataProp = { nodes, links: mappedLinks }

  return (
    <div className="space-y-6">
      <MetricsCards stats={stats} />

      {/* Show loading message if no cauldrons loaded yet */}
      {cauldrons.length === 0 ? (
        <div className="card">
          <div className="text-center py-8 text-gray-400">
            Loading cauldrons from backend...
          </div>
        </div>
      ) : (
        <>
          {/* Two-column responsive grid: Map | Alerts + Tickets */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <motion.div initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} transition={{duration:0.35}} className="lg:col-span-2">
              <PotionNetworkGraph data={dataProp} />
            </motion.div>

            <motion.div initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} transition={{duration:0.35, delay:0.05}} className="flex flex-col gap-4">
              <AlertsPanel />
              <TicketsTable />
            </motion.div>
          </div>

          {/* Timeline bar full width */}
          <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{duration:0.4}} className="min-w-0 w-full">
            <div className="card min-w-0 w-full">
              <div className="mb-2 text-sm text-gray-400">Timeline</div>
              <div className="min-w-0 w-full">
                <TimelineHeatmap />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  )
}
