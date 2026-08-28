/**
 * 客户端缓存系统 — 静态资源 HTTP Cache
 *
 * 封装浏览器 Cache API，用于缓存静态资源（图片、字体、CSS、JS）
 * 策略: stale-while-revalidate — 先返回缓存，后台更新
 *
 * @author CuteLeaf <xiaye@msn.com>
 */

// ─── 配置 ─────────────────────────────────────────────────────

interface AssetsCacheConfig {
	/** Cache API 的缓存名称 */
	cacheName: string;
	/** 最大缓存条目数（LRU 淘汰） */
	maxEntries: number;
	/** 不缓存的 URL 模式（正则） */
	excludePatterns: RegExp[];
	/** 只缓存同源请求 */
	sameOriginOnly: boolean;
}

const DEFAULT_CONFIG: AssetsCacheConfig = {
	cacheName: "firefly-assets-v1",
	maxEntries: 200,
	excludePatterns: [/api\//i, /\/webhooks\//i],
	sameOriginOnly: true,
};

// ─── 核心类 ───────────────────────────────────────────────────

export class AssetsCache {
	private config: AssetsCacheConfig;
	private cacheReady: Promise<Cache | null>;

	constructor(config?: Partial<AssetsCacheConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.cacheReady = this.initCache();
	}

	/**
	 * 初始化 Cache API（检查浏览器支持）
	 */
	private async initCache(): Promise<Cache | null> {
		if (typeof caches === "undefined") return null;
		try {
			return await caches.open(this.config.cacheName);
		} catch {
			return null;
		}
	}

	/**
	 * 检查 URL 是否应该被缓存
	 */
	private shouldCache(url: string): boolean {
		if (this.config.sameOriginOnly) {
			try {
				const parsed = new URL(url, location.href);
				if (parsed.origin !== location.origin) return false;
			} catch {
				return false;
			}
		}
		return !this.config.excludePatterns.some((p) => p.test(url));
	}

	/**
	 * stale-while-revalidate 策略
	 * 先返回缓存的响应，同时在后台发起网络请求更新缓存
	 */
	async fetch(url: string | Request, init?: RequestInit): Promise<Response> {
		const request = typeof url === "string" ? new Request(url, init) : url;
		const cache = await this.cacheReady;

		// Cache API 不支持则直接网络请求
		if (!cache) {
			return fetch(request);
		}

		const requestUrl = request.url;
		if (!this.shouldCache(requestUrl)) {
			return fetch(request);
		}

		// 查找缓存
		const cachedResponse = await cache.match(request);

		if (cachedResponse) {
			// 后台更新（不阻塞）
			this.revalidate(cache, request.clone()).catch(() => {});
			return cachedResponse;
		}

		// 无缓存，网络请求并缓存
		return this.fetchAndCache(cache, request);
	}

	/**
	 * 仅从缓存中读取（不触发网络请求）
	 */
	async match(url: string | Request): Promise<Response | undefined> {
		const cache = await this.cacheReady;
		if (!cache) return undefined;
		const request = typeof url === "string" ? new Request(url) : url;
		return cache.match(request);
	}

	/**
	 * 将响应写入缓存
	 */
	async put(url: string | Request, response: Response): Promise<void> {
		const cache = await this.cacheReady;
		if (!cache) return;
		const request = typeof url === "string" ? new Request(url) : url;

		// 只缓存成功的 GET 请求
		if (response.ok && response.type === "basic") {
			await cache.put(request, response.clone());
			await this.enforceMaxEntries(cache);
		}
	}

	/**
	 * 删除指定缓存
	 */
	async delete(url: string | Request): Promise<boolean> {
		const cache = await this.cacheReady;
		if (!cache) return false;
		const request = typeof url === "string" ? new Request(url) : url;
		return cache.delete(request);
	}

	/**
	 * 清空整个缓存池
	 */
	async clear(): Promise<void> {
		const cache = await this.cacheReady;
		if (!cache) return;
		const keys = await cache.keys();
		await Promise.all(keys.map((k) => cache.delete(k)));
	}

	/**
	 * 返回缓存条目数
	 */
	async size(): Promise<number> {
		const cache = await this.cacheReady;
		if (!cache) return 0;
		const keys = await cache.keys();
		return keys.length;
	}

	// ── 内部方法 ──

	/**
	 * 网络请求并写入缓存
	 */
	private async fetchAndCache(cache: Cache, request: Request): Promise<Response> {
		try {
			const response = await fetch(request);

			// 只缓存成功的 GET 请求
			if (response.ok && request.method === "GET" && response.type === "basic") {
				// 克隆一份用于缓存（原始 response 交给调用者）
				await cache.put(request, response.clone());
				await this.enforceMaxEntries(cache);
			}

			return response;
		} catch (error) {
			throw error;
		}
	}

	/**
	 * 后台重新验证缓存
	 */
	private async revalidate(cache: Cache, request: Request): Promise<void> {
		try {
			const response = await fetch(request);
			if (response.ok) {
				await cache.put(request, response);
				await this.enforceMaxEntries(cache);
			}
		} catch {
			// 静默失败，旧缓存仍然有效
		}
	}

	/**
	 * 强制执行最大条目数限制（LRU 淘汰最早的条目）
	 */
	private async enforceMaxEntries(cache: Cache): Promise<void> {
		const keys = await cache.keys();
		if (keys.length <= this.config.maxEntries) return;

		// 删除最早的条目（keys 按添加顺序排列）
		const excess = keys.length - this.config.maxEntries;
		for (let i = 0; i < excess; i++) {
			await cache.delete(keys[i]);
		}
	}
}

// ─── 便捷工厂函数 ─────────────────────────────────────────────

let _instance: AssetsCache | null = null;

/**
 * 获取全局 AssetsCache 单例
 */
export function getAssetsCache(): AssetsCache {
	if (!_instance) {
		_instance = new AssetsCache();
	}
	return _instance;
}

/**
 * 快捷 fetch（stale-while-revalidate）
 */
export function cachedFetch(
	url: string | Request,
	init?: RequestInit,
): Promise<Response> {
	return getAssetsCache().fetch(url, init);
}
