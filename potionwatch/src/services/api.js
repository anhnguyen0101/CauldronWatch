// Mock API functions
export async function fetchHistory(){
  // produce 10 days of mock per-cauldron snapshots
  // cauldrons used here should match `usePotionStore` initial ids: a1, b4, c2
  const cauldronIds = [
    { id: 'a1', name: 'A1' },
    { id: 'b4', name: 'B4' },
    { id: 'c2', name: 'C2' }
  ]

  const now = Date.now()
  const days = 10
  const data = []

  for(let d = 0; d < days; d++){
    const date = new Date(now - (days - d) * 24 * 60 * 60000)
    const snapshot = {
      time: date.toLocaleDateString(),
      cauldrons: [],
      // optional network-level aggregates for backwards compatibility
      avgLevel: 0,
      // forecast for next day (per-cauldron lighter row)
      forecast: []
    }

    let sum = 0
    cauldronIds.forEach((c, i) => {
      // deterministic pseudo-random metrics using trig functions
      const base = 40 + 30 * Math.abs(Math.sin((d + i) / 2))
      const variance = Math.round(10 * Math.cos((d * 1.3 + i)))
      const level = Math.max(0, Math.min(100, Math.round(base + variance)))
      const fillPercent = Math.round(level)
      const drainVolume = Math.round(Math.max(0, 100 - level) * (Math.abs(Math.sin(d + i)) * 0.6))
      const discrepancy = (Math.random() < 0.2) ? Math.round(Math.random() * 10) : 0
      const alertCount = (Math.random() < 0.15) ? Math.round(Math.random() * 3) : 0
      const predictedOverflow = (level > 85) && (Math.random() < 0.35)
      const status = predictedOverflow ? 'overfill' : (level < 30 ? 'underfill' : (d % 3 === 0 ? 'draining' : 'filling'))

      snapshot.cauldrons.push({
        id: c.id,
        name: c.name,
        status,
        fillPercent,
        drainVolume,
        discrepancy,
        alertCount,
        predictedOverflow,
        level
      })
      sum += level
      // small per-cauldron forecast (next day) - lighter information
      snapshot.forecast.push({ id: c.id, predictedOverflow: Math.random() < 0.2, predictedFillPercent: Math.max(0, Math.min(100, fillPercent + Math.round((Math.random() - 0.5) * 10))) })
    })

    snapshot.avgLevel = Math.round(sum / cauldronIds.length)
    data.push(snapshot)
  }

  return new Promise(res => setTimeout(()=>res(data), 200))
}
