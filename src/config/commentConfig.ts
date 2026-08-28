import type { CommentConfig } from "../types/commentConfig";

export const commentConfig: CommentConfig = {
	// 评论系统类型: 仅保留 Giscus (GitHub 登录评论)
	type: "giscus",

	// Giscus 评论系统配置
	giscus: {
		repo: "JunRutey/Aurora",
		repoId: "R_kgDOUE3-mg",
		category: "Announcements",
		categoryId: "DIC_kwDOUE3-ms4DETD9",
		mapping: "pathname",
		strict: "0",
		reactionsEnabled: "1",
		emitMetadata: "0",
		inputPosition: "top",
		lang: "zh-CN",
		loading: "lazy",
	},
};
