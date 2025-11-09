import React, { useState, useEffect } from "react";
import usePotionStore from "../store/usePotionStore";
import { Sparklines, SparklinesLine } from "react-sparklines";

export default function Discrepancies() {
  const cauldrons = usePotionStore((s) => s.cauldrons);
  const history = usePotionStore((s) => s.history);

  const [dateRange, setDateRange] = useState("Today");
  const [filtered, setFiltered] = useState([]);
  const [selected, setSelected] = useState(null);

  const getSeverity = (diff) => {
    const abs = Math.abs(diff);
    if (abs <= 10) return "🟢 OK";
    if (abs <= 30) return "🟡 Warning";
    return "🔴 Alert";
  };

  // Filter and merge data based on rolling time window
  useEffect(() => {
    if (!history || history.length === 0) return;

    const now = new Date();
    let start;

    switch (dateRange) {
      case "Today":
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000); // last 24h
        break;
      case "Past Week":
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // last 7 days
        break;
      case "Past Month":
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // last 30 days
        break;
      default:
        start = new Date(0);
    }

    const cauldronMap = {};

    history.forEach((col) => {
      const colTime = new Date(col.time);
      if (colTime < start || colTime > now) return;

      col.cauldrons.forEach((c) => {
        if (!cauldronMap[c.id]) {
          cauldronMap[c.id] = {
            cauldron: c.id,
            ticket: c.fillPercent ?? 0,
            drain: c.drainVolume ?? 0,
            diff: c.discrepancy ?? 0,
            history: [],
            status: c.status || "normal",
          };
        }
        cauldronMap[c.id].history.push(c.fillPercent ?? 0);
        // Keep latest ticket/drain/diff
        cauldronMap[c.id].ticket = c.fillPercent ?? 0;
        cauldronMap[c.id].drain = c.drainVolume ?? 0;
        cauldronMap[c.id].diff = c.discrepancy ?? 0;
        cauldronMap[c.id].status = c.status || "normal";
      });
    });

    setFiltered(Object.values(cauldronMap));
  }, [dateRange, history]);

  // Precompute summary stats
  const totalDiscrepancies = filtered.length;
  const avgDiff =
    filtered.length > 0
      ? Math.round(filtered.reduce((sum, r) => sum + Math.abs(r.diff), 0) / filtered.length)
      : 0;
  const largestOverflow = filtered.reduce(
    (p, r) => (r.diff > (p?.diff ?? -Infinity) ? r : p),
    null
  );
  const largestDrainLoss = filtered.reduce(
    (p, r) => (r.diff < (p?.diff ?? Infinity) ? r : p),
    null
  );
  const maxVal = Math.max(...filtered.flatMap((r) => [r.ticket, r.drain]), 1);

  return (
    <div className="p-6 space-y-6">
      {/* Date Range */}
      <div className="flex gap-2">
        {["Today", "Past Week", "Past Month"].map((r) => (
          <button
            key={r}
            onClick={() => setDateRange(r)}
            className={`px-3 py-1 rounded ${
              dateRange === r ? "bg-indigo-600 text-white" : "bg-gray-700 text-gray-300"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Summary Boxes */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="bg-gray-800 text-gray-200 p-4 rounded shadow flex-1 min-w-[180px]">
          🧾 Total Discrepancies: {totalDiscrepancies}
        </div>
        <div className="bg-gray-800 text-gray-200 p-4 rounded shadow flex-1 min-w-[180px]">
          ⚠️ Avg Diff: {avgDiff}L
        </div>
        <div className="bg-gray-800 text-gray-200 p-4 rounded shadow flex-1 min-w-[180px]">
          🧯 Largest Overflow: {largestOverflow?.cauldron}{" "}
          {largestOverflow?.diff > 0 ? `(+${largestOverflow.diff}L)` : `(${largestOverflow?.diff}L)`}
        </div>
        <div className="bg-gray-800 text-gray-200 p-4 rounded shadow flex-1 min-w-[180px]">
          🕳️ Drain Loss: {largestDrainLoss?.cauldron}{" "}
          {largestDrainLoss?.diff < 0 ? `(${largestDrainLoss.diff}L)` : `(+${largestDrainLoss?.diff}L)`}
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-700 text-gray-300">
            <tr>
              <th className="px-4 py-2">Cauldron</th>
              <th className="px-4 py-2">Ticket</th>
              <th className="px-4 py-2">Drain</th>
              <th className="px-4 py-2">Diff</th>
              <th className="px-4 py-2">Severity</th>
              <th className="px-4 py-2">Trend</th>
              <th className="px-4 py-2">Flow Comparison</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filtered.map((r, idx) => (
              <tr
                key={idx}
                className="hover:bg-gray-700/50 cursor-pointer"
                onClick={() => setSelected(r)}
              >
                <td className="px-4 py-2">{r.cauldron}</td>
                <td className="px-4 py-2">{r.ticket}</td>
                <td className="px-4 py-2">{r.drain}</td>
                <td className={`px-4 py-2 ${r.diff > 0 ? "text-green-400" : "text-red-400"}`}>
                  {r.diff > 0 ? `+${r.diff}` : r.diff}
                </td>
                <td className="px-4 py-2">{getSeverity(r.diff)}</td>
                <td className="px-4 py-2">
                  <Sparklines data={r.history} width={100} height={20}>
                    <SparklinesLine color="blue" />
                  </Sparklines>
                </td>
                <td className="px-4 py-2">
                  <div className="flex h-4 w-full bg-gray-700 rounded overflow-hidden">
                    <div
                      className="bg-blue-500"
                      style={{ width: `${(r.ticket / maxVal) * 100}%` }}
                    />
                    <div
                      className="bg-orange-500 opacity-70"
                      style={{
                        width: `${(r.drain / maxVal) * 100}%`,
                        marginLeft: `-${Math.min((r.drain / maxVal) * 100, (r.ticket / maxVal) * 100)}%`,
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drill-down modal */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center">
          <div className="bg-gray-900 p-6 rounded-lg max-w-md w-full shadow-lg relative">
            <h4 className="text-xl font-semibold text-gray-100 mb-3">{selected.cauldron}</h4>
            <p className="text-gray-300 text-sm mb-2">
              Ticket reported: {selected.ticket}L | Actual drain: {selected.drain}L
            </p>
            <p className="text-gray-400 text-sm mb-3">
              Difference: {selected.diff > 0 ? `+${selected.diff}` : selected.diff}L ({getSeverity(selected.diff)})
            </p>
            <div className="mb-4">
              <Sparklines data={selected.history} width={200} height={50}>
                <SparklinesLine color="cyan" />
              </Sparklines>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="absolute top-2 right-3 text-gray-400 hover:text-gray-200 text-xl"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
