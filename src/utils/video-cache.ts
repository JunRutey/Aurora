/**
 * 视频缓存管理器
 * 
 * 职责：
 * 1. 注册 Service Worker
 * 2. 在页面空闲时预缓存视频
 * 3. 不阻塞首页核心内容加载
 */

const SW_PATH = '/sw.js';
const CACHE_NAME = 'aurora-video-cache';

let swRegistration: ServiceWorkerRegistration | null = null;
let isPrefetching = false;

/**
 * 注册 Service Worker
 * 延迟注册，不阻塞首屏渲染
 */
export async function registerVideoSW(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  // 等待页面完全加载后再注册
  await new Promise<void>((resolve) => {
    if (document.readyState === 'complete') {
      resolve();
    } else {
      window.addEventListener('load', () => resolve(), { once: true });
    }
  });

  // 再等待 2 秒，确保首页骨架和壁纸优先加载
  await new Promise((resolve) => setTimeout(resolve, 2000));

  try {
    swRegistration = await navigator.serviceWorker.register(SW_PATH, {
      scope: '/',
    });
    
    console.log('[VideoCache] Service Worker registered');
    
    // 监听预缓存完成事件
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'PREFETCH_COMPLETE') {
        console.log('[VideoCache] Video prefetch completed');
        isPrefetching = false;
        window.dispatchEvent(new CustomEvent('video-cache-ready'));
      }
    });
    
    return swRegistration;
  } catch (error) {
    console.warn('[VideoCache] SW registration failed:', error);
    return null;
  }
}

/**
 * 预缓存视频
 * 使用 requestIdleCallback 在浏览器空闲时执行
 */
export async function prefetchVideos(urls: string | string[]): Promise<void> {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    return;
  }

  const urlList = Array.isArray(urls) ? urls : [urls];
  if (!urlList.length) return;

  if (isPrefetching) return;
  isPrefetching = true;

  const doPrefetch = () => {
    navigator.serviceWorker.controller?.postMessage({
      type: 'PREFETCH_VIDEOS',
      urls: urlList,
    });
  };

  // 使用 requestIdleCallback 在浏览器空闲时执行
  // 如果不支持，则使用 setTimeout 延迟 5 秒
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(doPrefetch, { timeout: 10000 });
  } else {
    setTimeout(doPrefetch, 5000);
  }
}

/**
 * 获取缓存状态
 */
export async function getCacheStatus(): Promise<string[]> {
  return new Promise((resolve) => {
    if (!navigator.serviceWorker.controller) {
      resolve([]);
      return;
    }

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'CACHE_STATUS') {
        navigator.serviceWorker.removeEventListener('message', handler);
        resolve(event.data.cachedUrls || []);
      }
    };

    navigator.serviceWorker.addEventListener('message', handler);
    navigator.serviceWorker.controller.postMessage({ type: 'GET_CACHE_STATUS' });
  });
}

/**
 * 检查视频是否已缓存
 */
export async function isVideoCached(url: string): Promise<boolean> {
  if (!('caches' in window)) return false;
  
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(url);
    return !!response;
  } catch {
    return false;
  }
}

/**
 * 获取缓存后的视频 URL
 * 如果已缓存，返回可用于 blob URL 的数据
 */
export async function getCachedVideoUrl(url: string): Promise<string | null> {
  if (!('caches' in window)) return null;
  
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(url);
    if (response) {
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
  } catch {
    // ignore
  }
  return null;
}
