<div align="center">

# ✨ Aurora

> 基于 [Firefly](https://github.com/CuteLeaf/Firefly) 主题深度定制的个人博客

![Astro](https://img.shields.io/badge/Astro-7.x-orange)
![TypeScript](https://img.shields.io/badge/TypeScript-blue)
![Svelte](https://img.shields.io/badge/Svelte-5-red)
![License](https://img.shields.io/badge/License-MIT-green)

**🌐 [在线访问](https://junrutey.github.io/Aurora/)** | **⚙️ [评论管理](https://luoliloli.ccwu.cc/ui)**

</div>

---

## 📖 说明

本仓库是 **JunRutey** 的个人博客源码，基于 [Firefly](https://github.com/CuteLeaf/Firefly) 主题进行深度二次开发，新增了客户端缓存系统、增量内容同步等底层能力。

> ⚠️ **注意：** 本仓库为个人博客的生产仓库，并非可直接部署的主题模板。代码和配置仅供学习参考。

### 项目关系

```
fuwari (saicaca)
  └─ Firefly (CuteLeaf)
       └─ Aurora (JunRutey) ← 本仓库
```

## ✨ 功能特性

### 🎨 视觉与主题
- 粉蓝渐变主题色（Hue 280）
- 8 张自定义壁纸，支持自动轮播（5.5s 间隔）
- 背景视频（720p H.264）
- 亮色/暗色模式自动切换 + 系统主题跟随
- 全屏壁纸模式 + 模糊渐变效果
- 樱花/水波纹/渐变过渡等视觉特效

### 📦 客户端缓存系统（新增）
自研的模块化三级缓存架构，提升访客体验：

```
┌─ 内存层 (Map) ──────┐  热数据即时访问
├─ localStorage 层 ───┤  持久化 + TTL + 版本淘汰
└─ HTTP Cache API ────┘  静态资源 stale-while-revalidate
```

- **SettingsCache** — 14 个用户偏好的统一管理，支持新旧格式双写兼容
- **ContentCache** — API 内容增量同步（ETag/Last-Modified 条件请求）
- **AssetsCache** — 静态资源 HTTP Cache API 封装
- **加载管线优化** — CacheBootstrap（Head inline）→ CacheInit（Module defer），确保首屏零阻塞

### 🛠️ 技术架构
- **框架：** Astro 7 + Svelte 5 + Tailwind CSS
- **路由：** Swup 单页导航（页面过渡动画）
- **代码高亮：** Expressive Code（行号 + 折叠 + 语言 Logo）
- **构建管线：** 7 步自动化（GitHub Card → LQIP → VNDB 封面 → 构建 → 资源裁剪 → 字体子集 → 内联脚本压缩 → Pagefind 搜索）

### 📝 内容功能
- Markdown / MDX 文章支持
- Obsidian 风格 Wiki Link（自动解析为文章卡片）
- 加密文章（AES-256-GCM，密码缓存到 sessionStorage）
- GitHub Repo 卡片（构建期静态数据 + 运行时 API 增量更新）
- 本地音乐播放器
- 书签导航与相册
- Memos 动态（增量同步）
- Pagefind 本地搜索
- RSS 订阅

## 🚀 快速开始

```bash
# 安装依赖
pnpm install

# 本地开发
pnpm dev

# 构建
pnpm build

# 预览构建结果
pnpm preview
```

## 🚀 部署信息

### 托管平台
- **博客托管：** [GitHub Pages](https://pages.github.com) — 静态网站托管
- **评论系统：** [Waline](https://github.com/walinejs/waline) — 匿名评论系统，支持 Markdown
- **评论托管：** [Vercel](https://vercel.com) — Waline 服务端部署
- **评论数据库：** [Neon](https://neon.tech) — Serverless PostgreSQL 数据库
- **二级域名：** [DNSHE](https://github.com/dnshe/DNSHE-FreeDomains) — 免费二级域名服务
- **DNS 托管：** [Cloudflare](https://www.cloudflare.com) — DNS 解析与安全防护

### 访问地址
- **博客主页：** https://junrutey.github.io/Aurora/
- **评论服务：** https://luoliloli.ccwu.cc/
- **评论管理面板：** https://luoliloli.ccwu.cc/ui

## 🙏 致谢

- [**fuwari**](https://github.com/saicaca/fuwari) by [saicaca](https://github.com/saicaca) — 上游模板
- [**Firefly**](https://github.com/CuteLeaf/Firefly) by [CuteLeaf](https://github.com/CuteLeaf) — 博客主题
- [**Waline**](https://github.com/walinejs/waline) — 匿名评论系统，为博客提供评论功能
- [**DNSHE**](https://github.com/dnshe/DNSHE-FreeDomains) — 免费二级域名服务，提供域名支持
- [**Astro**](https://astro.build) — 静态站点生成框架
- [**Svelte**](https://svelte.dev) — UI 组件框架
- [**Tailwind CSS**](https://tailwindcss.com) — CSS 工具类框架

## 📝 许可证

基于 [MIT License](https://mit-license.org/) 开源。

```
MIT License

Copyright (c) 2024 saicaca - fuwari
Copyright (c) 2025 CuteLeaf - Firefly
Copyright (c) 2026 JunRutey - Aurora
```

---

<div align="center">

**Made with ❤️ by [JunRutey](https://github.com/JunRutey)**

</div>
