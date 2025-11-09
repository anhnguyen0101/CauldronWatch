import React, { useEffect, useRef, useState, useMemo } from 'react'
import bgDark from '../assets/potion_network_bg_dark.png'
import bgLight from '../assets/potion_network_bg_light.png'

const statusColor = {
  normal: '#10b981',
  filling: '#3b82f6',
  draining: '#f97316',
  overfill: '#ef4444'
}

function PotionNetworkSVG({ 
  cauldrons: propCauldrons = [], 
  links: propLinks = [],
  market: propMarket = null 
}){
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  const bg = isDark ? bgDark : bgLight

  const ref = useRef(null)
  const [dims, setDims] = useState({ width: 800, height: 420 })
  
  // Debug: Log if precomputed coordinates are present (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const cauldronsWithXY = propCauldrons.filter(c => typeof c.x === 'number' && typeof c.y === 'number').length
      const marketHasXY = !propMarket || (typeof propMarket.x === 'number' && typeof propMarket.y === 'number')
      if (cauldronsWithXY === propCauldrons.length && marketHasXY && propCauldrons.length > 0) {
        console.log('✅ PotionNetworkSVG: All nodes have precomputed x, y coordinates - using fast path')
      } else {
        console.warn(`⚠️  PotionNetworkSVG: Using slow path - ${cauldronsWithXY}/${propCauldrons.length} cauldrons have x, y, market: ${marketHasXY}`)
      }
    }
  }, [propCauldrons, propMarket])

  useEffect(()=>{
    const el = ref.current
    if(!el) return
    const setSize = ()=> setDims({ width: Math.max(200, el.clientWidth), height: Math.max(120, el.clientHeight) })
    setSize()
    let ro
    if(window.ResizeObserver){
      ro = new ResizeObserver(()=> setSize())
      ro.observe(el)
    }
    return ()=> ro && ro.disconnect()
  }, [])

  const viewW = 600
  const viewH = 400
  const margin = 40 // Margin for nodes near edges

  // Use provided cauldrons, links, and market (from backend)
  const cauldrons = propCauldrons || []
  const links = propLinks || []
  const market = propMarket

  // Check if all nodes have precomputed x, y coordinates (FASTEST - skip all calculations!)
  const allNodesHaveXY = useMemo(() => {
    const cauldronsHaveXY = cauldrons.every(c => typeof c.x === 'number' && typeof c.y === 'number')
    const marketHasXY = !market || (typeof market.x === 'number' && typeof market.y === 'number')
    return cauldrons.length > 0 && cauldronsHaveXY && marketHasXY
  }, [cauldrons, market])

  // Helper: Get latitude/longitude from node (supports both formats)
  const getLatLng = (node) => {
    const lat = node.latitude ?? node.lat
    const lng = node.longitude ?? node.lng
    return { lat, lng }
  }

  // Helper: Convert latitude/longitude to SVG coordinates
  const latLngToXY = useMemo(() => (lat, lng, bounds) => {
    if (!bounds || bounds.minLat === bounds.maxLat && bounds.minLng === bounds.maxLng) {
      // All points are the same or no bounds, center them
      return { x: viewW / 2, y: viewH / 2 }
    }
    
    // Normalize coordinates to 0-1 range
    const normalizedX = (lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)
    const normalizedY = 1 - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) // Flip Y axis (lat increases upward in SVG)
    
    // Scale to viewBox with margin
    const x = margin + normalizedX * (viewW - 2 * margin)
    const y = margin + normalizedY * (viewH - 2 * margin)
    
    return { x, y }
  }, [viewW, viewH, margin])

  // Calculate bounds from all nodes (cauldrons + market) - ONLY if needed (no precomputed coords)
  const bounds = useMemo(() => {
    // If all nodes have precomputed x, y, skip bounds calculation entirely!
    if (allNodesHaveXY) {
      return null
    }
    
    const allNodes = [...cauldrons]
    if (market) {
      const marketCoords = getLatLng(market)
      if (marketCoords.lat != null && marketCoords.lng != null) {
        allNodes.push({ latitude: marketCoords.lat, longitude: marketCoords.lng })
      }
    }
    
    if (allNodes.length === 0) {
      return null
    }

    const coords = allNodes.map(n => getLatLng(n)).filter(c => c.lat != null && c.lng != null)
    
    if (coords.length === 0) {
      return null
    }

    const lats = coords.map(c => c.lat)
    const lngs = coords.map(c => c.lng)

    // Add padding (10% on each side)
    const latRange = Math.max(...lats) - Math.min(...lats)
    const lngRange = Math.max(...lngs) - Math.min(...lngs)
    const padding = latRange > 0 && lngRange > 0 ? 0.1 : 0.01

    return {
      minLat: Math.min(...lats) - latRange * padding,
      maxLat: Math.max(...lats) + latRange * padding,
      minLng: Math.min(...lngs) - lngRange * padding,
      maxLng: Math.max(...lngs) + lngRange * padding
    }
  }, [allNodesHaveXY, cauldrons, market])

  const hasRealCoords = bounds != null && !allNodesHaveXY && (
    cauldrons.some(c => {
      const coords = getLatLng(c)
      return coords.lat != null && coords.lng != null
    }) || (market && (() => {
      const coords = getLatLng(market)
      return coords.lat != null && coords.lng != null
    })())
  )

  // px per view-unit (how many pixels correspond to 1 viewBox unit)
  const pxPerViewY = dims.height / viewH

  // preferred node radius in pixels (fixed smaller size so 12 cauldrons fit)
  const preferredRadiusPx = 16
  // convert preferred pixel radius into viewBox units (using vertical scale)
  // shrink nodes when there are many cauldrons
  const count = Math.max(1, cauldrons.length)
  const shrinkFactor = Math.max(0.45, Math.min(1, 6 / count))
  const radius = Math.max(3, (preferredRadiusPx * shrinkFactor) / pxPerViewY)

  const clamp = (v,min,max) => Math.max(min, Math.min(max, v))

  // Auto-generate circular layout positions (fallback when no real coordinates)
  const centerX = viewW / 2
  const centerY = viewH / 2 - (viewH * 0.04) // slight upward offset
  const layoutMargin = Math.max(32, Math.min(viewW, viewH) * 0.12)
  const layoutRadius = Math.max(60, Math.min((Math.min(viewW, viewH) / 2) - layoutMargin, (viewW / 2) - layoutMargin)) - radius * 2

  const autoPositions = useMemo(() => {
    return cauldrons.map((c, i) => {
      const a = -Math.PI / 2 + (i * (2 * Math.PI / count))
      const x = centerX + layoutRadius * Math.cos(a)
      const y = centerY + layoutRadius * Math.sin(a)
      return { x, y, angle: a }
    })
  }, [cauldrons, count, centerX, centerY, layoutRadius])

  // Pre-compute all node positions - PRIORITY: Use precomputed x, y coordinates (FASTEST!)
  const nodePositions = useMemo(() => {
    const positionMap = new Map()

    // Priority 1: Use precomputed x, y coordinates from backend (normalized 0-1)
    // These are calculated once on the backend - fastest option!
    if (allNodesHaveXY) {
      cauldrons.forEach(node => {
        if (typeof node.x === 'number' && typeof node.y === 'number') {
          // Backend provides normalized coordinates (0-1), scale to viewBox
          // Apply margin to keep nodes away from edges
          positionMap.set(node.id, {
            x: margin + node.x * (viewW - 2 * margin),
            y: margin + node.y * (viewH - 2 * margin)
          })
        }
      })
      
      // Market position
      if (market && typeof market.x === 'number' && typeof market.y === 'number') {
        positionMap.set(market.id || 'market', {
          x: margin + market.x * (viewW - 2 * margin),
          y: margin + market.y * (viewH - 2 * margin)
        })
      }
      
      return positionMap
    }

    // Priority 2: Fallback to lat/lng calculation (only if x, y not available)
    cauldrons.forEach(node => {
      // Check if this node has precomputed coordinates first
      if (typeof node.x === 'number' && typeof node.y === 'number') {
        positionMap.set(node.id, {
          x: margin + node.x * (viewW - 2 * margin),
          y: margin + node.y * (viewH - 2 * margin)
        })
        return
      }
      
      // Fallback to lat/lng
      if (hasRealCoords && bounds) {
        const coords = getLatLng(node)
        if (coords.lat != null && coords.lng != null) {
          positionMap.set(node.id, latLngToXY(coords.lat, coords.lng, bounds))
          return
        }
      }
      
      // Fallback to circular layout
      const idx = cauldrons.findIndex(x => x.id === node.id)
      if (idx >= 0 && autoPositions[idx]) {
        positionMap.set(node.id, autoPositions[idx])
      }
    })
    
    // Market position
    if (market) {
      if (typeof market.x === 'number' && typeof market.y === 'number') {
        positionMap.set(market.id || 'market', {
          x: margin + market.x * (viewW - 2 * margin),
          y: margin + market.y * (viewH - 2 * margin)
        })
      } else if (hasRealCoords && bounds) {
        const coords = getLatLng(market)
        if (coords.lat != null && coords.lng != null) {
          positionMap.set(market.id || 'market', latLngToXY(coords.lat, coords.lng, bounds))
        } else {
          positionMap.set(market.id || 'market', { x: centerX, y: centerY })
        }
      } else {
        positionMap.set(market.id || 'market', { x: centerX, y: centerY })
      }
    }

    return positionMap
  }, [allNodesHaveXY, cauldrons, market, viewW, viewH, margin, hasRealCoords, bounds, latLngToXY, autoPositions, centerX, centerY])

  // Optimized pos function - O(1) lookup from precomputed positions
  const pos = (node) => {
    return nodePositions.get(node.id) || { x: centerX, y: centerY }
  }

  // Market position - use precomputed position
  const marketPos = useMemo(() => {
    if (market) {
      return nodePositions.get(market.id || 'market') || { x: centerX, y: centerY }
    }
    return { x: centerX, y: centerY }
  }, [market, nodePositions, centerX, centerY])

  const pathFor = (a,b) => {
    const pa = pos(a)
    const pb = pos(b)
    const mx = (pa.x + pb.x)/2
    const my = (pa.y + pb.y)/2
    const dx = pb.x - pa.x
    const dy = pb.y - pa.y
    const cx = mx - dy * 0.12
    const cy = my + dx * 0.08
    return `M ${pa.x} ${pa.y} Q ${cx} ${cy} ${pb.x} ${pb.y}`
  }

  // Path to market
  const pathToMarket = (c) => {
    const pa = pos(c)
    const pb = marketPos
    // control point pulls slightly toward center to create a gentle curve
    const mx = (pa.x + pb.x)/2
    const my = (pa.y + pb.y)/2
    const dx = pb.x - pa.x
    const dy = pb.y - pa.y
    const cx = mx + dy * 0.06
    const cy = my - dx * 0.06
    return `M ${pa.x} ${pa.y} Q ${cx} ${cy} ${pb.x} ${pb.y}`
  }

  const circ = 2 * Math.PI * radius
  const scale = viewW / 100

  // helper: convert hex color like #rrggbb to rgba with alpha
  const hexToRgba = (hex, alpha=1) => {
    const h = hex.replace('#','')
    const r = parseInt(h.substring(0,2),16)
    const g = parseInt(h.substring(2,4),16)
    const b = parseInt(h.substring(4,6),16)
    return `rgba(${r},${g},${b},${alpha})`
  }

  // Helper: format travel time or distance for display on edges
  const formatEdgeLabel = (link) => {
    if (link.travel_time_minutes != null) {
      const mins = Math.round(link.travel_time_minutes)
      return `${mins}m`
    }
    if (link.distance != null) {
      const dist = link.distance.toFixed(1)
      return `${dist}km`
    }
    return ''
  }

  // Create node lookup map for efficient edge rendering
  const nodeById = new Map()
  cauldrons.forEach(c => nodeById.set(c.id, c))
  if (market) {
    nodeById.set(market.id || 'market', market)
  }

  return (
    <div ref={ref} className="w-full h-full relative overflow-hidden flex items-center justify-center rounded-2xl border border-gray-600/40">
      <svg viewBox={`0 0 ${viewW} ${viewH}`} width="100%" height="100%" className="w-full h-auto max-h-[450px]" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <linearGradient id="gradPotion" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="50%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#7dd3fc" />
          </linearGradient>

          {/* small soft overlay to help nodes pop */}
          <linearGradient id="bgOverlay" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity={isDark ? 0.12 : 0.04} />
          </linearGradient>
        </defs>

  {/* background image inside SVG so it scales with viewBox */}
  <image href={bg} x="0" y="0" width={viewW} height={viewH} preserveAspectRatio="xMidYMid slice" />
  {/* overlay rect to subtly darken the bottom */}
  <rect x="0" y="0" width={viewW} height={viewH} fill="url(#bgOverlay)" />

        {/* Network edges (from network_edges table) - supports cauldron-to-cauldron and cauldron-to-market */}
        <g strokeLinecap="round" fill="none">
          {links.map((link, i) => {
            // Support multiple field name formats: from/to, from_node/to_node
            const fromId = link.from || link.from_node
            const toId = link.to || link.to_node
            const fromNode = nodeById.get(fromId)
            const toNode = nodeById.get(toId)
            
            if (!fromNode || !toNode) return null
            
            const pa = pos(fromNode)
            const pb = pos(toNode)
            const d = pathFor(fromNode, toNode)
            const dash = 5 * scale
            const urgent = (fromNode.status && ['overfill', 'draining'].includes(fromNode.status)) || 
                          (toNode.status && ['overfill', 'draining'].includes(toNode.status))
            const bright = urgent ? '#ff9b7a' : '#9ef6ff'
            const midTransparent = 'rgba(160,240,255,0)'
            const baseWidth = 0.9 * scale

            // gradient id per link
            const gid = `linkGrad-${i}`

            return (
              <g key={`edge-${i}`}>
                <defs>
                  <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}>
                    <stop offset="0%" stopColor={bright} stopOpacity={1} />
                    <stop offset="45%" stopColor={midTransparent} stopOpacity={0} />
                    <stop offset="55%" stopColor={midTransparent} stopOpacity={0} />
                    <stop offset="100%" stopColor={bright} stopOpacity={1} />
                  </linearGradient>
                </defs>

                {/* thin base with gradient glow */}
                <path d={d} stroke={`url(#${gid})`} strokeWidth={baseWidth} style={{filter: urgent ? 'url(#glow)' : undefined}} strokeOpacity={0.95} />

                {/* animated dashed flow */}
                <path d={d} stroke={bright} strokeWidth={0.5 * scale} strokeDasharray={`${dash} ${dash*2}`} strokeLinecap="round" strokeOpacity={0.95}>
                  <animate attributeName="stroke-dashoffset" from="0" to={`${-30 * scale}`} dur={urgent ? '2.6s' : '4s'} repeatCount="indefinite" />
                </path>

                {/* Edge label (travel time or distance) */}
                {(link.travel_time_minutes != null || link.distance != null) ? (
                  <text fontSize={2.2 * scale} fill={isDark ? '#e6f0f6' : '#1e293b'} 
                        fontWeight="500" opacity={0.9}>
                    <textPath href={`#edge-path-${i}`} startOffset="50%" textAnchor="middle">
                      {formatEdgeLabel(link)}
                    </textPath>
                  </text>
                ) : null}

                {/* Invisible path for textPath */}
                <path id={`edge-path-${i}`} d={d} fill="none" stroke="transparent" strokeWidth={0} />
              </g>
            )
          })}
        </g>

        {/* Shipment links: each cauldron -> market (only show if market exists and not already in network edges) */}
        {market && (
          <g strokeLinecap="round" fill="none">
            {cauldrons.map((c, i) => {
              // Check if this cauldron-to-market edge already exists in links
              const marketId = market.id || 'market'
              const existingEdge = links.find(l => 
                (l.from === c.id || l.from_node === c.id) && 
                (l.to === marketId || l.to_node === marketId)
              )
              
              // Skip if edge already rendered in network edges
              if (existingEdge) return null
              
              const pa = pos(c)
              const pb = marketPos
              const d = pathToMarket(c)
              const gid = `shipGrad-${i}`
              const bright = '#ffd36b'
              const dash = 6 * scale
              
              return (
                <g key={`ship-${c.id}`}>
                  <defs>
                    <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}>
                      <stop offset="0%" stopColor={bright} stopOpacity={0.95} />
                      <stop offset="60%" stopColor={bright} stopOpacity={0.12} />
                      <stop offset="100%" stopColor={bright} stopOpacity={0.95} />
                    </linearGradient>
                  </defs>

                  <path id={`ship-path-${i}`} d={d} stroke={`url(#${gid})`} strokeWidth={0.9 * scale} strokeOpacity={0.65} strokeLinecap="round" strokeDasharray={`${dash} ${dash*1.8}`}>
                    <animate attributeName="stroke-dashoffset" from="0" to={`${-30 * scale}`} dur="3.6s" repeatCount="indefinite" />
                  </path>

                  {/* Note: Distance/time labels are handled by network edges above */}
                </g>
              )
            })}
          </g>
        )}
        {/* cauldron nodes */}
        {cauldrons.map((c, idx) => {
          const p = pos(c)
          const pct = Math.max(0, Math.min(100, Number(c.level) || 0))
          const color = statusColor[c.status] || statusColor.normal
          const fillLen = (pct/100) * circ
          // aura color with alpha 0.25
          const aura = hexToRgba(color, 0.25)
          
          // Label positioning: offset outward from node center
          // For precomputed coordinates or real coordinates, use a simple downward offset
          // For circular layout, offset radially outward
          let labelX, labelY
          if (allNodesHaveXY || hasRealCoords) {
            // Simple downward offset for real/precomputed coordinates
            labelX = 0
            labelY = radius + 14
          } else {
            // Radial outward offset for circular layout
            const dx = p.x - centerX
            const dy = p.y - centerY
            const dist = Math.sqrt(dx*dx + dy*dy) || 1
            const nx = dx / dist
            const ny = dy / dist
            const labelOffset = 6 // view units outward
            labelX = nx * (radius + labelOffset)
            labelY = ny * (radius + labelOffset)
          }

          return (
            <g key={c.id} transform={`translate(${p.x}, ${p.y})`}>
              {/* subtle aura */}
              <circle r={radius * 1.6} fill={aura} opacity={0.95} style={{filter: 'url(#glow)'}} />

              {/* outer ring with slow pulsing animation */}
              <g>
                <circle r={radius + 0.35} fill="#071427" stroke={isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)'} strokeWidth={0.38 * scale} />
                <circle r={radius + 0.35} fill="none" stroke={hexToRgba(color,0.9)} strokeWidth={0.8 * scale} strokeOpacity={0.9} strokeDasharray={`${Math.max(6, radius*2)} ${Math.max(8,radius*3)}`} strokeLinecap="round">
                  <animate attributeName="opacity" values="1;0.6;1" dur="3.6s" repeatCount="indefinite" />
                  <animateTransform attributeName="transform" attributeType="XML" type="scale" values="1;1.04;1" dur="3.6s" repeatCount="indefinite" />
                </circle>
              </g>

              {/* colored ring indicating level */}
              <g transform="rotate(-90)">
                <circle r={radius} fill="none" stroke={color} strokeWidth={0.85 * scale} strokeDasharray={`${fillLen} 999`} strokeLinecap="round" style={{transition: 'stroke-dasharray 0.4s ease, stroke 0.4s ease'}} />
              </g>

              {/* inner glass */}
              <circle r={Math.max(2, radius-1.2)} fill={isDark ? 'rgba(6,12,18,0.9)' : 'rgba(255,255,255,0.96)'} stroke="rgba(0,0,0,0.04)" strokeWidth={0.08 * scale} />

              {/* percentage (smaller) */}
              <text x={0} y={0.5 * scale} textAnchor="middle" fontSize={3.4 * scale} fontWeight={700} fill={isDark ? '#e6f0f6' : '#06202a'}>{pct}%</text>

              {/* name offset outward */}
              <text x={labelX} y={labelY} textAnchor="middle" fontSize={2.2 * scale} fill={isDark ? '#9ca3af' : '#334155'}>{c.name || c.id}</text>
            </g>
          )
        })}

        {/* Market node */}
        {market && (
          <g transform={`translate(${marketPos.x}, ${marketPos.y})`}>
            <circle r={radius * 1.6} fill={hexToRgba('#ffd36b', 0.18)} style={{filter: 'url(#glow)'}} />
            <circle r={radius * 1.15} fill="#ffd36b" stroke={hexToRgba('#5a3c00',0.12)} strokeWidth={0.6 * scale} />
            <circle r={radius * 0.75} fill={isDark ? '#1a1200' : '#fff7e6'} />
            <text x={0} y={radius * 1.8} textAnchor="middle" fontSize={3 * scale} fill={isDark ? '#ffe9b5' : '#6b4a00'}>
              {market.name || 'Enchanted Market'}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}

// Memoize component to prevent unnecessary re-renders
export default React.memo(PotionNetworkSVG)
