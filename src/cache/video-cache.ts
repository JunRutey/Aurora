/**
 * 客户端缓存系统 — 视频缓存模块
 *
 * 管理背景视频的预缓存，集成到 Aurora 缓存架构
 * 策略: 页面加载时立即开始预缓存，播放时从 Cache API 读取
 *
 * @author JunRutey
 */

// ─── 配置 ─────────────────────────────────────────────────────

const VIDEO_CACHE_NAME = "aurora-video-v1";
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".ogg", ".mov"];

// ─── 核心类 ───────────────────────────────────────────────────

export class VideoCache {
  private cacheReady: Promise<Cache | null>;
  private prefetching = false;
  private prefetchedUrls = new Set<string>();
  private onProgressCallback?: (progress: VideoCacheProgress) => void;
  private onCompleteCallback?: () => void;

  constructor() {
    this.cacheReady = this.initCache();
  }

  /**
   * 初始化 Cache API
   */
  private async initCache(): Promise<Cache | null> {
    if (typeof caches === "undefined") return null;
    try {
      return await caches.open(VIDEO_CACHE_NAME);
    } catch {
      return null;
    }
  }

  /**
   * 判断是否为视频 URL
   */
  isVideoUrl(url: string): boolean {
    try {
      const pathname = new URL(url, location.href).pathname.toLowerCase();
      return VIDEO_EXTENSIONS.some((ext) => pathname.endsWith(ext));
    } catch {
      return false;
    }
  }

  /**
   * 预缓存视频列表
   * 立即开始，不等待任何条件
   */
  async prefetch(urls: string[]): Promise<void> {
    if (this.prefetching || !urls.length) return;
    this.prefetching = true;

    const cache = await this.cacheReady;
    if (!cache) {
      this.prefetching = false;
      return;
    }

    // 过滤已缓存的
    const toCache: string[] = [];
    for (const url of urls) {
      if (!this.prefetchedUrls.has(url)) {
        const exists = await cache.match(url);
        if (!exists) {
          toCache.push(url);
        } else {
          this.prefetchedUrls.add(url);
        }
      }
    }

    if (!toCache.length) {
      this.prefetching = false;
      this.notifyComplete();
      return;
    }

    const total = toCache.length;
    let completed = 0;
    let failed = 0;

    // 逐个缓存
    for (const url of toCache) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          await cache.put(url, response);
          this.prefetchedUrls.add(url);
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
      completed++;

      // 报告进度
      this.notifyProgress({
        completed,
        total,
        failed,
        percent: Math.round((completed / total) * 100),
      });
    }

    this.prefetching = false;
    this.notifyComplete();
  }

  /**
   * 从缓存获取视频 Response
   */
  async match(url: string): Promise<Response | null> {
    const cache = await this.cacheReady;
    if (!cache) return null;
    const response = await cache.match(url);
    return response ?? null;
  }

  /**
   * 检查视频是否已缓存
   */
  async isCached(url: string): Promise<boolean> {
    const cache = await this.cacheReady;
    if (!cache) return false;
    const response = await cache.match(url);
    return !!response;
  }

  /**
   * 获取缓存的视频 Blob URL
   * 用于直接设置 video.src
   */
  async getBlobUrl(url: string): Promise<string | null> {
    const response = await this.match(url);
    if (!response) return null;
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  /**
   * 设置进度回调
   */
  onProgress(cb: (progress: VideoCacheProgress) => void): void {
    this.onProgressCallback = cb;
  }

  /**
   * 设置完成回调
   */
  onComplete(cb: () => void): void {
    this.onCompleteCallback = cb;
  }

  private notifyProgress(progress: VideoCacheProgress): void {
    this.onProgressCallback?.(progress);
  }

  private notifyComplete(): void {
    this.onCompleteCallback?.();
  }

  /**
   * 清空缓存
   */
  async clear(): Promise<void> {
    const cache = await this.cacheReady;
    if (!cache) return;
    const keys = await cache.keys();
    await Promise.all(keys.map((k) => cache.delete(k)));
    this.prefetchedUrls.clear();
  }
}

// ─── 类型 ─────────────────────────────────────────────────────

export interface VideoCacheProgress {
  completed: number;
  total: number;
  failed: number;
  percent: number;
}

// ─── 便捷函数 ─────────────────────────────────────────────────

let _instance: VideoCache | null = null;

/**
 * 获取全局 VideoCache 单例
 */
export function getVideoCache(): VideoCache {
  if (!_instance) {
    _instance = new VideoCache();
  }
  return _instance;
}

/**
 * 快捷预缓存
 */
export function prefetchVideos(urls: string[]): Promise<void> {
  return getVideoCache().prefetch(urls);
}

/**
 * 快捷获取缓存的视频
 */
export function getCachedVideo(url: string): Promise<Response | null> {
  return getVideoCache().match(url);
}
