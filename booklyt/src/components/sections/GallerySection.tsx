'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Eye, EyeOff, ImageIcon, Loader2 } from 'lucide-react'
import { InlineEditable } from '@/components/builder/InlineEditable'
import { compressImage } from '@/lib/builder/compress-image'
import type { BrandConfig, ContentConfig, SectionVariant } from '@/types/builder'

interface Props {
  brand: BrandConfig
  content: ContentConfig
  variant?: SectionVariant
  language?: 'en' | 'ar'
  onContentChange?: (updates: Partial<ContentConfig>) => void
}

const SLOT_COUNT = 6

export function GallerySection({ brand, content, language = 'en', onContentChange }: Props) {
  const arabic = language === 'ar'
  const [uploading, setUploading] = useState<number | null>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const inputsRef = useRef<Array<HTMLInputElement | null>>([])
  const editable = !!onContentChange
  const images = content.galleryImages ?? []
  const hidden = content.galleryHidden ?? []

  const updateImage = (index: number, url: string) => {
    const next = [...images]
    next[index] = url
    const nextHidden = [...hidden]
    nextHidden[index] = false
    onContentChange?.({ galleryImages: next, galleryHidden: nextHidden })
  }

  const toggleHidden = (index: number) => {
    const nextHidden = [...hidden]
    nextHidden[index] = !nextHidden[index]
    onContentChange?.({ galleryHidden: nextHidden })
  }

  const uploadImage = async (index: number, file: File | undefined) => {
    if (!file || !onContentChange) return
    setUploading(index)

    try {
      const { file: compressed } = await compressImage(file)
      const urlRes = await fetch('/api/builder/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: compressed.name,
          contentType: compressed.type,
          size: compressed.size,
        }),
      })
      const urlJson = await urlRes.json()
      if (!urlRes.ok) throw new Error(urlJson.error ?? (arabic ? 'تعذر الحصول على رابط الرفع' : 'Could not get upload URL'))

      const uploadRes = await fetch(urlJson.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': compressed.type },
        body: compressed,
      })
      if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status})`)

      updateImage(index, urlJson.publicUrl)
    } catch (error) {
      alert(error instanceof Error ? error.message : (arabic ? 'فشل الرفع' : 'Upload failed'))
    } finally {
      setUploading(null)
    }
  }

  const slots = editable
    ? Array.from({ length: Math.max(SLOT_COUNT, images.length) }, (_, index) => ({
        src: images[index],
        hidden: !!hidden[index],
      }))
    : images
        .map((src, index) => ({ src, hidden: !!hidden[index] }))
        .filter(item => item.src && !item.hidden)

  // Arrow state follows the real scroll position, so it stays correct when the
  // viewer swipes the track directly instead of using the buttons.
  const syncArrows = () => {
    const track = trackRef.current
    if (!track) return
    // RTL tracks report negative scrollLeft in most engines; compare on distance.
    const max = track.scrollWidth - track.clientWidth
    const offset = Math.abs(track.scrollLeft)
    setAtStart(offset < 8)
    setAtEnd(offset >= max - 8)
  }

  useEffect(() => {
    syncArrows()
    const track = trackRef.current
    if (!track) return
    const observer = new ResizeObserver(syncArrows)
    observer.observe(track)
    return () => observer.disconnect()
  }, [slots.length])

  const scrollByCard = (direction: -1 | 1) => {
    const track = trackRef.current
    if (!track) return
    const card = track.firstElementChild as HTMLElement | null
    const step = card ? card.offsetWidth + 16 : track.clientWidth * 0.8
    track.scrollBy({ left: (arabic ? -direction : direction) * step, behavior: 'smooth' })
  }

  if (!editable && slots.length === 0) return null

  return (
    <section className="site-gallery" style={{ background: 'var(--tenant-background)' }}>
      <div className="site-section-inner">
        <div className="tenant-section-heading site-gallery-heading">
          <div>
            <p className="tenant-eyebrow">
              <InlineEditable
                value={content.galleryEyebrow ?? (arabic ? 'المعرض' : 'Gallery')}
                onChange={onContentChange ? value => onContentChange({ galleryEyebrow: value }) : undefined}
              />
            </p>
            <h2 style={{ fontFamily: `'${brand.font}', serif` }}>
              <InlineEditable
                value={content.galleryHeading ?? (arabic ? 'من أعمالنا' : 'Our Work')}
                onChange={onContentChange ? value => onContentChange({ galleryHeading: value }) : undefined}
              />
            </h2>
          </div>
          {slots.length > 1 && (
            <div className="site-gallery-arrows">
              <button
                type="button"
                onClick={() => scrollByCard(-1)}
                disabled={atStart}
                aria-label={arabic ? 'السابق' : 'Previous'}
              >
                {arabic ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
              <button
                type="button"
                onClick={() => scrollByCard(1)}
                disabled={atEnd}
                aria-label={arabic ? 'التالي' : 'Next'}
              >
                {arabic ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
              </button>
            </div>
          )}
        </div>

        <div className="site-gallery-track" ref={trackRef} onScroll={syncArrows}>
          {slots.map((item, i) => (
            <div
              key={i}
              className={`site-gallery-card ${editable ? 'is-editable' : ''}`}
              onClick={() => editable && inputsRef.current[i]?.click()}
            >
              {editable && (
                <input
                  ref={node => {
                    inputsRef.current[i] = node
                  }}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={event => uploadImage(i, event.target.files?.[0])}
                />
              )}

              {item.hidden ? (
                <div className="site-gallery-empty">
                  <EyeOff size={26} />
                  <span>{arabic ? 'صورة مخفية' : 'Hidden photo'}</span>
                </div>
              ) : item.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.src} alt={`${content.galleryHeading ?? 'Gallery'} ${i + 1}`} loading="lazy" />
              ) : (
                <div className="site-gallery-empty">
                  {uploading === i ? <Loader2 size={28} className="animate-spin" /> : <ImageIcon size={28} />}
                  {editable && <span>{arabic ? 'اضغط للرفع' : 'Click to upload'}</span>}
                </div>
              )}

              {editable && (
                <div className="site-gallery-actions">
                  <span>{item.src ? (arabic ? 'استبدال' : 'Replace') : (arabic ? 'رفع' : 'Upload')}</span>
                  {(item.src || item.hidden) && (
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation()
                        toggleHidden(i)
                      }}
                      aria-label={item.hidden ? (arabic ? 'إظهار' : 'Show') : (arabic ? 'إخفاء' : 'Hide')}
                    >
                      {item.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
