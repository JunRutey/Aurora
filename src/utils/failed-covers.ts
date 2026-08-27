/**
 * 封面加载失败的本地缓存（用于跳过已知失败的图片）
 *
 * 已迁移到客户端缓存系统 (src/cache/)
 * @author CuteLeaf <xiaye@msn.com>
 */

import { getContentCache } from "@/cache/content-cache";

/**
 * 获取失败封面图 URL 集合
 * @param key 缓存 key（保留参数以兼容调用方，实际已忽略）
 */
export function getFailedCovers(_key?: string): Set<string> {
	try {
		return getContentCache().getFailedCovers();
	} catch {
		return new Set();
	}
}

/**
 * 记录失败的封面图 URL（最多保留 200 条）
 * @param url 失败的图片 URL
 * @param _key 保留参数（兼容调用方，实际已忽略）
 */
export function markCoverFailed(url: string, _key?: string): void {
	try {
		getContentCache().addFailedCover(url);
	} catch {
		// 静默忽略
	}
}
