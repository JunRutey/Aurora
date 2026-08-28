import type { CommentConfig } from "../types/commentConfig";

export const commentConfig: CommentConfig = {
	// 评论系统类型: "waline" 表示使用 Waline 评论
	type: "waline",

	// Waline 评论系统配置
	waline: {
		serverURL: "https://luoliloli.ccwu.cc/",
		locale: {
			ADMIN: "博主",
			BOTTOM_TIPS: "",
			COMMENT: "评论",
			MORE: "更多",
			PAGEHOLDER: "请写下你的评论...",
			PREVIEW: "预览",
			SUBMIT: "提交",
			SUCCESS: "提交成功！",
		},
		meta: ["nick", "mail", "link"],
		requiredMeta: ["nick", "mail"],
		deep: 3,
		avatar: "mp",
		highlight: true,
		copyright: true,
		recaptchaV3Key: "",
		mathTag: false,
		floating: true,
		avatarDefault: "mp",
		turnout: false,
		emoji: [
			"//unpkg.com/@waline/emojis@1.2.0/qq",
		],
		imageUploader: false,
	},
};
