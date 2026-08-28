/**
 * MyAnimeList 数据服务
 *
 * 封装 MAL API 调用，分页逻辑由调用方控制
 * 数据在构建时获取，通过 Astro 前端传递给 Svelte 组件
 *
 * @author CuteLeaf <xiaye@msn.com>
 */

import type { MalListItem, MalListResponse } from "@/types/mal";

// ─── 类型 ────────────────────────────────────────────────────

export type MalListKind = "anime" | "manga";

export type MalFetchOptions = {
	apiUrl: string;
	username: string;
	clientId: string;
	kind?: MalListKind;
	limit: number;
	offset: number;
};

/** MAL 分类（UI 层用于渲染分类网格） */
export interface MalCategory {
	id: MalListKind;
	name: string;
	count: number;
	items: MalListItem[];
}

// ─── 字段声明 ────────────────────────────────────────────────

export const MAL_ANIME_FIELDS: string = [
	"id",
	"title",
	"main_picture",
	"alternative_titles",
	"mean",
	"media_type",
	"num_episodes",
	"genres",
	"start_season",
	"status",
	"list_status{status,score,num_episodes_watched,is_rewatching,updated_at,start_date,finish_date,comments}",
].join(",");

export const MAL_MANGA_FIELDS: string = [
	"id",
	"title",
	"main_picture",
	"alternative_titles",
	"mean",
	"media_type",
	"num_chapters",
	"num_volumes",
	"genres",
	"start_date",
	"status",
	"list_status{status,score,num_chapters_read,num_volumes_read,is_rereading,updated_at,start_date,finish_date,comments}",
].join(",");

// ─── 公开 API ────────────────────────────────────────────────

/**
 * 获取一页 MAL 列表数据
 *
 * 调用方通过 limit/offset 控制分页，自行处理循环和延迟
 */
export async function fetchMalList(options: MalFetchOptions): Promise<MalListResponse> {
	const kind = options.kind === "manga" ? "manga" : "anime";
	const endpoint = kind === "manga" ? "mangalist" : "animelist";
	const fields = kind === "manga" ? MAL_MANGA_FIELDS : MAL_ANIME_FIELDS;
	const params = new URLSearchParams({
		fields,
		limit: String(options.limit),
		offset: String(options.offset),
	});

	const response = await fetch(
		`${options.apiUrl}/users/${encodeURIComponent(options.username)}/${endpoint}?${params.toString()}`,
		{
			headers: {
				"X-MAL-CLIENT-ID": options.clientId,
				Accept: "application/json",
			},
		},
	);

	if (!response.ok) {
		throw new Error(`[MAL] 无法获取数据 (状态码: ${response.status})`);
	}

	return (await response.json()) as MalListResponse;
}
