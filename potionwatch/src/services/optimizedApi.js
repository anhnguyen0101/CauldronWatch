// Optimized data fetching with intelligent caching and real-time sync
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Create axios instance for optimized API calls
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ============================================
// HISTORY CACHE
// ============================================

class HistoryCache {
  constructor() {
    this.cache = new Map() // Store by time range key
    this.timestamps = new Map() // Track fetch times
    this.CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
    this.pendingRequests = new Map() // Track in-flight requests to prevent duplicates
  }

  getCacheKey(startTime, endTime) {
    // Round to nearest 5 minutes for better cache hits (handles millisecond differences)
    // Also normalize by time range to group similar requests
    const start = new Date(startTime)
    const end = new Date(endTime)
    const rangeMs = end.getTime() - start.getTime()
    
    // Round down to nearest 5 minutes for start
    start.setMinutes(Math.floor(start.getMinutes() / 5) * 5, 0, 0)
    // Round up to nearest 5 minutes for end
    end.setMinutes(Math.ceil(end.getMinutes() / 5) * 5, 0, 0)
    
    // Create key that groups similar time ranges together
    // Use range-based grouping: if ranges are within 1 hour of each other, they're the same
    const rangeHours = Math.round(rangeMs / (1000 * 60 * 60))
    const startHour = Math.floor(start.getTime() / (1000 * 60 * 60))
    const endHour = Math.floor(end.getTime() / (1000 * 60 * 60))
    
    return `${rangeHours}h-${startHour}-${endHour}`
  }
  
  // Check if there's a pending request for this range
  getPendingRequest(startTime, endTime) {
    const key = this.getCacheKey(startTime, endTime)
    return this.pendingRequests.get(key)
  }
  
  // Set a pending request promise
  setPendingRequest(startTime, endTime, promise) {
    const key = this.getCacheKey(startTime, endTime)
    this.pendingRequests.set(key, promise)
    // Clean up after promise resolves/rejects
    promise.finally(() => {
      this.pendingRequests.delete(key)
    })
    return promise
  }

  get(startTime, endTime) {
    const key = this.getCacheKey(startTime, endTime)
    const cached = this.cache.get(key)
    const timestamp = this.timestamps.get(key)

    // Check if cache is still valid
    if (cached && timestamp && (Date.now() - timestamp) < this.CACHE_DURATION) {
      return cached
    }

    return null
  }

  set(startTime, endTime, data) {
    const key = this.getCacheKey(startTime, endTime)
    this.cache.set(key, data)
    this.timestamps.set(key, Date.now())
  }

  invalidate() {
    this.cache.clear()
    this.timestamps.clear()
  }

  // Get overlapping cached data to avoid re-fetching
  getOverlappingData(startTime, endTime) {
    const start = new Date(startTime).getTime()
    const end = new Date(endTime).getTime()

    for (const [key, data] of this.cache.entries()) {
      const [cachedStart, cachedEnd] = key.split('-').map(t => new Date(t).getTime())

      // Check if requested range is fully contained in cached range
      if (cachedStart <= start && cachedEnd >= end) {
        // Filter cached data to requested range
        return data.filter(snapshot => {
          const t = snapshot.timestamp || new Date(snapshot.time).getTime() || 0
          return t >= start && t <= end
        })
      }
    }

    return null
  }
}

const historyCache = new HistoryCache()

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate status based on level
 */
function calculateStatus(level) {
  if (level > 95) return 'overfill'
  if (level < 20) return 'underfill'
  if (level > 80) return 'filling'
  return 'normal'
}

/**
 * Process raw history data into snapshots with calculated metrics
 * This matches the format expected by TimelineHeatmap
 */
function processHistorySnapshots(rawData, cauldronsMap) {
  if (!Array.isArray(rawData) || rawData.length === 0) return []

  // Group by timestamp (minute-level granularity)
  const grouped = {}
  
  rawData.forEach(point => {
    // Group by minute for timeline
    const date = new Date(point.timestamp)
    const timeKey = date.toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm
    
    if (!grouped[timeKey]) {
      grouped[timeKey] = {
        time: date.toLocaleTimeString(),
        timestamp: date.getTime(),
        levels: [],
        cauldronsMap: new Map() // Track latest value per cauldron per minute
      }
    }
    
    grouped[timeKey].levels.push(point.level)

    // Store per-cauldron data (keep latest value per cauldron per minute)
    // Handle both cauldron_id (from backend) and id (from store)
    const cauldronId = point.cauldron_id || point.id || point.cauldronId
    const cauldronInfo = cauldronsMap?.get(cauldronId) || 
                        cauldronsMap?.get(point.cauldron_id) || 
                        cauldronsMap?.get(point.id)
    
    const capacity = cauldronInfo?.capacity ||
      cauldronInfo?.max_volume ||
      point.capacity ||
      point.max_volume ||
      1000
    
    const percentage = Math.round((point.level / capacity) * 100)
    
    // Keep the latest value for each cauldron (in case of duplicates in same minute)
    const existing = grouped[timeKey].cauldronsMap.get(cauldronId)
    if (!existing || new Date(point.timestamp) > new Date(existing.timestamp)) {
      grouped[timeKey].cauldronsMap.set(cauldronId, {
        id: cauldronId,
        name: cauldronInfo?.name || point.name || cauldronId,
        level: percentage,
        fillPercent: percentage,
        status: calculateStatus(percentage),
        timestamp: point.timestamp,
        drainVolume: point.drain_volume || point.drainVolume || 0,
        discrepancy: point.discrepancy || 0,
        alertCount: point.alert_count || point.alertCount || 0
      })
    }
  })

  // Convert to array format expected by TimelineHeatmap
  const result = Object.values(grouped)
    .map(snapshot => ({
      time: snapshot.time,
      timestamp: snapshot.timestamp,
      avgLevel: Math.round(snapshot.levels.reduce((a, b) => a + b, 0) / snapshot.levels.length),
      cauldrons: Array.from(snapshot.cauldronsMap.values())
    }))
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))

  return result
}

