import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { saveDraft, publishConfig, getTenantConfig, getDefaultConfig } from '@/lib/supabase/tenant-config'
import { getBuilderWebsiteData } from '@/lib/builder/website-data'
import type { Business } from '@/types/database'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: business } = await supabase
    .from('businesses')
    .select('id, slug, language')
    .eq('owner_id', user.id)
    .single() as { data: Pick<Business, 'id' | 'slug' | 'language'> | null; error: unknown }

  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  try {
    const [config, previewData] = await Promise.all([
      getTenantConfig(business.id),
      getBuilderWebsiteData(supabase, business.id),
    ])
    return NextResponse.json({
      ...(config ?? getDefaultConfig(business.id)),
      business_language: business.language,
      preview_data: previewData,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Could not load your website data. Please try again.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: business } = await supabase
    .from('businesses')
    .select('id, slug, language')
    .eq('owner_id', user.id)
    .single() as { data: Pick<Business, 'id' | 'slug' | 'language'> | null; error: unknown }

  if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  const body = await request.json()
  const { action, brand, layout, content, meta } = body

  try {
    if (action === 'save_draft') {
      await saveDraft(business.id, {
        brand,
        layout,
        content,
        meta,
        savedAt: new Date().toISOString(),
      })
      return NextResponse.json({ success: true, message: 'Draft saved' })
    }

    if (action === 'publish') {
      const published = await publishConfig(business.id)
      revalidatePath(`/book/${business.slug}`)
      return NextResponse.json({ success: true, message: 'Published', published })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    // Never String(err) here: Supabase errors are plain objects, not Error
    // instances, and stringify to "[object Object]".
    const message =
      err instanceof Error ? err.message
        : typeof err === 'string' ? err
          : JSON.stringify(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
