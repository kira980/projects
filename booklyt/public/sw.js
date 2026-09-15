self.addEventListener('install', event => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  event.respondWith(fetch(event.request))
})

self.addEventListener('push', event => {
  let payload = {}

  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'BookFlow', body: event.data ? event.data.text() : 'You have a new update.' }
  }

  const title = payload.title || 'BookFlow'
  const options = {
    body: payload.body || 'You have a new booking update.',
    tag: payload.tag || `bookflow-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    silent: false,
    timestamp: Date.now(),
    data: {
      url: payload.url || '/',
    },
  }

  if (payload.icon) options.icon = payload.icon
  if (payload.badge || payload.icon) options.badge = payload.badge || payload.icon

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const client of clients) {
        if (client.url === url && 'focus' in client) {
          return client.focus()
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
    })
  )
})