// ============================================
// OPTIMIZED FETCHING
// ============================================

/**
 * Optimized history fetching with smart caching
 * Priority: Speed over completeness - show data fast, fill in details later
 */
export async function fetchHistoryOptimized(timeRange, cauldronsMap) {
  const endDate = new Date()
  const startDate = new Date()

  // Calculate start time based on range
  const rangeHours = {
    '1h': 1,
    '6h': 6,
    '24h': 24,
    '7d': 24 * 7,
    '30d': 24 * 30
  }[timeRange] || 24

  startDate.setTime(endDate.getTime() - (rangeHours * 60 * 60 * 1000))

  const startISO = startDate.toISOString()
  const endISO = endDate.toISOString()

  // ✅ OPTIMIZATION: Check for pending requests first to prevent duplicate fetches
  const pendingRequest = historyCache.getPendingRequest(startISO, endISO)
  if (pendingRequest) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`⏳ Reusing pending request for ${timeRange}`)
    }
    return pendingRequest
  }

  // Check cache first
  const cached = historyCache.get(startISO, endISO)
  if (cached) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`📦 Using cached data for ${timeRange} (${cached.length} snapshots)`)
    }
    return cached
  }

  // Check if we have overlapping cached data
  const overlapping = historyCache.getOverlappingData(startISO, endISO)
  if (overlapping && overlapping.length > 0) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`📦 Using overlapping cached data for ${timeRange} (${overlapping.length} snapshots)`)
    }
    // Cache the filtered result
    historyCache.set(startISO, endISO, overlapping)
    return overlapping
  }

  // Fetch from server with time range parameters
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔄 Fetching ${timeRange} from server (${startISO} to ${endISO})...`)
  }
  
  // Create the fetch promise and register it as pending
  const fetchPromise = (async () => {
    try {
      const startTime = Date.now()
      
      // Use existing api instance from api.js
      // Backend expects 'start' and 'end' as ISO datetime strings
      const response = await api.get('/api/data', {
        params: {
          start: startISO,
          end: endISO,
          limit: 1000 // Limit to prevent huge responses
        }
      })

      const fetchTime = Date.now() - startTime
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`📊 Fetched ${response.data.length} data points in ${fetchTime}ms`)
      }

      // Process and transform the data
      const snapshots = processHistorySnapshots(response.data, cauldronsMap)

      // Cache the results
      historyCache.set(startISO, endISO, snapshots)

      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Fetched and cached ${snapshots.length} snapshots for ${timeRange}`)
      }
      
      return snapshots
    } catch (err) {
      console.error(`❌ Error fetching history for ${timeRange}:`, err)
      // Return empty array on error (don't throw - let UI handle gracefully)
      return []
    }
  })()
  
  // Register as pending request to prevent duplicates
  historyCache.setPendingRequest(startISO, endISO, fetchPromise)
  
  return fetchPromise
}

/**
 * Invalidate cache when manual refresh is triggered
 */
export function invalidateHistoryCache() {
  historyCache.invalidate()
  if (process.env.NODE_ENV === 'development') {
    console.log('🗑️ History cache invalidated')
  }
}

/**
 * Prefetch next time range in background (optional optimization)
 */
export function prefetchNextRange(currentRange, cauldronsMap = null) {
  const nextRange = {
    '1h': '6h',
    '6h': '24h',
    '24h': '7d'
  }[currentRange]

  if (nextRange && cauldronsMap) {
    // Fetch in background without blocking (after a short delay)
    setTimeout(() => {
      fetchHistoryOptimized(nextRange, cauldronsMap).catch(() => {
        // Silently fail - prefetch is optional
      })
    }, 2000) // Wait 2 seconds before prefetching
  }
}

// Export cache for debugging (development only)
if (process.env.NODE_ENV === 'development') {
  window.__HISTORY_CACHE__ = historyCache
}

