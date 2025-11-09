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
  try {
    const response = await api.get('/api/cauldrons')
    return response.data
  } catch (error) {
    console.error('Error fetching cauldrons:', error)
    // Fallback to mock data if backend is not available
    return [
      { id: 'cauldron_001', cauldron_id: 'cauldron_001', name: 'Crimson Brew', latitude: 33.2148, longitude: -97.1331, max_volume: 1000, level: 60 },
      { id: 'cauldron_002', cauldron_id: 'cauldron_002', name: 'Sapphire Mist', latitude: 33.2155, longitude: -97.1325, max_volume: 800, level: 30 },
      { id: 'cauldron_003', cauldron_id: 'cauldron_003', name: 'Golden Elixir', latitude: 33.2160, longitude: -97.1330, max_volume: 1200, level: 85 },
    ]
  }
}

// Fetch latest levels for all cauldrons
export async function fetchLatestLevels() {
  try {
    const response = await api.get('/api/data/latest')
    return response.data
  } catch (error) {
    console.error('Error fetching latest levels:', error)
    return []
  }
}

// Fetch historical data
export async function fetchHistory(cauldronId = null, startDate = null, endDate = null) {
  try {
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
  } catch (error) {
    console.error('Error fetching history:', error)
    // Fallback to mock data
    const now = Date.now()
    const data = []
    for(let i=0;i<10;i++){
      data.push({ time: new Date(now - (10 - i)*24*60*60000).toLocaleDateString(), avgLevel: Math.round(40 + 40*Math.abs(Math.sin(i/2))) })
    }
    return data
  }
}

// Fetch tickets
export async function fetchTickets() {
  try {
    const response = await api.get('/api/tickets')
    return response.data.transport_tickets || response.data.tickets || []
  } catch (error) {
    console.error('Error fetching tickets:', error)
    return []
  }
}

// Fetch drain events for a cauldron
export async function fetchDrainEvents(cauldronId, date = null) {
  try {
    if (date) {
      const response = await api.get(`/api/analysis/drains/${cauldronId}/${date}`)
      return response.data.drain_events || []
    } else {
      const response = await api.get(`/api/analysis/cauldrons/${cauldronId}`)
      return response.data.drain_events || []
    }
  } catch (error) {
    console.error('Error fetching drain events:', error)
    return []
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

// Detect discrepancies (Person 3) - triggers detection and returns results
export async function detectDiscrepancies(startDate = null, endDate = null) {
  try {
    const params = {}
    if (startDate) params.start_date = startDate
    if (endDate) params.end_date = endDate
    
    const response = await api.post('/api/discrepancies/detect', null, { params })
    return response.data
  } catch (error) {
    console.error('Error detecting discrepancies:', error)
    return { discrepancies: [], total_discrepancies: 0, critical_count: 0, warning_count: 0, info_count: 0 }
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
