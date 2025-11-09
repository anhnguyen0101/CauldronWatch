import React from 'react'
import { Sparklines, SparklinesLine } from 'react-sparklines'

export default function Discrepancies() {
  const rows = [
    {id: 1, cauldron: 'A1', ticket: 120, drain: 110, diff: 10, history: [5, 8, 12, 10, 6,4,3,4,7,1,2,9]},
    {id: 2, cauldron: 'B4', ticket: 60, drain: 90, diff: -30, history: [15, 10, 5, 8, 8,9,5,4,3,2,6,9,12]},
    {id: 3, cauldron: 'A5', ticket: 120, drain: 110, diff: 10, history: [5, 1, 12, 1, 16,4,8,4,7,11,2,9]},
  ]

  const getSeverity = (diff) => {
    const abs = Math.abs(diff)
    if (abs <= 10) return '🟢 OK'
    if (abs <= 30) return '🟡 Warning'
    return '🔴 Alert'
  }

  // Find max value for scaling bars
  const maxVal = Math.max(...rows.flatMap(r => [r.ticket, r.drain]))

  return (
    <>
      {/* Summary */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="bg-gray-800 text-gray-200 p-4 rounded shadow flex-1 min-w-[180px]">
          🧾 Total Discrepancies: {rows.length}
        </div>
        <div className="bg-gray-800 text-gray-200 p-4 rounded shadow flex-1 min-w-[180px]">
          ⚠️ Avg Diff: {Math.round(rows.reduce((sum, r) => sum + Math.abs(r.diff), 0) / rows.length)}L
        </div>
        <div className="bg-gray-800 text-gray-200 p-4 rounded shadow flex-1 min-w-[180px]">
          🧯 Largest Overflow: {rows.reduce((prev,r)=>r.diff>prev.diff?r:prev,rows[0]).cauldron} ({Math.max(...rows.map(r=>r.diff))}L)
        </div>
        <div className="bg-gray-800 text-gray-200 p-4 rounded shadow flex-1 min-w-[180px]">
          🕳️ Drain Loss: {rows.reduce((prev,r)=>r.diff<prev.diff?r:prev,rows[0]).cauldron} ({Math.min(...rows.map(r=>r.diff))}L)
        </div>
      </div>

      {/* Table */}
      <div className="card p-4 space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full table-auto text-left">
            <thead>
              <tr className="text-gray-400 text-sm">
                <th className="px-3 py-2">Cauldron</th>
                <th className="px-3 py-2">Ticket</th>
                <th className="px-3 py-2">Drain</th>
                <th className="px-3 py-2">Diff</th>
                <th className="px-3 py-2">Severity</th>
                <th className="px-3 py-2">Trend</th>
                <th className="px-3 py-2">Bar View</th>
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
                  <td className="px-3 py-3">{getSeverity(r.diff)}</td>
                  <td className="px-3 py-3">
                    <Sparklines data={r.history} width={100} height={20}>
                      <SparklinesLine color="blue" />
                    </Sparklines>
                  </td>
                  <td className="px-3 py-3">
                    {/* Combined horizontal bar */}
                    <div className="flex h-4 w-full bg-gray-700 rounded overflow-hidden">
                      <div
                        className="bg-blue-500"
                        style={{ width: `${(r.ticket / maxVal) * 100}%` }}
                      />
                      <div
                        className="bg-orange-500"
                        style={{
                          width: `${(r.drain / maxVal) * 100}%`,
                          marginLeft: `-${(r.ticket / maxVal) * 100}%` // overlap
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
