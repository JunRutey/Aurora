/**
 * Aurora Media Cache Service Worker
 *
 * 职责：
 * 1. 拦截视频/音频请求，优先从缓存读取
 * 2. 缓存媒体文件供离线/流畅播放
 */

const VIDEO_CACHE = "aurora-video-v1";
const AUDIO_CACHE = "aurora-audio-v1";
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".ogg", ".mov"];
const AUDIO_EXTENSIONS = [".mp3", ".wav", ".flac", ".aac", ".m4a", ".ogg"];

function isMediaRequest(url, extensions) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return extensions.some((ext) => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== VIDEO_CACHE && n !== AUDIO_CACHE)
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

/**
 * 拦截媒体请求 - 优先从缓存返回
 */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = request.url;
  let cacheName = null;

  if (isMediaRequest(url, VIDEO_EXTENSIONS)) {
    cacheName = VIDEO_CACHE;
  } else if (isMediaRequest(url, AUDIO_EXTENSIONS)) {
    cacheName = AUDIO_CACHE;
  }

  if (!cacheName) return;

  event.respondWith(
    caches.open(cacheName).then((cache) =>
      cache.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request).then((response) => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        });
      })
    )
  );
});
