export type CommentConfig = {
	/**
	 * 当前启用的评论系统类型
	 * "none" | "giscus"
	 */
	type: "none" | "giscus";
	giscus?: {
		repo: string;
		repoId: string;
		category: string;
		categoryId: string;
		mapping: string;
		strict: string;
		reactionsEnabled: string;
		emitMetadata: string;
		inputPosition: string;
		lang: string;
		loading: string;
	};
};
