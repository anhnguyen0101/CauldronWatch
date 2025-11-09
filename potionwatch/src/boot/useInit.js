import { useEffect } from 'react'
import { initSocket } from './initSocket'
import { fetchHistory, fetchCauldrons, fetchLatestLevels, checkBackendHealth } from '../services/api'
import usePotionStore from '../store/usePotionStore'

export default function useInit(){
  useEffect(()=>{
    // Check backend health
    checkBackendHealth().then(isHealthy => {
      if (isHealthy) {
        console.log('✅ Backend is healthy')
      } else {
        console.warn('⚠️ Backend not available, using fallback data')
      }
    })

    // Load initial cauldrons
    fetchCauldrons().then(cauldrons => {
      console.log('📦 Fetched cauldrons from backend:', cauldrons.length)
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
      
      // Get current store state to check for pending updates
      const currentStore = usePotionStore.getState()
      
      // Update store with cauldrons
      usePotionStore.setState({ cauldrons: transformed })
      
      // Apply any pending WebSocket updates that arrived before cauldrons were loaded
      if (currentStore.pendingUpdates && currentStore.pendingUpdates.length > 0) {
        console.log(`📦 Applying ${currentStore.pendingUpdates.length} pending WebSocket updates`)
        const updateCauldronLevels = usePotionStore.getState().updateCauldronLevels
        if (updateCauldronLevels) {
          updateCauldronLevels(currentStore.pendingUpdates)
        }
      }
      
      // Load latest levels
      return fetchLatestLevels()
    }).then(levels => {
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
      
      // History loading is now handled by TimelineHeatmap component
      // It will fetch 7 days of data once and filter client-side
      console.log('✅ Initial data loaded. Timeline will load history separately.')
    }).catch(err => {
      console.error('❌ Error loading initial data:', err)
    })

    // Initialize WebSocket connection
    const sock = initSocket()
    return ()=> sock.close()
  }, [])
}
