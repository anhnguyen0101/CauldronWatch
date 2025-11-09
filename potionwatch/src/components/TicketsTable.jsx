import React, { useEffect, useState } from 'react'
import { fetchDrainEvents, fetchTickets } from '../services/api'
import usePotionStore from '../store/usePotionStore'

export default function TicketsTable(){
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [dataLoaded, setDataLoaded] = useState(false)
  const cauldrons = usePotionStore(s => s.cauldrons)

  useEffect(() => {
    // Only load data once when cauldrons are first available
    // Don't reload on every cauldron update (that causes flickering)
    if (cauldrons.length === 0 || dataLoaded) {
      if (cauldrons.length === 0) {
        setLoading(false)
      }
      return
    }

    async function loadData() {
      try {
        setLoading(true)
        console.log('📊 Loading tickets vs drains data...')
        
        // Get all cauldrons analysis (includes drain events)
        const analyses = {}
        for (const cauldron of cauldrons.slice(0, 5)) { // Limit to first 5 for performance
          try {
            const drainEvents = await fetchDrainEvents(cauldron.id)
            if (drainEvents && drainEvents.length > 0) {
              // Group by date
              const byDate = {}
              drainEvents.forEach(event => {
                const date = event.start_time?.split('T')[0] || event.timestamp?.split('T')[0]
                if (date) {
                  if (!byDate[date]) byDate[date] = []
                  byDate[date].push(event)
                }
              })
              analyses[cauldron.id] = { drain_events: drainEvents, byDate }
            }
          } catch (err) {
            console.warn(`Failed to fetch drain events for ${cauldron.id}:`, err)
          }
        }
        
        // Get tickets
        const tickets = await fetchTickets()
        
        // Match tickets with drain events
        const matchedRows = []
        const ticketMap = new Map()
        
        // Group tickets by cauldron and date
        // Tickets have: {ticket_id, cauldron_id, date (YYYY-MM-DD), amount_collected, courier_id}
        tickets.forEach(ticket => {
          const ticketDate = ticket.date || ticket.timestamp?.split('T')[0]
          const cauldronId = ticket.cauldron_id
          if (cauldronId && ticketDate) {
            const key = `${cauldronId}_${ticketDate}`
            if (!ticketMap.has(key)) {
              ticketMap.set(key, [])
            }
            ticketMap.get(key).push(ticket)
          }
        })
        
        // Create rows from drain events and match with tickets
        Object.entries(analyses).forEach(([cauldronId, analysis]) => {
          if (analysis.byDate) {
            // Process each date
            Object.entries(analysis.byDate).forEach(([date, events]) => {
              const totalDrained = events.reduce((sum, e) => sum + (e.volume_drained || 0), 0)
              
              // Match with tickets
              const key = `${cauldronId}_${date}`
              const dayTickets = ticketMap.get(key) || []
              const ticketVolume = dayTickets.reduce((sum, t) => sum + (t.amount_collected || t.volume || 0), 0)
              
              const diff = ticketVolume - totalDrained
              matchedRows.push({
                id: `${cauldronId}_${date}`,
                date: new Date(date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }),
                cauldron: cauldronId.replace('cauldron_', '').toUpperCase(),
                ticket: ticketVolume > 0 ? `${Math.round(ticketVolume)} L` : '-',
                drain: `${Math.round(totalDrained)} L`,
                diff: diff !== 0 ? `${diff > 0 ? '+' : ''}${Math.round(diff)} L` : '0 L'
              })
            })
          }
        })
        
        // Sort by date (newest first) and limit to 10
        matchedRows.sort((a, b) => {
          // Extract date from id (format: cauldron_001_2025-11-09)
          const dateA = a.id.split('_').slice(-1)[0]
          const dateB = b.id.split('_').slice(-1)[0]
          return new Date(dateB) - new Date(dateA)
        })
        setRows(matchedRows.slice(0, 10))
        setDataLoaded(true)
        console.log(`✅ Loaded ${matchedRows.length} ticket vs drain matches`)
      } catch (error) {
        console.error('❌ Error loading tickets vs drains:', error)
        // Fallback to empty or show error
        setRows([])
        setDataLoaded(true) // Mark as loaded even on error to prevent retry loops
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [cauldrons.length, dataLoaded]) // Only depend on cauldrons.length, not the array itself

  if (loading) {
    return (
      <div className="card">
        <h3 className="panel-title mb-3">Tickets vs Drains</h3>
        <div className="text-center py-8 text-gray-400">Loading...</div>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="card">
        <h3 className="panel-title mb-3">Tickets vs Drains</h3>
        <div className="text-center py-8 text-gray-400">
          No data available. Make sure backend is running and has drain analysis data.
        </div>
      </div>
    )
  }

  const totalVolume = rows.reduce((sum, r) => {
    const drainVol = parseFloat(r.drain.replace(' L', '')) || 0
    return sum + drainVol
  }, 0)

  return (
    <div className="card">
      <h3 className="panel-title mb-3">Tickets vs Drains</h3>
      <div className="overflow-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-gray-400 text-xs uppercase">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Cauldron</th>
              <th className="px-3 py-2">Ticket Volume</th>
              <th className="px-3 py-2">Drain</th>
              <th className="px-3 py-2">Difference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r=> (
              <tr key={r.id} className="border-t border-border hover:bg-neutral-700/50 transition-colors">
                <td className="px-3 py-3 text-gray-100">{r.date}</td>
                <td className="px-3 py-3 text-gray-100">{r.cauldron}</td>
                <td className="px-3 py-3 text-gray-100">{r.ticket}</td>
                <td className="px-3 py-3 text-gray-100">{r.drain}</td>
                <td className={`px-3 py-3 ${r.diff.includes('-') && !r.diff.includes('+') ? 'text-red-400' : 'text-green-400'}`}>
                  {r.diff}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalVolume > 0 && (
          <div className="mt-3 pt-3 border-t border-border text-sm text-gray-400">
            {new Date().toLocaleDateString()} - Total Volume: {Math.round(totalVolume)}L
          </div>
        )}
      </div>
    </div>
  )
}
