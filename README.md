<div align="center">

# ✨ Aurora

> 基于 [Firefly](https://github.com/CuteLeaf/Firefly) 主题二次开发的个人博客仓库

![Astro](https://img.shields.io/badge/Astro-7.x-orange)
![TypeScript](https://img.shields.io/badge/TypeScript-blue)
![License](https://img.shields.io/badge/License-MIT-green)

**🌐 [在线访问](https://junrutey.github.io/Firefly/)**

</div>

---

## 📖 说明

本仓库是 **JunRutey** 的个人博客源码，基于 [Firefly](https://github.com/CuteLeaf/Firefly) 主题进行二次定制开发。

> ⚠️ **注意：** 本仓库为个人博客的存储仓库，并非可直接部署的主题模板。二次开发过程中大量使用了 AI 辅助工具，代码和配置仅供学习参考，不建议直接复用或部署。

### 与上游项目的关系

| 项目 | 说明 |
|------|------|
| [fuwari](https://github.com/saicaca/fuwari) | Firefly 的上游模板，由 [saicaca](https://github.com/saicaca) 开发 |
| [Firefly](https://github.com/CuteLeaf/Firefly) | 基于 fuwari 二次开发的博客主题，由 [CuteLeaf](https://github.com/CuteLeaf) 维护 |
| **Aurora（本仓库）** | 基于 Firefly 进行个性化定制的个人博客 |

## ✨ 定制内容

本仓库在 Firefly 主题基础上进行了以下定制：

### 主题与视觉
- 粉蓝渐变主题色（`hue: 280` + `custom-gradient.css`）
- 8 张自定义壁纸，支持自动轮播（间隔 5.5 秒）
- 背景视频（720p H.264 格式）
- 亮色/暗色模式自动切换

### 内容与功能
- 个人资料与签名自定义
- 导航栏菜单精简与重排
- B 站主页链接集成
- 本地音乐播放器（4 首 MP3）
- 自定义书签导航与相册

### 技术修改
- RSS 构建路径修复（`getAllPosts` → `getSortedPosts`）
- 视频格式转换（HEVC → H.264，兼容浏览器播放）
- 背景视频路径适配 `base` 配置

## 🙏 致谢

本博客的构建依赖于以下开源项目：

- [**fuwari**](https://github.com/saicaca/fuwari) by [saicaca](https://github.com/saicaca) — 博客主题的上游模板
- [**Firefly**](https://github.com/CuteLeaf/Firefly) by [CuteLeaf](https://github.com/CuteLeaf) — 本博客所采用的主题
- [**Astro**](https://astro.build) — 静态站点生成框架
- [**Tailwind CSS**](https://tailwindcss.com) — CSS 工具类框架

> 如果你参考或使用了 Firefly 的组件设计和相关代码，请注明来自 [Firefly](https://github.com/CuteLeaf/Firefly)。

## 📝 许可证

本项目基于 [MIT License](https://mit-license.org/) 开源。

根据 MIT 协议，你可以自由使用、修改和分发代码，但需保留原始版权声明。

```
MIT License

Copyright (c) 2024 saicaca - fuwari
Copyright (c) 2025 CuteLeaf - Firefly
```

---

<div align="center">

**Made with ❤️ by [JunRutey](https://github.com/JunRutey)**

</div>
