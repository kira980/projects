/**
 * Compress an image file in the browser using the Canvas API.
 * Resizes to maxWidth if larger, converts to WebP at the given quality.
 * GIF and SVG are returned unchanged (they don't benefit from canvas conversion).
 */
export async function compressImage(
  file: File,
  maxWidth = 1920,
  quality = 0.82
): Promise<{ file: File; originalSize: number; compressedSize: number }> {
  const originalSize = file.size

  // Pass through formats that shouldn't be re-encoded
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return { file, originalSize, compressedSize: file.size }
  }

  const compressed = await new Promise<File>((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      // Compute output dimensions — never upscale
      let { width, height } = img
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }

      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas not supported')); return }

      // White background so transparent PNGs don't go black in JPEG
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)

      // Try WebP first (best compression), fall back to JPEG
      const outputType = 'image/webp'
      canvas.toBlob(
        blob => {
          if (!blob) { reject(new Error('Compression failed')); return }
          const baseName = file.name.replace(/\.[^.]+$/, '')
          resolve(new File([blob], `${baseName}.webp`, {
            type: outputType,
            lastModified: Date.now(),
          }))
        },
        outputType,
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not load image for compression'))
    }

    img.src = objectUrl
  })

  return { file: compressed, originalSize, compressedSize: compressed.size }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export async function createAppIconFile(
  file: File,
  size = 512,
  quality = 0.9
): Promise<File> {
  if (file.type === 'image/svg+xml') {
    return file
  }

  return new Promise<File>((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas not supported'))
        return
      }

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, size, size)

      const sourceSize = Math.min(img.width, img.height)
      const sourceX = Math.round((img.width - sourceSize) / 2)
      const sourceY = Math.round((img.height - sourceSize) / 2)
      const padding = Math.round(size * 0.08)
      const outputSize = size - padding * 2

      ctx.drawImage(
        img,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        padding,
        padding,
        outputSize,
        outputSize
      )

      canvas.toBlob(
        blob => {
          if (!blob) {
            reject(new Error('Icon generation failed'))
            return
          }
          const baseName = file.name.replace(/\.[^.]+$/, '')
          resolve(new File([blob], `${baseName}-app-icon.webp`, {
            type: 'image/webp',
            lastModified: Date.now(),
          }))
        },
        'image/webp',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not load image for app icon'))
    }

    img.src = objectUrl
  })
}
