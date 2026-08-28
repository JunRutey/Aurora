/**
 * 客户端缓存系统 — 用户偏好缓存
 *
 * 统一管理所有 localStorage 偏好读写，替代散落各处的直接调用
 * 永不过期，schema 版本变更时自动迁移
 *
 * @author CuteLeaf <xiaye@msn.com>
 */

import type { SettingsCacheConfig, SettingsKey } from "./types";
import { CacheManager } from "./core";

// ─── 默认配置 ─────────────────────────────────────────────────

const DEFAULT_SETTINGS_CONFIG: SettingsCacheConfig = {
	version: 1,
	keyPrefix: "ff:settings:",
	defaultTTL: 0, // 用户偏好永不过期
	maxKeys: 50,
};

// ─── 已知 key 的默认值映射 ────────────────────────────────────

const DEFAULTS: Record<string, string> = {
	theme: "auto",
	hue: "250",
	wallpaperMode: "normal",
	overlayOpacity: "0.6",
	overlayBlur: "15",
	overlayCardOpacity: "0.85",
	wavesEnabled: "true",
	gradientEnabled: "true",
	bannerTitleEnabled: "true",
	bannerCarouselEnabled: "true",
	cardBorderEnabled: "true",
	cardFollowThemeEnabled: "true",
	postListLayout: "",
	"music-player-volume": "0.7",
};

// ─── 旧 key 迁移映射 ──────────────────────────────────────────

/** 旧系统直接用裸 key，新系统加前缀。首次访问时迁移 */
const MIGRATION_KEYS: string[] = [
	"theme",
	"hue",
	"wallpaperMode",
	"overlayOpacity",
	"overlayBlur",
	"overlayCardOpacity",
	"wavesEnabled",
	"gradientEnabled",
	"bannerTitleEnabled",
	"bannerCarouselEnabled",
	"cardBorderEnabled",
	"cardFollowThemeEnabled",
	"postListLayout",
	"music-player-volume",
];

// ─── 核心类 ───────────────────────────────────────────────────

export class SettingsCache {
	private manager: CacheManager;
	private config: SettingsCacheConfig;

	constructor(config?: Partial<SettingsCacheConfig>) {
		this.config = { ...DEFAULT_SETTINGS_CONFIG, ...config };
		this.manager = new CacheManager(this.config);
		this.migrateLegacyKeys();
	}

	/**
	 * 读取用户偏好
	 * 优先读新格式 (ff:settings:{version}:{key})，回退读旧格式 (裸 key)
	 * 内联 <script> 在 CacheInit 之前执行，写的是裸 key，这里兜底兼容
	 */
	get(key: SettingsKey): string | null {
		// 1. 新格式优先
		const newValue = this.manager.get<string>(key);
		if (newValue !== null) return newValue;

		// 2. 回退读旧格式裸 key
		if (typeof localStorage !== "undefined") {
			try {
				const legacyValue = localStorage.getItem(key);
				if (legacyValue !== null) {
					// 异步迁移到新格式（不阻塞读取）
					this.manager.set(key, legacyValue);
					return legacyValue;
				}
			} catch { /* 静默 */ }
		}

		// 3. 返回默认值
		return DEFAULTS[key] ?? null;
	}

	/**
	 * 读取用户偏好（泛型版本，自动类型转换）
	 */
	getTyped<T>(key: SettingsKey, fallback: T): T {
		const raw = this.get(key);
		if (raw === null) return fallback;

		if (typeof fallback === "boolean") {
			return (raw === "true") as T;
		}
		if (typeof fallback === "number") {
			const n = Number.parseFloat(raw);
			return (Number.isFinite(n) ? n : fallback) as T;
		}
		return raw as T;
	}

	/**
	 * 设置用户偏好（写入新格式，同时同步写旧格式以兼容内联 script）
	 */
	set(key: SettingsKey, value: unknown): void {
		const strValue = String(value);
		// 写新格式
		this.manager.set(key, strValue);
		// 同步写旧格式，保证 Layout.astro 内联 script 读到最新值
		if (typeof localStorage !== "undefined") {
			try {
				localStorage.setItem(key, strValue);
			} catch { /* 静默 */ }
		}
	}

	/**
	 * 批量设置
	 */
	setAll(entries: Partial<Record<SettingsKey, unknown>>): void {
		for (const [k, v] of Object.entries(entries)) {
			this.set(k, v);
		}
	}

	/**
	 * 删除指定偏好（恢复为默认值）
	 */
	remove(key: SettingsKey): void {
		this.manager.remove(key);
	}

	/**
	 * 获取所有当前生效的偏好快照
	 */
	getAll(): Record<string, string | null> {
		const result: Record<string, string | null> = {};
		for (const key of Object.keys(DEFAULTS)) {
			result[key] = this.get(key);
		}
		return result;
	}

	/**
	 * 清空所有自定义偏好（恢复全部默认）
	 */
	resetAll(): void {
		this.manager.clear();
	}

	// ── 迁移 ──

	/**
	 * 一次性迁移：将旧格式裸 key 的值同步到新格式
	 * 之后裸 key 由 set() 双写保持同步，不再需要额外迁移
	 */
	private migrateLegacyKeys(): void {
		if (typeof localStorage === "undefined") return;
		const migrated = this.manager.get<boolean>("__migrated__");
		if (migrated) return;

		for (const key of MIGRATION_KEYS) {
			try {
				const legacyValue = localStorage.getItem(key);
				if (legacyValue !== null && this.manager.get(key) === null) {
					this.manager.set(key, legacyValue);
				}
			} catch {
				// 静默跳过
			}
		}

		this.manager.set("__migrated__", true);
	}
}

// ─── 便捷工厂函数 ─────────────────────────────────────────────

let _instance: SettingsCache | null = null;

/**
 * 获取全局 SettingsCache 单例
 */
export function getSettingsCache(): SettingsCache {
	if (!_instance) {
		_instance = new SettingsCache();
	}
	return _instance;
}

/**
 * 快捷读取（代理 getSettingsCache().getTyped）
 */
export function getSetting<T>(key: SettingsKey, fallback: T): T {
	return getSettingsCache().getTyped(key, fallback);
}

/**
 * 快捷写入（代理 getSettingsCache().set）
 */
export function setSetting(key: SettingsKey, value: unknown): void {
	getSettingsCache().set(key, value);
}
