// API service for connecting to backend
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Fetch all cauldrons
export async function fetchCauldrons() {
  const response = await api.get('/api/cauldrons')
  return response.data
}

// Fetch latest levels for all cauldrons
export async function fetchLatestLevels() {
  const response = await api.get('/api/data/latest')
  return response.data
}

// Fetch historical data
export async function fetchHistory(cauldronId = null, startDate = null, endDate = null, cauldronsMap = null) {
  try {
    const params = {}
    if (cauldronId) params.cauldron_id = cauldronId
    if (startDate) params.start = startDate
    if (endDate) params.end = endDate

    // Add limit to prevent fetching too much data (max 1000 points)
    params.limit = 1000

    console.log('📊 Fetching history with params:', { cauldronId, startDate, endDate, limit: params.limit })
    const startTime = Date.now()
    const response = await api.get('/api/data', { params })
    const fetchTime = Date.now() - startTime
    console.log(`📊 Fetched ${response.data.length} data points in ${fetchTime}ms`)

    // Transform to format expected by frontend
    // Group by minute (not by day) for better timeline granularity
    const grouped = {}
    response.data.forEach(point => {
      // Group by minute for timeline
      const date = new Date(point.timestamp)
      const timeKey = date.toISOString().slice(0, 16) // YYYY-MM-DDTHH:mm
      if (!grouped[timeKey]) {
        grouped[timeKey] = {
          time: date.toLocaleTimeString(),
          timestamp: date.getTime(), // Store timestamp for filtering
          levels: [],
          cauldrons: [], // Will store Map to deduplicate by cauldron_id
          cauldronsMap: new Map() // Track latest value per cauldron
        }
      }
      grouped[timeKey].levels.push(point.level)

      // Store per-cauldron data for timeline (keep latest value per cauldron per minute)
      // Use capacity from cauldronsMap if available, otherwise from point or default
      const capacity = cauldronsMap?.get(point.cauldron_id)?.capacity ||
        point.capacity ||
        point.max_volume ||
        1000
      const percentage = Math.round((point.level / capacity) * 100)

      // Keep the latest value for each cauldron (in case of duplicates in same minute)
      const existing = grouped[timeKey].cauldronsMap.get(point.cauldron_id)
      if (!existing || new Date(point.timestamp) > new Date(existing.timestamp)) {
        grouped[timeKey].cauldronsMap.set(point.cauldron_id, {
          id: point.cauldron_id,
          level: percentage,
          timestamp: point.timestamp
        })
      }
    })

    // Convert cauldronsMap to array for each timeKey
    Object.keys(grouped).forEach(timeKey => {
      grouped[timeKey].cauldrons = Array.from(grouped[timeKey].cauldronsMap.values())
      delete grouped[timeKey].cauldronsMap // Clean up
    })

    // Convert to array and sort by timestamp
    const result = Object.values(grouped)
      .map(snapshot => ({
        time: snapshot.time,
        timestamp: snapshot.timestamp, // Already stored in grouped object
        avgLevel: Math.round(snapshot.levels.reduce((a, b) => a + b, 0) / snapshot.levels.length),
        cauldrons: snapshot.cauldrons
      }))
      .sort((a, b) => {
        // Sort by timestamp (more reliable than time string)
        return (a.timestamp || 0) - (b.timestamp || 0)
      })

    console.log(`📊 Transformed to ${result.length} timeline snapshots`)
    return result
  } catch (error) {
    console.error('Error fetching history:', error)
    // Return empty array on error
    return []
  }
}

// Fetch tickets
export async function fetchTickets() {
  const response = await api.get('/api/tickets')
  return response.data.transport_tickets || response.data.tickets || []
}

// Fetch drain events for a cauldron
export async function fetchDrainEvents(cauldronId, date = null) {
  if (date) {
    const response = await api.get(`/api/analysis/drains/${cauldronId}/${date}`)
    return response.data.drain_events || []
  } else {
    const response = await api.get(`/api/analysis/cauldrons/${cauldronId}`)
    return response.data.drain_events || []
  }
}

// Fetch discrepancies (Person 3)
export async function fetchDiscrepancies(severity = null, cauldronId = null, startDate = null, endDate = null) {
  // Build params object (used in both initial request and retry)
  const params = {}
  if (severity) params.severity = severity
  if (cauldronId) params.cauldron_id = cauldronId
  if (startDate) params.start_date = startDate
  if (endDate) params.end_date = endDate

  try {
    const response = await api.get('/api/discrepancies', { params })
    return response.data
  } catch (error) {
    console.error('Error fetching discrepancies:', error)
    // If no cache exists, try to detect first
    if (error.response?.status === 404) {
      console.log('No cached discrepancies, running detection...')
      try {
        const detectParams = {}
        if (startDate) detectParams.start_date = startDate
        if (endDate) detectParams.end_date = endDate
        await api.post('/api/discrepancies/detect', null, { params: detectParams })
        // Retry fetching with same params
        const retryResponse = await api.get('/api/discrepancies', { params })
        return retryResponse.data
      } catch (detectError) {
        console.error('Error detecting discrepancies:', detectError)
        return { discrepancies: [], total_discrepancies: 0, critical_count: 0, warning_count: 0, info_count: 0 }
      }
    }
    return { discrepancies: [], total_discrepancies: 0, critical_count: 0, warning_count: 0, info_count: 0 }
  }
}

