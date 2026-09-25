self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '1',
        url: data.url || '/'
      }
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  // 알림 데이터의 상대 경로('/stats?month=...')를 절대 URL로 정규화해야 client.url(절대 URL)과 비교할 수 있다.
  var data = event.notification.data || {};
  var target;
  try {
    target = new URL(data.url || '/', self.location.origin);
  } catch {
    target = new URL('/', self.location.origin);
  }
  // 외부 출처로의 이동은 허용하지 않는다
  if (target.origin !== self.location.origin) {
    target = new URL('/', self.location.origin);
  }
  var targetHref = target.href;

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(windowClients) {
      // 1) 같은 URL로 열린 창이 있으면 포커스
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === targetHref && 'focus' in client) {
          return client.focus();
        }
      }
      // 2) 같은 출처의 창이 있으면 그 창을 대상 URL로 이동 후 포커스
      for (var j = 0; j < windowClients.length; j++) {
        var sameOriginClient = windowClients[j];
        var clientOrigin;
        try {
          clientOrigin = new URL(sameOriginClient.url).origin;
        } catch {
          continue;
        }
        if (clientOrigin === self.location.origin && 'navigate' in sameOriginClient) {
          return sameOriginClient
            .navigate(targetHref)
            .then(function(navigated) {
              var c = navigated || sameOriginClient;
              return 'focus' in c ? c.focus() : c;
            })
            .catch(function() {
              // navigate 실패(제어되지 않는 창 등) 시 새 창으로 연다
              return clients.openWindow ? clients.openWindow(targetHref) : undefined;
            });
        }
      }
      // 3) 없으면 새 창 열기
      if (clients.openWindow) {
        return clients.openWindow(targetHref);
      }
    })
  );
});
