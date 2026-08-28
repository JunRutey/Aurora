import type { APIContext } from "astro";
import { siteConfig } from "@/config";
import { getSortedPosts } from "@/utils/content-utils";
import { formatDateI18nWithTime } from "@/utils/date-utils";
import { url } from "@/utils/url-utils";

export async function GET(context: APIContext) {
	const posts = await getSortedPosts();

	const items = posts
		.map(
			(post) => `
	<item>
		<title><![CDATA[${post.data.title}]]></title>
		<link>${siteConfig.site_url}${url(`${post.id}/`)}</link>
		<guid isPermaLink="true">${siteConfig.site_url}${url(`${post.id}/`)}</guid>
		<pubDate>${new Date(post.data.published).toUTCString()}</pubDate>
		<description><![CDATA[${post.data.description || ""}]]></description>
	</item>`,
		)
		.join("");

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
	<channel>
		<title>${siteConfig.title}</title>
		<description>${siteConfig.description}</description>
		<link>${siteConfig.site_url}/</link>
		<language>zh-cn</language>
		<atom:link href="${siteConfig.site_url}/rss.xml" rel="self" type="application/rss+xml" />
		<image>
			<url>${siteConfig.site_url}/favicon/firefly-32.png</url>
			<title>${siteConfig.title}</title>
			<link>${siteConfig.site_url}</link>
		</image>
		<lastBuildDate>${formatDateI18nWithTime(new Date())}</lastBuildDate>
		${items}
	</channel>
</rss>`;

	return new Response(xml, {
		headers: {
			"Content-Type": "application/rss+xml; charset=utf-8",
		},
	});
}
