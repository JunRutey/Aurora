import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { siteConfig } from "@/config";
import { getAllPosts } from "@/utils/content-utils";
import { formatDateI18nWithTime } from "@/utils/date";
import { url } from "@/utils/url-utils";
import i18nKey from "../i18n/i18nKey";
import { i18n } from "../i18n/translation";
import pkg from "../../package.json";

export async function GET(context: APIContext) {
	const posts = await getAllPosts();
	return rss({
		title: siteConfig.title,
		description: siteConfig.description,
		site: siteConfig.site_url,
		items: posts.map((post) => ({
			title: post.data.title,
			pubDate: post.data.published,
			description: post.data.description || "",
			link: url(`${post.id}/`),
		})),
		customData: `<language>zh-cn</language>
		<atom:link href="${siteConfig.site_url}/rss.xml" rel="self" type="application/rss+xml" />
		<image>
			<url>${siteConfig.site_url}/favicon/firefly-32.png</url>
			<title>${siteConfig.title}</title>
			<link>${siteConfig.site_url}</link>
		</image>
		<generator>${i18n(i18nKey.rssWhatIsRSS)}</generator>
		<templateThemeVersion>${pkg.version}</templateThemeVersion>
		<templateThemeUrl>https://github.com/CuteLeaf/Firefly</templateThemeUrl>
		<lastBuildDate>${formatDateI18nWithTime(new Date())}</lastBuildDate>`,
	});
}