// Detect discrepancies (Person 3) - triggers detection and returns results
export async function detectDiscrepancies(startDate = null, endDate = null) {
  try {
    const params = {}
    
    // Accept date strings directly (YYYY-MM-DD format)
    if (startDate) {
      params.start_date = startDate
    }
    if (endDate) {
      params.end_date = endDate
    }

    console.log('📨 POST /api/discrepancies/detect', params)

    const response = await api.post('/api/discrepancies/detect', null, { params })
    return response.data
  } catch (error) {
    console.error('Error detecting discrepancies:', error)
    return {
      discrepancies: [],
      total_discrepancies: 0,
      critical_count: 0,
      warning_count: 0,
      info_count: 0,
    }
  }
}



// Health check
export async function checkBackendHealth() {
  try {
    const response = await api.get('/health')
    return response.data.status === 'healthy'
  } catch (error) {
    return false
  }
}

// Fetch full network topology (nodes + edges)
export async function fetchNetwork() {
  try {
    const response = await api.get('/api/network')
    // Backend returns a NetworkDto with edges
    // EdgeDto format: {from_node (alias: "from"), to_node (alias: "to"), travel_time_minutes, weight, distance}
    const network = response.data || {}
    const edges = (network.edges || []).map(e => ({
      from: e.from_node || e.from || null,
      from_node: e.from_node || e.from || null, // Support both formats
      to: e.to_node || e.to || null,
      to_node: e.to_node || e.to || null, // Support both formats
      travel_time_minutes: e.travel_time_minutes != null ? e.travel_time_minutes : null,
      distance: e.distance != null ? e.distance : null,
      weight: e.weight != null ? e.weight : null
    }))
    return { nodes: network.nodes || [], edges }
  } catch (error) {
    console.error('Error fetching network:', error)
    return { nodes: [], edges: [] }
  }
}

// Fetch market (single market hub) if available
export async function fetchMarket() {
  try {
    const response = await api.get('/api/market')
    return response.data || null
  } catch (error) {
    console.warn('Market not available or error fetching market:', error?.message || error)
    return null
  }
}

// Forecast endpoints
export async function fetchMinimumWitches(safetyMarginPercent = 0.9, unloadTimeMinutes = 15) {
  try {
    const response = await api.get('/api/forecast/minimum-witches', {
      params: {
        safety_margin_percent: safetyMarginPercent,
        unload_time_minutes: unloadTimeMinutes
      }
    })
    return response.data
  } catch (error) {
    console.error('Error fetching minimum witches:', error)
    return { minimum_witches: 0, schedule: [], cauldrons_serviced: 0, total_cauldrons: 0, verification: {} }
  }
}

export async function fetchDailySchedule(targetDate = null) {
  try {
    const params = {}
    if (targetDate) {
      params.target_date = targetDate
    }
    const response = await api.get('/api/forecast/daily-schedule', { params })
    return response.data
  } catch (error) {
    console.error('Error fetching daily schedule:', error)
    return { date: null, minimum_witches: 0, schedules: [], total_tasks: 0, repeating: false }
  }
}

// AI-Powered Insights Endpoints
export async function fetchAISummary(timeRange = "24 hours") {
  try {
    const response = await api.get('/api/ai/summary', {
      params: { time_range: timeRange }
    })
    return response.data
  } catch (error) {
    console.error('Error fetching AI summary:', error)
    return {
      summary: "Unable to generate AI summary at this time.",
      key_findings: [],
      recommendations: [],
      risk_level: "UNKNOWN",
      generated_at: new Date().toISOString()
    }
  }
}

export async function fetchAIOptimizationPlan() {
  try {
    const response = await api.get('/api/ai/optimization-plan')
    return response.data
  } catch (error) {
    console.error('Error fetching AI optimization plan:', error)
    return {
      plan: "Unable to generate optimization plan at this time.",
      witch_allocation: { witches_needed: 0, rationale: "" },
      expected_savings: { witch_hours_saved: "0 hours", cost_reduction: "0%" },
      implementation_steps: [],
      generated_at: new Date().toISOString()
    }
  }
}

export async function fetchAIFraudAnalysis(startDate = null, endDate = null) {
  try {
    const params = {}
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate
    
    const response = await api.get('/api/ai/fraud-analysis', { params })
    return response.data
  } catch (error) {
    console.error('Error fetching AI fraud analysis:', error)
    return {
      suspicious_patterns: [],
      courier_risk_scores: {},
      investigation_priorities: [],
      generated_at: new Date().toISOString()
    }
  }
}

// Contextual AI explanation for specific components
export async function fetchAIExplanation(componentName, componentData) {
  try {
    const response = await api.post('/api/ai/explain', {
      component_name: componentName,
      data: componentData
    })
    return response.data
  } catch (error) {
    console.error('Error fetching AI explanation:', error)
    // Return fallback explanation
    return {
      main_idea: `This ${componentName} displays important monitoring data for your potion network.`,
      key_points: [
        "Data is updated in real-time",
        "Colors indicate status levels",
        "Click elements for more details"
      ],
      how_to_read: "Review the visual elements and their labels to understand the current state.",
      what_to_look_for: "Watch for unusual patterns or values that deviate from normal operations."
    }
  }
}
