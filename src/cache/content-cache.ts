/**
 * 客户端缓存系统 — 内容增量缓存
 *
 * 核心能力：
 * 1. 首次全量拉取，持久化到 localStorage
 * 2. 后续访问通过 ETag / Last-Modified 条件请求，只传输变化数据
 * 3. 支持 stale-while-revalidate：先返回旧缓存，后台静默更新
 *
 * @author CuteLeaf <xiaye@msn.com>
 */

import type {
	ContentCacheConfig,
	ContentCacheEntry,
	GithubCardCacheData,
	MemosCacheData,
	SyncMeta,
} from "./types";
import { CacheManager } from "./core";

// ─── 默认配置 ─────────────────────────────────────────────────

const DEFAULT_CONTENT_CONFIG: ContentCacheConfig = {
	version: 1,
	keyPrefix: "ff:content:",
	defaultTTL: 30 * 60 * 1000, // 30 分钟
	memosSyncInterval: 10 * 60 * 1000, // 10 分钟
	githubCardTTL: 24 * 60 * 60 * 1000, // 24 小时
};

// ─── 缓存 Key 常量 ────────────────────────────────────────────

const KEYS = {
	memos: "memos",
	memosSync: "memos:sync",
	githubCard: (repo: string) => `github:${repo.toLowerCase()}`,
	githubCardSync: (repo: string) => `github:sync:${repo.toLowerCase()}`,
	failedCovers: "failed-covers",
} as const;

// ─── 核心类 ───────────────────────────────────────────────────

export class ContentCache {
	private manager: CacheManager;
	private config: ContentCacheConfig;

	/** inflight 请求去重 */
	private inflight = new Map<string, Promise<unknown>>();

	constructor(config?: Partial<ContentCacheConfig>) {
		this.config = { ...DEFAULT_CONTENT_CONFIG, ...config };
		this.manager = new CacheManager(this.config);
	}

	// ═══════════════════════════════════════════════════════════
	// Memos 增量同步
	// ═══════════════════════════════════════════════════════════

	/**
	 * 获取 Memos 数据（stale-while-revalidate 策略）
	 *
	 * - 首次: 全量拉取 → 缓存 → 返回
	 * - 非首次: 立即返回旧缓存 + 后台条件请求更新
	 * - 过期: 同步等待最新数据
	 */
	async fetchMemos<T>(
		memosApiUrl: string,
		options?: {
			pageSize?: number;
			maxPages?: number;
			parent?: string;
			forceRefresh?: boolean;
		},
		transform?: (raw: unknown[]) => T[],
	): Promise<T[]> {
		const cacheKey = KEYS.memos;
		const metaKey = KEYS.memosSync;

		// 检查是否需要刷新
		const meta = this.manager.get<ContentCacheEntry<unknown>>(metaKey);
		const isStale = !meta || Date.now() - meta.syncedAt >= this.config.memosSyncInterval;

		if (!options?.forceRefresh && !isStale) {
			// 缓存新鲜，直接返回
			const cached = this.manager.get<T[]>(cacheKey);
			if (cached) return cached;
		}

		if (isStale && !options?.forceRefresh && meta) {
			// stale-while-revalidate: 返回旧数据 + 后台更新
			const cached = this.manager.get<T[]>(cacheKey);
			if (cached) {
				this.backgroundSyncMemos(memosApiUrl, options, transform).catch(() => {});
				return cached;
			}
		}

		// 全量拉取（同步等待）
		return this.syncMemos(memosApiUrl, options, transform);
	}

