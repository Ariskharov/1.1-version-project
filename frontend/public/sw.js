/* TimeTrack service worker — push + open cabinet */
/* eslint-disable no-restricted-globals */

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {
    title: 'TimeTrack',
    body: 'Новое объявление',
    url: '/cabinet',
    tag: 'announcement',
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (_) {
    try {
      data.body = event.data ? event.data.text() : data.body;
    } catch (__) {
      /* ignore */
    }
  }

  const options = {
    body: data.body || '',
    tag: data.tag || 'announcement',
    renotify: true,
    requireInteraction: data.type === 'urgent',
    data: { url: data.url || '/cabinet', announcementId: data.announcementId || null },
    vibrate: data.type === 'urgent' ? [120, 60, 120] : [80],
    badge: '/icons/icon-192.png',
    icon: '/icons/icon-192.png',
  };

  event.waitUntil(self.registration.showNotification(data.title || 'TimeTrack', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/cabinet';
  const absolute = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.navigate(absolute);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(absolute);
      }
      return undefined;
    })
  );
});
