import type { AnalyticsConfig } from "../types/analyticsConfig";

export const analyticsConfig: AnalyticsConfig = {
	// Google Analytics ID
	googleAnalyticsId: "",
	// Microsoft Clarity ID
	microsoftClarityId: "",
	// Umami 统计配置
	umamiAnalytics: {
		// Umami Website ID
		websiteId: "12d68a2d-a2c2-44fd-97de-e12455beab58",
		// Umami JS地址，支持使用自建
		scriptUrl: "https://cloud.umami.is/script.js",
		// Umami 会话回放脚本地址，支持使用自建
		replaysScriptUrl: "https://cloud.umami.is/recorder.js",
		// 是否追踪出站链接
		trackOutboundLinks: true,
		// 是否收集浏览器性能指标
		collectWebVitals: false,
		// 会话回放配置
		replays: {
			// 是否启用会话回放
			enabled: false,
			// 录制会话采样率，范围 0-1，例如 0.15 表示记录 15% 的会话
			sampleRate: 0.15,
			// 隐私遮罩级别："moderate" 会遮罩所有输入框；"strict" 额外遮罩页面全部文本
			maskLevel: "moderate",
			// 单次录制最大时长（毫秒）
			maxDuration: 300000,
			// 需要排除录制的元素 CSS 选择器，例如 ".sensitive-widget"
			blockSelector: "",
		},
		// 访问统计显示配置（用于在页面显示累计访问次数和人次）
		stats: {
			// 是否启用访问统计显示
			enabled: true,
			// 显示方式：
			// - "link": 显示"访问统计"链接（免费计划推荐）
			// - "iframe": 嵌入 Share URL（免费计划可用，会显示完整仪表板）
			// - "api": 通过 API 获取数据并显示数字（需要付费计划）
			mode: "iframe",
			// Umami Cloud Share URL（link 和 iframe 模式使用）
			shareUrl: "https://cloud.umami.is/share/Qpo5oYVQZZZsodHO",
			// Umami Cloud API 地址（api 模式使用）
			apiUrl: "https://api.umami.is",
			// Umami API Key（api 模式使用，需要付费计划）
			apiKey: "",
		},
	},
	// 51la 统计配置
	la51Analytics: {
		// 51la 统计 ID
		Id: "",
		// 自定义 SDK JS 地址，防止 DNS 污染，留空使用默认地址
		sdkUrl: "",
		// 多个统计 ID 的数据分离标识，留空则使用 Id
		ck: "",
		// 是否开启事件分析功能
		autoTrack: false,
		//  Hash路由模式, 项目使用History API路由, 所以不必开启默认false
		hashMode: false,
		// 是否开启网站录屏功能
		screenRecord: true,
	},
};