	/**
	 * 条件请求同步 Memos
	 * 使用 If-None-Match / If-Modified-Since 减少传输
	 */
	private async syncMemos<T>(
		memosApiUrl: string,
		options?: { pageSize?: number; maxPages?: number; parent?: string },
		transform?: (raw: unknown[]) => T[],
	): Promise<T[]> {
		const cacheKey = KEYS.memos;
		const metaKey = KEYS.memosSync;
		const dedupeKey = `sync:${cacheKey}`;

		return this.dedupe<T[]>(dedupeKey, async () => {
			// 读取已有的条件请求元数据
			const existingMeta = this.manager.get<ContentCacheEntry<unknown>>(metaKey);
			const syncMeta: SyncMeta | undefined = existingMeta?.sync;

			// 构建条件请求头
			const headers: Record<string, string> = {
				Accept: "application/json",
			};
			if (syncMeta?.etag) {
				headers["If-None-Match"] = syncMeta.etag;
			}
			if (syncMeta?.lastModified) {
				headers["If-Modified-Since"] = syncMeta.lastModified;
			}

			// 尝试增量拉取：只获取 updateTime > lastSyncTime 的记录
			const pageSize = options?.pageSize || 10000;
			const maxPages = options?.maxPages || 10;
			const parent = options?.parent || "";
			const allMemos: unknown[] = [];
			let pageToken = "";
			let responseEtag: string | undefined;
			let responseLastModified: string | undefined;
			let notModified = false;

			for (let page = 0; page < maxPages; page++) {
				const url = new URL(`${memosApiUrl}/api/v1/memos`);
				url.searchParams.set("pageSize", String(pageSize));
				if (parent) {
					url.searchParams.set("parent", parent);
				}
				if (pageToken) {
					url.searchParams.set("pageToken", pageToken);
				}

				// 如果有上次同步时间，只拉取更新的内容
				if (syncMeta?.syncedAt) {
					const since = new Date(syncMeta.syncedAt).toISOString();
					url.searchParams.set("filter", `update_time > "${since}"`);
				}

				const response = await fetch(url.toString(), {
					headers,
					signal: AbortSignal.timeout(15000),
				});

				// 304 Not Modified — 缓存仍然有效
				if (response.status === 304) {
					notModified = true;
					break;
				}

				if (!response.ok) {
					const errorText = await response.text().catch(() => "");
					console.error(`[Cache] Memos API ${response.status}: ${errorText}`);
					throw new Error(`Memos API error: ${response.status}`);
				}

				// 提取条件响应头
				responseEtag = response.headers.get("etag") ?? undefined;
				responseLastModified = response.headers.get("last-modified") ?? undefined;

				const data = await response.json();
				allMemos.push(...(data.memos || []));

				if (!data.nextPageToken) break;
				pageToken = data.nextPageToken;
			}

			// 304: 返回旧缓存数据
			if (notModified) {
				const cached = this.manager.get<T[]>(cacheKey);
				// 更新同步时间戳
				if (existingMeta) {
					existingMeta.syncedAt = Date.now();
					if (responseEtag) existingMeta.sync.etag = responseEtag;
					if (responseLastModified) existingMeta.sync.lastModified = responseLastModified;
					this.manager.set(metaKey, existingMeta);
				}
				return cached ?? [];
			}

			// 合并数据：如果有增量更新，与旧数据合并去重
			let finalData: unknown[] = allMemos;
			if (syncMeta?.syncedAt && allMemos.length > 0) {
				const oldRaw = this.manager.get<ContentCacheEntry<unknown>>(cacheKey);
				const oldData = (oldRaw as unknown as T[]) ?? [];
				// 增量合并：新数据替换旧数据中的同 id 计录
				const newIds = new Set(
					allMemos.map((m: any) => m.name || m.id),
				);
				const merged = [
					...oldData.filter((item: any) => !newIds.has(item.name || item.id)),
					...allMemos,
				];
				finalData = merged;
			}

			// Transform if provided
			const result = transform ? transform(finalData) : (finalData as T[]);

			// 写入缓存
			this.manager.set(cacheKey, result);
			this.manager.set(metaKey, {
				data: null,
				fetchedAt: Date.now(),
				version: this.config.version,
				sync: {
					etag: responseEtag,
					lastModified: responseLastModified,
					syncedAt: Date.now(),
				},
			} satisfies ContentCacheEntry<null>);

			return result;
		});
	}

	/**
	 * 后台静默同步（不阻塞页面渲染）
	 */
	private async backgroundSyncMemos<T>(
		memosApiUrl: string,
		options?: { pageSize?: number; maxPages?: number; parent?: string },
		transform?: (raw: unknown[]) => T[],
	): Promise<void> {
		try {
			await this.syncMemos(memosApiUrl, options, transform);
		} catch {
			// 静默失败，下次访问时重试
		}
	}

	// ═══════════════════════════════════════════════════════════
	// GitHub Card 缓存（兼容现有逻辑）
	// ═══════════════════════════════════════════════════════════

	/**
	 * 读取 GitHub Card 缓存
	 */
	getGithubCard(repo: string): GithubCardCacheData | null {
		const key = KEYS.githubCard(repo);
		return this.manager.get<GithubCardCacheData>(key, this.config.githubCardTTL);
	}

	/**
	 * 写入 GitHub Card 缓存
	 */
	setGithubCard(repo: string, data: GithubCardCacheData): void {
		const key = KEYS.githubCard(repo);
		this.manager.set(key, data, this.config.githubCardTTL);
	}

