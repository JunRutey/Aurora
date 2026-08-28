# Aurora 后台管理系统

本地运行的博客文章管理工具，提供 Web 界面创建、编辑、删除文章，自动执行 Git 提交和推送。

## 快速开始

```bash
cd admin-server
npm install
npm start
```

浏览器访问 http://localhost:3000

## 功能

- 📝 文章列表：查看所有文章，按日期排序
- ✏️ 新建/编辑：表单填写标题、标签、日期，支持 Markdown 编辑和实时预览
- 🗑️ 删除：一键删除文章
- 🔄 自动推送：保存/删除后自动 `git add → commit → push`

## Frontmatter 字段

| 字段 | 说明 | 默认值 |
|------|------|--------|
| `title` | 标题（必填） | — |
| `published` | 发布日期 | 今天 |
| `draft` | 草稿状态 | false |
| `pinned` | 置顶 | false |
| `description` | 描述/摘要 | "" |
| `tags` | 标签数组 | [] |
| `category` | 分类 | "" |
| `image` | 封面图片路径 | "" |
| `author` | 作者 | "" |
| `lang` | 语言 | "" |
| `comment` | 开启评论 | true |
| `sourceLink` | 来源链接 | "" |
| `licenseName` | 授权名称 | "" |
| `licenseUrl` | 授权链接 | "" |
| `password` | 密码保护 | "" |
| `passwordHint` | 密码提示 | "" |

## 技术栈

- Express + CORS
- gray-matter（Frontmatter 解析）
- simple-git（Git 操作）
