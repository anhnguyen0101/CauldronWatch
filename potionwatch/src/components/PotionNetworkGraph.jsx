import React, { useEffect, useRef, useState, useMemo } from 'react'
import bgDark from '../assets/potion_network_bg_dark.png'
import bgLight from '../assets/potion_network_bg_light.png'

// Props: data = { nodes: [{id,name,x,y,fillPercent,status,isMarket}], links: [{from,to,travel_time_minutes}] }
function PotionNetworkGraph({ data = { nodes: [], links: [] }, className = '' }){
  const { nodes: propNodes = [], links: propLinks = [] } = data
  // Debug: log incoming data shape so we can diagnose missing nodes/links (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      try {
        console.log('PotionNetworkGraph: received data', { nodes: propNodes.length, links: propLinks.length })
        if (propNodes.length > 0) {
          console.log('  sample node:', propNodes[0])
        }
        if (propLinks.length > 0) {
          console.log('  sample link:', propLinks[0])
        }
      } catch (e) {}
    }
  }, [propNodes.length, propLinks.length])
  const ref = useRef(null)
  const [dims, setDims] = useState({ width: 800, height: 600 })
  const [hover, setHover] = useState(null)
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  const bg = isDark ? bgDark : bgLight

  // responsive sizing observer
  useEffect(()=>{
    const el = ref.current
    if(!el) return
    const resize = ()=> setDims({ width: Math.max(320, el.clientWidth), height: Math.max(240, el.clientHeight) })
    resize()
    let ro
    if(window.ResizeObserver){
      ro = new ResizeObserver(resize)
      ro.observe(el)
    }
    return ()=> ro && ro.disconnect()
  }, [])

  // layout: if nodes provide lat/lng use them with proper geographic bounds, otherwise use x,y or auto-circle
  const viewW = 800
  const viewH = 600
  const margin = 50 // Margin for nodes near edges
  const centerX = viewW/2
  const centerY = viewH/2

  // Helper function - simple getter, doesn't need memoization
  const getLatLng = (node) => {
    const lat = node.latitude ?? node.lat
    const lng = node.longitude ?? node.lng
    return { lat, lng }
  }

  // Memoize nodes array to prevent unnecessary recalculations
  const nodes = useMemo(() => 
    propNodes.map((n, i) => ({
      ...n,
      _index: i
    })), [propNodes]
  )

  // Check if all nodes have precomputed x, y coordinates (fastest path)
  const allNodesHaveXY = useMemo(() => {
    return nodes.length > 0 && nodes.every(n => typeof n.x === 'number' && typeof n.y === 'number')
  }, [nodes])

  // Memoize bounds calculation - only needed as fallback if x, y not available
  const bounds = useMemo(() => {
    // If all nodes have precomputed x, y, we don't need bounds calculation
    if (allNodesHaveXY) {
      return null
    }
    
    const coords = nodes.map(n => getLatLng(n)).filter(c => c.lat != null && c.lng != null)
    
    if (coords.length === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log('PotionNetworkGraph: No nodes with coordinates found, using fallback layout')
      }
      return null
    }

    const lats = coords.map(c => c.lat)
    const lngs = coords.map(c => c.lng)

    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)
    
    const latRange = maxLat - minLat
    const lngRange = maxLng - minLng
    
    // Handle case where all points are the same (or very close) - add fixed padding
    const hasRange = latRange > 0.0001 && lngRange > 0.0001
    const padding = hasRange ? 0.1 : 0.05
    
    // Use minimum range to ensure visible area even if all points are identical
    const effectiveLatRange = latRange || 0.02 // ~2km at equator
    const effectiveLngRange = lngRange || 0.02 // ~2km at equator

    const bounds = {
      minLat: minLat - effectiveLatRange * padding,
      maxLat: maxLat + effectiveLatRange * padding,
      minLng: minLng - effectiveLngRange * padding,
      maxLng: maxLng + effectiveLngRange * padding
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`PotionNetworkGraph: Calculated bounds for ${coords.length} nodes (fallback mode):`, bounds)
    }
    return bounds
  }, [nodes, allNodesHaveXY, getLatLng])

  const hasRealCoords = bounds != null

  // Memoize coordinate conversion function
  const latLngToXY = useMemo(() => (lat, lng, bounds) => {
    if (!bounds) {
      return { x: centerX, y: centerY }
    }
    
    const latRange = bounds.maxLat - bounds.minLat
    const lngRange = bounds.maxLng - bounds.minLng
    
    // Normalize coordinates to 0-1 range
    const normalizedX = latRange > 0.001 ? (lng - bounds.minLng) / lngRange : 0.5
    const normalizedY = latRange > 0.001 ? 1 - ((lat - bounds.minLat) / latRange) : 0.5 // Flip Y axis
    
    // Scale to viewBox with margin
    const x = margin + normalizedX * (viewW - 2 * margin)
    const y = margin + normalizedY * (viewH - 2 * margin)
    
    return { x, y }
  }, [centerX, centerY, margin, viewW, viewH])

  // Memoize count and layout radius
  const count = useMemo(() => Math.max(1, nodes.length), [nodes.length])
  const layoutRadius = useMemo(() => Math.max(120, Math.min(viewW, viewH)/2 - 120), [viewW, viewH])

  // Memoize auto positions for circular layout
  const autoPositions = useMemo(() => {
    return nodes.map((c, i) => {
      const a = -Math.PI/2 + (i * (2*Math.PI / count))
      const x = centerX + layoutRadius * Math.cos(a)
      const y = centerY + layoutRadius * Math.sin(a)
      return { x, y }
    })
  }, [nodes, count, centerX, centerY, layoutRadius])

  // Memoize bounds center
  const boundsCenter = useMemo(() => {
    if (!bounds) return { x: centerX, y: centerY }
    return latLngToXY(
      (bounds.minLat + bounds.maxLat) / 2,
      (bounds.minLng + bounds.maxLng) / 2,
      bounds
    )
  }, [bounds, latLngToXY, centerX, centerY])

  // Memoize nodes without coordinates
  const nodesWithoutCoords = useMemo(() => {
    if (!hasRealCoords) return []
    return nodes.filter(n => {
      const coords = getLatLng(n)
      return coords.lat == null || coords.lng == null
    })
  }, [nodes, hasRealCoords])

  // Memoize index map for mixed-mode positioning
  const nodeIndexInMixedMap = useMemo(() => {
    const map = new Map()
    nodesWithoutCoords.forEach((n, idx) => {
      map.set(n.id, idx)
    })
    return map
  }, [nodesWithoutCoords])

  // Pre-compute all node positions - use backend precomputed coordinates (FAST!)
  const nodePositions = useMemo(() => {
    const positionMap = new Map()

    nodes.forEach((node, idx) => {
      // Priority 1: Use precomputed x, y coordinates from backend (normalized 0-1)
      // These are calculated once on the backend - fastest option!
      if(typeof node.x === 'number' && typeof node.y === 'number'){
        // Backend provides normalized coordinates (0-1), scale to viewBox
        // Apply margin to keep nodes away from edges
        positionMap.set(node.id, { 
          x: margin + node.x * (viewW - 2 * margin), 
          y: margin + node.y * (viewH - 2 * margin) 
        })
        return
      }
      
      // Priority 2: Fallback to lat/lng calculation (only if x, y not available)
      if (hasRealCoords && bounds) {
        const coords = getLatLng(node)
        if (coords.lat != null && coords.lng != null) {
          positionMap.set(node.id, latLngToXY(coords.lat, coords.lng, bounds))
          return
        }
      }
      
      // Priority 3: Fallback to circular layout
      if (!hasRealCoords) {
        // No coordinates at all - use circular layout
        positionMap.set(node.id, autoPositions[idx] || { x: centerX, y: centerY })
        return
      }
      
      // Mixed mode: hasRealCoords but this node doesn't have coordinates
      const nodeIndexInMixed = nodeIndexInMixedMap.get(node.id)
      const mixedRadius = Math.min(viewW, viewH) * 0.15
      
      if (nodeIndexInMixed != null && nodesWithoutCoords.length > 1) {
        // Space them in a circle around bounds center
        const angle = (nodeIndexInMixed / nodesWithoutCoords.length) * 2 * Math.PI - Math.PI / 2
        positionMap.set(node.id, {
          x: boundsCenter.x + mixedRadius * Math.cos(angle),
          y: boundsCenter.y + mixedRadius * Math.sin(angle)
        })
        return
      }
      
      // Single node without coords - place at bounds center
      positionMap.set(node.id, { x: boundsCenter.x, y: boundsCenter.y })
    })

    return positionMap
  }, [nodes, viewW, viewH, margin, hasRealCoords, bounds, getLatLng, latLngToXY, autoPositions, nodeIndexInMixedMap, nodesWithoutCoords, boundsCenter, centerX, centerY])

  // Optimized pos function - O(1) lookup instead of calculations
  const pos = (node) => {
    return nodePositions.get(node.id) || { x: centerX, y: centerY }
  }

  const statusColor = {
    normal: '#10b981',
    filling: '#3b82f6',
    draining: '#f97316',
    overfill: '#ef4444'
  }

  // helper for edge color intensity
  const edgeColorByTime = (t) => {
    if(t == null) return '#9ef6ff'
    // shorter time -> brighter
    const minutes = Number(t)
    // clamp
    const v = Math.max(1, Math.min(120, minutes || 1))
    const intensity = 1 - (v / 180) // 1..~0
    // interpolate between soft cyan and bright teal
    const r = Math.round(160 + (30 * intensity))
    const g = Math.round(246 + (9 * intensity))
    const b = Math.round(255 - (80 * (1-intensity)))
    return `rgb(${r},${g},${b})`
  }

  // glyph radius
  const nodeRadius = 22
  const ringWidth = 4
  const circ = 2 * Math.PI * nodeRadius

  // Memoize node lookup map for O(1) access
  const nodeById = useMemo(() => 
    new Map(nodes.map((n) => [n.id, n])), 
    [nodes]
  )

  // tooltip helpers
  const toClient = (sx, sy) => {
    const el = ref.current
    if(!el) return { left: sx, top: sy }
    const rect = el.getBoundingClientRect()
    return { left: rect.left + (sx/viewW) * rect.width, top: rect.top + (sy/viewH) * rect.height }
  }

  // smooth transitions: keep last fill values
  const lastFillRef = useRef({})
  useEffect(()=>{
    nodes.forEach(n => { lastFillRef.current[n.id] = n.fillPercent })
  }, [data])

  return (
    <div ref={ref} className={`card relative overflow-hidden rounded-2xl border border-neutral-700 ${className}`}>
      <div className="p-4">
        <h3 className="panel-title mb-3">Potion Network</h3>
      </div>

      <div className="w-full h-[520px] relative">
        <svg viewBox={`0 0 ${viewW} ${viewH}`} preserveAspectRatio="xMidYMid slice" className="w-full h-full">
          <defs>
            {/* background image */}
            <pattern id="bgPattern" patternUnits="objectBoundingBox" width="1" height="1">
              <image href={bg} x="0" y="0" width={viewW} height={viewH} preserveAspectRatio="xMidYMid slice" />
            </pattern>

            {/* glow filter */}
            <filter id="glow" x='-50%' y='-50%' width='200%' height='200%'>
              <feGaussianBlur stdDeviation='6' result='coloredBlur' />
              <feMerge>
                <feMergeNode in='coloredBlur' />
                <feMergeNode in='SourceGraphic' />
              </feMerge>
            </filter>

            {/* subtle outer glow for market */}
            <filter id="marketGlow" x='-60%' y='-60%' width='220%' height='220%'>
              <feGaussianBlur stdDeviation='10' result='blur1' />
              <feMerge>
                <feMergeNode in='blur1' />
                <feMergeNode in='SourceGraphic' />
              </feMerge>
            </filter>

            {/* animated dash for edges - we use stroke-dashoffset animation per path */}
            <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0">
              <stop offset="0%" stopColor="#7dd3fc" stopOpacity="1" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="1" />
            </linearGradient>

          </defs>

          {/* background */}
          <rect x={0} y={0} width={viewW} height={viewH} fill="url(#bgPattern)" />
          {isDark && <rect x={0} y={0} width={viewW} height={viewH} fill="#000" opacity="0.22" />}

          {/* edges (curved) */}
          <g>
            {propLinks.map((l, i) => {
              const a = nodeById.get(l.from) || nodeById.get(l.source) || nodeById.get(l.node_id)
              const b = nodeById.get(l.to) || nodeById.get(l.target) || nodeById.get(l.node_id)
              if(!a || !b) {
                // Log missing references only in development
                if (process.env.NODE_ENV === 'development') {
                  console.warn(`PotionNetworkGraph: link ${i} references missing node(s): from=${l.from} to=${l.to}`, l)
                }
                return null
              }
              // Use optimized pos function - no index needed anymore
              const pa = pos(a)
              const pb = pos(b)
              const mx = (pa.x + pb.x)/2
              const my = (pa.y + pb.y)/2
              const dx = pb.x - pa.x
              const dy = pb.y - pa.y
              const cx = mx - dy * 0.12
              const cy = my + dx * 0.08
              const d = `M ${pa.x} ${pa.y} Q ${cx} ${cy} ${pb.x} ${pb.y}`
              const time = l.travel_time_minutes != null ? Number(l.travel_time_minutes) : null
              const stroke = edgeColorByTime(time)
              const totalLen = Math.hypot(dx, dy) * 1.6 + 80
              const dash = Math.max(8, Math.min(60, totalLen / 6))

              return (
                <g key={`link-${i}`}> 
                  <path d={d} fill="none" stroke={stroke} strokeWidth={1.8} strokeOpacity={0.85} style={{filter: 'url(#glow)'}} />
                  {/* animated flow */}
                  <path d={d} fill="none" stroke={stroke} strokeWidth={1.6} strokeOpacity={0.95} strokeDasharray={`${dash} ${dash*1.6}`} strokeLinecap="round">
                    <animate attributeName="stroke-dashoffset" from="0" to="-100" dur={`${3 + (time? Math.min(60, time)/30 : 0.8)}s`} repeatCount="indefinite" />
                  </path>
                </g>
              )
            })}
          </g>

          {/* shipment links to market (if market node exists) */}
          <g>
            {(() => {
              const marketNode = nodes.find(n => n.isMarket)
              if (!marketNode) return null
              const pm = pos(marketNode)
              return nodes.filter(n => !n.isMarket).map((src, i) => {
                const pa = pos(src)
                const pb = pm
                const mx = (pa.x + pb.x)/2
                const my = (pa.y + pb.y)/2
                const dx = pb.x - pa.x
                const dy = pb.y - pa.y
                const cx = mx - dy * 0.06
                const cy = my + dx * 0.04
                const d = `M ${pa.x} ${pa.y} Q ${cx} ${cy} ${pb.x} ${pb.y}`
                // Darker, muted stroke for market routes but keep a soft glow so they remain visible on light backgrounds
                const stroke = isDark ? '#0b7185' : '#0f3a3a'
                return (
                  <g key={`mroute-${i}`}>
                    <path d={d} fill="none" stroke={stroke} strokeWidth={1.4} strokeOpacity={isDark ? 0.9 : 0.6} style={{filter: 'url(#glow)'}} />
                    {/* subtle animated hint */}
                    <path d={d} fill="none" stroke={stroke} strokeWidth={1.2} strokeOpacity={0.85} strokeDasharray={`6 12`} strokeLinecap="round">
                      <animate attributeName="stroke-dashoffset" from="0" to="-40" dur="4s" repeatCount="indefinite" />
                    </path>
                  </g>
                )
              })
            })()}
          </g>

          {/* nodes */}
          <g>
            {nodes.map((n) => {
              // Use optimized pos function - no index needed anymore
              const p = pos(n)
              const pct = Math.max(0, Math.min(100, Number(n.fillPercent) || 0))
              const color = statusColor[n.status] || statusColor.normal
              const glowColor = color
              const filled = (pct/100) * circ
              const dash = `${filled} ${circ}`

              const clientPos = toClient(p.x, p.y)

              const isMarket = !!n.isMarket

              return (
                <g key={n.id} transform={`translate(${p.x}, ${p.y})`} style={{transition: 'transform 220ms ease'}}
                   onMouseEnter={(e)=>{
                     setHover({ node: n, pos: clientPos })
                   }}
                   onMouseLeave={()=> setHover(null)}>

                  {isMarket ? (
                      <g>
                        {/* darker base with glow: lighter in dark mode, muted in light mode */}
                        <circle r={nodeRadius*1.4} fill={isDark ? '#facc15' : '#6b4b1a'} opacity={isDark ? 0.12 : 0.06} style={{filter: 'url(#marketGlow)'}} />
                        {/* accent ring to give glow but not be too bright on light backgrounds */}
                        <circle r={nodeRadius+6} fill="none" stroke="#06b6d4" strokeWidth={2} strokeOpacity={0.18} style={{filter: 'url(#glow)'}} />
                        <circle r={nodeRadius} fill={isDark ? '#ffd36b' : '#c09a2f'} stroke={isDark ? '#5a3c00' : '#35240a'} strokeWidth={1} />
                        <text x={0} y={nodeRadius*1.85} textAnchor="middle" fontSize={14} fontWeight={700} fill={isDark ? '#fff7e6' : '#071422'}>🏠 Enchanted Market</text>
                      </g>
                    ) : (
                    <g>
                      {/* aura */}
                      <circle r={nodeRadius+8} fill={glowColor} opacity={0.08} style={{filter: 'url(#glow)'}} />

                      {/* outer ring */}
                      <circle r={nodeRadius+3} fill="#071427" stroke={glowColor} strokeWidth={2} strokeOpacity={0.28} />

                      {/* progress ring - rotate -90 */}
                      <g transform="rotate(-90)">
                        <circle r={nodeRadius} cx={0} cy={0} fill="none" stroke="#1f2937" strokeWidth={ringWidth} />
                        <circle r={nodeRadius} cx={0} cy={0} fill="none" stroke={color} strokeWidth={ringWidth} strokeDasharray={dash} strokeLinecap="round" style={{transition: 'stroke-dasharray 900ms ease'}} />
                      </g>

                      {/* inner glass */}
                      <circle r={nodeRadius-6} fill={isDark ? 'rgba(6,12,18,0.9)' : 'rgba(255,255,255,0.96)'} stroke="rgba(0,0,0,0.04)" strokeWidth={0.6} />

                      {/* percentage label */}
                      <text x={0} y={2} textAnchor="middle" fontSize={12} fontWeight={700} fill={isDark ? '#e6f0f6' : '#06202a'}>{pct}%</text>

                      {/* name below */}
                      <text x={0} y={nodeRadius + 20} textAnchor="middle" fontSize={11} fill={isDark ? '#9ca3af' : '#334155'}>{n.name}</text>
                    </g>
                  )}
                </g>
              )
            })}
          </g>

        </svg>

        {/* tooltip */}
        {hover && hover.node && (
          <div style={{position: 'fixed', left: hover.pos.left + 12, top: hover.pos.top + 12, pointerEvents: 'none'}} className={`text-xs p-2 rounded-md shadow-lg ${isDark ? 'bg-neutral-800 text-white' : 'bg-white text-black'}`}>
            <div className="font-semibold">{hover.node.name}</div>
            <div className="text-neutral-400 text-[11px]">{(hover.node.fillPercent||0)}% full</div>
            <div className="text-[11px]">ID: <span className="font-mono">{hover.node.id}</span></div>
          </div>
        )}

      </div>
    </div>
  )
}

// Custom comparison function for React.memo
// Only re-render if nodes/links actually changed (by content, not just reference)
function arePropsEqual(prevProps, nextProps) {
  const prev = prevProps.data
  const next = nextProps.data
  
  // Quick reference check
  if (prev === next) return true
  
  // Check nodes length
  if (prev.nodes?.length !== next.nodes?.length) return false
  
  // Check links length
  if (prev.links?.length !== next.links?.length) return false
  
  // Check if any node levels changed (this is what updates most frequently)
  // Only compare IDs and fillPercent for performance
  const prevNodeMap = new Map(prev.nodes.map(n => [n.id, n.fillPercent]))
  const nextNodeMap = new Map(next.nodes.map(n => [n.id, n.fillPercent]))
  
  // If node count changed, re-render
  if (prevNodeMap.size !== nextNodeMap.size) return false
  
  // Check if any fillPercent values changed
  for (const [id, fillPercent] of prevNodeMap) {
    if (nextNodeMap.get(id) !== fillPercent) {
      return false // Level changed - re-render
    }
  }
  
  // If we get here, nodes and links are the same (by content)
  // Only re-render if className changed
  return prevProps.className === nextProps.className
}

export default React.memo(PotionNetworkGraph, arePropsEqual)
