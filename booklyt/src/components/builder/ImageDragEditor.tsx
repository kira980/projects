'use client'

import { useRef, useCallback, useEffect, useState } from 'react'

interface Props {
  src: string
  positionX: number  // 0–100
  positionY: number  // 0–100
  zoom: number       // 100–200
  onChange: (x: number, y: number, zoom: number) => void
  aspectRatio?: number  // width/height, default 16/9
  className?: string
}

const CORNER_HANDLES = [
  { key: 'tl', top: 0,    left: 0,    right: 'auto',  bottom: 'auto',  cursor: 'nw-resize', signX:  1, signY:  1, borderClass: 'border-t-2 border-l-2 rounded-tl' },
  { key: 'tr', top: 0,    right: 0,   left: 'auto',   bottom: 'auto',  cursor: 'ne-resize', signX: -1, signY:  1, borderClass: 'border-t-2 border-r-2 rounded-tr' },
  { key: 'bl', bottom: 0, left: 0,    right: 'auto',  top: 'auto',     cursor: 'sw-resize', signX:  1, signY: -1, borderClass: 'border-b-2 border-l-2 rounded-bl' },
  { key: 'br', bottom: 0, right: 0,   left: 'auto',   top: 'auto',     cursor: 'se-resize', signX: -1, signY: -1, borderClass: 'border-b-2 border-r-2 rounded-br' },
]

export function ImageDragEditor({
  src, positionX, positionY, zoom, onChange, aspectRatio = 16 / 9, className = '',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'pan' | 'corner' | null>(null)

  // All drag state lives in a ref so handlers don't stale-close over it
  const drag = useRef({
    startX: 0, startY: 0,
    startPosX: 0, startPosY: 0, startZoom: 0,
    cornerSignX: 1, cornerSignY: 1,
  })

  // Keep a ref to current props so effect callbacks don't need them as deps
  const latest = useRef({ positionX, positionY, zoom })
  latest.current = { positionX, positionY, zoom }

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

  const getClient = (e: MouseEvent | TouchEvent) => {
    if ('touches' in e) return { cx: e.touches[0]?.clientX ?? 0, cy: e.touches[0]?.clientY ?? 0 }
    return { cx: e.clientX, cy: e.clientY }
  }

  // ── Start pan ───────────────────────────────────────────────────────────────
  const onPanStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const cx = 'touches' in e ? e.touches[0].clientX : e.clientX
    const cy = 'touches' in e ? e.touches[0].clientY : e.clientY
    drag.current = {
      ...drag.current,
      startX: cx, startY: cy,
      startPosX: latest.current.positionX,
      startPosY: latest.current.positionY,
      startZoom: latest.current.zoom,
    }
    setMode('pan')
  }, [])

  // ── Start corner zoom ───────────────────────────────────────────────────────
  const onCornerStart = useCallback((e: React.MouseEvent, signX: number, signY: number) => {
    e.preventDefault()
    e.stopPropagation()
    drag.current = {
      startX: e.clientX, startY: e.clientY,
      startPosX: latest.current.positionX,
      startPosY: latest.current.positionY,
      startZoom: latest.current.zoom,
      cornerSignX: signX, cornerSignY: signY,
    }
    setMode('corner')
  }, [])

  // ── Global move / end ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mode) return
    const rect = containerRef.current?.getBoundingClientRect()

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!rect) return
      const { cx, cy } = getClient(e)
      const dx = cx - drag.current.startX
      const dy = cy - drag.current.startY

      if (mode === 'pan') {
        // Dragging right → focal point moves left (posX decreases) — image "follows" grab
        const newX = clamp(drag.current.startPosX - (dx / rect.width) * 100, 0, 100)
        const newY = clamp(drag.current.startPosY - (dy / rect.height) * 100, 0, 100)
        onChange(Math.round(newX), Math.round(newY), latest.current.zoom)
      } else {
        // Corner: diagonal movement inward = zoom in
        const diagonal = (dx * drag.current.cornerSignX + dy * drag.current.cornerSignY) / 2
        const newZoom = clamp(Math.round(drag.current.startZoom + diagonal * 0.4), 100, 200)
        onChange(latest.current.positionX, latest.current.positionY, newZoom)
      }
    }

    const onEnd = () => setMode(null)

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onEnd)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onEnd)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [mode, onChange])

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden select-none rounded-lg ${mode === 'pan' ? 'cursor-grabbing' : 'cursor-grab'} ${className}`}
      style={{ aspectRatio: String(aspectRatio) }}
      onMouseDown={onPanStart}
      onTouchStart={onPanStart}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Hero preview"
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={{
          objectPosition: `${positionX}% ${positionY}%`,
          transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
          transformOrigin: `${positionX}% ${positionY}%`,
        }}
      />

      {/* Grid overlay */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
        xmlns="http://www.w3.org/2000/svg"
      >
        <line x1="33.3%" y1="0" x2="33.3%" y2="100%" stroke="white" strokeWidth="0.5" />
        <line x1="66.6%" y1="0" x2="66.6%" y2="100%" stroke="white" strokeWidth="0.5" />
        <line x1="0" y1="33.3%" x2="100%" y2="33.3%" stroke="white" strokeWidth="0.5" />
        <line x1="0" y1="66.6%" x2="100%" y2="66.6%" stroke="white" strokeWidth="0.5" />
      </svg>

      {/* Center crosshair */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-5 h-5 opacity-60">
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white" />
        </div>
      </div>

      {/* Corner handles */}
      {CORNER_HANDLES.map(h => (
        <div
          key={h.key}
          className="absolute w-8 h-8 z-10"
          style={{ top: h.top, left: h.left, right: h.right, bottom: h.bottom, cursor: h.cursor }}
          onMouseDown={e => onCornerStart(e, h.signX, h.signY)}
        >
          <div
            className={`absolute w-4 h-4 border-white/80 ${h.borderClass}`}
            style={{
              top: h.top === 0 ? 4 : 'auto',
              bottom: h.bottom === 0 ? 4 : 'auto',
              left: h.left === 0 ? 4 : 'auto',
              right: h.right === 0 ? 4 : 'auto',
            }}
          />
        </div>
      ))}

      {/* Zoom badge */}
      {zoom > 100 && (
        <div className="absolute bottom-2 right-2 bg-black/50 rounded px-1.5 py-0.5 text-[10px] text-white/80 pointer-events-none">
          {zoom}%
        </div>
      )}
    </div>
  )
}
