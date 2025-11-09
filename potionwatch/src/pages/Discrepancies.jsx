import React from 'react'

export default function Discrepancies(){
  const rows = [
    {id: 1, cauldron: 'A1', ticket: 120, drain: 110, diff: 10},
    {id: 2, cauldron: 'B4', ticket: 60, drain: 90, diff: -30}
  ]

  return (
    <div className="card">
      <h3 className="panel-title mb-4">Ticket–Drain Discrepancies</h3>
      <div className="overflow-x-auto">
        <table className="w-full table-auto text-left">
          <thead>
            <tr className="text-gray-400 text-sm">
              <th className="px-3 py-2">Cauldron</th>
              <th className="px-3 py-2">Ticket</th>
              <th className="px-3 py-2">Drain</th>
              <th className="px-3 py-2">Diff</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r=> (
              <tr key={r.id} className="border-t border-neutral-800">
                <td className="px-3 py-3 text-gray-100">{r.cauldron}</td>
                <td className="px-3 py-3 text-gray-100">{r.ticket}</td>
                <td className="px-3 py-3 text-gray-100">{r.drain}</td>
                <td className={`px-3 py-3 ${r.diff>0 ? 'text-green-400' : 'text-red-400'}`}>{r.diff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
