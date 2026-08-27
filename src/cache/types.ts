/**
 * 客户端缓存系统 — 类型定义
 * @author CuteLeaf <xiaye@msn.com>
 */

// ─── 缓存条目元数据 ───────────────────────────────────────────

/** 持久化条目的包装结构 */
export interface CacheEntry<T> {
	/** 实际数据 */
	data: T;
	/** 写入时间 (unix ms) */
	fetchedAt: number;
	/** 缓存 schema 版本，升级时自动淘汰旧数据 */
	version: number;
}

/** 内容缓存的条件请求元数据 */
export interface SyncMeta {
	/** HTTP ETag 响应头 */
	etag?: string;
	/** HTTP Last-Modified 响应头 */
	lastModified?: string;
	/** 最后一次成功同步的时间戳 */
	syncedAt: number;
}

/** 内容缓存条目 = 元数据 + 数据 */
export interface ContentCacheEntry<T> extends CacheEntry<T> {
	sync: SyncMeta;
}

// ─── 缓存配置 ─────────────────────────────────────────────────

export interface CacheConfig {
	/** 缓存 schema 版本号，结构变更时递增以自动淘汰旧数据 */
	version: number;
	/** localStorage 前缀，避免与其他库冲突 */
	keyPrefix: string;
	/** 默认 TTL (ms)，0 = 永不过期 */
	defaultTTL: number;
}

/** 各模块的独立配置 */
export interface ContentCacheConfig extends CacheConfig {
	/** Memos 增量同步间隔 (ms) */
	memosSyncInterval: number;
	/** GitHub Card 缓存 TTL (ms) */
	githubCardTTL: number;
}

export interface SettingsCacheConfig extends CacheConfig {
	/** 单个设置项的最大 key 数量（防止滥用） */
	maxKeys: number;
}

// ─── Settings 缓存 ────────────────────────────────────────────

/** 已知的用户偏好 key 集合 */
export type SettingsKey =
	| "theme"
	| "hue"
	| "wallpaperMode"
	| "overlayOpacity"
	| "overlayBlur"
	| "overlayCardOpacity"
	| "wavesEnabled"
	| "gradientEnabled"
	| "bannerTitleEnabled"
	| "bannerCarouselEnabled"
	| "cardBorderEnabled"
	| "cardFollowThemeEnabled"
	| "postListLayout"
	| "music-player-volume"
	| (string & {}); // 允许扩展

// ─── 内容缓存 ─────────────────────────────────────────────────

/** 缓存的 Memos 响应结构 */
export interface MemosCacheData {
	memos: unknown[];
	totalCount: number;
}

/** 缓存的 GitHub 仓库数据 */
export interface GithubCardCacheData {
	description: string | null;
	language: string | null;
	forks: number;
	stargazers_count: number;
	owner?: { avatar_url?: string };
	license?: { spdx_id?: string } | null;
}

// ─── 回调 / 事件 ──────────────────────────────────────────────

export interface CacheEvents {
	/** 缓存命中（含来源层级） */
	hit: { key: string; layer: "memory" | "storage" | "network" };
	/** 缓存写入 */
	set: { key: string; size: number };
	/** 缓存淘汰 */
	evict: { key: string; reason: "ttl" | "version" | "quota" | "manual" };
	/** 增量同步完成 */
	sync: { key: string; changed: boolean };
	/** 缓存错误 */
	error: { key: string; error: unknown };
}
