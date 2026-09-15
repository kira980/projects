'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BatteryFull, Signal, Wifi } from 'lucide-react'

interface Props {
  children: React.ReactNode
  mode: 'desktop' | 'mobile'
}

export function PreviewViewport({ children, mode }: Props) {
  const iframe = useRef<HTMLIFrameElement>(null)
  const [mount, setMount] = useState<HTMLElement | null>(null)
  const stage = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const container = stage.current
    if (!container || mode !== 'mobile') return
    const resize = () => {
      const availableHeight = Math.max(360, window.innerHeight - container.getBoundingClientRect().top - 28)
      setScale(Math.min(1, Math.max(1, container.clientWidth - 12) / 414, availableHeight / 868))
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    window.addEventListener('resize', resize)
    return () => { observer.disconnect(); window.removeEventListener('resize', resize) }
  }, [mode])

  useEffect(() => {
    const frame = iframe.current
    const doc = frame?.contentDocument
    if (!doc) return
    doc.documentElement.lang = document.documentElement.lang
    doc.documentElement.className = document.documentElement.className
    doc.body.className = document.body.className
    doc.body.style.margin = '0'
    const base = doc.createElement('base')
    base.href = document.baseURI
    doc.head.appendChild(base)
    const host = doc.createElement('div')
    doc.body.appendChild(host)
    const syncStyles = () => {
      doc.head.querySelectorAll('[data-preview-style]').forEach(node => node.remove())
      document.head.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
        const copy = node.cloneNode(true) as HTMLElement
        copy.setAttribute('data-preview-style', '')
        doc.head.appendChild(copy)
      })
    }
    syncStyles()
    const observer = new MutationObserver(syncStyles)
    observer.observe(document.head, { childList: true, subtree: true, characterData: true })
    const handleLink = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const anchor = target.closest?.('a')
      if (!anchor) return
      event.preventDefault()
      const href = anchor.getAttribute('href')
      if (href?.startsWith('#')) doc.getElementById(href.slice(1))?.scrollIntoView({ behavior: 'smooth' })
    }
    doc.addEventListener('click', handleLink)
    setMount(host)
    return () => {
      observer.disconnect()
      doc.removeEventListener('click', handleLink)
      host.remove()
      base.remove()
    }
  }, [])

  return (
    <div ref={stage} className="builder-preview-stage">
      <div className="builder-device-space" style={mode === 'mobile' ? { width: 414 * scale, height: 868 * scale } : undefined}>
        <div className={`builder-viewport builder-viewport-${mode}`} style={mode === 'mobile' ? { transform: `scale(${scale})` } : undefined}>
          {mode === 'mobile' ? <>
            <div className="builder-phone-status" aria-hidden="true"><strong>9:41</strong><span className="builder-phone-island" /><span className="builder-phone-indicators"><Signal size={16} /><Wifi size={16} /><BatteryFull size={22} /></span></div>
          </> : <div className="builder-viewport-bar"><span /><span /><span /><p>Desktop website</p></div>}
          <iframe ref={iframe} title={`${mode === 'mobile' ? 'iPhone' : 'Desktop'} website preview`} className="builder-preview-frame" />
          {mode === 'mobile' && <div className="builder-phone-home" aria-hidden="true"><span /></div>}
        </div>
      </div>
      {mount && createPortal(children, mount)}
    </div>
  )
}
