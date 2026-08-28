/**
 * VNDB 视觉小说数据服务
 *
 * 封装 VNDB API 调用，分页逻辑由调用方控制
 * 支持构建时获取（static 模式）和客户端获取（dynamic 模式）
 *
 * @author CuteLeaf <xiaye@msn.com>
 */

import type { VndbUlistResponse } from "@/types/vndb";

// ─── 类型 ────────────────────────────────────────────────────

export type VndbUlistFetchOptions = {
	apiUrl: string;
	userId: string;
	apiToken?: string;
	results: number;
	page: number;
};

// ─── 常量 ────────────────────────────────────────────────────

const VNDB_ULIST_FIELDS: string = [
	"id",
	"vote",
	"notes",
	"started",
	"finished",
	"labels{label}",
	"vn{id,title,alttitle,released,languages,platforms,image{url,thumbnail,sexual,violence},rating,votecount,length,length_minutes,developers{name},tags{name}}",
].join(",");

const VNDB_TAGS_TO_KEEP = 3;

// ─── 公开 API ────────────────────────────────────────────────

/**
 * 获取一页 VNDB 用户列表数据
 *
 * 调用方通过 results/page 控制分页，自行处理循环和延迟
 */
export async function fetchVndbUlist(
	options: VndbUlistFetchOptions,
): Promise<VndbUlistResponse> {
	const headers: Record<string, string> = {
		Accept: "application/json",
		"Content-Type": "application/json",
	};
	if (options.apiToken) {
		headers.Authorization = `Token ${options.apiToken}`;
	}

	const response = await fetch(`${options.apiUrl}/ulist`, {
		method: "POST",
		headers,
		body: JSON.stringify({
			user: options.userId,
			fields: VNDB_ULIST_FIELDS,
			results: options.results,
			page: options.page,
		}),
	});

	if (!response.ok) {
		throw new Error(`[VNDB] 无法获取数据 (状态码: ${response.status})`);
	}

	const data = (await response.json()) as VndbUlistResponse;
	return {
		...data,
		results: data.results.map((item) => {
			const tagNames = (item.vn?.tags || [])
				.map((tag) => tag.name)
				.filter(Boolean);
			return {
				...item,
				labels: (item.labels || []).map(({ label }) => ({ label })),
				vn: {
					...item.vn,
					developers: (item.vn?.developers || []).map(({ name }) => ({ name })),
					tags: tagNames.slice(0, VNDB_TAGS_TO_KEEP).map((name) => ({ name })),
					tagCount: tagNames.length,
				},
			};
		}),
	};
}
