import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  // 1. Verify the user is authenticated (anon key reads session from cookies)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Parse and validate the file
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
  }

  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image must be under 8 MB' }, { status: 400 })
  }

  // 3. Upload using service role — bypasses RLS, safe because we verified the user above
  const service = createServiceClient()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${user.id}/${Date.now()}.${ext}`

  const { error } = await service.storage
    .from('business-media')
    .upload(path, file, { contentType: file.type, upsert: true })

  if (error) {
    console.error('Storage upload error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: { publicUrl } } = service.storage
    .from('business-media')
    .getPublicUrl(path)

  return NextResponse.json({ url: publicUrl })
}
