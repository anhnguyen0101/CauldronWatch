import React, { useMemo } from 'react'
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
  // ✅ Subscribe to lastUpdate to force re-render when timeline snapshots are applied
  const lastUpdate = usePotionStore(s => s.lastUpdate)
  const stats = [
    {title: 'Cauldrons', value: cauldrons.length},
    {title: 'Alerts', value: usePotionStore.getState().alerts.length},
    {title: 'Avg Level', value: cauldrons.length > 0 
      ? Math.round(cauldrons.reduce((a,c)=>a+(c.level || 0),0)/cauldrons.length) + '%'
      : '--'}
  ]

  const links = usePotionStore(s => s.links)
  const market = usePotionStore(s => s.market)

  // Memoize nodes array - only recreate when cauldrons, market, or lastUpdate changes
  // ✅ Include lastUpdate to ensure graph updates when timeline snapshots are applied
  const nodes = useMemo(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Overview: Recomputing nodes (lastUpdate:', lastUpdate, ', cauldrons:', cauldrons.length, ')')
      if (cauldrons.length > 0) {
        console.log('   Sample cauldron:', { 
          id: cauldrons[0].id, 
          name: cauldrons[0].name, 
          level: cauldrons[0].level,
          x: cauldrons[0].x,
          y: cauldrons[0].y,
          hasXY: typeof cauldrons[0].x === 'number' && typeof cauldrons[0].y === 'number'
        })
        // Log high level cauldrons
        cauldrons.filter(c => c.level > 90).forEach(c => {
          console.log(`   🔥 High level: ${c.name} = ${c.level}%`)
        })
      }
    }
    
    const nodeList = cauldrons.map(c => {
      const level = c.level ?? c.fillPercent ?? 0
      
      // Dynamically calculate status based on level (matches alert thresholds)
      let status = 'normal'
      if (level > 95) {
        status = 'overfill'
      } else if (level < 20) {
        status = 'underfill'
      } else if (level > 80) {
        status = 'filling'
      }
      
      return {
        id: c.cauldron_id || c.id || c.cauldronId,
        name: c.name || c.label || (`${c.cauldron_id || c.id}`),
        fillPercent: level,
        status: status,
        x: typeof c.x === 'number' ? c.x : undefined,
        y: typeof c.y === 'number' ? c.y : undefined,
        lat: c.latitude ?? c.lat,
        lng: c.longitude ?? c.lng,
        latitude: c.latitude ?? c.lat,
        longitude: c.longitude ?? c.lng,
        isMarket: false
      }
    })

  if (market) {
      nodeList.push({
      id: market.id || 'market_001',
        name: market.name || 'Enchanted Market',
      fillPercent: 0,
      status: 'normal',
        x: typeof market.x === 'number' ? market.x : undefined,
        y: typeof market.y === 'number' ? market.y : undefined,
        lat: market.latitude ?? market.lat,
        lng: market.longitude ?? market.lng,
        latitude: market.latitude ?? market.lat,
        longitude: market.longitude ?? market.lng,
      isMarket: true
    })
  }

    return nodeList
  }, [cauldrons, market, lastUpdate]) // ✅ Include lastUpdate to trigger updates on timeline snapshots

  // Memoize link parsing - only recreate when links change
  const parseCostToMinutes = (cost) => {
    if (cost == null) return null
    if (typeof cost === 'number') return cost
    if (!isNaN(Number(cost))) return Number(cost)
    const parts = String(cost).split(':').map(p => Number(p))
    if (parts.length === 3) {
      return parts[0]*60 + parts[1] + parts[2]/60
    }
    if (parts.length === 2) {
      return parts[0]*60 + parts[1]
    }
    return null
  }

  const mappedLinks = useMemo(() => {
    return (links || []).map(l => ({
    from: l.from || l.node_id || l.source,
    to: l.to || l.node_id || l.target,
    travel_time_minutes: parseCostToMinutes(l.cost || l.travel_time_minutes || l.time || null),
    distance: l.distance ?? null,
    weight: l.weight ?? null
  }))
  }, [links]) // Only recreate when links change

  // Memoize data prop - only recreate when nodes or links change
  const dataProp = useMemo(() => ({ 
    nodes, 
    links: mappedLinks 
  }), [nodes, mappedLinks])

  return (
    <div className="space-y-6">
      <MetricsCards stats={stats} />

      {/* Show loading message if no cauldrons loaded yet */}
      {cauldrons.length === 0 ? (
          <div className="card">
          <div className="text-center py-8 text-text-light dark:text-gray-400">
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
              <div className="mb-2 text-sm text-text-light dark:text-gray-400">Timeline</div>
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