	// ═══════════════════════════════════════════════════════════
	// 加密密码缓存（兼容现有 sessionStorage 逻辑）
	// ═══════════════════════════════════════════════════════════

	/**
	 * 读取加密文章密码（sessionStorage）
	 */
	getPassword(slug: string): string | null {
		try {
			return sessionStorage.getItem(`pw:${slug}`);
		} catch {
			return null;
		}
	}

	/**
	 * 写入加密文章密码（sessionStorage）
	 */
	setPassword(slug: string, password: string): void {
		try {
			sessionStorage.setItem(`pw:${slug}`, password);
		} catch {
			// 静默
		}
	}

	// ═══════════════════════════════════════════════════════════
	// 失败封面图记录
	// ═══════════════════════════════════════════════════════════

	/**
	 * 获取失败封面图 URL 集合
	 */
	getFailedCovers(): Set<string> {
		try {
			const raw = localStorage.getItem(KEYS.failedCovers);
			return new Set(raw ? JSON.parse(raw) : []);
		} catch {
			return new Set();
		}
	}

	/**
	 * 记录失败的封面图 URL（最多保留 200 条）
	 */
	addFailedCover(url: string): void {
		try {
			const failed = this.getFailedCovers();
			failed.add(url);
			const arr = [...failed].slice(-200);
			localStorage.setItem(KEYS.failedCovers, JSON.stringify(arr));
		} catch {
			// 静默
		}
	}

	// ═══════════════════════════════════════════════════════════
	// 通用 API 缓存（可扩展）
	// ═══════════════════════════════════════════════════════════

	/**
	 * 通用的条件请求缓存获取
	 * 适用于任何支持 ETag / Last-Modified 的 API
	 */
	async fetchWithCache<T>(
		key: string,
		url: string,
		options?: {
			ttl?: number;
			timeout?: number;
			headers?: Record<string, string>;
		},
	): Promise<T> {
		const metaKey = `${key}:meta`;
		const ttl = options?.ttl ?? this.config.defaultTTL;

		// 检查缓存新鲜度
		const meta = this.manager.get<ContentCacheEntry<unknown>>(metaKey);
		if (meta && Date.now() - meta.syncedAt < ttl) {
			const cached = this.manager.get<T>(key);
			if (cached) return cached;
		}

		return this.dedupe<T>(`fetch:${key}`, async () => {
			const syncMeta: SyncMeta | undefined = meta?.sync;

			const headers: Record<string, string> = {
				Accept: "application/json",
				...options?.headers,
			};
			if (syncMeta?.etag) headers["If-None-Match"] = syncMeta.etag;
			if (syncMeta?.lastModified) headers["If-Modified-Since"] = syncMeta.lastModified;

			const response = await fetch(url, {
				headers,
				signal: AbortSignal.timeout(options?.timeout ?? 10000),
			});

			if (response.status === 304) {
				const cached = this.manager.get<T>(key);
				if (meta) {
					meta.syncedAt = Date.now();
					this.manager.set(metaKey, meta);
				}
				return cached as T;
			}

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}

			const data: T = await response.json();

			const entry: ContentCacheEntry<T> = {
				data,
				fetchedAt: Date.now(),
				version: this.config.version,
				sync: {
					etag: response.headers.get("etag") ?? undefined,
					lastModified: response.headers.get("last-modified") ?? undefined,
					syncedAt: Date.now(),
				},
			};

			this.manager.set(key, data);
			this.manager.set(metaKey, entry);

			return data;
		});
	}

	// ═══════════════════════════════════════════════════════════
	// 工具方法
	// ═══════════════════════════════════════════════════════════

	/**
	 * 请求去重：相同 key 的并发请求只执行一次
	 */
	private async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
		const existing = this.inflight.get(key);
		if (existing) return existing as Promise<T>;

		const promise = fn().finally(() => {
			this.inflight.delete(key);
		});

		this.inflight.set(key, promise);
		return promise;
	}

	/**
	 * 清理所有内容缓存
	 */
	clear(): void {
		this.manager.clear(["github:sync:"]);
		this.inflight.clear();
	}

	/**
	 * 返回缓存统计
	 */
	stats() {
		return this.manager.stats();
	}
}

// ─── 便捷工厂函数 ─────────────────────────────────────────────

let _instance: ContentCache | null = null;

/**
 * 获取全局 ContentCache 单例
 */
export function getContentCache(): ContentCache {
	if (!_instance) {
		_instance = new ContentCache();
	}
	return _instance;
}
