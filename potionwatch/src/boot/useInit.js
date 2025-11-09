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
        
        // Update store with cauldrons using the store method
        usePotionStore.getState().setCauldrons(transformed)
        console.log('✅ Store updated with', transformed.length, 'cauldrons')
        
        // Load latest levels
        return fetchLatestLevels()
      })
      .then(levels => {
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
          
          // Load initial history AFTER cauldrons and levels are loaded
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
          return
        }
        
        console.log('📜 Fetched history from backend:', h.length, 'snapshots')
        const store = usePotionStore.getState()
        const push = store.pushHistorySnapshot
        
        // Convert history snapshots: transform levelLiters to percentages using cauldron capacities
        h.forEach(s => {
          if (s.cauldrons && s.cauldrons.length > 0) {
            // Convert levelLiters to percentage using store cauldron capacities
            const enhancedCauldrons = s.cauldrons.map(cData => {
              const storeCauldron = store.cauldrons.find(c => c.id === cData.id)
              
              if (storeCauldron && storeCauldron.capacity > 0) {
                // Convert liters to percentage
                const levelLiters = cData.levelLiters || 0
                const percentage = Math.round((levelLiters / storeCauldron.capacity) * 100)
                
                console.log(`  📜 Converting ${cData.id}: ${levelLiters}L / ${storeCauldron.capacity}L = ${percentage}%`)
                
                return {
                  id: cData.id,
                  name: storeCauldron.name || cData.id,
                  level: percentage,
                  fillPercent: percentage,
                  status: percentage > 95 ? 'overfill' : percentage < 20 ? 'underfill' : 'normal'
                }
              } else {
                // Use store level if cauldron found but no capacity/conversion possible
                console.warn(`  ⚠️  No store cauldron or capacity for ${cData.id}, using store level or 0`)
                return {
                  id: cData.id,
                  name: storeCauldron?.name || cData.id,
                  level: storeCauldron?.level || 0,
                  fillPercent: storeCauldron?.level || 0,
                  status: (storeCauldron?.level || 0) > 95 ? 'overfill' : (storeCauldron?.level || 0) < 20 ? 'underfill' : 'normal'
                }
              }
            })
            
            // Calculate avgLevel from percentages
            const avgLevel = enhancedCauldrons.length > 0
              ? Math.round(enhancedCauldrons.reduce((sum, c) => sum + (c.level || 0), 0) / enhancedCauldrons.length)
              : 0
            
            push({
              time: s.time,
              avgLevel: avgLevel,
              cauldrons: enhancedCauldrons
            })
          } else {
            // If no cauldrons in snapshot, create from store state
            console.log(`  📜 Snapshot ${s.time} has no cauldrons, creating from store`)
            const cauldronSnapshots = store.cauldrons.map(c => ({
              id: c.id,
              name: c.name,
              level: c.level || 0,
              fillPercent: c.level || 0,
              status: (c.level || 0) > 95 ? 'overfill' : (c.level || 0) < 20 ? 'underfill' : 'normal'
            }))
            push({
              time: s.time,
              avgLevel: cauldronSnapshots.length > 0
                ? Math.round(cauldronSnapshots.reduce((sum, c) => sum + (c.level || 0), 0) / cauldronSnapshots.length)
                : 0,
              cauldrons: cauldronSnapshots
            })
          }
        })
        console.log('✅ Loaded', h.length, 'history snapshots with cauldron data')
      })
      .catch(err => {
        console.error('❌ Error loading initial data from backend:', err)
        console.error('❌ Backend is not available. Please start the backend server.')
      })

    const sock = initSocket()
    return ()=> sock.close()
  }, [])
}
