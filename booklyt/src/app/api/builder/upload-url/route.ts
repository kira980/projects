import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAdminVerifiedBusiness } from '@/lib/admin-business'
import type { StorageClient } from '@supabase/storage-js'

// Returns a short-lived signed upload URL so the browser can upload
// directly to Supabase Storage — file never passes through Next.js.
export async function POST(request: NextRequest) {
  const { filename, contentType, size, admin_slug } = await request.json() as {
    filename: string
    contentType: string
    size: number
    admin_slug?: string | null
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let ownerPath = user?.id ?? null

  if (!ownerPath && admin_slug) {
    const { business } = await getAdminVerifiedBusiness(admin_slug)
    if (business) ownerPath = `admin-${business.id}`
  }

  if (!ownerPath) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!contentType.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
  }
  if (size > 30 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image must be under 30 MB' }, { status: 400 })
  }

  const ext  = filename.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${ownerPath}/${Date.now()}.${ext}`

  // Use StorageClient directly — createSignedUploadUrl exists at runtime
  // but is absent from the Database-typed SupabaseClient storage property.
  const service = createServiceClient()
  const storage = service.storage as unknown as StorageClient

  const { data, error } = await storage
    .from('business-media')
    .createSignedUploadUrl(path)

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to create upload URL' },
      { status: 500 }
    )
  }

  const { data: { publicUrl } } = storage
    .from('business-media')
    .getPublicUrl(path)

  return NextResponse.json({
    signedUrl: data.signedUrl as string,
    token:     data.token     as string,
    path,
    publicUrl,
  })
}
