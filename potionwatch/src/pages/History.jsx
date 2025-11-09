import React, { useEffect, useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { motion } from 'framer-motion'
import usePotionStore from '../store/usePotionStore'
import { fetchHistoryOptimized } from '../services/optimizedApi'

export default function History() {
  const cauldrons = usePotionStore(s => s.cauldrons)
  const snapshots = usePotionStore(s => s.history)

  const [playing, setPlaying] = useState(false)
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastFetchTime, setLastFetchTime] = useState(null)

  // 🔹 Load last 7 days into store.history once cauldrons are ready
  useEffect(() => {
    const load = async () => {
      if (!cauldrons || cauldrons.length === 0) return

      try {
        setLoading(true)
        setError(null)

        const cauldronsMap = new Map(cauldrons.map(c => [c.id, c]))
        const fetched = await fetchHistoryOptimized('7d', cauldronsMap)

        // If your store already has pushHistorySnapshot, you can use it.
        // But since we already have the full array, set directly to avoid weirdness.
        usePotionStore.setState({ history: fetched })

        setLastFetchTime(new Date())
        setPlaying(false)

        // start the playback position at the end of the range
        if (fetched && fetched.length > 0) {
          setIndex(fetched.length - 1)
        } else {
          setIndex(0)
        }
      } catch (err) {
        console.error('Error loading 7d history:', err)
        setError('Failed to load 7-day history.')
        setPlaying(false)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [cauldrons])

  // 🔹 Build chart data: avg level across all cauldrons per snapshot
  const chartData = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return []

    return snapshots.map(snap => {
      const cauls = snap.cauldrons || []
      const levels = cauls.map(c => c.level ?? c.fillPercent ?? 0)

      const avg =
        levels.length > 0
          ? levels.reduce((sum, v) => sum + v, 0) / levels.length
          : 0

      return {
        time:
          snap.time ||
          (snap.timestamp
            ? new Date(snap.timestamp).toLocaleString()
            : ''),
        avgLevel: Math.round(avg),
      }
    })
  }, [snapshots])

  // 🔹 Keep index in range when data changes
  useEffect(() => {
    if (chartData.length === 0) {
      setIndex(0)
      setPlaying(false)
      return
    }
    setIndex(i => {
      if (i < 0) return 0
      if (i >= chartData.length) return chartData.length - 1
      return i
    })
  }, [chartData.length])

  // 🔹 Playback: move a "cursor" across existing data (does NOT hide points)
  useEffect(() => {
    if (!playing) return
    if (chartData.length <= 1) {
      setPlaying(false)
      return
    }

    const interval = setInterval(() => {
      setIndex(prev => {
        const next = prev + 1
        if (next >= chartData.length) {
          clearInterval(interval)
          return chartData.length - 1
        }
        return next
      })
    }, 800)

    return () => clearInterval(interval)
  }, [playing, chartData.length])

  const hasData = chartData.length > 0

  const progressPct =
    !hasData || chartData.length === 1
      ? 0
      : (index / (chartData.length - 1)) * 100

  const currentPoint = hasData ? chartData[index] : null

  return (
    <div>
      <div className="card mb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <h3 className="font-semibold">Network Fill Playback (Last 7 Days)</h3>
            <span className="text-xs text-neutral-400">
              Line = average % full across all cauldrons. Playback cursor moves along it.
            </span>
            {lastFetchTime && (
              <span className="text-[10px] text-neutral-500">
                Updated {lastFetchTime.toLocaleString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (!hasData) return
                // If we are at the end, restart from 0 when pressing Play again
                setIndex(i => (i >= chartData.length - 1 ? 0 : i))
                setPlaying(p => !p)
              }}
              disabled={loading || !hasData || chartData.length <= 1}
              className="px-3 py-1 rounded-md bg-neutral-800/40 hover:bg-neutral-800/60 disabled:opacity-40"
            >
              {playing ? 'Pause' : 'Play'}
            </button>
            <button
              onClick={() => hasData && setIndex(0)}
              disabled={loading || !hasData}
              className="px-3 py-1 rounded-md bg-neutral-800/40 hover:bg-neutral-800/60 disabled:opacity-40"
            >
              Restart
            </button>
          </div>
        </div>

        <div className="mt-4 h-64">
          {loading ? (
            <div className="flex items-center justify-center h-full text-sm text-neutral-500">
              Loading 7-day history...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-sm text-red-400">
              {error}
            </div>
          ) : hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData} // ✅ always show the full 7-day series
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                <XAxis dataKey="time" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="avgLevel"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-neutral-500">
              No history available yet.
            </div>
          )}
        </div>

        {/* Playback progress bar */}
        <motion.div layout className="mt-3">
          <div className="h-2 bg-neutral-800 rounded-full overflow-hidden border border-neutral-800">
            <div
              className="h-full bg-accent"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </motion.div>

        {/* Optional: show current cursor time & value */}
        {currentPoint && (
          <div className="mt-1 text-[10px] text-neutral-400">
            Cursor at: <span className="font-medium">{currentPoint.time}</span> —{' '}
            <span className="font-medium">{currentPoint.avgLevel}%</span> avg fill
          </div>
        )}
      </div>
    </div>
  )
}
