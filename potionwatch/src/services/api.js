// API service for connecting to backendhttps://github.com/anhnguyen0101/CauldronWatch/pull/2/conflict?name=potionwatch%252Fsrc%252Fservices%252Fapi.js&ancestor_oid=efe2eb5f5560ae2cb1599f694061ba51d5775643&base_oid=24ae9b287a0a5aa89965e61cfb969e425b9480db&head_oid=fcc704a8da224ee492bee4406d858c8c074de463
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
export async function fetchHistory(cauldronId = null, startDate = null, endDate = null) {
  const params = {}
  if (cauldronId) params.cauldron_id = cauldronId
  if (startDate) params.start = startDate
  if (endDate) params.end = endDate
  
  const response = await api.get('/api/data', { params })
  
  // Transform to format expected by frontend
  // Group by timestamp and calculate average level
  const grouped = {}
  response.data.forEach(point => {
    const timeKey = new Date(point.timestamp).toLocaleDateString()
    if (!grouped[timeKey]) {
      grouped[timeKey] = { time: timeKey, levels: [] }
    }
    grouped[timeKey].levels.push(point.level)
  })
  
  return Object.values(grouped).map(snapshot => ({
    time: snapshot.time,
    avgLevel: Math.round(snapshot.levels.reduce((a, b) => a + b, 0) / snapshot.levels.length)
  }))
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
export async function fetchDiscrepancies(severity = null, cauldronId = null) {
  // Build params object (used in both initial request and retry)
  const params = {}
  if (severity) params.severity = severity
  if (cauldronId) params.cauldron_id = cauldronId
  
  try {
    const response = await api.get('/api/discrepancies', { params })
    return response.data
  } catch (error) {
    console.error('Error fetching discrepancies:', error)
    // If no cache exists, try to detect first
    if (error.response?.status === 404) {
      console.log('No cached discrepancies, running detection...')
      try {
        await api.post('/api/discrepancies/detect')
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

    snapshot.avgLevel = Math.round(sum / cauldronIds.length)
    data.push(snapshot)
  }

  return new Promise(res => setTimeout(()=>res(data), 200))
}
