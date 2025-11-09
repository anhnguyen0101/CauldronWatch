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
  const nodes = cauldrons.map(c => {
    // Support multiple possible id/field names from backend
    const lat = c.latitude ?? c.lat
    const lng = c.longitude ?? c.lng
    
    return {
      id: c.cauldron_id || c.id || c.cauldronId,
      name: c.name || c.label || (`${c.cauldron_id || c.id}`),
      // convert store level (0..100) to fillPercent for graph
      fillPercent: c.level ?? c.fillPercent ?? 0,
      status: c.status || 'normal',
      // Include both formats for maximum compatibility
      lat: typeof lat === 'number' ? lat : undefined,
      lng: typeof lng === 'number' ? lng : undefined,
      latitude: typeof lat === 'number' ? lat : undefined,
      longitude: typeof lng === 'number' ? lng : undefined,
      isMarket: false
    }
  })

  if (market) {
    const marketLat = market.latitude ?? market.lat
    const marketLng = market.longitude ?? market.lng
    
    nodes.push({
      id: market.id || 'market_001',
      name: market.name || 'Enchanted Market',
      fillPercent: 0,
      status: 'normal',
      // Include both formats for maximum compatibility
      lat: typeof marketLat === 'number' ? marketLat : undefined,
      lng: typeof marketLng === 'number' ? marketLng : undefined,
      latitude: typeof marketLat === 'number' ? marketLat : undefined,
      longitude: typeof marketLng === 'number' ? marketLng : undefined,
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
