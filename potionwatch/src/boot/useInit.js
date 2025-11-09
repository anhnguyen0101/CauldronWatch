import { useEffect } from 'react'
import { initSocket } from './initSocket'
import { fetchHistory, fetchCauldrons, fetchLatestLevels, checkBackendHealth, fetchNetwork, fetchMarket } from '../services/api'
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
  }).then(async levels => {
        if (!levels) {
          console.warn('⚠️  No levels data received from backend (levels is null/undefined)')
          return
        }
        console.log('📊 Fetched latest levels from backend:', levels?.length || 0)
        console.log('📊 Sample level data:', levels[0]) // Log first level to see structure
        
        if (levels && levels.length > 0) {
          const store = usePotionStore.getState()
          let updated = 0
          let skipped = 0
          
          levels.forEach(level => {
            // Backend returns: {cauldron_id, timestamp, level}
            const cauldronId = level.cauldron_id || level.id
            const cauldron = store.cauldrons.find(c => c.id === cauldronId)
            
            if (!cauldron) {
              console.warn(`   ⚠️  No cauldron found for level ID: ${cauldronId}`)
              skipped++
              return
            }
            
            if (level.level == null) {
              console.warn(`   ⚠️  Level is null/undefined for ${cauldronId}:`, level)
              skipped++
              return
            }
            
            // Check if level is 0 or very small
            if (level.level === 0) {
              console.warn(`   ⚠️  Level is 0 for ${cauldronId} - this might indicate no data in cache`)
            }
            
            if (cauldron.capacity <= 0) {
              console.warn(`   ⚠️  Invalid capacity (${cauldron.capacity}) for ${cauldronId}`)
              skipped++
              return
            }
            
            const percentage = Math.round((level.level / cauldron.capacity) * 100)
            store.setCauldronLevel(cauldronId, percentage)
            updated++
            console.log(`   ✅ Updated ${cauldronId}: ${level.level}L / ${cauldron.capacity}L = ${percentage}%`)
          })
          
          console.log(`✅ Updated ${updated}/${levels.length} cauldron levels (skipped: ${skipped})`)
          
          // Log average level for verification
          if (store.cauldrons.length > 0) {
            const avgLevel = Math.round(
              store.cauldrons.reduce((sum, c) => sum + (c.level || 0), 0) / store.cauldrons.length
            )
            console.log(`📊 Average level: ${avgLevel}%`)
            console.log(`📊 All cauldron levels:`, store.cauldrons.map(c => `${c.id}: ${c.level || 0}%`))
          }
          
          // Load network and market data (parallel) so the graph can render live edges
          // Then load initial history AFTER cauldrons and levels are loaded
          try {
            const [networkData, marketData] = await Promise.all([fetchNetwork(), fetchMarket()])
            if (networkData && Array.isArray(networkData.edges)) {
              usePotionStore.getState().setLinks(networkData.edges)
              console.log(`🌐 Loaded ${networkData.edges.length} network edges`)
            }
            if (marketData) {
              usePotionStore.getState().setMarket(marketData)
              console.log('🏪 Loaded market data:', marketData)
            }
          } catch (e) {
            console.warn('Unable to load network/market at boot:', e)
          }

          // This ensures history snapshots can reference the loaded cauldrons
          return fetchHistory()
        } else {
          console.warn('⚠️  No levels data received from backend (empty array)')
          return Promise.resolve([])
        }
      })
      .then(h => {
        if (!h || h.length === 0) {
          console.log('📜 No history data to load')
        } else {
          console.log(`📜 Loaded ${h.length} history snapshots`)
        }
        
        // History loading is now handled by TimelineHeatmap component
        // It will fetch 7 days of data once and filter client-side
        console.log('✅ Initial data loaded. Timeline will load history separately.')
      })
      .catch(err => {
        console.error('❌ Error loading initial data:', err)
      })

    // Initialize WebSocket connection
    const sock = initSocket()
    return ()=> sock.close()
  }, [])
}
