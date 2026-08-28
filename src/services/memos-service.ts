/**
 * Memos 数据服务
 *
 * 合并 memos-adapter（数据转换） + ContentCache（缓存/ETag增量同步）
 * UI 层唯一入口：import { fetchMemos } from "@/services"
 *
 * @author CuteLeaf <xiaye@msn.com>
 */

import { Marked } from "marked";
import { getContentCache } from "@/cache/content-cache";

// ─── 类型 ────────────────────────────────────────────────────

interface MemoAttachment {
	name: string;
	filename: string;
	type: string;
	externalLink: string;
}

interface MemoLocation {
	placeholder?: string;
}

interface Memo {
	name: string;
	state: string;
	creator: string;
	createTime: string;
	updateTime: string;
	content: string;
	visibility: string;
	pinned: boolean;
	attachments: MemoAttachment[];
	location?: MemoLocation;
}

export interface DynamicImage {
	alt: string;
	src: string;
	title?: string;
}

export interface DynamicEntry {
	id: string;
	published: number;
	html: string;
	images: DynamicImage[];
	searchText: string;
	pinned?: boolean;
	location?: string;
}

// ─── Markdown 渲染 ───────────────────────────────────────────

const memosMarked = new Marked({ gfm: true, breaks: true });
memosMarked.use({
	renderer: {
		link({ href, title, tokens }) {
			const text = this.parser.parseInline(tokens);
			const titleAttr = title ? ` title="${title}"` : "";
			return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
		},
		image() {
			return "";
		},
	},
});

function markdownToHtml(markdown: string): string {
	return memosMarked.parse(markdown) as string;
}

function extractPlainText(content: string): string {
	return content
		.replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/<[^>]+>/g, " ")
		.replace(/[#>*_`~[\]()-]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function extractImages(memo: Memo, memosApiUrl: string): DynamicImage[] {
	const images: DynamicImage[] = [];

	const tokens = memosMarked.lexer(memo.content);
	memosMarked.walkTokens(tokens, (token) => {
		if (token.type !== "image") return;
		let src = token.href;
		if (!src.startsWith("http") && !src.startsWith("//")) {
			src = `${memosApiUrl}${src.startsWith("/") ? "" : "/"}${src}`;
		}
		images.push({
			alt: token.text || "",
			src,
			title: token.title || undefined,
		});
	});

	if (memo.attachments) {
		for (const attachment of memo.attachments) {
			if (attachment.type.startsWith("image/")) {
				const attachmentId = attachment.name.split("/").pop() || "";
				const src =
					attachment.externalLink ||
					`${memosApiUrl}/file/attachments/${attachmentId}/${attachment.filename}`;
				images.push({
					alt: attachment.filename,
					src,
					title: attachment.filename,
				});
			}
		}
	}

	return images;
}

// ─── 数据转换 ─────────────────────────────────────────────────

function transformMemos(rawMemos: Memo[], memosApiUrl: string): DynamicEntry[] {
	return rawMemos
		.filter((memo) => memo.state === "NORMAL")
		.map((memo) => {
			const id = memo.name.split("/").pop() || "";
			const published = new Date(memo.createTime).getTime();
			const html = markdownToHtml(memo.content);
			const images = extractImages(memo, memosApiUrl);
			const location = memo.location?.placeholder?.trim() || "";
			const searchText = [extractPlainText(memo.content), location]
				.filter(Boolean)
				.join(" ")
				.toLocaleLowerCase();
			const pinned = memo.pinned || false;

			return { id, published, html, images, searchText, pinned, location };
		})
		.sort((a, b) => {
			if (a.pinned && !b.pinned) return -1;
			if (!a.pinned && b.pinned) return 1;
			return b.published - a.published;
		});
}

function filterByCreator(memos: Memo[], parent?: string): Memo[] {
	if (!parent) return memos;
	return memos.filter((memo) => memo.creator === parent);
}

// ─── 公开 API ────────────────────────────────────────────────

/**
 * 获取 Memos 动态数据
 *
 * 通过 ContentCache 实现：
 * - 首次：全量拉取 → 缓存 → 返回
 * - 后续：先返回旧缓存 + 后台 ETag 条件请求更新
 * - 过期：同步等待最新数据
 */
export async function fetchMemos(
	memosApiUrl: string,
	options?: { pageSize?: number; maxPages?: number; parent?: string; forceRefresh?: boolean },
): Promise<DynamicEntry[]> {
	const cache = getContentCache();

	return cache.fetchMemos<DynamicEntry>(
		memosApiUrl,
		options,
		(rawMemos: unknown[]) => {
			const filtered = filterByCreator(rawMemos as Memo[], options?.parent);
			return transformMemos(filtered, memosApiUrl);
		},
	);
}
