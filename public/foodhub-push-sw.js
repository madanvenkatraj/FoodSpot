/* FoodHub Customer App — Browser Push Notification Service Worker */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'FoodHub Live Order Update',
    body: 'Your order status has changed.',
    orderId: '',
    orderNumber: '',
    tag: 'foodhub-order-update',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    icon: '/images/dish-pizza.svg',
    badge: '/images/dish-pizza.svg',
    tag: payload.tag || `foodhub-order-${payload.orderNumber || Date.now()}`,
    renotify: true,
    data: {
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      url: payload.orderId ? `/customer/orders/${payload.orderId}` : '/customer/orders',
    },
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || '/customer/orders';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
