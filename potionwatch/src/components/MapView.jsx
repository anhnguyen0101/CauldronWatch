import React, { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import usePotionStore from '../store/usePotionStore'

export default function MapView(){
  const mapContainer = useRef(null)
  const mapRef = useRef(null)
  const cauldrons = usePotionStore(state => state.cauldrons)

  useEffect(()=>{
    if(mapRef.current) return

    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [-73.935242, 40.73061],
      zoom: 12
    })

    return ()=> mapRef.current?.remove()
  }, [])

  useEffect(()=>{
    const map = mapRef.current
    if(!map) return

    // Add or update cauldron markers
    cauldrons.forEach(c => {
      const el = document.getElementById(`cauldron-${c.id}`) || document.createElement('div')
      el.id = `cauldron-${c.id}`
      el.className = 'rounded-full border-2'
      el.style.width = '28px'
      el.style.height = '28px'
      el.style.borderColor = 'rgba(255,255,255,0.06)'
      // Use accent color visual for fill level
      el.style.background = `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.6), rgba(56,189,248,0.9) ${c.level}%, rgba(0,0,0,0.15))`

      if(!document.getElementById(el.id)){
        new maplibregl.Marker(el).setLngLat([c.lng, c.lat]).addTo(map)
      }
    })
  }, [cauldrons])

  return (
    <div className="card h-[520px]">
      <h3 className="panel-title mb-3">Potion Network</h3>
      <div className="rounded-xl overflow-hidden h-[460px] border border-border">
        <div className="w-full h-full map-beige" style={{height: '100%'}}>
          <div ref={mapContainer} className="w-full h-full" />
        </div>
      </div>
    </div>
  )
}
