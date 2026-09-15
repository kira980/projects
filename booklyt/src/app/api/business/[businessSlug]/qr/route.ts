import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { createServiceClient } from '@/lib/supabase/service'
import { BOOKLYT } from '@/lib/booklyt'

export const dynamic = 'force-dynamic'

/**
 * PNG QR code for a business's universal app link.
 * Public — the QR encodes only the public link already shown on the website.
 * ?download=1 → served as an attachment.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessSlug: string }> }
) {
  const { businessSlug } = await params

  const db = createServiceClient()
  const { data: biz } = await db
    .from('businesses')
    .select('business_code, name, active')
    .eq('slug', businessSlug)
    .maybeSingle()

  if (!biz || biz.active === false || !biz.business_code) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  const link = BOOKLYT.businessAppLink(biz.business_code)
  const png = await QRCode.toBuffer(link, {
    type: 'png',
    width: 512,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#18181b', light: '#ffffff' },
  })

  const headers = new Headers({
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=86400',
  })
  if (request.nextUrl.searchParams.get('download') === '1') {
    headers.set('Content-Disposition', `attachment; filename="${businessSlug}-booklyt-qr.png"`)
  }

  return new NextResponse(new Uint8Array(png), { headers })
}
