/**
 * Bilibili 追番数据服务
 *
 * 封装 Bilibili API 调用，标准化输出
 * 数据在构建时获取，通过 Astro 前端传递给 Svelte 组件
 *
 * @author CuteLeaf <xiaye@msn.com>
 */

import type { StandardizedAnime } from "@/types/bilibili";

// ─── 类型 ────────────────────────────────────────────────────

interface BilibiliItem {
	media_id: number;
	title: string;
	cover?: string;
	season_type?: number;
	season_type_name?: string;
	rating?: { score?: number };
	evaluate?: string;
	brief?: string;
	season_id: number;
	new_ep?: { index_show?: string };
}

// ─── 常量 ────────────────────────────────────────────────────

const BILIBILI_API = "https://api.bilibili.com/x/space/bangumi/follow/list";
const PAGE_SIZE = 30;

// ─── 内部方法 ────────────────────────────────────────────────

async function fetchByType(uid: string, type: number): Promise<BilibiliItem[]> {
	const items: BilibiliItem[] = [];

	const firstRes = await fetch(
		`${BILIBILI_API}?type=${type}&vmid=${uid}&pn=1&ps=${PAGE_SIZE}`,
	);
	const firstJson = await firstRes.json();
	if (firstJson.code !== 0 || !firstJson.data?.list?.length) return items;

	items.push(...firstJson.data.list);
	const total = firstJson.data.total || items.length;
	const totalPages = Math.ceil(total / PAGE_SIZE);

	if (totalPages > 1) {
		const promises: Promise<BilibiliItem[]>[] = [];
		for (let pn = 2; pn <= totalPages; pn++) {
			promises.push(
				fetch(
					`${BILIBILI_API}?type=${type}&vmid=${uid}&pn=${pn}&ps=${PAGE_SIZE}`,
				)
					.then((r) => r.json())
					.then((j) => j.data?.list || []),
			);
		}
		const remaining = await Promise.all(promises);
		for (const batch of remaining) {
			items.push(...batch);
		}
	}
	return items;
}

function standardizeItem(item: BilibiliItem): StandardizedAnime {
	return {
		id: item.media_id,
		title: item.title,
		originalTitle: item.title,
		poster: item.cover ? item.cover.replace("http://", "https://") : null,
		type: item.season_type === 2 ? ("movie" as const) : ("tv" as const),
		season_type: item.season_type || 1,
		rating: item.rating?.score || 0,
		date: "",
		overview: item.evaluate || item.brief || "",
		link: `https://www.bilibili.com/bangumi/play/ss${item.season_id}`,
		epStatus: item.new_ep?.index_show || "",
	};
}

// ─── 公开 API ────────────────────────────────────────────────

/**
 * 获取 Bilibili 追番（type=1）+ 追剧（type=2）并标准化
 *
 * 构建时调用，结果嵌入 HTML 传递给 Svelte 组件
 */
export async function fetchBilibiliList(uid: string): Promise<StandardizedAnime[]> {
	const [animeItems, dramaItems] = await Promise.all([
		fetchByType(uid, 1),
		fetchByType(uid, 2),
	]);
	console.log(
		`[Bilibili] Fetched ${animeItems.length + dramaItems.length} items (anime: ${animeItems.length}, drama: ${dramaItems.length}).`,
	);

	return [...animeItems, ...dramaItems].map(standardizeItem);
}
