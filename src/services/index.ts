/**
 * 服务层统一入口
 *
 * UI 层（Svelte / Astro）只从这里导入数据获取函数
 * 不直接访问 utils/*-utils.ts 中的数据获取函数
 *
 * @example
 * ```ts
 * import { fetchMemos } from "@/services";
 * import { fetchBilibiliList } from "@/services";
 * import { fetchMalList, type MalCategory } from "@/services";
 * import { fetchVndbUlist } from "@/services";
 * ```
 *
 * @author CuteLeaf <xiaye@msn.com>
 */

export { fetchMemos } from "./memos-service";
export type { DynamicEntry, DynamicImage } from "./memos-service";

export { fetchBilibiliList } from "./bilibili-service";

export { fetchMalList, MAL_ANIME_FIELDS, MAL_MANGA_FIELDS } from "./mal-service";
export type { MalFetchOptions, MalListKind, MalCategory } from "./mal-service";

export { fetchVndbUlist } from "./vndb-service";
export type { VndbUlistFetchOptions } from "./vndb-service";
