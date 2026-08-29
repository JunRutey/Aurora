<div align="center">

# ✨ Aurora

> 基于 [Firefly](https://github.com/CuteLeaf/Firefly) 主题深度定制的个人博客

![Astro](https://img.shields.io/badge/Astro-7.x-orange)
![TypeScript](https://img.shields.io/badge/TypeScript-blue)
![Svelte](https://img.shields.io/badge/Svelte-5-red)
![Node](https://img.shields.io/badge/Node.js-24+-green)
![License](https://img.shields.io/badge/License-MIT-green)

**🌐 [在线访问](https://lolicute.ccwu.cc/)**

</div>

---

## 📖 说明

本仓库是 **JunRutey** 的个人博客源码，基于 [Firefly](https://github.com/CuteLeaf/Firefly) 主题进行深度二次开发，新增了客户端缓存系统、模块化内容管线、以及本地化的文章编辑后台。

> ⚠️ **注意：** 本仓库为个人博客的生产仓库，并非可直接部署的主题模板。代码和配置仅供学习参考。

### 项目关系

```
fuwari (saicaca)
  └─ Firefly (CuteLeaf)
       └─ Aurora (JunRutey) ← 本仓库
```

---

## 🏗️ 模块化核心框架

本项目围绕 Astro 构建管线，实现了一套模块化内容处理架构，核心能力分布如下：

### 内容管线（Content Pipeline）

```
源码 Content/
  ├─ posts/          文章（Markdown + MDX）
  ├─ notes/          随笔（Memos 同步）
  ├─ bookmarks/      书签导航
  ├─ photo/          相册
  └─ wiki/           知识库（Obsidian Wiki Link）
```

每个内容类型都经过统一的 7 步构建管线：

```
Step 1  GitHub Card ─── 仓库卡片静态数据提取
Step 2  LQIP ───────── 低质量图片占位符生成
Step 3  VNDB Cover ─── 视觉小说封面自动抓取
Step 4  Astro Build ── 静态站点生成
Step 5  Asset Trim ── 图片资源无损压缩
Step 6  Font Subset ─ 中文字体子集化
Step 7  Inline JS ─── 内联脚本压缩 + Pagefind 搜索索引
```

### 客户端缓存架构

自研三级缓存体系，提升访客体验：

```
┌─ 内存层 (Map) ──────┐  热数据即时访问
├─ localStorage 层 ───┤  持久化 + TTL + 版本淘汰
└─ HTTP Cache API ────┘  静态资源 stale-while-revalidate
```

- **SettingsCache** — 14 个用户偏好的统一管理，支持新旧格式双写兼容
- **ContentCache** — API 内容增量同步（ETag/Last-Modified 条件请求）
- **AssetsCache** — 静态资源 HTTP Cache API 封装
- **CacheBootstrap** — Head inline 脚本，确保首屏零阻塞

---

## ⚙️ 文章编辑后台（Admin Server）

本地化的文章编辑与预览系统，用于管理博客内容。编辑保存后自动执行 Git commit + push。

### 架构

```
admin-server/
├─ server.js       主服务（Express，单文件）
├─ package.json    依赖声明
└─ README.md       详细部署文档
```

- **运行时：** Node.js 18+ / Express
- **认证：** 无（仅限本地使用，勿暴露至公网）
- **端口：** `3000`（可通过环境变量 `PORT` 修改）
- **工作目录：** 从服务器启动目录向上两级，即仓库根目录

### 功能概览

| 模块 | 路径 | 说明 |
|---|---|---|
| 文章列表 | `GET /` | 展示所有文章，支持编辑/删除 |
| 新建文章 | `GET /new` | Markdown 编辑器 + 实时预览 |
| 编辑文章 | `GET /edit?slug=xxx` | 加载已有文章进行编辑 |
| 保存推送 | `POST /api/post` | 保存文章并自动 git commit + push |
| 删除文章 | `DELETE /api/post/:slug` | 删除文章并自动 git commit + push |

### 本地部署（详细步骤）

#### 前置条件

- [Node.js](https://nodejs.org) 18 或更高版本
- Git（用于克隆仓库）

#### 步骤 1：克隆仓库

```bash
git clone https://github.com/AsteriskIT/Aurora.git
cd Aurora
```

#### 步骤 2：安装博客前端依赖

博客主站使用 pnpm 作为包管理器：

```bash
pnpm install
```

#### 步骤 3：安装后台编辑系统的依赖

```bash
cd admin-server
npm install
```

> `npm install` 会读取 `package.json`，自动安装 `express`、`cors`、`gray-matter`、`simple-git` 等依赖。

#### 步骤 4：启动后台服务

```bash
# 确保在 admin-server 目录下
node server.js
```

看到以下输出表示启动成功：

```
📌 当前 Git 分支: main

🚀 Aurora 后台已启动
   地址: http://localhost:3000
   文章目录: C:\Users\xxx\...\Aurora\src\content\posts
```

#### 步骤 5：访问管理界面

打开浏览器访问：

```
http://localhost:3000
```

> ⚠️ 此后台无登录验证，仅限本地使用。请勿将其暴露至公网环境。

#### 环境变量（可选）

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3000` | 服务端口 |

启动时可传入环境变量：

```bash
# Windows PowerShell
$env:PORT=8080; node server.js

# Linux / macOS
PORT=8080 node server.js
```

---

## 🎨 功能特性

### 🖼️ 视觉与主题
- 粉蓝渐变主题色（Hue 280）
- 8 张自定义壁纸，支持自动轮播（5.5s 间隔）
- 背景视频（720p H.264）
- 亮色/暗色模式自动切换 + 系统主题跟随
- 全屏壁纸模式 + 模糊渐变效果
- 樱花/水波纹/渐变过渡等视觉特效

### 🛠️ 技术栈
- **框架：** Astro 7 + Svelte 5 + Tailwind CSS
- **路由：** Swup 单页导航（页面过渡动画）
- **代码高亮：** Expressive Code（行号 + 折叠 + 语言 Logo）
- **后台系统：** Node.js + Express + simple-git

### 📝 内容功能
- Markdown / MDX 文章支持
- Obsidian 风格 Wiki Link（自动解析为文章卡片）
- 加密文章（AES-256-GCM，密码缓存到 sessionStorage）
- GitHub Repo 卡片（构建期静态数据 + 运行时 API 增量更新）
- 本地音乐播放器
- 书签导航
- 博客相册（持续完善中）
- Memos 动态（增量同步）
- Pagefind 本地搜索
- RSS 订阅

### 📊 访问统计
- **Umami** — 隐私优先的访客分析系统
- **不蒜子** — 轻量级访问量展示（总访问量 / 总访客数）

---

## 🚀 博客前端启动

```bash
# 安装依赖（首次需要）
pnpm install

# 本地开发
pnpm dev

# 构建
pnpm build

# 预览构建结果
pnpm preview
```

---

## 🌐 部署信息

### 托管平台
- **博客托管：** [Vercel](https://vercel.com) — 静态网站托管与部署
- **评论系统：** [Waline](https://github.com/walinejs/waline) — 匿名评论系统，支持 Markdown
- **评论托管：** [Vercel](https://vercel.com) — Waline 服务端部署
- **评论数据库：** [Neon](https://neon.tech) — Serverless PostgreSQL 数据库
- **访客分析：** [Umami](https://umami.is) — 隐私优先的网站分析平台
- **访问统计：** [不蒜子](https://busuanzi.ibruce.info) — 免费网页计数器
- **二级域名：** [DNSHE](https://github.com/dnshe/DNSHE-FreeDomains) — 免费二级域名服务
- **DNS 托管：** [Cloudflare](https://www.cloudflare.com) — DNS 解析与安全防护

### 访问地址
- **博客主页：** https://lolicute.ccwu.cc/
- **评论服务：** https://luoliloli.ccwu.cc/
- **评论管理面板：** https://luoliloli.ccwu.cc/ui
- **Umami 仪表板：** https://cloud.umami.is/share/Qpo5oYVQZZZsodHO

---

## 🙏 致谢

### 主题与模板
- [**fuwari**](https://github.com/saicaca/fuwari) by [saicaca](https://github.com/saicaca) — 上游模板
- [**Firefly**](https://github.com/CuteLeaf/Firefly) by [CuteLeaf](https://github.com/CuteLeaf) — 博客主题

### 评论系统
- [**Waline**](https://github.com/walinejs/waline) — 匿名评论系统

### 访问统计
- [**Umami**](https://github.com/umami-software/umami) — 隐私优先的网站分析平台
- [**不蒜子**](https://busuanzi.ibruce.info) — 免费网页计数器

### 技术栈
- [**Astro**](https://astro.build) — 静态站点生成框架
- [**Svelte**](https://svelte.dev) — UI 组件框架
- [**Tailwind CSS**](https://tailwindcss.com) — CSS 工具类框架

### 服务与托管
- [**Vercel**](https://vercel.com) — 部署与托管平台
- [**Neon**](https://neon.tech) — Serverless PostgreSQL 数据库
- [**Cloudflare**](https://www.cloudflare.com) — DNS 解析与 CDN
- [**DNSHE**](https://github.com/dnshe/DNSHE-FreeDomains) — 免费二级域名服务

---

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
