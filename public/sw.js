/**
 * Aurora Background Video Cache Service Worker
 * 
 * 职责：
 * 1. 拦截视频请求，优先从缓存读取
 * 2. 缓存完整视频文件供离线/流畅播放
 * 3. 不影响其他资源加载优先级
 */

const CACHE_NAME = 'aurora-video-cache';
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov'];

/**
 * 判断是否为视频请求
 */
function isVideoRequest(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return VIDEO_EXTENSIONS.some(ext => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

/**
 * 安装事件 - 预缓存指定的视频
 */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

/**
 * 激活事件 - 清理旧缓存
 */
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
 * 拦截请求 - 视频请求优先从缓存读取
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // 只处理视频请求
  if (!isVideoRequest(request.url)) {
    return;
  }

  // GET 请求才处理
  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // 缓存命中，直接返回
          return cachedResponse;
        }

        // 缓存未命中，从网络获取并缓存
        return fetch(request).then((networkResponse) => {
          // 只缓存成功的响应
          if (networkResponse.ok) {
            // 克隆响应，因为响应流只能使用一次
            const responseToCache = networkResponse.clone();
            cache.put(request, responseToCache);
          }
          return networkResponse;
        }).catch((error) => {
          console.error('[SW] Video fetch failed:', error);
          throw error;
        });
      });
    })
  );
});

/**
 * 接收消息 - 预缓存视频
 */
self.addEventListener('message', (event) => {
  const { type, urls } = event.data;
  
  if (type === 'PREFETCH_VIDEOS' && Array.isArray(urls)) {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return Promise.allSettled(
          urls.map((url) => {
            return fetch(url).then((response) => {
              if (response.ok) {
                return cache.put(url, response);
              }
            }).catch((err) => {
              console.warn('[SW] Prefetch failed for:', url, err);
            });
          })
        );
      }).then(() => {
        // 通知客户端预缓存完成
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'PREFETCH_COMPLETE' });
          });
        });
      })
    );
  }
  
  if (type === 'GET_CACHE_STATUS') {
    caches.open(CACHE_NAME).then((cache) => {
      return cache.keys().then((requests) => {
        const cachedUrls = requests.map((req) => req.url);
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ 
              type: 'CACHE_STATUS', 
              cachedUrls,
              cacheName: CACHE_NAME
            });
          });
        });
      });
    });
  }
});
