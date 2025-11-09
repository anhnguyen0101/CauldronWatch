import React, { useEffect, useRef, useState } from 'react'
import bgDark from '../assets/potion_network_bg_dark.png'
import bgLight from '../assets/potion_network_bg_light.png'

// Props: data = { nodes: [{id,name,x,y,fillPercent,status,isMarket}], links: [{from,to,travel_time_minutes}] }
export default function PotionNetworkGraph({ data = { nodes: [], links: [] }, className = '' }){
  const { nodes: propNodes = [], links: propLinks = [] } = data
  // Debug: log incoming data shape so we can diagnose missing nodes/links
  useEffect(() => {
    try {
      // eslint-disable-next-line no-console
      console.log('PotionNetworkGraph: received data', { nodes: propNodes.length, links: propLinks.length })
      if (propNodes.length > 0) {
        // eslint-disable-next-line no-console
        console.log('  sample node:', propNodes[0])
      }
      if (propLinks.length > 0) {
        // eslint-disable-next-line no-console
        console.log('  sample link:', propLinks[0])
      }
    } catch (e) {}
  }, [data])
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

  // layout: if nodes provide x,y use them, otherwise auto-circle
  const viewW = 800
  const viewH = 600
  const centerX = viewW/2
  const centerY = viewH/2

  const nodes = propNodes.map((n, i) => ({
    ...n,
    _index: i
  }))

  const count = Math.max(1, nodes.length)
  const layoutRadius = Math.max(120, Math.min(viewW, viewH)/2 - 120)

  const autoPositions = nodes.map((c, i) => {
    const a = -Math.PI/2 + (i * (2*Math.PI / count))
    const x = centerX + layoutRadius * Math.cos(a)
    const y = centerY + layoutRadius * Math.sin(a)
    return { x, y }
  })

  const pos = (node, idx) => {
    if(typeof node.x === 'number' && typeof node.y === 'number'){
      // assume 0..1 normalized or absolute coords; if in 0..1, scale to view
      if(Math.abs(node.x) <= 1 && Math.abs(node.y) <= 1){
        return { x: node.x * viewW, y: node.y * viewH }
      }
      return { x: node.x, y: node.y }
    }
    return autoPositions[idx] || { x: centerX, y: centerY }
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

  // mapping nodes by id
  const nodeById = new Map(nodes.map((n, i) => [n.id, n]))

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
                // Log missing references once to help debugging
                // eslint-disable-next-line no-console
                console.warn(`PotionNetworkGraph: link ${i} references missing node(s): from=${l.from} to=${l.to}`, l)
                return null
              }
              const pa = pos(a, nodes.indexOf(a))
              const pb = pos(b, nodes.indexOf(b))
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
            {nodes.map((n, idx) => {
              if(!n.isMarket) return null
              return null
            })}
          </g>

          {/* nodes */}
          <g>
            {nodes.map((n, idx) => {
              const p = pos(n, idx)
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
                      <circle r={nodeRadius*1.4} fill="#facc15" opacity={0.12} style={{filter: 'url(#marketGlow)'}} />
                      <circle r={nodeRadius} fill="#ffd36b" stroke="#5a3c00" strokeWidth={1} />
                      <text x={0} y={nodeRadius*1.85} textAnchor="middle" fontSize={14} fontWeight={700} fill="#fff7e6">🏠 Enchanted Market</text>
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
