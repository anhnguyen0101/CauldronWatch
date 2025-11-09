import React, { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import usePotionStore from '../store/usePotionStore'

// small helpers
const levelColor = (lvl) => {
  if(lvl >= 85) return '#ef4444' // red-500
  if(lvl >= 60) return '#f97316' // orange-500
  if(lvl >= 40) return '#f59e0b' // amber-500
  if(lvl >= 20) return '#06b6d4' // cyan-500
  return '#10b981' // green-500 for very low
}

export default function MapView(){
  const mapContainer = useRef(null)
  const mapRef = useRef(null)
  const markerMapRef = useRef(new Map())
  const cauldrons = usePotionStore(state => state.cauldrons)

  useEffect(()=>{
    if(mapRef.current) return

    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://demotiles.maplibre.org/style.json',
      // center on first cauldron if available
      center: cauldrons && cauldrons.length ? [cauldrons[0].lng, cauldrons[0].lat] : [-73.935242, 40.73061],
      zoom: 12
    })

    return ()=> mapRef.current?.remove()
  }, [])

  // update markers when cauldrons or their levels change
  useEffect(()=>{
    const map = mapRef.current
    if(!map) return

    const existing = markerMapRef.current

    // remove markers for removed cauldrons
    Array.from(existing.keys()).forEach(key => {
      if(!cauldrons.find(c => `cauldron-${c.id}` === key)){
        const m = existing.get(key)
        m.marker.remove()
        existing.delete(key)
      }
    })

    cauldrons.forEach(c => {
      const id = `cauldron-${c.id}`
      let entry = existing.get(id)

      const color = levelColor(c.level ?? 0)
      const bg = `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.6), ${color} 70%, rgba(0,0,0,0.15))`

      if(!entry){
        const el = document.createElement('div')
        el.id = id
        el.className = 'rounded-full border-2'
        el.style.width = '28px'
        el.style.height = '28px'
        el.style.borderColor = 'rgba(255,255,255,0.06)'
        el.style.background = bg
        el.style.transition = 'background 600ms ease, transform 220ms ease'

        // popup
        const popup = new maplibregl.Popup({ offset: 12, closeButton: false })
        const setPopupHTML = () => {
          popup.setHTML(`<div class="text-sm font-semibold">${c.name}</div><div class="text-xs text-neutral-300">${c.level}%</div>`)
        }
        setPopupHTML()

        // interactions
        el.addEventListener('mouseenter', () => popup.setLngLat([c.lng, c.lat]).addTo(map))
        el.addEventListener('mouseleave', () => popup.remove())
        el.addEventListener('click', () => {
          setPopupHTML()
          popup.setLngLat([c.lng, c.lat]).addTo(map)
        })

        const marker = new maplibregl.Marker(el).setLngLat([c.lng, c.lat]).addTo(map)
        existing.set(id, { marker, el, lastLevel: c.level })
      } else {
        // update marker position and style
        entry.marker.setLngLat([c.lng, c.lat])
        // animate when level changed
        if(entry.lastLevel !== c.level){
          // update background color smoothly
          entry.el.style.background = bg
          // quick scale pulse
          try{ entry.el.animate([{ transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 420 }) }catch(e){}
          entry.lastLevel = c.level
        }
      }
    })
  }, [cauldrons])

  return (
    <div className="card">
      <h3 className="panel-title mb-3">Potion Network</h3>
      <div className="rounded-xl overflow-hidden border border-border">
        <div className="w-full h-[400px] bg-neutral-900/40 dark:bg-neutral-800 map-beige" style={{height: 400}}>
          <div ref={mapContainer} className="w-full h-full" />
        </div>
      </div>
    </div>
  )
}
