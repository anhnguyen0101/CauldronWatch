import React, { useEffect, useRef, useState } from 'react'
import bgDark from '../assets/potion_network_bg_dark.png'
import bgLight from '../assets/potion_network_bg_light.png'

// Mock data
const sampleCauldrons = [
  { id: 'A', name: 'Cauldron A', x: 160, y: 100, level: 72, status: 'filling' },
  { id: 'B', name: 'Cauldron B', x: 180, y: 240, level: 61, status: 'filling' },
  { id: 'D', name: 'Cauldron D', x: 120, y: 360, level: 40, status: 'normal' },
  { id: 'C', name: 'Cauldron C', x: 480, y: 160, level: 95, status: 'overfill' },
  { id: 'E', name: 'Cauldron E', x: 420, y: 300, level: 31, status: 'normal' }
]

const sampleLinks = [
  { from: 'A', to: 'B' },
  { from: 'B', to: 'D' },
  { from: 'A', to: 'C' },
  { from: 'C', to: 'E' }
]

const statusColor = {
  filling: '#3b82f6',
  draining: '#f97316',
  overfill: '#ef4444',
  normal: '#10b981'
}

export default function PotionNetwork({ cauldrons = sampleCauldrons, links = sampleLinks }){
  const ref = useRef(null)
  const [isDark, setIsDark] = useState(false)
  const [hover, setHover] = useState(null)

  useEffect(()=>{
    const update = ()=> setIsDark(document.documentElement.classList.contains('dark'))
    update()
    const mo = new MutationObserver(update)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return ()=> mo.disconnect()
  }, [])

  // viewBox logical size
  const VBW = 600
  const VBH = 420
  const radius = 36
  const ring = 8
  const circ = 2 * Math.PI * radius

  const nodeById = id => cauldrons.find(c => c.id === id)

  // generate a smooth quadratic path between two points
  const pathFor = (a,b) => {
    const mx = (a.x + b.x)/2
    const my = (a.y + b.y)/2
    const dx = b.x - a.x
    const dy = b.y - a.y
    const cx = mx - dy * 0.12
    const cy = my + dx * 0.08
    return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`
  }

  // tooltip position mapping from svg coords to container pixels
  const toClient = (sx, sy) => {
    const el = ref.current
    if(!el) return {left: sx, top: sy}
    const rect = el.getBoundingClientRect()
    const left = rect.left + (sx / VBW) * rect.width
    const top = rect.top + (sy / VBH) * rect.height
    return { left, top }
  }

  return (
    <div className="card">
      <h3 className="panel-title mb-3">Potion Network</h3>

      <div className="rounded-xl overflow-visible border border-border" style={{height: 420}}>
        <div ref={ref} style={{width: '100%', height: '100%', position: 'relative'}}>
          <svg viewBox={`0 0 ${VBW} ${VBH}`} preserveAspectRatio="xMidYMid slice" className="w-full h-full">
            <defs>
              {/* background images */}
              <pattern id="bgDark" patternUnits="objectBoundingBox" width="1" height="1">
                <image href={bgDark} x="0" y="0" width={VBW} height={VBH} preserveAspectRatio="xMidYMid slice" opacity="0.92" />
              </pattern>
              <pattern id="bgLight" patternUnits="objectBoundingBox" width="1" height="1">
                <image href={bgLight} x="0" y="0" width={VBW} height={VBH} preserveAspectRatio="xMidYMid slice" opacity="0.98" />
              </pattern>

              {/* glowing line gradient */}
              <linearGradient id="lineGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#7dd3fc" stopOpacity="1" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="1" />
              </linearGradient>

              {/* animated glow filter */}
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* background image selection */}
            <rect x="0" y="0" width={VBW} height={VBH} fill={isDark ? 'url(#bgDark)' : 'url(#bgLight)'} />

            {/* subtle overlay to dim in dark mode */}
            {isDark && <rect x="0" y="0" width={VBW} height={VBH} fill="#000" opacity="0.25" />}

            {/* energy links (paths) */}
            <g stroke="url(#lineGlow)" strokeWidth={3} fill="none" style={{filter: 'url(#glow)'}}>
              {links.map((l, i) => {
                const a = nodeById(l.from)
                const b = nodeById(l.to)
                if(!a || !b) return null
                const d = pathFor(a,b)
                const id = `link-${i}`
                return (
                  <g key={id}>
                    <path id={id} d={d} strokeOpacity={0.9} strokeLinecap="round" strokeLinejoin="round" />
                    {/* moving spark using animateMotion */}
                    <circle r={3} fill="#7dd3fc" opacity={0.9}>
                      <animateMotion dur="4s" repeatCount="indefinite">
                        <mpath href={`#${id}`} />
                      </animateMotion>
                    </circle>
                  </g>
                )
              })}
            </g>

            {/* nodes */}
            {cauldrons.map(c => {
              const pct = Math.max(0, Math.min(100, Number(c.level) || 0))
              const filled = (pct/100) * circ
              const dash = `${filled} ${circ}`
              const color = statusColor[c.status] || statusColor.normal
              const overfillGlow = c.status === 'overfill'
              return (
                <g key={c.id} transform={`translate(${c.x}, ${c.y})`}>
                  {/* glow for overfill */}
                  {overfillGlow && <circle r={radius+18} fill={color} opacity={0.12} />}

                  {/* ring (fill arc) rotated so it starts at top */}
                  <g transform="rotate(-90)">
                    <circle r={radius} cx={0} cy={0} fill="none" stroke="#263238" strokeWidth={ring} />
                    <circle r={radius} cx={0} cy={0} fill="none" stroke={color} strokeWidth={ring} strokeDasharray={dash} strokeLinecap="round" style={{transition: 'stroke-dasharray 900ms ease'}} />
                  </g>

                  {/* inner glass disk */}
                  <defs>
                    <radialGradient id={`glass-${c.id}`} cx="30%" cy="30%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
                      <stop offset="60%" stopColor={isDark ? '#071426' : '#e6f7fb'} stopOpacity="0.18" />
                      <stop offset="100%" stopColor={isDark ? '#021019' : '#dbeffc'} stopOpacity="0.08" />
                    </radialGradient>
                  </defs>
                  <circle r={radius-10} fill={`url(#glass-${c.id})`} stroke="rgba(0,0,0,0.06)" />

                  {/* liquid wave (simple semi-circle) */}
                  <path d={`M ${-radius+8} 8 A ${radius-8} ${radius-8} 0 0 0 ${radius-8} 8 L ${radius-8} ${radius+6} L ${-radius+8} ${radius+6} Z`} fill={isDark ? '#0ea5b1' : '#38bdf8'} opacity={0.14} transform={`translate(0, ${10 - (pct/100)*(radius*1.2)})`} />

                  {/* percentage text */}
                  <text x={0} y={-2} textAnchor="middle" fontSize={18} fontWeight={700} fill={isDark ? '#e6f0f6' : '#06202a'}>{pct}%</text>

                  {/* label */}
                  <text x={radius + 12} y={6} textAnchor="start" fontSize={13} fill={isDark ? '#93a4b2' : '#374151'}>{c.name}</text>

                  {/* hover area */}
                  <circle r={radius+8} fill="transparent" onMouseEnter={(e)=>{
                    const pos = toClient(c.x, c.y)
                    setHover({ text: `${c.name} – ${pct}% full – ${c.status}`, left: pos.left, top: pos.top })
                  }} onMouseLeave={()=> setHover(null)} />
                </g>
              )
            })}

          </svg>

          {/* tooltip */}
          {hover && (
            <div style={{position: 'fixed', left: hover.left + 12, top: hover.top + 12, pointerEvents: 'none'}} className={`text-xs p-2 rounded-md shadow-lg ${isDark ? 'bg-neutral-800 text-white' : 'bg-white text-black'}`}>
              {hover.text}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
