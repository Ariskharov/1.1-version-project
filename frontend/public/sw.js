/* TimeTrack service worker — push + open cabinet */
/* eslint-disable no-restricted-globals */

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

const readPushData = (event) => {
  const data = {
    title: 'ТокмокУПП',
    body: '',
    url: '/cabinet',
    tag: 'notice',
  };
  if (!event.data) return data;
  try {
    return { ...data, ...event.data.json() };
  } catch (_) {
    try {
      data.body = event.data.text();
    } catch (__) {
      /* тело пуша не разобралось */
    }
    return data;
  }
};

self.addEventListener('push', (event) => {
  const data = readPushData(event);
  const title = data.title || 'ТокмокУПП';
  const options = {
    body: data.body || '',
    tag: data.tag || 'notice',
    renotify: true,
    data: { url: data.url || '/cabinet', announcementId: data.announcementId || null },
    vibrate: [80],
    badge: '/icons/icon-192.png',
    icon: '/icons/icon-192.png',
  };

  // Баннер запускаем сразу, тем же набором опций, что и у рабочей заявки.
  // Ожидание списка окон до showNotification на части телефонов глушит уведомление.
  const shown = self.registration.showNotification(title, options).catch(() => (
    self.registration.showNotification(title, {
      body: options.body,
      tag: options.tag,
      data: options.data,
    }).catch(() => undefined)
  ));

  const ping = self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    windows.forEach((client) => {
      try {
        client.postMessage({
          type: 'push',
          title,
          body: options.body,
          url: options.data.url,
          tag: options.tag,
        });
      } catch (_) {
        /* окно уже закрыто */
      }
    });
  }).catch(() => undefined);

  event.waitUntil(Promise.all([shown, ping]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/cabinet';
  const absolute = new URL(targetUrl, self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows.find((client) => 'focus' in client);
    if (open) {
      open.postMessage({ type: 'notification-click', url: targetUrl });
      await open.focus();
      return;
    }
    if (self.clients.openWindow) await self.clients.openWindow(absolute);
  })());
});
