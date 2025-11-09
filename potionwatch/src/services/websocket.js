// WebSocket service for real-time updates
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws'

export function startSocket(onMessage) {
  let ws = null
  let reconnectAttempts = 0
  const maxReconnectAttempts = 5
  let reconnectTimeout = null

  function connect() {
    try {
      // Determine WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = import.meta.env.VITE_WS_URL 
        ? new URL(import.meta.env.VITE_WS_URL).host
        : window.location.hostname + ':8000'
      const wsUrl = import.meta.env.VITE_WS_URL || `${protocol}//${host}/ws`
      
      console.log('🔌 Connecting to WebSocket:', wsUrl)
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('✅ WebSocket connected to', wsUrl)
        reconnectAttempts = 0
        onMessage({ type: 'connected', message: 'Connected to CauldronWatch' })
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.type === 'cauldron_update') {
            console.log('📨 WebSocket: Cauldron update received', data)
            // Transform backend format to frontend format
            if (!data.data || !data.data.cauldrons) {
              console.error('❌ WebSocket: Invalid cauldron_update format - missing data.data.cauldrons', data)
              return
            }
            const updates = data.data.cauldrons.map(c => ({
              id: c.cauldron_id || c.id,
              level: Math.round((c.level / (c.capacity || c.max_volume || 1000)) * 100), // Convert to percentage
              rawLevel: c.level,
              capacity: c.capacity || c.max_volume || 1000
            }))
            console.log('📨 WebSocket: Transformed updates', updates)
            onMessage({ type: 'levels', data: updates })
          } else if (data.type === 'drain_event') {
            console.log('💧 WebSocket: Drain event received', data.data)
            onMessage({ type: 'drain_event', data: data.data, timestamp: data.timestamp })
          } else if (data.type === 'discrepancy') {
            console.log('🚨 WebSocket: Discrepancy received', data.data)
            onMessage({ type: 'discrepancy', data: data.data, timestamp: data.timestamp })
          } else if (data.type === 'ping') {
            // Ignore ping messages - just keep connection alive
            // Don't log to avoid console spam
          } else if (data.type === 'connected') {
            console.log('📨 WebSocket message:', data.type)
            onMessage(data)
          } else {
            console.log('📨 WebSocket message:', data.type)
            onMessage(data)
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error)
        console.error('❌ WebSocket error details:', {
          type: error.type,
          target: error.target,
          readyState: ws.readyState, // 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
          url: wsUrl
        })
        // Don't close immediately - let onclose handle it
      }

      ws.onclose = () => {
        console.log('🔌 WebSocket closed')
        ws = null
        
        // Attempt to reconnect
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000) // Exponential backoff, max 30s
          console.log(`🔄 Reconnecting in ${delay/1000}s... (attempt ${reconnectAttempts}/${maxReconnectAttempts})`)
          reconnectTimeout = setTimeout(connect, delay)
        } else {
          console.error('❌ Max reconnection attempts reached. Backend is not available.')
        }
      }
    } catch (error) {
      console.error('❌ WebSocket connection error:', error)
      console.error('❌ Backend is not available. Please start the backend server.')
    }
  }

  connect()

  return {
    close: () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
      }
      if (ws) {
        ws.close()
        ws = null
      }
    },
    send: (data) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(typeof data === 'string' ? data : JSON.stringify(data))
      }
    }
  }
}

// Mock socket removed - backend is required
