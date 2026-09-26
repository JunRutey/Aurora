// biome-ignore lint/suspicious/noShadowRestrictedNames: <toString from mdast-util-to-string>
import { toString } from "mdast-util-to-string";

/* 摘要最大长度（按显示宽度计），超出后截断并追加省略号 */
export const EXCERPT_MAX_LENGTH = 150;

/* 中日韩文字/全角标点按 1 计，其余（字母、数字、半角标点）按 0.5 计 */
const FULL_WIDTH_CHAR = /[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;

/** 计算文本的显示宽度，用于让中英文混排的摘要长度观感保持一致 */
function getTextWidth(text) {
	let width = 0;
	for (const char of text) {
		width += FULL_WIDTH_CHAR.test(char) ? 1 : 0.5;
	}
	return width;
}

/**
 * 按显示宽度截断摘要，超出上限时在标点或空格处收尾并追加省略号。
 * 省略号占用的宽度会提前预留，保证最终结果不超过 maxWidth。
 */
function truncateExcerpt(text, maxWidth = EXCERPT_MAX_LENGTH) {
	const trimmed = text.trim();
	if (getTextWidth(trimmed) <= maxWidth) {
		return trimmed;
	}

	// 预留省略号的宽度
	const ellipsisWidth = 1;
	const budget = maxWidth - ellipsisWidth;
	const chars = [...trimmed];
	let width = 0;
	let end = 0;

	for (let i = 0; i < chars.length; i++) {
		const charWidth = FULL_WIDTH_CHAR.test(chars[i]) ? 1 : 0.5;
		if (width + charWidth > budget) {
			end = i;
			break;
		}
		width += charWidth;
		end = i + 1;
	}

	const clipped = chars.slice(0, end).join("");
	// 尽量在标点或空格处断句，避免把词语/句子切成两半
	const boundary = Math.max(
		clipped.lastIndexOf("，"),
		clipped.lastIndexOf("。"),
		clipped.lastIndexOf("；"),
		clipped.lastIndexOf("！"),
		clipped.lastIndexOf("？"),
		clipped.lastIndexOf(" "),
		clipped.lastIndexOf(","),
		clipped.lastIndexOf("."),
	);
	const result =
		boundary >= Math.floor(end * 0.6) ? clipped.slice(0, boundary) : clipped;

	return `${result.trim()}…`;
}

/* Use the post's first paragraph as the excerpt, truncated to a reasonable length */
export function remarkExcerpt() {
	return (tree, { data }) => {
		let excerpt = "";
		for (const node of tree.children) {
			if (node.type !== "paragraph") {
				continue;
			}
			excerpt = toString(node);
			break;
		}
		data.astro.frontmatter.excerpt = truncateExcerpt(excerpt);
	};
}
