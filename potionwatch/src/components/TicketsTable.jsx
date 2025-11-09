import React, { useEffect, useState } from 'react'
import { fetchDiscrepancies } from '../services/api'

export default function TicketsTable() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)

        const res = await fetchDiscrepancies()
        const data = res.discrepancies || []

        const mapped = data
          .map(d => {
            const ticketVolume = d.ticket_volume ?? 0
            const actualDrained = d.actual_drained ?? 0
            const diff = d.discrepancy ?? (actualDrained - ticketVolume)

            return {
              id: d.ticket_id,
              date: d.date || '',
              cauldron:
                d.cauldron_id?.replace('cauldron_', '').toUpperCase() ||
                d.cauldron_id,
              ticketVolume,
              actualDrained,
              diff,
            }
          })
          // 👇 skip rows where drain is exactly 0
          .filter(r => r.actualDrained !== 0)
          // newest first
          .sort((a, b) => new Date(b.date) - new Date(a.date))

        setRows(mapped)
      } catch (err) {
        console.error('Error loading Tickets vs Drains table:', err)
        setRows([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return (
    <div className="card">
      <h3 className="panel-title mb-3">Tickets vs Drains</h3>


      {loading ? (
        <div className="text-text-light/70 dark:text-text-dark/70 text-sm py-4">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="text-text-light/70 dark:text-text-dark/70 text-sm py-4">
          No ticket vs drain data with non-zero drains.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-sm uppercase sticky top-0 bg-panel-light dark:bg-panel-dark text-text-light/80 dark:text-text-dark/80 backdrop-blur border-b border-border-light dark:border-border-dark">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Cauldron</th>
                  <th className="px-3 py-2">Ticket Volume</th>
                  <th className="px-3 py-2">Drain</th>
                  <th className="px-3 py-2">Difference</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const colorClass =
                    r.diff === 0
                      ? 'text-text-light/60 dark:text-text-dark/60'
                      : r.diff > 0
                        ? 'text-green-400'
                        : 'text-red-400'

                  return (
                    <tr
                      key={r.id}
                      className="border-t border-border-light dark:border-border-dark hover:bg-panel-light/50 dark:hover:bg-panel-dark/50 transition-colors"
                    >
                      <td className="px-3 py-3 text-text-light/70 dark:text-text-dark/70">
                        {r.date || '-'}
                      </td>
                      <td className="px-3 py-3 text-text-light/70 dark:text-text-dark/70">
                        {r.cauldron || '-'}
                      </td>
                      <td className="px-3 py-3 text-text-light dark:text-text-dark">
                        {Math.round(r.ticketVolume)} L
                      </td>
                      <td className="px-3 py-3 text-text-light dark:text-text-dark">
                        {Math.round(r.actualDrained)} L
                      </td>
                      <td className={`px-3 py-3 font-semibold ${colorClass}`}>
                        {r.diff > 0 ? '+' : ''}
                        {Math.round(r.diff)} L
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
  )
}
