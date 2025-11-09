import { useEffect } from 'react'
import { initSocket } from './initSocket'
import { fetchHistory, fetchCauldrons, fetchLatestLevels, checkBackendHealth } from '../services/api'
import usePotionStore from '../store/usePotionStore'

export default function useInit(){
  useEffect(()=>{
    // Check backend health first
    checkBackendHealth().then(isHealthy => {
      if (!isHealthy) {
        console.error('❌ Backend is not available. Please start the backend server.')
        console.error('❌ Frontend requires backend to function. No mock data will be used.')
        return
      }
      console.log('✅ Backend is healthy')
    }).catch(err => {
      console.error('❌ Error checking backend health:', err)
      console.error('❌ Backend is not available. Please start the backend server.')
      return
    })

    // Load initial cauldrons
    fetchCauldrons()
      .then(cauldrons => {
        console.log('📦 Fetched cauldrons from backend:', cauldrons.length)
        const store = usePotionStore.getState()
        // Transform backend format to frontend format
        // Backend returns: {id, latitude, longitude, max_volume, name}
        const transformed = cauldrons.map(c => {
          const cauldronId = c.cauldron_id || c.id
          return {
            id: cauldronId,
            name: c.name || cauldronId,
            lat: c.latitude,
            lng: c.longitude,
            level: 0, // Will be updated by latest levels
            capacity: c.capacity || c.max_volume || 1000
          }
        })
        
        console.log('✅ Transformed cauldrons:', transformed.length, transformed[0])
        
        // Update store with cauldrons
        usePotionStore.setState({ cauldrons: transformed })
        
        // Load latest levels
        return fetchLatestLevels()
      })
      .then(levels => {
        if (!levels) return
        console.log('📊 Fetched latest levels from backend:', levels?.length || 0)
        if (levels && levels.length > 0) {
          const store = usePotionStore.getState()
          let updated = 0
          levels.forEach(level => {
            // Backend returns: {cauldron_id, timestamp, level}
            const cauldronId = level.cauldron_id || level.id
            const cauldron = store.cauldrons.find(c => c.id === cauldronId)
            if (cauldron && level.level != null) {
              const percentage = Math.round((level.level / cauldron.capacity) * 100)
              store.setCauldronLevel(cauldronId, percentage)
              updated++
              console.log(`   ✅ Updated ${cauldronId}: ${level.level}/${cauldron.capacity} = ${percentage}%`)
            } else if (!cauldron) {
              console.warn(`   ⚠️  No cauldron found for level ID: ${cauldronId}`)
            }
          })
          console.log(`✅ Updated ${updated}/${levels.length} cauldron levels`)
          
          // Log average level for verification
          const avgLevel = Math.round(
            store.cauldrons.reduce((sum, c) => sum + c.level, 0) / store.cauldrons.length
          )
          console.log(`📊 Average level: ${avgLevel}%`)
        } else {
          console.warn('⚠️  No levels data received from backend')
        }
      })
      .catch(err => {
        console.error('❌ Error loading initial data from backend:', err)
        console.error('❌ Backend is not available. Please start the backend server.')
      })

    // Load initial history
    fetchHistory()
      .then(h => {
        const push = usePotionStore.getState().pushHistorySnapshot
        h.forEach(s => push(s))
      })
      .catch(err => {
        console.error('❌ Error loading history from backend:', err)
      })

    // Initialize WebSocket connection
    const sock = initSocket()
    return ()=> sock.close()
  }, [])
}
