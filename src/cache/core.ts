/**
 * 客户端缓存系统 — 核心管理器
 *
 * 三级缓存: 内存 (Map) → localStorage → 按需穿透
 * 职责: TTL 管理、schema 版本淘汰、存储抽象、事件通知
 *
 * @author CuteLeaf <xiaye@msn.com>
 */

import type { CacheConfig, CacheEntry, CacheEvents } from "./types";

type EventHandler<K extends keyof CacheEvents> = (payload: CacheEvents[K]) => void;

// ─── 默认配置 ─────────────────────────────────────────────────

export const DEFAULT_CONFIG: CacheConfig = {
	version: 1,
	keyPrefix: "ff:",
	defaultTTL: 0, // 默认永不过期
};

// ─── 核心类 ───────────────────────────────────────────────────

export class CacheManager {
	private memory = new Map<string, unknown>();
	private config: Required<CacheConfig>;
	private listeners = new Map<string, Set<Function>>();

	constructor(config?: Partial<CacheConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		// 启动时清理版本不匹配的旧数据
		this.pruneStaleVersion();
	}

	// ── 事件 ──

	on<K extends keyof CacheEvents>(event: K, handler: EventHandler<K>): void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)!.add(handler);
	}

	private emit<K extends keyof CacheEvents>(event: K, payload: CacheEvents[K]): void {
		this.listeners.get(event)?.forEach((fn) => fn(payload));
	}

	// ── 存储抽象 ──

	private storageKey(key: string): string {
		return `${this.config.keyPrefix}${this.config.version}:${key}`;
	}

	private readStorage<T>(key: string): CacheEntry<T> | null {
		if (typeof localStorage === "undefined") return null;
		try {
			const raw = localStorage.getItem(this.storageKey(key));
			if (!raw) return null;
			return JSON.parse(raw) as CacheEntry<T>;
		} catch {
			return null;
		}
	}

	private writeStorage<T>(key: string, entry: CacheEntry<T>): void {
		if (typeof localStorage === "undefined") return;
		try {
			localStorage.setItem(this.storageKey(key), JSON.stringify(entry));
		} catch {
			// 配额不足时尝试 LRU 淘汰：删除最旧的 20% 非核心条目
			this.evictOldest(0.2);
			try {
				localStorage.setItem(this.storageKey(key), JSON.stringify(entry));
			} catch {
				// 仍然失败则静默放弃
			}
		}
	}

	private removeStorage(key: string): void {
		if (typeof localStorage === "undefined") return;
		localStorage.removeItem(this.storageKey(key));
	}

	// ── 核心 API ──

	/**
	 * 读取缓存，三级查找: memory → localStorage → null
	 * 如果配置了 TTL，过期条目会被自动淘汰
	 */
	get<T>(key: string, ttl = this.config.defaultTTL): T | null {
		// 1. 内存命中
		if (this.memory.has(key)) {
			this.emit("hit", { key, layer: "memory" });
			return this.memory.get(key) as T;
		}

		// 2. localStorage 命中
		const entry = this.readStorage<T>(key);
		if (!entry) return null;

		// TTL 检查
		if (ttl > 0 && Date.now() - entry.fetchedAt >= ttl) {
			this.remove(key);
			this.emit("evict", { key, reason: "ttl" });
			return null;
		}

		// 恢复到内存层
		this.memory.set(key, entry.data);
		this.emit("hit", { key, layer: "storage" });
		return entry.data;
	}

	/**
	 * 写入缓存，同时写入内存和 localStorage
	 */
	set<T>(key: string, data: T, ttl = this.config.defaultTTL): void {
		const entry: CacheEntry<T> = {
			data,
			fetchedAt: Date.now(),
			version: this.config.version,
		};

		this.memory.set(key, data);
		this.writeStorage(key, entry);

		this.emit("set", { key, size: JSON.stringify(data).length });
	}

	/**
	 * 读取元数据（fetchedAt 等），不恢复数据到内存
	 */
	getMeta(key: string): { fetchedAt: number; version: number } | null {
		const entry = this.readStorage(key);
		if (!entry) return null;
		return { fetchedAt: entry.fetchedAt, version: entry.version };
	}

	/**
	 * 删除单个缓存条目
	 */
	remove(key: string): void {
		this.memory.delete(key);
		this.removeStorage(key);
	}

	/**
	 * 按前缀批量删除
	 */
	removeByPrefix(prefix: string): void {
		const fullPrefix = `${this.config.keyPrefix}${this.config.version}:${prefix}`;
		// 清理内存
		for (const k of this.memory.keys()) {
			if (k.startsWith(prefix)) this.memory.delete(k);
		}
		// 清理 localStorage
		if (typeof localStorage === "undefined") return;
		const keysToRemove: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i);
			if (k?.startsWith(fullPrefix)) keysToRemove.push(k);
		}
		keysToRemove.forEach((k) => localStorage.removeItem(k));
	}

	/**
	 * 清空全部缓存（保留指定前缀）
	 */
	clear(keepPrefixes: string[] = []): void {
		const fullPrefixes = keepPrefixes.map(
			(p) => `${this.config.keyPrefix}${this.config.version}:${p}`,
		);
		if (typeof localStorage !== "undefined") {
			const keysToRemove: string[] = [];
			for (let i = 0; i < localStorage.length; i++) {
				const k = localStorage.key(i);
				if (k?.startsWith(this.config.keyPrefix)) {
					if (!fullPrefixes.some((p) => k.startsWith(p))) {
						keysToRemove.push(k);
					}
				}
			}
			keysToRemove.forEach((k) => localStorage.removeItem(k));
		}
		this.memory.clear();
	}

	/**
	 * 返回缓存统计信息（用于调试）
	 */
	stats(): { memoryKeys: number; storageKeys: number; storageBytes: number } {
		let storageBytes = 0;
		let storageKeys = 0;
		if (typeof localStorage !== "undefined") {
			const prefix = `${this.config.keyPrefix}${this.config.version}:`;
			for (let i = 0; i < localStorage.length; i++) {
				const k = localStorage.key(i);
				if (k?.startsWith(prefix)) {
					storageKeys++;
					storageBytes += localStorage.getItem(k)?.length ?? 0;
				}
			}
		}
		return {
			memoryKeys: this.memory.size,
			storageKeys,
			storageBytes,
		};
	}

	// ── 内部工具 ──

	/**
	 * LRU 式淘汰：按 fetchedAt 排序，删除最旧的 ratio 比例条目
	 */
	private evictOldest(ratio: number): void {
		if (typeof localStorage === "undefined") return;
		const prefix = `${this.config.keyPrefix}${this.config.version}:`;
		const entries: { key: string; fetchedAt: number }[] = [];

		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i);
			if (!k?.startsWith(prefix)) continue;
			try {
				const parsed = JSON.parse(localStorage.getItem(k) || "");
				if (parsed?.fetchedAt) {
					entries.push({ key: k, fetchedAt: parsed.fetchedAt });
				}
			} catch {
				// 解析失败的直接标记删除
				entries.push({ key: k, fetchedAt: 0 });
			}
		}

		entries.sort((a, b) => a.fetchedAt - b.fetchedAt);
		const count = Math.max(1, Math.ceil(entries.length * ratio));
		for (let i = 0; i < count; i++) {
			localStorage.removeItem(entries[i].key);
			const dataKey = entries[i].key.slice(prefix.length).replace(/^[^:]+:/, "");
			this.memory.delete(dataKey);
			this.emit("evict", { key: dataKey, reason: "quota" });
		}
	}

	/**
	 * 启动时淘汰 schema 版本不匹配的旧数据
	 */
	private pruneStaleVersion(): void {
		if (typeof localStorage === "undefined") return;
		const prefix = `${this.config.keyPrefix}`;
		const keysToRemove: string[] = [];

		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i);
			if (!k?.startsWith(prefix)) continue;
			// 格式: ff:{version}:{key} — 提取 version
			const afterPrefix = k.slice(prefix.length);
			const colonIdx = afterPrefix.indexOf(":");
			if (colonIdx === -1) continue;
			const storedVersion = Number.parseInt(afterPrefix.slice(0, colonIdx), 10);
			if (storedVersion !== this.config.version) {
				keysToRemove.push(k);
			}
		}

		keysToRemove.forEach((k) => localStorage.removeItem(k));
	}
}
