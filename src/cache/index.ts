/**
 * 客户端缓存系统 — 统一入口
 *
 * @example
 * ```ts
 * // 读写用户偏好
 * import { getSetting, setSetting } from "@/cache";
 * const theme = getSetting("theme", "auto");
 * setSetting("theme", "dark");
 *
 * // 获取 Memos（增量同步）
 * import { getContentCache } from "@/cache";
 * const memos = await getContentCache().fetchMemos(apiUrl, { parent });
 *
 * // 缓存静态资源
 * import { cachedFetch } from "@/cache";
 * const resp = await cachedFetch("/assets/image.webp");
 * ```
 *
 * @author CuteLeaf <xiaye@msn.com>
 */

export { CacheManager } from "./core";
export { DEFAULT_CONFIG } from "./core";
export { SettingsCache, getSettingsCache, getSetting, setSetting } from "./settings-cache";
export { ContentCache, getContentCache } from "./content-cache";
export { AssetsCache, getAssetsCache, cachedFetch } from "./assets-cache";
export { VideoCache, getVideoCache, prefetchVideos, getCachedVideo } from "./video-cache";

// 统一初始化函数，应用启动时调用一次
import { getSettingsCache } from "./settings-cache";
import { getContentCache } from "./content-cache";
import { getAssetsCache } from "./assets-cache";

/**
 * 初始化缓存系统
 * 在应用入口处调用一次即可，后续使用各模块的单例
 */
export function initCacheSystem(): void {
	// 预热单例，提前完成异步初始化
	getSettingsCache();
	getContentCache();
	getAssetsCache();
}
