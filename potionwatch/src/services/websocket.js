// WebSocket service for real-time updates
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws'

export function startSocket(onMessage) {
  let ws = null
  let reconnectAttempts = 0
  const maxReconnectAttempts = 10  // Increased to allow more reconnection attempts
  let reconnectTimeout = null
  let isConnecting = false
  let isIntentionallyClosed = false  // Track if we intentionally closed the connection

  function connect() {
    // Prevent multiple simultaneous connection attempts
    if (isConnecting || (ws && ws.readyState === WebSocket.CONNECTING)) {
      console.log('⏳ WebSocket connection already in progress, skipping...')
      return
    }
    
    // Don't reconnect if we intentionally closed
    if (isIntentionallyClosed) {
      console.log('🚫 WebSocket intentionally closed, not reconnecting')
      return
    }
    
    // Determine WebSocket URL (outside try block so it's accessible in error handlers)
    let wsUrl
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = import.meta.env.VITE_WS_URL 
        ? new URL(import.meta.env.VITE_WS_URL).host
        : window.location.hostname + ':8000'
      wsUrl = import.meta.env.VITE_WS_URL || `${protocol}//${host}/ws`
    } catch (e) {
      console.error('❌ Error determining WebSocket URL:', e)
      wsUrl = 'ws://localhost:8000/ws'  // Fallback URL
    }
    
    try {
      // Close existing connection if any
      if (ws) {
        try {
          ws.close()
        } catch (e) {
          // Ignore errors when closing
        }
        ws = null
      }
      
      console.log('🔌 Connecting to WebSocket:', wsUrl)
      isConnecting = true
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('✅ WebSocket connected')
        isConnecting = false
        reconnectAttempts = 0
        onMessage({ type: 'connected', message: 'Connected to CauldronWatch' })
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.type === 'cauldron_update') {
            console.log('📨 WebSocket: Cauldron update received', data.data)
            
            if (!data.data || !data.data.cauldrons || !Array.isArray(data.data.cauldrons)) {
              console.error('⚠️  Invalid cauldron_update message format:', data)
              return
            }
            
            // Transform backend format to frontend format
            const updates = data.data.cauldrons.map((c, index) => {
              const cauldronId = c.cauldron_id || c.id
              const level = c.level || 0
              const capacity = c.capacity || c.max_volume || 1000
              const percentage = capacity > 0 ? Math.round((level / capacity) * 100) : 0
              
              // Log first few updates for debugging
              if (index < 2) {
                console.log(`   📊 WebSocket update: ${cauldronId} = ${level}L / ${capacity}L = ${percentage}%`)
              }
              
              return {
                id: cauldronId,
                level: percentage,
                rawLevel: level,
                capacity: capacity
              }
            })
            
            console.log(`📨 Processed ${updates.length} cauldron updates from WebSocket`)
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
        isConnecting = false
        // Don't log errors if we're already closing or closed - onclose will handle it
        if (ws && ws.readyState !== WebSocket.CLOSING && ws.readyState !== WebSocket.CLOSED) {
          console.error('❌ WebSocket error:', error)
          // Safely log error details - ws might be null or error object might not have all properties
          try {
            const readyState = ws?.readyState ?? 'N/A'
            const states = { 0: 'CONNECTING', 1: 'OPEN', 2: 'CLOSING', 3: 'CLOSED' }
            console.error('❌ WebSocket error details:', {
              type: error?.type || 'unknown',
              readyState: typeof readyState === 'number' ? states[readyState] : readyState,
              url: wsUrl
            })
          } catch (e) {
            // If logging fails, just log the basic error
            console.error('❌ WebSocket error (unable to get details):', e)
          }
        }
        // Don't close immediately - let onclose handle it
      }

      ws.onclose = (event) => {
        isConnecting = false
        const wasOpen = ws && ws.readyState === WebSocket.OPEN
        console.log('🔌 WebSocket closed', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          wasOpen: wasOpen
        })
        
        ws = null
        
        // Don't reconnect if we intentionally closed the connection
        if (isIntentionallyClosed) {
          console.log('🚫 WebSocket intentionally closed, not reconnecting')
          return
        }
        
        // Only reconnect if it was an unexpected close (not a clean close with code 1000)
        // Code 1000 = normal closure
        // Code 1001 = going away
        // Code 1006 = abnormal closure (connection lost)
        const shouldReconnect = event.code !== 1000 || !event.wasClean
        
        if (shouldReconnect && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000) // Exponential backoff, max 30s
          console.log(`🔄 Reconnecting in ${delay/1000}s... (attempt ${reconnectAttempts}/${maxReconnectAttempts})`)
          reconnectTimeout = setTimeout(() => {
            if (!isIntentionallyClosed) {
              connect()
            }
          }, delay)
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          console.error('❌ Max reconnection attempts reached. Backend is not available.')
        }
      }
    } catch (error) {
      isConnecting = false
      console.error('❌ WebSocket connection error:', error)
      console.error('❌ Backend is not available. Please start the backend server.')
      
      // Schedule reconnection attempt
      if (reconnectAttempts < maxReconnectAttempts && !isIntentionallyClosed) {
        reconnectAttempts++
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
        console.log(`🔄 Will retry connection in ${delay/1000}s... (attempt ${reconnectAttempts}/${maxReconnectAttempts})`)
        reconnectTimeout = setTimeout(() => {
          if (!isIntentionallyClosed) {
            connect()
          }
        }, delay)
      }
    }
  }

  connect()

  return {
    close: () => {
      isIntentionallyClosed = true
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
        reconnectTimeout = null
      }
      if (ws) {
        try {
          ws.close(1000, 'Intentional close')  // Normal closure
        } catch (e) {
          // Ignore errors when closing
        }
        ws = null
      }
      isConnecting = false
    },
    send: (data) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(typeof data === 'string' ? data : JSON.stringify(data))
        } catch (e) {
          console.error('❌ Error sending WebSocket message:', e)
        }
      } else {
        console.warn('⚠️  WebSocket is not open. Cannot send message.')
      }
    },
    isConnected: () => {
      return ws && ws.readyState === WebSocket.OPEN
    }
  }
}

// Mock socket removed - backend is required
