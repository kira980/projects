import { NextResponse } from 'next/server'
import { BOOKLYT } from '@/lib/booklyt'

/**
 * Android App Links verification file.
 * Set ANDROID_CERT_SHA256_FINGERPRINTS to a comma-separated list of the
 * SHA-256 fingerprints of your release (and optionally debug) signing certs.
 */
export function GET() {
  const fingerprints = (process.env.ANDROID_CERT_SHA256_FINGERPRINTS ?? '')
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean)

  const body = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: BOOKLYT.bundleId,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ]

  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  })
}
