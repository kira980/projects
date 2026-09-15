'use client'

import { KeyboardEvent, useEffect, useRef } from 'react'

interface Props {
  value: string
  onChange?: (value: string) => void
  multiline?: boolean
  className?: string
}

export function InlineEditable({ value, onChange, multiline, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const editable = !!onChange

  useEffect(() => {
    if (ref.current && ref.current.innerText !== value) {
      ref.current.innerText = value
    }
  }, [value])

  const commit = () => {
    const next = ref.current?.innerText.trim()
    if (next && next !== value) onChange?.(next)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === 'Enter' && !multiline) {
      event.preventDefault()
      ref.current?.blur()
    }
  }

  return (
    <span
      ref={ref}
      contentEditable={editable}
      suppressContentEditableWarning
      onBlur={commit}
      onKeyDown={handleKeyDown}
      onClick={editable ? event => {
        event.preventDefault()
        event.stopPropagation()
      } : undefined}
      className={`${editable ? 'cursor-text rounded outline outline-1 outline-transparent hover:outline-[var(--tenant-primary)] focus:outline-[var(--tenant-primary)] focus:bg-white/40' : ''} ${className ?? ''}`}
    >
      {value}
    </span>
  )
}
