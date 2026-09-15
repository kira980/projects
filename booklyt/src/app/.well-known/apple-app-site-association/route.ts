import { NextResponse } from 'next/server'
import { BOOKLYT } from '@/lib/booklyt'

/**
 * iOS Universal Links association file (must be served without extension,
 * Content-Type application/json). Requires APPLE_TEAM_ID.
 */
export function GET() {
  const teamId = process.env.APPLE_TEAM_ID ?? 'TEAMID'
  const appId = `${teamId}.${BOOKLYT.bundleId}`

  const body = {
    applinks: {
      apps: [],
      details: [
        {
          appIDs: [appId],
          appID: appId,
          components: [
            { '/': '/app/*', comment: 'Booklyt customer app + business mini-apps' },
            { '/': '/book/*', comment: 'Business booking pages' },
          ],
          paths: ['/app/*', '/book/*'],
        },
      ],
    },
    webcredentials: { apps: [appId] },
  }

  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  })
}
