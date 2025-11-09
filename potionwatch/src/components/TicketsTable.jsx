import React from 'react'

export default function TicketsTable(){
  const rows = [
    { id: 1, date: '11/07', cauldron: 'A1', ticket: '120 L', drain: '90 L', diff: '30 L' },
    { id: 2, date: '11/07', cauldron: 'B4', ticket: '90 L', drain: '90 L', diff: '0 L' },
    { id: 3, date: '11/07', cauldron: 'C2', ticket: '80 L', drain: '60 L', diff: '20 L' }
  ]

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
                <td className={`px-3 py-3 ${r.diff.includes('-') ? 'text-red-400' : 'text-green-400'}`}>{r.diff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
