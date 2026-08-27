/**
 * 客户端缓存系统 — 兼容桥接层
 *
 * 为内联 <script> 提供 window.__cache 桥接
 * 替代散落的 localStorage 直接调用
 *
 * @author CuteLeaf <xiaye@msn.com>
 */

import { getSettingsCache } from "./settings-cache";
import { getContentCache } from "./content-cache";
import { getAssetsCache, cachedFetch } from "./assets-cache";

// ─── 全局桥接对象 ─────────────────────────────────────────────

export interface CacheBridge {
	/** 用户偏好 */
	settings: {
		get(key: string): string | null;
		set(key: string, value: unknown): void;
		getTyped<T>(key: string, fallback: T): T;
	};
	/** 内容缓存 */
	content: {
		getGithubCard(repo: string): unknown;
		setGithubCard(repo: string, data: unknown): void;
		getPassword(slug: string): string | null;
		setPassword(slug: string, password: string): void;
		getFailedCovers(): Set<string>;
		addFailedCover(url: string): void;
	};
	/** 静态资源缓存 */
	assets: {
		fetch(url: string | Request, init?: RequestInit): Promise<Response>;
		match(url: string): Promise<Response | undefined>;
	};
	/** 便捷函数 */
	cachedFetch: typeof cachedFetch;
}

/**
 * 在 <script> is:inline 中通过 window.__cache 访问
 * 示例:
 *   var theme = window.__cache.settings.getTyped("theme", "auto");
 *   window.__cache.settings.set("hue", "280");
 */
export function installBridge(): void {
	if (typeof window === "undefined") return;

	const settings = getSettingsCache();
	const content = getContentCache();
	const assets = getAssetsCache();

	(window as any).__cache = {
		settings: {
			get: (key: string) => settings.get(key),
			set: (key: string, value: unknown) => settings.set(key, value),
			getTyped: <T>(key: string, fallback: T) => settings.getTyped(key, fallback),
		},
		content: {
			getGithubCard: (repo: string) => content.getGithubCard(repo),
			setGithubCard: (repo: string, data: unknown) => content.setGithubCard(repo, data as any),
			getPassword: (slug: string) => content.getPassword(slug),
			setPassword: (slug: string, password: string) => content.setPassword(slug, password),
			getFailedCovers: () => content.getFailedCovers(),
			addFailedCover: (url: string) => content.addFailedCover(url),
		},
		assets: {
			fetch: (url: string | Request, init?: RequestInit) => assets.fetch(url, init),
			match: (url: string) => assets.match(url),
		},
		cachedFetch,
	} satisfies CacheBridge;
}

// ─── Setting-Utils 迁移适配 ───────────────────────────────────

/**
 * 替代 setting-utils.ts 中的 getStoredHue() 等函数
 * 新代码直接使用 getSetting() 即可
 */

// 重新导出，保持向后兼容
export { getSetting as getStoredHue } from "./settings-cache";
export { getSetting as getStoredTheme } from "./settings-cache";
export { getSetting as getStoredWallpaperMode } from "./settings-cache";
export { getSetting as getStoredOverlayOpacity } from "./settings-cache";
export { getSetting as getStoredOverlayBlur } from "./settings-cache";
export { setSetting as storeHue } from "./settings-cache";
export { setSetting as storeTheme } from "./settings-cache";
