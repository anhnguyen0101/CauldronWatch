import React from 'react'
import { Sparklines, SparklinesLine } from 'react-sparklines'

export default function Discrepancies() {
  const rows = [
    {id: 1, cauldron: 'A1', ticket: 120, drain: 110, diff: 10, history: [5, 8, 12, 10, 6,4,3,4,7,1,2,9]},
    {id: 2, cauldron: 'B4', ticket: 60, drain: 90, diff: -30, history: [15, 10, 5, 8, 8,9,5,4,3,2,6,9,12]},
     {id: 1, cauldron: 'A5', ticket: 120, drain: 110, diff: 10, history: [5, 1, 12, 1, 16,4,8,4,7,11,2,9]},
  ]

  return (
    <div className="card">
      <h3 className="panel-title mb-4">Ticket-Drain Discrepancies</h3>
      <div className="overflow-x-auto">
        <table className="w-full table-auto text-left">
          <thead>
            <tr className="text-gray-400 text-sm">
              <th className="px-3 py-2">Cauldron</th>
              <th className="px-3 py-2">Ticket</th>
              <th className="px-3 py-2">Drain</th>
              <th className="px-3 py-2">Diff</th>
              <th className="px-3 py-2">Trend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-neutral-800">
                <td className="px-3 py-3 text-gray-100">{r.cauldron}</td>
                <td className="px-3 py-3 text-gray-100">{r.ticket}</td>
                <td className="px-3 py-3 text-gray-100">{r.drain}</td>
                <td className={`px-3 py-3 ${r.diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {r.diff > 0 ? `+${r.diff}` : r.diff}
                </td>
                <td className="px-3 py-3">
                  <Sparklines data={r.history} width={100} height={20}>
                    <SparklinesLine color="blue" />
                  </Sparklines>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
