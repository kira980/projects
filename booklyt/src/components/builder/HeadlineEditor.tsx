'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

interface Props {
  value: string          // plain text fallback
  htmlValue?: string     // rich HTML if set
  onChange: (plain: string, html: string) => void
  placeholder?: string
  className?: string
}

const PRESET_COLORS = [
  '#ffffff', '#f5f5f7', '#000000', '#374151',
  '#7c3aed', '#c9a227', '#b76e79', '#2563eb',
  '#16a34a', '#e11d48', '#ea580c', '#0891b2',
]

export function HeadlineEditor({ value, htmlValue, onChange, placeholder = 'Enter headline…', className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [toolbar, setToolbar] = useState<{ x: number; y: number } | null>(null)
  const suppressSync = useRef(false)

  // Initialise content once
  useEffect(() => {
    if (!ref.current) return
    if (htmlValue) {
      ref.current.innerHTML = htmlValue
    } else if (value && ref.current.innerHTML !== value) {
      ref.current.innerText = value
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally only on mount

  const handleInput = useCallback(() => {
    if (!ref.current || suppressSync.current) return
    const html  = ref.current.innerHTML
    const plain = ref.current.innerText
    onChange(plain, html)
  }, [onChange])

  const handleSelect = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !ref.current?.contains(sel.anchorNode)) {
      setToolbar(null)
      return
    }
    const range = sel.getRangeAt(0)
    const rect  = range.getBoundingClientRect()
    const parent = ref.current.getBoundingClientRect()
    setToolbar({
      x: rect.left - parent.left + rect.width / 2,
      y: rect.top  - parent.top  - 8,
    })
  }, [])

  const applyColor = useCallback((color: string) => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    suppressSync.current = true
    document.execCommand('foreColor', false, color)
    suppressSync.current = false
    setToolbar(null)
    if (ref.current) {
      onChange(ref.current.innerText, ref.current.innerHTML)
    }
  }, [onChange])

  const clearColor = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    suppressSync.current = true
    document.execCommand('removeFormat', false)
    suppressSync.current = false
    setToolbar(null)
    if (ref.current) {
      onChange(ref.current.innerText, ref.current.innerHTML)
    }
  }, [onChange])

  return (
    <div className="relative">
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onMouseUp={handleSelect}
        onKeyUp={handleSelect}
        onBlur={() => setTimeout(() => setToolbar(null), 150)}
        data-placeholder={placeholder}
        className={`min-h-[56px] outline-none text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-600 ${className}`}
        style={{ fontFamily: 'inherit' }}
      />

      {/* Floating color toolbar */}
      {toolbar && (
        <div
          className="absolute z-50 flex items-center gap-1 p-1.5 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl"
          style={{
            left: toolbar.x,
            top: toolbar.y,
            transform: 'translate(-50%, -100%)',
          }}
          onMouseDown={e => e.preventDefault()} // keep selection alive
        >
          {PRESET_COLORS.map(color => (
            <button
              key={color}
              title={color}
              onClick={() => applyColor(color)}
              className="w-5 h-5 rounded-full border-2 border-transparent hover:border-white transition-all hover:scale-110 shrink-0"
              style={{ background: color }}
            />
          ))}
          <div className="w-px h-4 bg-zinc-700 mx-0.5" />
          <button
            onClick={clearColor}
            title="Remove color"
            className="text-[10px] text-zinc-400 hover:text-white px-1.5 py-0.5 rounded-md hover:bg-zinc-700"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
