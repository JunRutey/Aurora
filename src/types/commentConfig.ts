export type CommentConfig = {
	/**
	 * 当前启用的评论系统类型
	 * "none" | "giscus" | "waline"
	 */
	type: "none" | "giscus" | "waline";
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
	waline?: {
		serverURL: string;
		locale?: {
			ADMIN: string;
			BOTTOM_TIPS: string;
			COMMENT: string;
			MORE: string;
			PAGEHOLDER: string;
			PREVIEW: string;
			SUBMIT: string;
			SUCCESS: string;
			[key: string]: string;
		};
		meta?: string[];
		requiredMeta?: string[];
		deep?: number;
		avatar?: string;
		avatarCDN?: string;
		highlight?: boolean;
		highlighter?: string;
		copyright?: boolean;
		recaptchaV3Key?: string;
		mathTag?: boolean;
		floating?: boolean;
		avatarDefault?: string;
		turnout?: boolean;
		emoji?: string[];
		imageUploader?: false;
	};
};
