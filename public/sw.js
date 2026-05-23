// ChatWrapped service worker — only purpose is to handle the Web Share Target.
// No caching: all network requests fall through to the browser.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Holds the shared file in memory between the POST intercept and the client request.
let pendingFile = null;

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Intercept the share-target POST sent by the OS share sheet.
  if (url.pathname === '/share-target' && event.request.method === 'POST') {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        pendingFile = formData.get('chat') ?? null;
      } catch {
        pendingFile = null;
      }
      // Redirect to the app; the app will ask for the file via postMessage.
      return Response.redirect('/?shared=1', 303);
    })());
  }
  // All other requests: let the browser handle them normally.
});

self.addEventListener('message', event => {
  if (event.data?.type === 'GET_SHARED_FILE') {
    event.source.postMessage({ type: 'SHARED_FILE', file: pendingFile });
    pendingFile = null;
  }
});
