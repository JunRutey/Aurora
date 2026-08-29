/**
 * Aurora Background Video Cache Service Worker
 */

const CACHE_NAME = 'aurora-video-cache';
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov'];

function isVideoRequest(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return VIDEO_EXTENSIONS.some(ext => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

/**
 * 拦截视频请求 - 优先从缓存读取
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  if (!isVideoRequest(request.url) || request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            cache.put(request, responseToCache);
          }
          return networkResponse;
        });
      });
    })
  );
});

/**
 * 预缓存视频 - 逐个缓存并报告进度
 */
self.addEventListener('message', (event) => {
  const { type, urls } = event.data;
  
  if (type === 'PREFETCH_VIDEOS' && Array.isArray(urls)) {
    const total = urls.length;
    let completed = 0;
    let failed = 0;

    // 逐个缓存，报告进度
    const cacheOne = async (url) => {
      try {
        const cache = await caches.open(CACHE_NAME);
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
        }
      } catch (err) {
        failed++;
        console.warn('[SW] Prefetch failed:', url);
      }
      completed++;
      
      // 报告进度
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ 
            type: 'CACHE_PROGRESS', 
            completed,
            total,
            failed
          });
        });
      });
    };

    // 串行缓存，避免并发过多
    const cacheAll = async () => {
      for (const url of urls) {
        await cacheOne(url);
      }
      
      // 全部完成
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ 
            type: 'PREFETCH_COMPLETE',
            total,
            failed
          });
        });
      });
    };

    cacheAll();
  }
});
