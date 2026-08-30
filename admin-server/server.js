const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const simpleGit = require("simple-git");
const multer = require("multer");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const POSTS_DIR = path.join(PROJECT_ROOT, "src", "content", "posts");
const IMAGES_DIR = path.join(PROJECT_ROOT, "src", "assets", "images");
const PUBLIC_IMAGES_DIR = path.join(PROJECT_ROOT, "public", "assets", "images");
const GALLERY_DIR = path.join(PROJECT_ROOT, "public", "gallery");
const CONTENT_DIR = path.join(PROJECT_ROOT, "src", "content");
const GALLERY_CONFIG_FILE = path.join(PROJECT_ROOT, "src", "config", "galleryConfig.ts");
const CONFIG_DIR = path.join(PROJECT_ROOT, "src", "config");
const WALLPAPER_DIR = path.join(IMAGES_DIR, "CustomWallpaper");
const MOBILE_WALLPAPER_DIR = path.join(IMAGES_DIR, "MobileWallpaper");
const VIDEO_DIR = path.join(PROJECT_ROOT, "public", "assets", "videos");
const MUSIC_DIR = path.join(PROJECT_ROOT, "public", "assets", "music");
const MUSIC_COVER_DIR = path.join(MUSIC_DIR, "cover");
const SITE_CONFIG_FILE = path.join(__dirname, "site-config.json");
const STAGING_FILE = path.join(__dirname, ".staging.json");
const git = simpleGit(PROJECT_ROOT);
let currentBranch = "main";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ── Multer 配置 ──
var storage = multer.diskStorage({
  destination: function(req, file, cb) {
    if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
    cb(null, IMAGES_DIR);
  },
  filename: function(req, file, cb) {
    var ext = path.extname(file.originalname);
    var base = path.basename(file.originalname, ext)
      .toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff_-]/g, "-").replace(/-+/g, "-");
    cb(null, base + "-" + Date.now() + ext);
  }
});
var upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    cb(/^image\/(jpeg|png|gif|webp|avif|svg\+xml)$/.test(file.mimetype) ? null : new Error("只允许上传图片文件"), true);
  }
});
var imageUpload = upload;

// ── Gallery 图片上传 ──
var galleryStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    var albumId = req.params.id;
    // 使用更严格的验证
    if (!albumId || !validateAlbumIdSafe(albumId)) {
      return cb(new Error("无效的相册 ID：只能包含字母、数字、连字符和下划线"));
    }
    var albumDir = path.join(GALLERY_DIR, albumId);
    // 确保路径在 GALLERY_DIR 内
    if (!isPathContained(albumDir, GALLERY_DIR)) {
      return cb(new Error("路径不安全"));
    }
    if (!fs.existsSync(albumDir)) fs.mkdirSync(albumDir, { recursive: true });
    cb(null, albumDir);
  },
  filename: function(req, file, cb) {
    var ext = path.extname(file.originalname);
    var base = path.basename(file.originalname, ext)
      .toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff_-]/g, "-").replace(/-+/g, "-");
    cb(null, base + "-" + Date.now() + ext);
  }
});
var galleryUpload = multer({
  storage: galleryStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    cb(/^image\/(jpeg|png|gif|webp|avif|svg\+xml)$/.test(file.mimetype) ? null : new Error("只允许上传图片文件"), true);
  }
});

// ── 视频上传 ──
var videoUpload = multer({
  storage: multer.diskStorage({
    destination: function(req, file, cb) {
      if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });
      cb(null, VIDEO_DIR);
    },
    filename: function(req, file, cb) {
      var ext = path.extname(file.originalname);
      var base = path.basename(file.originalname, ext).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff_-]/g, "-").replace(/-+/g, "-");
      cb(null, base + "-" + Date.now() + ext);
    }
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    cb(/^video\/(mp4|webm|ogg|mov)$/.test(file.mimetype) || /\.(mp4|webm|ogg|mov)$/i.test(file.originalname) ? null : new Error("只允许上传视频文件"), true);
  }
});

// ── 音乐上传 ──
var musicUpload = multer({
  storage: multer.diskStorage({
    destination: function(req, file, cb) {
      if (!fs.existsSync(MUSIC_DIR)) fs.mkdirSync(MUSIC_DIR, { recursive: true });
      cb(null, MUSIC_DIR);
    },
    filename: function(req, file, cb) {
      var ext = path.extname(file.originalname);
      var base = path.basename(file.originalname, ext).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff_-]/g, "-").replace(/-+/g, "-");
      cb(null, base + "-" + Date.now() + ext);
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    cb(/^audio\/(mpeg|mp3|ogg|wav|flac|aac|m4a)$/.test(file.mimetype) || /\.(mp3|ogg|wav|flac|aac|m4a)$/i.test(file.originalname) ? null : new Error("只允许上传音频文件"), true);
  }
});

// ── 音乐封面上传 ──
var musicCoverUpload = multer({
  storage: multer.diskStorage({
    destination: function(req, file, cb) {
      if (!fs.existsSync(MUSIC_COVER_DIR)) fs.mkdirSync(MUSIC_COVER_DIR, { recursive: true });
      cb(null, MUSIC_COVER_DIR);
    },
    filename: function(req, file, cb) {
      var ext = path.extname(file.originalname);
      var base = path.basename(file.originalname, ext).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff_-]/g, "-").replace(/-+/g, "-");
      cb(null, base + "-" + Date.now() + ext);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: function(req, file, cb) {
    cb(/^image\/(jpeg|png|gif|webp|avif)$/.test(file.mimetype) ? null : new Error("只允许上传图片文件"), true);
  }
});

const FM_DEFAULTS = {
  title: "", published: new Date().toISOString(), draft: false,
  description: "", image: "", tags: [], category: "", lang: "", pinned: false,
  author: "", sourceLink: "", licenseName: "", licenseUrl: "", comment: true,
  password: "", passwordHint: "",
};

// ── 暂存管理 ──
function loadStaging() {
  try { return JSON.parse(fs.readFileSync(STAGING_FILE, "utf-8")); }
  catch (e) { return []; }
}
function saveStaging(list) {
  fs.writeFileSync(STAGING_FILE, JSON.stringify(list, null, 2), "utf-8");
}
function addToStaging(slug, title) {
  var list = loadStaging();
  if (!list.find(function(s) { return s.slug === slug; })) {
    list.push({ slug: slug, title: title || slug, stagedAt: new Date().toISOString() });
    saveStaging(list);
  }
  return list;
}
function removeFromStaging(slug) {
  var list = loadStaging().filter(function(s) { return s.slug !== slug; });
  saveStaging(list);
  return list;
}

// ── 安全：速率限制（按 IP + 路径独立计数） ──
var rateLimitStore = {};
function rateLimit(maxReq, windowMs) {
  return function(req, res, next) {
    var ip = req.ip || req.connection.remoteAddress || "unknown";
    var key = ip + ":" + req.path;
    var now = Date.now();
    if (!rateLimitStore[key] || now - rateLimitStore[key].start > windowMs) {
      rateLimitStore[key] = { start: now, count: 1 };
      return next();
    }
    rateLimitStore[key].count++;
    if (rateLimitStore[key].count > maxReq) {
      return res.status(429).json({ ok: false, error: "请求过于频繁，请稍后再试" });
    }
    next();
  };
}

// ── 安全：Slug 校验与路径防护 ──
function validateSlug(slug) {
  if (!slug || typeof slug !== "string") return false;
  if (/\.\./.test(slug) || /^\//.test(slug) || /\0/.test(slug)) return false;
  // 严格白名单：只允许字母、数字、中文、连字符、下划线
  return /^[a-zA-Z0-9\u4e00-\u9fff_-]+$/.test(slug);
}
function safeFindPostFile(slug) {
  if (!validateSlug(slug)) return null;
  var exts = [".md", ".mdx"];
  for (var i = 0; i < exts.length; i++) {
    var p = path.join(POSTS_DIR, slug + exts[i]);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
function isPathContained(filePath, baseDir) {
  var resolved = path.resolve(filePath);
  var base = path.resolve(baseDir);
  return resolved === base || resolved.startsWith(base + path.sep) || resolved.startsWith(base + "/");
}
function sanitizeSlug(slug) {
  if (!slug || typeof slug !== "string") return "";
  return slug.replace(/\.\./g, "").replace(/[/\\]/g, "").replace(/[^\w\u4e00-\u9fff-]/g, "").trim();
}

// ── 哈希函数：标题 + 时间戳 → 短唯一字符串 ──
function generateSlugHash(str) {
  var hash = 5381;
  for (var i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return (hash >>> 0).toString(36);
}

// 安全：验证相册 ID（只允许字母、数字、连字符、下划线）
function validateAlbumIdSafe(id) {
  // 显式转换为字符串，防止类型混淆攻击
  if (id === null || id === undefined) return false;
  var str = String(id);
  if (str.length === 0 || str.length > 100) return false;
  if (/\.\./.test(str) || /\0/.test(str)) return false;
  return /^[a-zA-Z0-9_-]+$/.test(str);
}

// 安全：验证文件名（防止路径穿越）
function validateFileName(name) {
  // 显式转换为字符串，防止类型混淆攻击
  if (name === null || name === undefined) return false;
  var str = String(name);
  if (str.length === 0 || str.length > 255) return false;
  if (/\.\./.test(str) || /[\/\\]/.test(str) || /\0/.test(str)) return false;
  // 只允许常见图片扩展名和安全字符
  return /^[a-zA-Z0-9\u4e00-\u9fff_\-\.]+$/.test(str);
}

// 安全：净化用户输入用于 HTML 展示（防止 XSS）
function sanitizeForHTML(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\//g, "&#47;");
}

// 安全：净化用户输入用于 JavaScript 字符串
function sanitizeForJS(str) {
  if (str == null) return "";
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/</g, "\\x3c")
    .replace(/>/g, "\\x3e");
}

// ── 站点配置管理 ──
function loadSiteConfig() {
  try {
    return JSON.parse(fs.readFileSync(SITE_CONFIG_FILE, "utf-8"));
  } catch (e) {
    return {
      wallpapers: { desktop: [], mobile: [] },
      video: "",
      music: [],
      announcement: { title: "", content: "", closable: true, link: { enable: false, text: "", url: "", external: false } },
      friends: [],
      about: ""
    };
  }
}
function saveSiteConfig(cfg) {
  fs.writeFileSync(SITE_CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf-8");
}

// ── TypeScript 配置文件同步 ──
function syncWallpaperToTS(cfg) {
  var file = path.join(CONFIG_DIR, "backgroundWallpaper.ts");
  try {
    var content = fs.readFileSync(file, "utf-8");
    var desktopPaths = cfg.wallpapers.desktop.map(function(p) { return '\t\t\t"' + p + '"'; });
    content = content.replace(
      /desktop:\s*\[[\s\S]*?\]/,
      "desktop: [\n" + desktopPaths.join(",\n") + ",\n\t\t]"
    );
    var mobilePaths = cfg.wallpapers.mobile.map(function(p) { return '\t\t\t"' + p + '"'; });
    content = content.replace(
      /mobile:\s*\[[\s\S]*?\]/,
      "mobile: [\n" + mobilePaths.join(",\n") + ",\n\t\t]"
    );
    if (cfg.video) {
      var videoPath = cfg.video;
      content = content.replace(
        /playerUrl:\s*`[^`]*`/,
        'playerUrl: `${process.env.VERCEL ? "/" : "/Aurora/"}' + videoPath.replace(/^\//, '') + '`'
      );
    }
    fs.writeFileSync(file, content, "utf-8");
  } catch (e) {
    console.error("Sync wallpaper TS error:", e.message);
  }
}

function syncMusicToTS(cfg) {
  var file = path.join(CONFIG_DIR, "musicConfig.ts");
  try {
    var content = fs.readFileSync(file, "utf-8");
    var playlist = cfg.music.map(function(m) {
      return '\t\t{\n\t\t\tname: "' + (m.name || "").replace(/"/g, '\\"') + '",\n' +
        '\t\t\tartist: "' + (m.artist || "").replace(/"/g, '\\"') + '",\n' +
        '\t\t\turl: "' + (m.url || "") + '",\n' +
        '\t\t\tcover: "' + (m.cover || "") + '",\n' +
        '\t\t\tlrc: "' + (m.lrc || "") + '",\n' +
        '\t\t}';
    });
    content = content.replace(
      /playlist:\s*\[[\s\S]*?\](?=\s*\})/,
      "playlist: [\n" + playlist.join(",\n") + ",\n\t\t]"
    );
    fs.writeFileSync(file, content, "utf-8");
  } catch (e) {
    console.error("Sync music TS error:", e.message);
  }
}

function normalizeFriendItem(f) {
  var item = f || {};
  var normalized = {
    title: item.title || item.name || "未命名",
    imgurl: item.imgurl || item.icon || "",
    desc: item.desc || "",
    siteurl: item.siteurl || item.url || "",
    tags: Array.isArray(item.tags) ? item.tags : [],
    weight: Number(item.weight) || 1,
    enabled: item.enabled !== false
  };
  if (!normalized.title || normalized.title === "未命名") {
    normalized.title = String(item.name || item.title || "未命名");
  }
  if (!normalized.siteurl) normalized.siteurl = String(item.url || item.siteurl || "");
  if (!normalized.imgurl) normalized.imgurl = String(item.icon || item.imgurl || "");
  return normalized;
}

function syncFriendsToTS(cfg) {
  var file = path.join(CONFIG_DIR, "friendsConfig.ts");
  try {
    var friends = Array.isArray(cfg.friends) ? cfg.friends.map(normalizeFriendItem) : [];
    var rendered = [];
    friends.forEach(function(f) {
      var name = String(f.title || "未命名").replace(/"/g, '\\"');
      var imgurl = String(f.imgurl || "").replace(/"/g, '\\"');
      var desc = String(f.desc || "").replace(/"/g, '\\"');
      var siteurl = String(f.siteurl || "").replace(/"/g, '\\"');
      var tags = Array.isArray(f.tags) ? f.tags.map(function(t) { return '"' + String(t).replace(/"/g, '\\"') + '"'; }).join(", ") : "";
      var weight = Number(f.weight) || 1;
      var enabled = f.enabled !== false;
      rendered.push(
        '\t{\n' +
        '\t\ttitle: "' + name + '",\n' +
        '\t\timgurl: "' + imgurl + '",\n' +
        '\t\tdesc: "' + desc + '",\n' +
        '\t\tsiteurl: "' + siteurl + '",\n' +
        '\t\ttags: [' + tags + '],\n' +
        '\t\tweight: ' + weight + ',\n' +
        '\t\tenabled: ' + enabled + ',\n' +
        '\t}'
      );
    });

    var content = [
      'import type { FriendLink, FriendsPageConfig } from "../types/friendsConfig";\n',
      '\n',
      '// 可以在src/content/spec/friends.md中编写友链页面下方的自定义内容\n',
      '\n',
      '// 友链页面配置\n',
      'export const friendsPageConfig: FriendsPageConfig = {\n',
      '\t// 页面标题，如果留空则使用 i18n 中的翻译\n',
      '\ttitle: "",\n',
      '\n',
      '\t// 页面描述文本，如果留空则使用 i18n 中的翻译\n',
      '\tdescription: "",\n',
      '\n',
      '\t// 是否显示底部自定义内容（friends.mdx 中的内容）\n',
      '\tshowCustomContent: true,\n',
      '\n',
      '\t// 是否显示评论区，需要先在commentConfig.ts启用评论系统\n',
      '\tshowComment: true,\n',
      '\n',
      '\t// 是否开启随机排序配置，如果开启，就会忽略权重，构建时进行一次随机排序\n',
      '\trandomizeSort: false,\n',
      '};\n',
      '\n',
      '// 友链配置\n',
      'export const friendsConfig: FriendLink[] = [\n',
      (rendered.length ? rendered.join(',\n') + '\n' : ''),
      '];\n',
      '\n',
      '// 获取启用的友链并进行排序\n',
      'export const getEnabledFriends = (): FriendLink[] => {\n',
      '\tconst friends = friendsConfig.filter((friend) => friend.enabled);\n',
      '\n',
      '\tif (friendsPageConfig.randomizeSort) {\n',
      '\t\treturn friends.sort(() => Math.random() - 0.5);\n',
      '\t}\n',
      '\n',
      '\treturn friends.sort((a, b) => b.weight - a.weight);\n',
      '};\n'
    ].join("");

    fs.writeFileSync(file, content, "utf-8");
  } catch (e) {
    console.error("Sync friends TS error:", e.message);
  }
}

function syncAnnouncementToTS(cfg) {
  var file = path.join(CONFIG_DIR, "announcementConfig.ts");
  try {
    var a = cfg.announcement;
    var content = 'import type { AnnouncementConfig } from "../types/announcementConfig";\n\n';
    content += 'export const announcementConfig: AnnouncementConfig = {\n';
    content += '\ttitle: "' + (a.title || "").replace(/"/g, '\\"') + '",\n';
    content += '\tcontent: "' + (a.content || "").replace(/"/g, '\\"') + '",\n';
    content += '\tclosable: ' + (a.closable !== false) + ',\n';
    content += '\tlink: {\n';
    content += '\t\tenable: ' + (a.link && a.link.enable) + ',\n';
    content += '\t\ttext: "' + ((a.link && a.link.text) || "").replace(/"/g, '\\"') + '",\n';
    content += '\t\turl: "' + ((a.link && a.link.url) || "").replace(/"/g, '\\"') + '",\n';
    content += '\t\texternal: ' + (a.link && !!a.link.external) + ',\n';
    content += '\t},\n';
    content += '};\n';
    fs.writeFileSync(file, content, "utf-8");
  } catch (e) {
    console.error("Sync announcement TS error:", e.message);
  }
}

// ── HTML helpers ──
var STYLE = [
  "*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}",
  "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans SC',sans-serif;background:#f5f5f5;color:#1a1a1a;line-height:1.6}",
  "a{color:#2563eb;text-decoration:none}a:hover{text-decoration:underline}",
  ".container{max-width:960px;margin:0 auto;padding:24px 20px}",
  "header{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px}",
  "header h1{font-size:20px;font-weight:600}header h1 span{color:#94a3b8;font-weight:400;font-size:14px;margin-left:8px}",
  ".btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:6px;border:none;font-size:14px;font-weight:500;cursor:pointer;transition:all .15s}",
  ".btn-primary{background:#2563eb;color:#fff}.btn-primary:hover{background:#1d4ed8}",
  ".btn-success{background:#16a34a;color:#fff}.btn-success:hover{background:#15803d}",
  ".btn-warning{background:#f59e0b;color:#fff}.btn-warning:hover{background:#d97706}",
  ".btn-danger{background:#ef4444;color:#fff}.btn-danger:hover{background:#dc2626}",
  ".btn-ghost{background:transparent;color:#64748b;border:1px solid #e2e8f0}.btn-ghost:hover{background:#f1f5f9}",
  ".btn-sm{padding:4px 10px;font-size:12px}",
  ".post-table{width:100%;border-collapse:collapse}",
  ".post-table th{text-align:left;padding:10px 12px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e2e8f0}",
  ".post-table td{padding:12px;border-bottom:1px solid #f1f5f9;font-size:14px}",
  ".post-table tr:hover td{background:#f8fafc}",
  ".post-table .actions{display:flex;gap:6px}",
  ".tag{display:inline-block;padding:2px 8px;border-radius:4px;background:#f1f5f9;font-size:12px;color:#64748b;margin-right:4px}",
  ".draft-badge{display:inline-block;padding:2px 6px;border-radius:4px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:500}",
  ".pinned-badge{display:inline-block;padding:2px 6px;border-radius:4px;background:#dbeafe;color:#1e40af;font-size:11px;font-weight:500}",
  ".empty{text-align:center;padding:60px 20px;color:#94a3b8}.empty p{margin-bottom:16px}",
  ".form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}",
  ".form-grid .full{grid-column:1/-1}",
  ".form-group{display:flex;flex-direction:column;gap:4px}",
  ".form-group label{font-size:13px;font-weight:500;color:#475569}",
  ".form-group input,.form-group select,.form-group textarea{padding:8px 12px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;font-family:inherit;transition:border-color .15s}",
  ".form-group input:focus,.form-group textarea:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.1)}",
  ".form-group textarea{min-height:400px;resize:vertical;font-family:'JetBrains Mono','Fira Code',monospace;font-size:13px;line-height:1.7}",
  ".form-actions{display:flex;gap:10px;margin-top:20px}",
  ".help-text{font-size:12px;color:#94a3b8}",
  ".toast{position:fixed;bottom:24px;right:24px;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:500;color:#fff;z-index:9999;transform:translateY(100px);opacity:0;transition:all .3s ease}",
  ".toast.show{transform:translateY(0);opacity:1}",
  ".toast.success{background:#16a34a}.toast.error{background:#dc2626}.toast.info{background:#2563eb}",
  ".editor-layout{display:flex;gap:16px}",
  ".editor-layout .form-group.editor{flex:1}",
  ".editor-layout .preview-panel{flex:1;border:1px solid #e2e8f0;border-radius:6px;padding:16px;overflow-y:auto;max-height:500px;background:#fff;font-size:14px;line-height:1.8}",
  ".cover-section{border:1px solid #e2e8f0;border-radius:8px;padding:16px;background:#fff}",
  ".cover-row{display:flex;gap:16px;align-items:flex-start}",
  ".cover-row .cover-upload{flex:1}",
  ".cover-preview{width:200px;height:120px;border-radius:6px;border:1px solid #e2e8f0;object-fit:cover;background:#f1f5f9;display:none}",
  ".cover-preview.active{display:block}",
  ".cover-gallery{display:flex;gap:8px;overflow-x:auto;padding:8px 0;max-width:100%}",
  ".cover-gallery-item{width:100px;height:64px;border-radius:4px;border:2px solid transparent;object-fit:cover;cursor:pointer;flex-shrink:0;transition:border-color .15s}",
  ".cover-gallery-item:hover{border-color:#94a3b8}",
  ".cover-gallery-item.selected{border-color:#2563eb}",
  ".upload-zone{border:2px dashed #e2e8f0;border-radius:8px;padding:24px;text-align:center;color:#94a3b8;cursor:pointer;transition:all .15s}",
  ".upload-zone:hover{border-color:#2563eb;color:#2563eb}",
  ".upload-zone.dragover{border-color:#2563eb;background:#eff6ff}",
  ".upload-zone input{display:none}",
  ".editor-toolbar{display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:6px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px 6px 0 0;border-bottom:none}",
  ".editor-toolbar .btn{font-size:12px;padding:4px 10px}",
  ".body-upload-zone{border:2px dashed #e2e8f0;border-radius:6px;padding:14px;text-align:center;color:#94a3b8;cursor:pointer;transition:all .15s;margin-bottom:6px;font-size:13px}",
  ".body-upload-zone:hover{border-color:#2563eb;color:#2563eb}",
  ".body-upload-zone.dragover{border-color:#2563eb;background:#eff6ff}",
  ".body-upload-zone input{display:none}",
  ".cover-tabs{display:flex;gap:0;margin-bottom:12px}",
  ".cover-tab{padding:6px 14px;font-size:13px;border:1px solid #e2e8f0;cursor:pointer;background:#fafafa;color:#64748b;transition:all .15s}",
  ".cover-tab:first-child{border-radius:6px 0 0 6px}",
  ".cover-tab:last-child{border-radius:0 6px 6px 0}",
  ".cover-tab.active{background:#2563eb;color:#fff;border-color:#2563eb}",
  ".cover-tab-content{display:none}.cover-tab-content.active{display:block}",
  "@media(max-width:768px){.form-grid{grid-template-columns:1fr}.editor-layout{flex-direction:column}.cover-row{flex-direction:column}.cover-preview{width:100%}}",
  // ── Aurora Dashboard Layout ──
  ".setting-shell{display:flex;max-width:1360px;margin:0 auto;padding:18px 20px 28px;gap:20px;min-height:calc(100vh - 40px)}",
  ".setting-sidebar{width:260px;background:linear-gradient(180deg,#f7fbff 0%,#eef4ff 100%);border:1px solid #dfeafc;border-radius:22px;padding:18px 14px;box-shadow:0 18px 35px rgba(37,99,235,.08);display:flex;flex-direction:column;gap:16px;flex-shrink:0}",
  ".setting-brand{display:flex;align-items:center;gap:12px;padding:8px 8px 12px;border-bottom:1px solid rgba(148,163,184,.2)}",
  ".brand-mark{width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,#2563eb,#60a5fa);color:#fff;font-size:20px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 18px rgba(37,99,235,.25);overflow:hidden}",
  ".brand-mark svg{width:26px;height:26px;display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.08));transform:translateY(1px)}",
  ".brand-copy{display:flex;flex-direction:column;gap:2px}",
  ".brand-copy strong{font-size:16px;color:#0f172a;letter-spacing:.08em}",
  ".brand-copy span{font-size:11px;color:#64748b;letter-spacing:.08em;text-transform:uppercase}",
  ".setting-nav{display:flex;flex-direction:column;gap:6px}",
  ".side-nav-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;color:#475569;text-decoration:none;font-size:14px;font-weight:600;transition:all .2s ease}",
  ".side-nav-item svg{width:16px;height:16px;opacity:.8}",
  ".side-nav-item:hover{background:#eaf2ff;color:#1d4ed8}",
  ".side-nav-item.active{background:linear-gradient(135deg,#2563eb,#60a5fa);color:#fff;box-shadow:0 10px 18px rgba(37,99,235,.22)}",
  ".side-nav-item.active svg{color:#fff}",
  ".setting-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:18px}",
  ".app-shell{background:#f5f7fb;border:1px solid #e2e8f0;border-radius:24px;padding:18px 18px 0;box-shadow:0 18px 40px rgba(15,23,42,.04)}",
  ".app-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 10px 18px;border-bottom:1px solid rgba(148,163,184,.22)}",
  ".header-brand{display:flex;align-items:center;gap:12px}",
  ".header-brand .brand-mark{width:40px;height:40px;border-radius:14px;font-size:22px}",
  ".header-brand-text{display:flex;flex-direction:column;gap:2px}",
  ".header-brand-text strong{font-size:18px;color:#0f172a;letter-spacing:.08em}",
  ".header-brand-text span{font-size:12px;color:#64748b;letter-spacing:.12em;text-transform:uppercase}",
  ".header-actions{display:flex;align-items:center;gap:10px}",
  ".mini-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:7px 12px;border:1px solid #dfeafc;background:#fff;color:#475569;border-radius:10px;font-size:12px;font-weight:600;text-decoration:none;box-shadow:0 4px 10px rgba(148,163,184,.12)}",
  ".mini-btn:hover{text-decoration:none;background:#f8fbff}",
  ".mini-btn svg{width:14px;height:14px}",
  ".action-group{display:flex;align-items:center;gap:8px;padding:0;border:none;border-radius:0;overflow:visible;box-shadow:none}",
  ".action-group a{display:inline-flex;align-items:center;justify-content:center;padding:10px 18px;text-decoration:none;font-weight:600;font-size:13px;border:1px solid rgba(37,99,235,.18);border-radius:12px;box-shadow:0 8px 18px rgba(37,99,235,.08)}",
  ".action-group a:last-child{border-right:1px solid rgba(37,99,235,.18)}",
  ".action-group .primary-action{background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;border-color:transparent}",
  ".action-group .secondary-action{background:#fff;color:#1e40af}",
  ".app-main{display:flex;gap:18px;padding:18px 10px 20px;min-height:540px}",
  ".main-column{flex:1;min-width:0;display:flex;flex-direction:column;gap:18px}",
  ".side-column{width:300px;flex-shrink:0}",
  ".info-card, .list-card, .quick-card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 14px 26px rgba(15,23,42,.04)}",
  ".info-card{padding:18px 18px 16px}",
  ".list-card{overflow:hidden}",
  ".list-card-header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid #edf2f7}",
  ".list-card-header h3{font-size:16px;color:#0f172a}",
  ".list-card-header span{font-size:12px;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;padding:4px 8px;border-radius:999px}",
  ".list-card-body{padding:16px 18px 18px}",
  ".stats-grid{display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:12px}",
  ".stat-badge{background:#f8fbff;border:1px solid #dfeafc;border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;min-height:90px}",
  ".stat-badge .label{font-size:12px;color:#64748b;letter-spacing:.08em;text-transform:uppercase}",
  ".stat-badge strong{font-size:24px;color:#0f172a}",
  ".quick-card{padding:14px 14px 12px}",
  ".quick-card h4{font-size:14px;color:#0f172a;margin-bottom:10px;font-weight:700}",
  ".quick-list{display:flex;flex-direction:column;gap:8px}",
  ".quick-link{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;color:#475569;text-decoration:none;background:#f8fafc;border:1px solid #edf2f7;transition:all .2s ease}",
  ".quick-link:hover{background:#eef6ff;border-color:#dfeafc;color:#1d4ed8;text-decoration:none}",
  ".quick-link svg{width:16px;height:16px;opacity:.7}",
  ".quick-link .count-badge{margin-left:auto;background:#dbeafe;color:#1e40af;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700}",
  ".list-table{width:100%;border-collapse:collapse}",
  ".list-table th{padding:10px 12px;text-align:left;font-size:12px;color:#64748b;background:#f8fafc;border-bottom:1px solid #edf2f7;letter-spacing:.08em;text-transform:uppercase}",
  ".list-table td{padding:10px 12px;border-bottom:1px solid #f3f4f6;color:#334155}",
  ".list-table tbody tr:hover{background:#f8fbff}",
  ".list-table .actions{display:flex;gap:6px;justify-content:flex-end}",
  ".list-table .tag{display:inline-block;padding:3px 8px;border-radius:999px;background:#eef6ff;color:#1d4ed8;font-size:11px;font-weight:600}",
  ".empty-state{padding:28px;text-align:center;border:1px dashed #d6dbe6;border-radius:12px;background:#f8fafc;color:#64748b}",
  ".main-column .list-card{min-height:260px}",
  "@media(max-width:900px){.setting-shell{flex-direction:column}.setting-sidebar{width:100%}.app-main{flex-direction:column}.side-column{width:100%}.stats-grid{grid-template-columns:repeat(2,minmax(140px,1fr))}}",
  "@media(max-width:560px){.stats-grid{grid-template-columns:1fr}.header-actions{width:100%;justify-content:flex-end}.action-group{flex-wrap:wrap}.app-header{flex-wrap:wrap}}",
  // ── Stats ──
  ".stat-row{display:flex;align-items:center;justify-content:space-between;padding:7px 0;font-size:13px}",
  ".stat-row+.stat-row{border-top:1px solid #f8f9fa}",
  ".stat-label{color:#6b7280;display:flex;align-items:center;gap:6px}",
  ".stat-value{font-weight:600;color:#1f2937}",
  // ── Stats Summary ──
  ".stats-summary{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}",
  ".stats-summary .stat-chip{display:inline-flex;align-items:center;gap:6px;padding:10px 16px;background:#fff;border:1px solid #e8e8e8;border-radius:8px;font-size:13px;color:#6b7280;white-space:nowrap}",
  ".stats-summary .stat-chip svg{width:15px;height:15px;opacity:.5;flex-shrink:0}",
  ".stats-summary .stat-chip strong{color:#1f2937;font-weight:600}",
  "@media(max-width:600px){.stats-summary .stat-chip{padding:8px 12px;font-size:12px;flex:1 1 calc(50% - 6px);justify-content:center}}",
  "@media(max-width:900px){.dashboard{flex-direction:column}.dashboard-side{width:100%}}",
  // ── Modal ──
  ".modal-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.4);z-index:9998;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s}",
  ".modal-overlay.show{opacity:1}",
  ".modal{background:#fff;border-radius:12px;padding:28px 28px 24px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.2);transform:translateY(20px);transition:transform .2s}",
  ".modal-overlay.show .modal{transform:translateY(0)}",
  ".modal h2{font-size:18px;font-weight:600;margin-bottom:6px}",
  ".modal p{font-size:14px;color:#64748b;margin-bottom:20px}",
  ".modal-actions{display:flex;gap:10px;justify-content:flex-end}",
  // ── Staging Badge ──
  ".staged-badge{display:inline-block;padding:2px 6px;border-radius:4px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:500;margin-left:6px}",
  // ── Card Grid（壁纸/视频管理） ──
  ".form-section{background:#fff;border:1px solid #e8e8e8;border-radius:12px;padding:20px;margin-bottom:16px}",
  ".form-section h3{margin:0 0 12px;font-size:15px;font-weight:600}",
  ".card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}",
  ".card-item{border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;background:#f8fafc}"
].join("\n");

var TOAST_SCRIPT = [
  "function showToast(msg,type,duration){duration=duration||3000;var t=document.getElementById('toast');t.textContent=msg;t.className='toast '+(type||'info');requestAnimationFrame(function(){t.classList.add('show')});setTimeout(function(){t.classList.remove('show')},duration)}",
  "function setLoading(btn,loading){if(loading){btn.dataset.origText=btn.textContent;btn.textContent='处理中...';btn.disabled=true}else{btn.textContent=btn.dataset.origText||btn.textContent;btn.disabled=false}}"
].join("\n");

function parseDateFlexible(s) {
  if (!s) return new Date(NaN);
  var str = String(s);
  if (str.indexOf("T") >= 0) return new Date(str);
  return new Date(str.replace(" ", "T") + "Z");
}

function sidebar(activePath) {
  var items = [
    { href: "/", label: "后台主页", icon: icDash },
    { href: "/config/friends", label: "友链", icon: icUser },
    { href: "/config/wallpaper", label: "封面壁纸", icon: icImage },
    { href: "/config/video", label: "背景视频", icon: icVideo },
    { href: "/config/music", label: "背景音乐", icon: icMusic }
  ];

  var nav = items.map(function(item) {
    var isActive = activePath === item.href || (activePath && activePath.indexOf(item.href) === 0);
    return '<a class="side-nav-item ' + (isActive ? 'active' : '') + '" href="' + item.href + '">' + item.icon + '<span>' + item.label + '</span></a>';
  }).join("");

  return '<div class="setting-shell"><aside class="setting-sidebar"><div class="setting-brand"><div class="brand-mark"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 5 L38 22 L55 28 L38 34 L32 52 L26 34 L9 28 L26 22 Z" fill="white"/></svg></div><div class="brand-copy"><strong>Aurora</strong><span>极光 · 后台管理</span></div></div><nav class="setting-nav">' + nav + '</nav></aside><div class="setting-main">';
}

function esc(s) {
  if (s == null) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
function escJS(s) {
  if (s == null) return "";
  return String(s).replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/"/g,"\\\"").replace(/\n/g,"\\n").replace(/\r/g,"\\r");
}

function wrapHTML(title, body) {
  return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>' + esc(title) + ' - Aurora Admin</title><style>' + STYLE + '</style></head><body>' + body + '<div id="toast" class="toast"></div><script>' + TOAST_SCRIPT + '</script></body></html>';
}

function formatBytes(b) {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}

function formatDateShanghai(d) {
  var sh = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
  var y = sh.getFullYear();
  var mo = String(sh.getMonth() + 1).padStart(2, "0");
  var dd = String(sh.getDate()).padStart(2, "0");
  var hh = String(sh.getHours()).padStart(2, "0");
  var mm = String(sh.getMinutes()).padStart(2, "0");
  var ss = String(sh.getSeconds()).padStart(2, "0");
  return y + "-" + mo + "-" + dd + "T" + hh + ":" + mm + ":" + ss + "+08:00";
}

function serializeFM(data) {
  var out = {};
  for (var k in data) {
    if (data[k] instanceof Date) {
      out[k] = formatDateShanghai(data[k]);
    } else {
      out[k] = data[k];
    }
  }
  return out;
}

function getAllPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs.readdirSync(POSTS_DIR)
    .filter(function(f) { return /\.(md|mdx)$/.test(f); })
    .map(function(f) {
      var raw = fs.readFileSync(path.join(POSTS_DIR, f), "utf-8");
      var parsed = matter(raw);
      return {
        slug: f.replace(/\.(md|mdx)$/, ""),
        file: f,
        data: serializeFM(parsed.data),
        size: formatBytes(Buffer.byteLength(raw))
      };
    });
}

function findPostFile(slug) {
  if (!validateSlug(slug)) return null;
  var exts = [".md", ".mdx"];
  for (var i = 0; i < exts.length; i++) {
    var p = path.join(POSTS_DIR, slug + exts[i]);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function scanImages(dir, base) {
  var results = [];
  if (!fs.existsSync(dir)) return results;
  var items = fs.readdirSync(dir, { withFileTypes: true });
  for (var i = 0; i < items.length; i++) {
    if (i >= items.length) break;
    var item = items[i];
    if (!item || !item.name) continue;
    var full = path.join(dir, item.name);
    var rel = base ? base + "/" + item.name : item.name;
    if (item.isDirectory()) {
      results = results.concat(scanImages(full, rel));
    } else if (/\.(jpe?g|png|gif|webp|avif|svg)$/i.test(item.name)) {
      results.push(rel);
    }
  }
  return results;
}

function isStaged(slug) {
  return loadStaging().some(function(s) { return s.slug === slug; });
}

// ── Gallery 配置解析 ──
function validateAlbumId(id) {
  if (!id || typeof id !== "string") return false;
  if (/\.\./.test(id) || /\0/.test(id)) return false;
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

function parseGalleryConfig() {
  if (!fs.existsSync(GALLERY_CONFIG_FILE)) return { albums: [], columnWidth: 240 };
  var content = fs.readFileSync(GALLERY_CONFIG_FILE, "utf-8");
  var result = { albums: [], columnWidth: 240 };

  // columnWidth
  var cwM = content.match(/columnWidth\s*:\s*(\d+)/);
  if (cwM) result.columnWidth = parseInt(cwM[1], 10);

  // albums 数组
  var aIdx = content.indexOf("albums");
  if (aIdx === -1) return result;
  var bStart = content.indexOf("[", aIdx);
  if (bStart === -1) return result;
  var depth = 0, bEnd = -1;
  for (var i = bStart; i < content.length; i++) {
    if (content[i] === "[") depth++;
    if (content[i] === "]") { depth--; if (depth === 0) { bEnd = i; break; } }
  }
  if (bEnd === -1) return result;
  var inner = content.substring(bStart + 1, bEnd);

  // 提取 { } 对象
  var objs = [], oStart = -1;
  depth = 0;
  for (var i = 0; i < inner.length; i++) {
    if (inner[i] === "{") { if (depth === 0) oStart = i; depth++; }
    if (inner[i] === "}") {
      depth--;
      if (depth === 0 && oStart >= 0) { objs.push(inner.substring(oStart + 1, i)); oStart = -1; }
    }
  }

  result.albums = objs.map(function(t) {
    var a = {};
    var m;
    if ((m = t.match(/id\s*:\s*["'`](.*?)["'`]/))) a.id = m[1];
    if ((m = t.match(/name\s*:\s*["'`](.*?)["'`]/))) a.name = m[1];
    if ((m = t.match(/cover\s*:\s*["'`](.*?)["'`]/))) a.cover = m[1];
    if ((m = t.match(/date\s*:\s*["'`](.*?)["'`]/))) a.date = m[1];
    if ((m = t.match(/location\s*:\s*["'`](.*?)["'`]/))) a.location = m[1];
    if ((m = t.match(/password\s*:\s*["'`](.*?)["'`]/))) a.password = m[1];
    if ((m = t.match(/passwordHint\s*:\s*["'`](.*?)["'`]/))) a.passwordHint = m[1];
    if ((m = t.match(/description\s*:\s*["'`]([\s\S]*?)["'`]/))) a.description = m[1].trim();
    if ((m = t.match(/tags\s*:\s*\[([^\]]*)\]/))) {
      a.tags = (m[1].match(/["'`](.*?)["'`]/g) || []).map(function(s) { return s.slice(1, -1); });
    }
    return a;
  });

  return result;
}

function serializeGalleryConfig(config) {
  var lines = [];
  lines.push('import type { GalleryConfig } from "@/types/galleryConfig";');
  lines.push('');
  lines.push('// 相册配置');
  lines.push('export const galleryConfig: GalleryConfig = {');
  lines.push('	// 相册列表');
  lines.push('	albums: [');
  (config.albums || []).forEach(function(album) {
    lines.push('		{');
    lines.push('			id: "' + (album.id || '') + '",');
    lines.push('			name: "' + (album.name || '') + '",');
    if (album.description) lines.push('			description: "' + album.description + '",');
    if (album.location) lines.push('			location: "' + album.location + '",');
    if (album.date) lines.push('			date: "' + album.date + '",');
    if (album.tags && album.tags.length) {
      lines.push('			tags: [' + album.tags.map(function(t) { return '"' + t + '"'; }).join(', ') + '],');
    }
    if (album.cover) lines.push('			cover: "' + album.cover + '",');
    if (album.password) lines.push('			password: "' + album.password + '",');
    if (album.passwordHint) lines.push('			passwordHint: "' + album.passwordHint + '",');
    lines.push('		},');
  });
  lines.push('	],');
  lines.push('');
  lines.push('	// 瀑布流最小列宽(px)，浏览器根据容器宽度自动计算列数，默认 240');
  lines.push('	columnWidth: ' + (config.columnWidth || 240) + ',');
  lines.push('};');
  lines.push('');
  return lines.join('\n');
}

function getAlbumPhotos(albumId) {
  var albumDir = path.join(GALLERY_DIR, albumId);
  if (!fs.existsSync(albumDir)) return [];
  return fs.readdirSync(albumDir)
    .filter(function(f) { return /\.(jpe?g|png|gif|webp|avif|svg)$/i.test(f); })
    .map(function(f) {
      var stat = fs.statSync(path.join(albumDir, f));
      return { name: f, size: stat.size, path: "/gallery/" + albumId + "/" + f, modified: stat.mtime.toISOString() };
    })
    .sort(function(a, b) { return new Date(b.modified) - new Date(a.modified); });
}

function getAlbumPhotoCount(albumId) {
  var albumDir = path.join(GALLERY_DIR, albumId);
  if (!fs.existsSync(albumDir)) return 0;
  return fs.readdirSync(albumDir).filter(function(f) { return /\.(jpe?g|png|gif|webp|avif|svg)$/i.test(f); }).length;
}

function scanFiles(dir, exts) {
  if (!fs.existsSync(dir)) return [];
  var files = fs.readdirSync(dir, { withFileTypes: true });
  return files
    .filter(function(item) { return item && item.isFile() && exts.some(function(ext) { return item.name.toLowerCase().endsWith(ext.toLowerCase()); }); })
    .map(function(item) {
      var filePath = path.join(dir, item.name);
      var stat = fs.statSync(filePath);
      return { name: item.name, size: formatBytes(stat.size) };
    })
    .sort(function(a, b) { return a.name.localeCompare(b.name); });
}

// ── SVG Icons ──
var icDoc = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
var icFolder = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
var icTag = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>';
var icPin = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>';
var icEdit = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
var icDash = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>';
var icPackage = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';
var icInbox = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>';
var icCog = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';
var icRefresh = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>';
var icImage = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
var icVideo = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>';
var icMusic = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
var icAnnounce = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
var icUser = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
var icSettings = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

// ── API: 上传图片 ──
app.post("/api/upload", rateLimit(30, 60000), function(req, res) {
  upload.single("file")(req, res, function(err) {
    if (err) return res.json({ ok: false, error: err.message || "上传失败" });
    if (!req.file) return res.json({ ok: false, error: "未选择文件" });
    // 同步到 public 目录，确保 markdown 正文中的图片可被 web 服务器直接提供
    try {
      if (!fs.existsSync(PUBLIC_IMAGES_DIR)) fs.mkdirSync(PUBLIC_IMAGES_DIR, { recursive: true });
      var destPath = path.join(PUBLIC_IMAGES_DIR, req.file.filename);
      if (isPathContained(destPath, PUBLIC_IMAGES_DIR)) {
        fs.copyFileSync(req.file.path, destPath);
      }
    } catch (e) { /* non-fatal */ }
    res.json({
      ok: true,
      path: "src/assets/images/" + req.file.filename,
      publicPath: "/assets/images/" + req.file.filename,
      filename: req.file.filename,
      size: formatBytes(req.file.size)
    });
  });
});

// ── API: 文章元数据 ──
app.get("/api/post-meta.json", rateLimit(60, 60000), function(req, res) {
  try {
    res.json(getAllPosts().map(function(p) {
      return { id: p.slug, title: p.data.title || p.slug, published: p.data.published || "", draft: !!p.data.draft, pinned: !!p.data.pinned };
    }));
  } catch(e) { res.json([]); }
});

// ── API: 已有图片 ──
app.get("/api/images", rateLimit(60, 60000), function(req, res) {
  try {
    var images = scanImages(IMAGES_DIR, "src/assets/images");
    images.sort();
    res.json({ ok: true, images: images });
  } catch (e) { res.json({ ok: false, error: e.message, images: [] }); }
});

// ── API: 图片缩略图 ──
app.get("/api/thumb/*", rateLimit(120, 60000), function(req, res) {
  try {
    var relPath = req.params[0] || "";
    // 严格路径验证：防止路径穿越
    if (/\.\./.test(relPath) || /\0/.test(relPath)) {
      return res.status(403).send("Forbidden: path traversal");
    }
    // 只允许 src/ 和 public/ 目录下的图片
    var allowedPrefixes = ["src/assets/images/", "public/assets/images/", "public/gallery/"];
    var isAllowed = allowedPrefixes.some(function(prefix) {
      return relPath.startsWith(prefix) || relPath === prefix.slice(0, -1);
    });
    if (!isAllowed) {
      return res.status(403).send("Forbidden: path not allowed");
    }
    var filePath = path.join(PROJECT_ROOT, relPath);
    if (!isPathContained(filePath, PROJECT_ROOT)) {
      return res.status(403).send("Forbidden: path escape");
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).send("Not found");
    }
    res.sendFile(filePath);
  } catch (e) {
    res.status(500).send("Internal server error");
  }
});

// ── 站点配置 API ──
app.get("/api/config/wallpapers", rateLimit(30, 60000), function(req, res) {
  var cfg = loadSiteConfig();
  var desktop = cfg.wallpapers.desktop.map(function(p) {
    var name = path.basename(p);
    return { path: p, name: name, exists: fs.existsSync(path.join(PROJECT_ROOT, "public", p)) || fs.existsSync(path.join(IMAGES_DIR, name)) };
  });
  var mobile = cfg.wallpapers.mobile.map(function(p) {
    var name = path.basename(p);
    return { path: p, name: name, exists: fs.existsSync(path.join(PROJECT_ROOT, "public", p)) || fs.existsSync(path.join(IMAGES_DIR, name)) };
  });
  res.json({ ok: true, desktop: desktop, mobile: mobile });
});

app.post("/api/config/wallpaper/upload", rateLimit(30, 60000), imageUpload.single("file"), function(req, res) {
  if (!req.file) return res.json({ ok: false, error: "没有文件" });
  var relPath = "assets/images/" + req.file.filename;
  var target = path.join(PUBLIC_IMAGES_DIR, req.file.filename);
  try {
    if (!fs.existsSync(path.dirname(target))) fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(req.file.path, target);
    fs.unlinkSync(req.file.path);
  } catch (e) { console.error("Copy wallpaper error:", e.message); }
  var cfg = loadSiteConfig();
  var type = req.body.type || "desktop";
  if (type === "mobile") cfg.wallpapers.mobile.push("/" + relPath);
  else cfg.wallpapers.desktop.push("/" + relPath);
  saveSiteConfig(cfg);
  syncWallpaperToTS(cfg);
  res.json({ ok: true, path: "/" + relPath });
});

app.post("/api/config/wallpaper/delete", rateLimit(30, 60000), function(req, res) {
  var p = req.body.path;
  if (!p) return res.json({ ok: false, error: "缺少路径" });
  var cfg = loadSiteConfig();
  var i1 = cfg.wallpapers.desktop.indexOf(p);
  if (i1 !== -1) cfg.wallpapers.desktop.splice(i1, 1);
  var i2 = cfg.wallpapers.mobile.indexOf(p);
  if (i2 !== -1) cfg.wallpapers.mobile.splice(i2, 1);
  saveSiteConfig(cfg);
  syncWallpaperToTS(cfg);
  var filePath = path.join(PROJECT_ROOT, "public", p.replace(/^\//, ""));
  if (fs.existsSync(filePath)) { try { fs.unlinkSync(filePath); } catch(e) {} }
  res.json({ ok: true });
});

app.post("/api/config/wallpaper/reorder", rateLimit(30, 60000), function(req, res) {
  var cfg = loadSiteConfig();
  if (req.body.desktop) cfg.wallpapers.desktop = req.body.desktop;
  if (req.body.mobile) cfg.wallpapers.mobile = req.body.mobile;
  saveSiteConfig(cfg);
  syncWallpaperToTS(cfg);
  res.json({ ok: true });
});

app.get("/api/config/video", rateLimit(30, 60000), function(req, res) {
  var cfg = loadSiteConfig();
  var files = scanFiles(VIDEO_DIR, [".mp4", ".webm", ".ogg", ".mov"]);
  res.json({ ok: true, video: cfg.video, files: files.map(function(f) { return { name: f.name, size: f.size }; }) });
});

app.post("/api/config/video/upload", rateLimit(30, 60000), videoUpload.single("file"), function(req, res) {
  if (!req.file) return res.json({ ok: false, error: "没有文件" });
  res.json({ ok: true, filename: req.file.filename });
});

app.post("/api/config/video/select", rateLimit(30, 60000), function(req, res) {
  var filename = req.body.filename;
  if (!filename) return res.json({ ok: false, error: "缺少文件名" });
  var cfg = loadSiteConfig();
  cfg.video = "/assets/videos/" + filename;
  saveSiteConfig(cfg);
  syncWallpaperToTS(cfg);
  res.json({ ok: true });
});

app.post("/api/config/video/delete", rateLimit(30, 60000), function(req, res) {
  var filename = req.body.filename;
  if (!filename) return res.json({ ok: false, error: "缺少文件名" });
  var cfg = loadSiteConfig();
  if (cfg.video === "/assets/videos/" + filename) { cfg.video = ""; saveSiteConfig(cfg); syncWallpaperToTS(cfg); }
  var filePath = path.join(VIDEO_DIR, filename);
  if (fs.existsSync(filePath)) { try { fs.unlinkSync(filePath); } catch(e) {} }
  res.json({ ok: true });
});

app.get("/api/config/music", rateLimit(30, 60000), function(req, res) {
  var cfg = loadSiteConfig();
  var files = scanFiles(MUSIC_DIR, [".mp3", ".ogg", ".wav", ".flac", ".aac", ".m4a"]);
  res.json({ ok: true, music: cfg.music, files: files.map(function(f) { return { name: f.name, size: f.size }; }) });
});

app.post("/api/config/music/upload", rateLimit(30, 60000), musicUpload.single("file"), function(req, res) {
  if (!req.file) return res.json({ ok: false, error: "没有文件" });
  res.json({ ok: true, filename: req.file.filename });
});

app.post("/api/config/music/update", rateLimit(30, 60000), function(req, res) {
  var cfg = loadSiteConfig();
  cfg.music = req.body.music || [];
  saveSiteConfig(cfg);
  syncMusicToTS(cfg);
  res.json({ ok: true });
});

app.post("/api/config/music/delete", rateLimit(30, 60000), function(req, res) {
  var filename = req.body.filename;
  if (!filename) return res.json({ ok: false, error: "缺少文件名" });
  var cfg = loadSiteConfig();
  cfg.music = cfg.music.filter(function(m) { return m.url !== "/assets/music/" + filename; });
  saveSiteConfig(cfg);
  syncMusicToTS(cfg);
  var filePath = path.join(MUSIC_DIR, filename);
  if (fs.existsSync(filePath)) { try { fs.unlinkSync(filePath); } catch(e) {} }
  res.json({ ok: true });
});

app.post("/api/config/music/cover-upload", rateLimit(30, 60000), musicCoverUpload.single("file"), function(req, res) {
  if (!req.file) return res.json({ ok: false, error: "没有文件" });
  res.json({ ok: true, filename: req.file.filename, path: "/assets/music/cover/" + req.file.filename });
});

app.get("/api/config/announcement", rateLimit(30, 60000), function(req, res) {
  var cfg = loadSiteConfig();
  res.json({ ok: true, announcement: cfg.announcement });
});

app.post("/api/config/announcement", rateLimit(30, 60000), function(req, res) {
  var cfg = loadSiteConfig();
  cfg.announcement = req.body.announcement || cfg.announcement;
  saveSiteConfig(cfg);
  syncAnnouncementToTS(cfg);
  res.json({ ok: true });
});

app.get("/api/config/friends", rateLimit(30, 60000), function(req, res) {
  var cfg = loadSiteConfig();
  res.json({ ok: true, friends: cfg.friends || [] });
});

app.post("/api/config/friends", rateLimit(30, 60000), function(req, res) {
  try {
    var cfg = loadSiteConfig();
    var input = Array.isArray(req.body.friends) ? req.body.friends : [];
    cfg.friends = input.map(normalizeFriendItem);
    saveSiteConfig(cfg);
    syncFriendsToTS(cfg);
    res.json({ ok: true, friends: cfg.friends });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.get("/api/config/about", rateLimit(30, 60000), function(req, res) {
  var cfg = loadSiteConfig();
  res.json({ ok: true, about: cfg.about || "" });
});

app.post("/api/config/about", rateLimit(30, 60000), function(req, res) {
  var cfg = loadSiteConfig();
  cfg.about = req.body.about || "";
  saveSiteConfig(cfg);
  res.json({ ok: true });
});

app.post("/api/config/publish", rateLimit(10, 60000), async function(req, res) {
  try {
    await git.add(".");
    await git.commit("chore: 更新站点配置");
    await git.push("origin", currentBranch);
    res.json({ ok: true, message: "已推送到仓库" });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ── Dashboard 列表页 ──
app.get("/", function(req, res) {
  try {
    var posts = getAllPosts();
    posts.sort(function(a, b) { return new Date(b.data.published) - new Date(a.data.published); });

    var totalPosts = posts.length;
    var draftCount = posts.filter(function(p) { return p.data.draft; }).length;
    var pinnedCount = posts.filter(function(p) { return p.data.pinned; }).length;
    var allTags = {};
    posts.forEach(function(p) { (p.data.tags || []).forEach(function(t) { allTags[t] = 1; }); });
    var tagCount = Object.keys(allTags).length;
    var cats = {};
    posts.forEach(function(p) { if (p.data.category) cats[p.data.category] = 1; });
    var catCount = Object.keys(cats).length;
    var stagedCount = loadStaging().length;

    // ── 表格行 ──
    var rows = posts.map(function(p) {
      var tags = (p.data.tags || []).map(function(t) { return '<span class="tag">' + esc(t) + '</span>'; }).join("");
      var badges = [];
      if (p.data.draft) badges.push('<span class="draft-badge">草稿</span>');
      if (p.data.pinned) badges.push('<span class="pinned-badge">置顶</span>');
      if (isStaged(p.slug)) badges.push('<span class="staged-badge">已暂存</span>');
      var date = p.data.published ? parseDateFlexible(p.data.published).toLocaleString("zh-CN", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false, timeZone:"Asia/Shanghai" }) : "-";
      return '<tr><td><a href="/edit?slug=' + encodeURIComponent(p.slug) + '">' + esc(p.data.title || p.slug) + '</a> ' + badges.join(" ") + '</td><td>' + date + '</td><td>' + (tags || '<span style="color:#cbd5e1">-</span>') + '</td><td>' + p.size + '</td><td class="actions"><a href="/edit?slug=' + encodeURIComponent(p.slug) + '" class="btn btn-ghost btn-sm">编辑</a><button class="btn btn-danger btn-sm" onclick="deletePost(\'' + escJS(p.slug) + '\')">删除</button></td></tr>';
    }).join("\n");

    // ── Dashboard ──
    var body = '';
    body += '<div class="app-shell">';
    body += '<header class="app-header">';
    body += '<div class="header-brand">';
    body += '<div class="brand-mark"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 5 L38 22 L55 28 L38 34 L32 52 L26 34 L9 28 L26 22 Z" fill="white"/></svg></div>';
    body += '<div class="header-brand-text"><strong>Aurora</strong><span>后台管理</span></div>';
    body += '</div>';
    body += '<div class="header-actions">';
    body += '<a href="/" class="mini-btn">' + icRefresh + ' 刷新</a>';
    body += '<div class="action-group">';
    body += '<a href="/new" class="primary-action">新建文章</a>';
    body += '<a href="/new-dynamic" class="secondary-action">新建动态</a>';
    body += '</div>';
    body += '</div>';
    body += '</header>';

    body += '<div class="stats-grid">';
    body += '<div class="stat-badge"><span class="label">文章</span><strong>' + totalPosts + '</strong></div>';
    body += '<div class="stat-badge"><span class="label">分类</span><strong>' + catCount + '</strong></div>';
    body += '<div class="stat-badge"><span class="label">标签</span><strong>' + tagCount + '</strong></div>';
    body += '<div class="stat-badge"><span class="label">置顶</span><strong>' + pinnedCount + '</strong></div>';
    body += '</div>';

    body += '<div class="app-main">';
    body += '<div class="main-column">';

    var dynamicEntries = [];
    try {
      var dynamicJson = fs.readFileSync(path.join(PROJECT_ROOT, "src", "content", "dynamic", "index.json"), "utf-8");
      dynamicEntries = JSON.parse(dynamicJson);
    } catch (e) {
      dynamicEntries = [];
    }

    function renderRecentList(items, type) {
      if (!items || items.length === 0) {
        return '<div class="empty-state">暂无' + (type === "dynamic" ? '动态' : '文章') + '记录</div>';
      }
      return '<table class="list-table"><thead><tr><th>标题</th><th>日期</th><th>标签</th><th>大小</th><th>操作</th></tr></thead><tbody>' + items.slice(0, 3).map(function(item) {
        var tagHtml = (item.tags || []).slice(0, 2).map(function(tag) { return '<span class="tag">' + esc(tag) + '</span>'; }).join("") || '<span style="color:#94a3b8">-</span>';
        var slug = item.slug || item.id || "";
        var title = item.title || slug || "未命名";
        return '<tr><td>' + esc(title) + '</td><td>' + esc(item.date || "-") + '</td><td>' + tagHtml + '</td><td>' + esc(item.size || "-") + '</td><td class="actions"><a href="' + (item.href || "/") + '" class="btn btn-ghost btn-sm">修改</a><button type="button" class="btn btn-danger btn-sm" onclick="deleteRecentItem(\'' + type + '\', \'' + escJS(slug) + '\', \'' + escJS(title) + '\')">删除</button></td></tr>';
      }).join("") + '</tbody></table>';
    }

    var recentDynamics = dynamicEntries.slice(0, 3).map(function(item) {
      return {
        slug: item.slug || item.id || "",
        title: item.title || item.id || "未命名动态",
        date: item.date || "-",
        tags: item.tags || [],
        size: item.size || "-",
        href: item.href || "/dynamic/"
      };
    });

    var recentPosts = posts.slice(0, 3).map(function(p) {
      return {
        slug: p.slug,
        title: p.data.title || p.slug,
        date: p.data.published ? parseDateFlexible(p.data.published).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai" }) : "-",
        tags: p.data.tags || [],
        size: p.size || "-",
        href: "/edit?slug=" + encodeURIComponent(p.slug)
      };
    });

    body += '<div class="list-card">';
    body += '<div class="list-card-header"><h3>最近动态</h3><span>最新 3 条</span></div>';
    body += '<div class="list-card-body">' + renderRecentList(recentDynamics, "dynamic") + '</div>';
    body += '</div>';

    body += '<div class="list-card">';
    body += '<div class="list-card-header"><h3>最近文章</h3><span>最新 3 篇</span></div>';
    body += '<div class="list-card-body">' + renderRecentList(recentPosts, "post") + '</div>';
    body += '</div>';

    body += '</div>';

    body += '<aside class="side-column">';
    body += '<div class="quick-card"><h4>快捷操作</h4><div class="quick-list">';
    body += '<a href="/posts" class="quick-link">' + icDoc + ' 全部文章<span class="count-badge">' + totalPosts + '</span></a>';
    body += '<a href="/dynamics" class="quick-link">' + icInbox + ' 全部动态<span class="count-badge">' + dynamicEntries.length + '</span></a>';
    body += '<a href="/gallery-admin" class="quick-link">' + icImage + ' 相册管理</a>';
    body += '<a href="/staging" class="quick-link">' + icInbox + ' 暂存列表' + (stagedCount > 0 ? '<span class="count-badge">' + stagedCount + '</span>' : '') + '</a>';
    body += '<a href="/config/announcement" class="quick-link">' + icAnnounce + ' 公告管理</a>';
    body += '<a href="/config/about" class="quick-link">' + icUser + ' 关于我</a>';
    body += '<a href="/config/friends" class="quick-link">' + icUser + ' 底层修改</a>';
    body += '</div></div>';

    var stagingList = loadStaging();
    if (stagingList.length > 0) {
      body += '<div class="quick-card" style="margin-top:16px"><h4>待推送</h4><div class="quick-list">';
      stagingList.slice(0, 4).forEach(function(s) {
        body += '<a href="/edit?slug=' + encodeURIComponent(s.slug) + '" class="quick-link"><span style="display:inline-block;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(s.title || s.slug) + '</span></a>';
      });
      body += '</div></div>';
    }

    body += '</aside>';
    body += '</div>';
    body += '</div>';

    body += '<script>function deleteRecentItem(type,slug,title){if(!slug){showToast("缺少删除目标","error");return;}var target=title||slug;var confirmText=type==="dynamic"?"确认删除动态『"+target+"』吗？删除后将从本地动态数据中移除，并同步到 GitHub。":"确认删除文章『"+target+"』吗？删除后将从本地文件中移除，并同步到 GitHub。";if(!confirm(confirmText))return;var btn=event&&event.target?event.target:null;if(btn) setLoading(btn,true);var route=type==="dynamic"?"/api/dynamic/"+encodeURIComponent(slug):"/api/post/"+encodeURIComponent(slug);fetch(route,{method:"DELETE"}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast(j.message||"删除成功","success");setTimeout(function(){location.reload()},800)}else{showToast(j.error||"删除失败","error");if(btn) setLoading(btn,false)}}).catch(function(){showToast("网络错误","error");if(btn) setLoading(btn,false)})}function deletePost(slug){if(!confirm("确定删除 "+slug+" ?"))return;var btn=event.target;setLoading(btn,true);fetch("/api/post/"+encodeURIComponent(slug),{method:"DELETE"}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast(j.message,"success");setTimeout(function(){location.reload()},800)}else{showToast(j.error||"删除失败","error")}}).catch(function(){showToast("网络错误","error")});setLoading(btn,false)}</script>';

    res.send(wrapHTML("文章列表", body));
  } catch (e) {
    res.status(500).send(wrapHTML("错误", '<div class="container"><h1>错误</h1><pre>' + esc(e.message) + '</pre></div>'));
  }
});

// ── 全部文章列表页 ──
app.get("/posts", rateLimit(30, 60000), function(req, res) {
  try {
    var posts = getAllPosts();
    posts.sort(function(a, b) { return new Date(b.data.published) - new Date(a.data.published); });
    var body = '<div class="app-shell"><header class="app-header"><div class="header-brand"><div class="brand-mark"><svg viewBox="0 0 64 64"><path d="M32 5 L38 22 L55 28 L38 34 L32 52 L26 34 L9 28 L26 22 Z" fill="white"/></svg></div><div class="header-brand-text"><strong>Aurora</strong><span>全部文章</span></div></div><div class="header-actions"><a href="/" class="mini-btn">🏠 返回后台</a><a href="/new" class="primary-action" style="display:inline-flex;align-items:center;gap:6px;padding:10px 18px;text-decoration:none;font-weight:600;font-size:13px;border-radius:12px;background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff">+ 新建文章</a></div></header>';
    body += '<div class="stats-grid" style="grid-template-columns:repeat(2,minmax(140px,1fr))"><div class="stat-badge"><span class="label">总文章</span><strong>' + posts.length + '</strong></div><div class="stat-badge"><span class="label">草稿</span><strong>' + posts.filter(function(p){return p.data.draft}).length + '</strong></div></div>';
    body += '<div class="app-main" style="flex-direction:column"><div class="main-column" style="width:100%"><div class="list-card"><div class="list-card-header"><h3>文章列表</h3><span>' + posts.length + ' 篇</span></div><div class="list-card-body" style="padding:0">';
    if (posts.length === 0) {
      body += '<div class="empty-state" style="padding:40px;text-align:center"><p style="color:#94a3b8;margin:0 0 16px">暂无文章</p><a href="/new" class="btn btn-primary">新建文章</a></div>';
    } else {
      body += '<table class="list-table"><thead><tr><th>标题</th><th>日期</th><th>标签</th><th style="text-align:right">操作</th></tr></thead><tbody>';
      posts.forEach(function(p) {
        var tags = (p.data.tags || []).map(function(t) { return '<span class="tag">' + esc(t) + '</span>'; }).join("");
        var badges = [];
        if (p.data.draft) badges.push('<span class="draft-badge">草稿</span>');
        if (p.data.pinned) badges.push('<span class="pinned-badge">置顶</span>');
        var date = p.data.published ? parseDateFlexible(p.data.published).toLocaleString("zh-CN", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hour12:false, timeZone:"Asia/Shanghai" }) : "-";
        body += '<tr><td><a href="/edit?slug=' + encodeURIComponent(p.slug) + '" style="color:#2563eb;text-decoration:none;font-weight:500">' + esc(p.data.title || p.slug) + '</a> ' + badges.join(" ") + '</td><td style="color:#64748b;font-size:13px">' + date + '</td><td>' + (tags || '<span style="color:#cbd5e1">-</span>') + '</td><td style="text-align:right"><div style="display:flex;gap:6px;justify-content:flex-end"><a href="/edit?slug=' + encodeURIComponent(p.slug) + '" class="btn btn-ghost btn-sm">编辑</a><button class="btn btn-danger btn-sm" onclick="deletePost(\'' + escJS(p.slug) + '\')">删除</button></div></td></tr>';
      });
      body += '</tbody></table>';
    }
    body += '</div></div></div></div></div>';
    body += '<script>function deletePost(slug){if(!confirm("确定删除 "+slug+" ?"))return;var btn=event.target;setLoading(btn,true);fetch("/api/post/"+encodeURIComponent(slug),{method:"DELETE"}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast(j.message,"success");setTimeout(function(){location.reload()},800)}else{showToast(j.error||"删除失败","error")}}).catch(function(){showToast("网络错误","error")})}</script>';
    res.send(wrapHTML("全部文章", body));
  } catch (e) { res.status(500).send(wrapHTML("错误", '<div class="container"><h1>错误</h1><pre>' + esc(e.message) + '</pre></div>')); }
});

// ── 全部动态列表页 ──
app.get("/dynamics", rateLimit(30, 60000), function(req, res) {
  try {
    var dynamicDir = path.join(PROJECT_ROOT, "src", "content", "dynamic");
    var dynamics = [];
    if (fs.existsSync(dynamicDir)) {
      var files = fs.readdirSync(dynamicDir).filter(function(f) { return /\.(md|mdx)$/i.test(f); });
      files.forEach(function(f) {
        var raw = fs.readFileSync(path.join(dynamicDir, f), "utf-8");
        var parsed = matter(raw);
        dynamics.push({ slug: f.replace(/\.(md|mdx)$/i, ""), file: f, published: parsed.data.published || null, pinned: parsed.data.pinned || false, location: parsed.data.location || "", content: (parsed.content || "").trim().slice(0, 120) });
      });
    }
    dynamics.sort(function(a, b) { return (b.published ? new Date(b.published) : 0) - (a.published ? new Date(a.published) : 0); });

    var body = '<div class="app-shell"><header class="app-header"><div class="header-brand"><div class="brand-mark"><svg viewBox="0 0 64 64"><path d="M32 5 L38 22 L55 28 L38 34 L32 52 L26 34 L9 28 L26 22 Z" fill="white"/></svg></div><div class="header-brand-text"><strong>Aurora</strong><span>全部动态</span></div></div><div class="header-actions"><a href="/" class="mini-btn">🏠 返回后台</a><a href="/new-dynamic" class="primary-action" style="display:inline-flex;align-items:center;gap:6px;padding:10px 18px;text-decoration:none;font-weight:600;font-size:13px;border-radius:12px;background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff">+ 新建动态</a></div></header>';
    body += '<div class="stats-grid" style="grid-template-columns:repeat(2,minmax(140px,1fr))"><div class="stat-badge"><span class="label">总动态</span><strong>' + dynamics.length + '</strong></div><div class="stat-badge"><span class="label">置顶</span><strong>' + dynamics.filter(function(d){return d.pinned}).length + '</strong></div></div>';
    body += '<div class="app-main" style="flex-direction:column"><div class="main-column" style="width:100%"><div class="list-card"><div class="list-card-header"><h3>动态列表</h3><span>' + dynamics.length + ' 条</span></div><div class="list-card-body" style="padding:0">';

    if (dynamics.length === 0) {
      body += '<div class="empty-state" style="padding:40px;text-align:center"><p style="color:#94a3b8;margin:0 0 16px">暂无动态</p><a href="/new-dynamic" class="btn btn-primary">新建动态</a></div>';
    } else {
      body += '<table class="list-table"><thead><tr><th>内容</th><th>日期</th><th>位置</th><th style="text-align:right">操作</th></tr></thead><tbody>';
      dynamics.forEach(function(d) {
        var badges = d.pinned ? '<span class="pinned-badge">置顶</span>' : '';
        var date = d.published ? new Date(d.published).toLocaleString("zh-CN", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hour12:false, timeZone:"Asia/Shanghai" }) : "-";
        var preview = esc(d.content.replace(/!\[.*?\]\(.*?\)/g, "[图片]").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\n/g, " ").slice(0, 80));
        body += '<tr><td style="max-width:300px"><span style="color:#1a1a1a">' + preview + (d.content.length > 80 ? "..." : "") + '</span> ' + badges + '</td><td style="color:#64748b;font-size:13px;white-space:nowrap">' + date + '</td><td style="color:#64748b;font-size:13px">' + (d.location ? esc(d.location) : '<span style="color:#cbd5e1">-</span>') + '</td><td style="text-align:right"><button class="btn btn-danger btn-sm" onclick="deleteDynamic(\'' + escJS(d.slug) + '\')">删除</button></td></tr>';
      });
      body += '</tbody></table>';
    }
    body += '</div></div></div></div></div>';
    body += '<script>function deleteDynamic(slug){if(!confirm("确定删除动态 "+slug+" ?"))return;var btn=event.target;setLoading(btn,true);fetch("/api/dynamic/"+encodeURIComponent(slug),{method:"DELETE"}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast(j.message,"success");setTimeout(function(){location.reload()},800)}else{showToast(j.error||"删除失败","error")}}).catch(function(){showToast("网络错误","error")})}</script>';
    res.send(wrapHTML("全部动态", body));
  } catch (e) { res.status(500).send(wrapHTML("错误", '<div class="container"><h1>错误</h1><pre>' + esc(e.message) + '</pre></div>')); }
});

// ── 暂存列表页 ──
app.get("/staging", function(req, res) {
  try {
    var stagingList = loadStaging();
    var allPosts = getAllPosts();

    var body = '';
    body += '<div class="app-shell">';
    body += '<header class="app-header">';
    body += '<div class="header-brand">';
    body += '<div class="brand-mark"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 5 L38 22 L55 28 L38 34 L32 52 L26 34 L9 28 L26 22 Z" fill="white"/></svg></div>';
    body += '<div class="header-brand-text"><strong>Aurora</strong><span>暂存列表</span></div>';
    body += '</div>';
    body += '<div class="header-actions">';
    body += '<a href="/" class="mini-btn">🏠 返回后台</a>';
    if (stagingList.length > 0) {
      body += '<a href="#" class="primary-action" onclick="batchPush();return false" style="display:inline-flex;align-items:center;gap:6px;padding:10px 18px;text-decoration:none;font-weight:600;font-size:13px;border-radius:12px;background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;border:none">📦 全部推送</a>';
    }
    body += '</div>';
    body += '</header>';

    body += '<div class="stats-grid" style="grid-template-columns:repeat(2,minmax(140px,1fr))">';
    body += '<div class="stat-badge"><span class="label">待推送</span><strong>' + stagingList.length + '</strong></div>';
    body += '<div class="stat-badge"><span class="label">总文章</span><strong>' + allPosts.length + '</strong></div>';
    body += '</div>';

    body += '<div class="app-main" style="flex-direction:column">';
    body += '<div class="main-column" style="width:100%">';

    if (stagingList.length === 0) {
      body += '<div class="list-card"><div class="list-card-body">';
      body += '<div class="empty-state" style="padding:40px;text-align:center">';
      body += '<p style="color:#94a3b8;font-size:14px;margin:0 0 16px">暂存列表为空</p>';
      body += '<a href="/new" class="btn btn-primary">新建文章</a>';
      body += '</div>';
      body += '</div></div>';
    } else {
      body += '<div class="list-card">';
      body += '<div class="list-card-header"><h3>待推送文章</h3><span>' + stagingList.length + ' 篇</span></div>';
      body += '<div class="list-card-body" style="padding:0">';
      body += '<table class="list-table"><thead><tr><th>标题</th><th>暂存时间</th><th style="text-align:right">操作</th></tr></thead><tbody>';
      stagingList.forEach(function(s) {
        var post = allPosts.find(function(p) { return p.slug === s.slug; });
        var date = s.stagedAt ? new Date(s.stagedAt).toLocaleString("zh-CN", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hour12:false }) : "-";
        body += '<tr>';
        body += '<td><a href="/edit?slug=' + encodeURIComponent(s.slug) + '" style="color:#2563eb;text-decoration:none;font-weight:500">' + esc(post ? (post.data.title || s.slug) : s.title || s.slug) + '</a></td>';
        body += '<td style="color:#64748b;font-size:13px">' + date + '</td>';
        body += '<td class="actions">';
        body += '<a href="/edit?slug=' + encodeURIComponent(s.slug) + '" class="btn btn-ghost btn-sm">编辑</a>';
        body += '<button class="btn btn-primary btn-sm" onclick="pushOne(\'' + escJS(s.slug) + '\',this)">推送</button>';
        body += '<button class="btn btn-danger btn-sm" onclick="removeStaged(\'' + escJS(s.slug) + '\')">移除</button>';
        body += '</td></tr>';
      });
      body += '</tbody></table>';
      body += '</div></div>';
    }

    body += '</div></div></div>';

    body += '<script>';
    body += 'function pushOne(slug,btn){setLoading(btn,true);fetch("/api/staging/push-single",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({slugs:[slug]})}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast(j.message,"success");setTimeout(function(){location.reload()},800)}else{showToast(j.error||"推送失败","error");setLoading(btn,false)}}).catch(function(){showToast("网络错误","error");setLoading(btn,false)})}';
    body += 'function removeStaged(slug){if(!confirm("从暂存列表移除 "+slug+" ?"))return;fetch("/api/staging/remove",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({slug:slug})}).then(function(r){return r.json()}).then(function(j){if(j.ok){location.reload()}else{showToast(j.error||"操作失败","error")}}).catch(function(){showToast("网络错误","error")})}';
    body += 'function batchPush(){if(!confirm("确认将所有暂存文章推送到仓库？"))return;var btn=document.querySelector(".primary-action");setLoading(btn,true);fetch("/api/staging/batch-push",{method:"POST"}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast(j.message,"success",4000);setTimeout(function(){location.reload()},1500)}else{showToast(j.error||"推送失败","error");setLoading(btn,false)}}).catch(function(){showToast("网络错误","error");setLoading(btn,false)})}';
    body += '</script>';

    res.send(wrapHTML("暂存列表", body));
  } catch (e) {
    res.status(500).send(wrapHTML("错误", '<div class="container"><h1>错误</h1><pre>' + esc(e.message) + '</pre></div>'));
  }
});

// ── Gallery 管理列表页 ──
app.get("/gallery-admin", rateLimit(60, 60000), function(req, res) {
  try {
    var config = parseGalleryConfig();
    var albums = config.albums.map(function(album) {
      var photoCount = getAlbumPhotoCount(album.id);
      return { id: album.id, name: album.name, description: album.description || "", date: album.date || "", location: album.location || "", tags: album.tags || [], cover: album.cover || "", password: album.password || "", photoCount: photoCount };
    });

    var totalPhotos = albums.reduce(function(s, a) { return s + a.photoCount; }, 0);

    var body = '';
    body += '<div style="max-width:1100px;margin:0 auto;padding:24px 20px 0">';
    body += '<header style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">';
    body += '<h1 style="font-size:20px;font-weight:600;display:flex;align-items:center;gap:8px">📸 相册管理<span style="color:#94a3b8;font-weight:400;font-size:14px;margin-left:4px">' + albums.length + ' 个相册</span></h1>';
    body += '<div style="display:flex;gap:8px"><a href="/" class="btn btn-ghost btn-sm">🏠 后台首页</a><a href="/gallery-admin/new" class="btn btn-primary">+ 新建相册</a></div>';
    body += '</header>';
    body += '<div class="stats-summary">';
    body += '<div class="stat-chip">📷 <strong>' + albums.length + '</strong> 个相册</div>';
    body += '<div class="stat-chip">🖼️ <strong>' + totalPhotos + '</strong> 张图片</div>';
    body += '</div></div>';

    body += '<div class="container">';
    if (albums.length === 0) {
      body += '<div class="empty" style="background:#fff;border-radius:10px;border:1px solid #e8e8e8"><p>还没有相册</p><a href="/gallery-admin/new" class="btn btn-primary">创建第一个相册</a></div>';
    } else {
      body += '<div style="background:#fff;border-radius:10px;border:1px solid #e8e8e8;overflow:hidden">';
      body += '<table class="post-table"><thead><tr><th>相册</th><th>日期</th><th>标签</th><th>图片</th><th>操作</th></tr></thead><tbody>';
      albums.forEach(function(a) {
        var tags = a.tags.map(function(t) { return '<span class="tag">' + esc(t) + '</span>'; }).join("");
        var badges = [];
        if (a.password) badges.push('<span class="draft-badge">🔒 加密</span>');
        body += '<tr>';
        body += '<td><a href="/gallery-admin/edit?id=' + encodeURIComponent(a.id) + '">' + esc(a.name) + '</a> ' + badges.join(" ") + ' <span style="color:#94a3b8;font-size:12px">' + esc(a.id) + '</span></td>';
        body += '<td>' + esc(a.date || '-') + '</td>';
        body += '<td>' + (tags || '<span style="color:#cbd5e1">-</span>') + '</td>';
        body += '<td>' + a.photoCount + ' 张</td>';
        body += '<td class="actions">';
        body += '<a href="/gallery-admin/edit?id=' + encodeURIComponent(a.id) + '" class="btn btn-ghost btn-sm">编辑</a>';
        body += '<button class="btn btn-danger btn-sm" onclick="deleteAlbum(\'' + escJS(a.id) + '\',\'' + escJS(a.name) + '\')">删除</button>';
        body += '</td></tr>';
      });
      body += '</tbody></table></div>';
    }
    body += '</div>';

    body += '<script>';
    body += 'function deleteAlbum(id,name){if(!confirm("确定删除相册「"+name+"」？\
\
这将同时删除相册目录和所有图片，且无法恢复！"))return;var btn=event.target;setLoading(btn,true);fetch("/api/gallery/"+encodeURIComponent(id),{method:"DELETE"}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast(j.message,"success");setTimeout(function(){location.reload()},800)}else{showToast(j.error||"删除失败","error");setLoading(btn,false)}}).catch(function(){showToast("网络错误","error");setLoading(btn,false)})}';
    body += '</script>';

    res.send(wrapHTML("相册管理", body));
  } catch (e) {
    res.status(500).send(wrapHTML("错误", '<div class="container"><h1>错误</h1><pre>' + esc(e.message) + '</pre></div>'));
  }
});

// ── Gallery 新建/编辑表单页 ──
app.get("/gallery-admin/new", rateLimit(30, 60000), function(req, res) { serveGalleryEditor(null, res); });
app.get("/gallery-admin/edit", rateLimit(30, 60000), function(req, res) {
  var albumId = req.query.id;
  if (!albumId) return res.redirect("/gallery-admin");
  // 使用更严格的验证
  if (!validateAlbumIdSafe(albumId)) {
    return res.status(400).send(wrapHTML("错误", '<div class="container"><h1>无效的相册 ID</h1><p>相册 ID 只能包含字母、数字、连字符和下划线。</p><a href="/gallery-admin" class="btn btn-ghost">← 返回列表</a></div>'));
  }
  serveGalleryEditor(albumId, res);
});

function serveGalleryEditor(albumId, res) {
  var config = parseGalleryConfig();
  var album = null;
  var isNew = true;

  if (albumId) {
    for (var i = 0; i < config.albums.length; i++) {
      if (config.albums[i].id === albumId) { album = config.albums[i]; break; }
    }
    if (!album) return res.redirect("/gallery-admin");
    isNew = false;
  }

  var formTitle = isNew ? "新建相册" : "编辑: " + (album.name || albumId);
  var data = album || { id: "", name: "", description: "", date: "", location: "", tags: [], cover: "", password: "", passwordHint: "" };
  var safeIdForJS = escJS(albumId || "");

  var body = '<div class="container"><header><h1>' + esc(formTitle) + '</h1><a href="/gallery-admin" class="btn btn-ghost">← 返回列表</a></header>';
  body += '<form id="galleryForm"><div class="form-grid">';

  // ID
  body += '<div class="form-group"><label>相册 ID *</label><input type="text" name="id" value="' + esc(data.id || "") + '" required placeholder="如: japan-2025"' + (albumId ? ' readonly style="background:#f1f5f9"' : '') + '><span class="help-text">只能包含字母、数字、连字符和下划线，作为目录名</span></div>';
  // Name
  body += '<div class="form-group"><label>相册名称 *</label><input type="text" name="name" value="' + esc(data.name || "") + '" required placeholder="相册显示名称"></div>';
  // Description
  body += '<div class="form-group full"><label>描述</label><textarea name="description" style="min-height:80px" placeholder="相册描述">' + esc(data.description || "") + '</textarea></div>';
  // Date
  body += '<div class="form-group"><label>日期</label><input type="date" name="date" value="' + esc(data.date || "") + '"></div>';
  // Location
  body += '<div class="form-group"><label>拍摄地点</label><input type="text" name="location" value="' + esc(data.location || "") + '" placeholder="如：日本东京"></div>';
  // Tags
  body += '<div class="form-group"><label>标签（逗号分隔）</label><input type="text" name="tags" value="' + esc((data.tags || []).join(", ")) + '" placeholder="风景, 旅行, 日本"></div>';
  // Cover
  body += '<div class="form-group"><label>封面图</label><input type="text" name="cover" value="' + esc(data.cover || "") + '" placeholder="留空自动选择"><span class="help-text">可填 cover.jpg 或图片文件名，留空则用第一张图</span></div>';
  // Password
  body += '<div class="form-group"><label>访问密码</label><input type="text" name="password" value="' + esc(data.password || "") + '" placeholder="留空不加密"></div>';
  // Password Hint
  body += '<div class="form-group"><label>密码提示</label><input type="text" name="passwordHint" value="' + esc(data.passwordHint || "") + '"></div>';
  body += '</div>'; // form-grid

  // 操作按钮
  body += '<div class="form-actions">';
  body += '<button type="submit" class="btn btn-primary" id="saveBtn">保存</button>';
  body += '<a href="/gallery-admin" class="btn btn-ghost">取消</a>';
  body += '</div>';
  body += '</form>';

  // ── 照片管理（仅编辑模式）──
  if (!isNew) {
    body += '<div style="margin-top:32px;border-top:1px solid #e2e8f0;padding-top:24px">';
    body += '<h2 style="font-size:16px;font-weight:600;margin-bottom:16px">📷 照片管理 <span style="color:#94a3b8;font-weight:400;font-size:13px" id="photoCountBadge"></span></h2>';

    // 上传区域
    body += '<div class="upload-zone" id="galleryUploadZone" onclick="document.getElementById(\'galleryFileInput\').click()" style="margin-bottom:16px">';
    body += '<input type="file" id="galleryFileInput" accept="image/*" multiple>';
    body += '<div id="galleryUploadHint">点击或拖拽图片到此处上传到相册<br><span style="font-size:12px">支持多选，JPG / PNG / GIF / WebP / AVIF / SVG，最大 20MB</span></div>';
    body += '</div>';

    // URLs.txt 远程图片
    body += '<div class="form-group" style="margin-bottom:16px"><label>远程图片 URL（每行一个）</label>';
    body += '<textarea id="urlsTextarea" style="min-height:100px;font-family:\'JetBrains Mono\',monospace;font-size:13px" placeholder="https://example.com/photo1.jpg&#10;https://example.com/photo2.png"></textarea>';
    body += '<div style="display:flex;gap:8px;margin-top:6px"><button type="button" class="btn btn-ghost btn-sm" onclick="saveUrls()">保存 URL 列表</button><span class="help-text" style="display:flex;align-items:center">每行一个 URL，前端会读取 urls.txt 加载远程图片</span></div>';
    body += '</div>';

    // 照片网格
    body += '<div id="photoGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-top:16px"></div>';

    body += '</div>';
  }

  body += '</div>'; // container

  // ── JavaScript ──
  body += '<script>';
  if (!isNew) {
    body += 'var albumId="' + safeIdForJS + '";';
    body += 'function loadPhotos(){fetch("/api/gallery/"+encodeURIComponent(albumId)+"/photos").then(function(r){return r.json()}).then(function(j){if(!j.ok)return;var grid=document.getElementById("photoGrid");var badge=document.getElementById("photoCountBadge");badge.textContent="("+j.photos.length+" 张本地图片)";if(j.photos.length===0){grid.innerHTML="<p style=\\"color:#94a3b8;grid-column:1/-1;text-align:center;padding:20px\\">暂无本地图片</p>";return}grid.innerHTML=j.photos.map(function(p){return "<div style=\\"background:#f8fafc;border:1px solid #e8e8e8;border-radius:8px;overflow:hidden;position:relative\\">"+ "<div style=\\"height:140px;overflow:hidden;background:#f1f5f9;display:flex;align-items:center;justify-content:center\\">"+ "<img src=\\""+esc(p.path)+"\\" style=\\"width:100%;height:100%;object-fit:cover\\" onerror=\\"this.style.display=none\\">"+ "</div>"+ "<div style=\\"padding:8px 10px;font-size:12px\\">"+ "<div style=\\"color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\\">"+esc(p.name)+"</div>"+ "<div style=\\"color:#94a3b8;font-size:11px\\">"+esc(p.size)+"</div>"+ "</div>"+ "<button onclick=\\"deletePhoto(\\\\""+escJS(p.name)+"\\\\")\\" style=\\"position:absolute;top:6px;right:6px;width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,.5);color:#fff;border:none;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;line-height:1\\" title=\\"删除\\">×</button>"+ "</div>";}).join("");}).catch(function(e){console.error(e)})}';
    body += 'function deletePhoto(name){if(!confirm("确定删除图片 "+name+" ?"))return;fetch("/api/gallery/"+encodeURIComponent(albumId)+"/photo?name="+encodeURIComponent(name),{method:"DELETE"}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast(j.message,"success");loadPhotos()}else{showToast(j.error||"删除失败","error")}}).catch(function(){showToast("网络错误","error")})}';
    body += 'function saveUrls(){var text=document.getElementById("urlsTextarea").value;var urls=text.split("\
").map(function(l){return l.trim()}).filter(Boolean);fetch("/api/gallery/"+encodeURIComponent(albumId)+"/urls",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({urls:urls})}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast("URL 列表已保存","success")}else{showToast(j.error||"保存失败","error")}}).catch(function(){showToast("网络错误","error")})}';
    body += '(function(){loadPhotos();fetch("/api/gallery/"+encodeURIComponent(albumId)+"/photos").then(function(r){return r.json()}).then(function(j){if(j.ok&&j.urls){document.getElementById("urlsTextarea").value=j.urls.join("\n")}})})();';
    // 上传
    body += '(function(){var uz=document.getElementById("galleryUploadZone");var fi=document.getElementById("galleryFileInput");uz.addEventListener("dragover",function(e){e.preventDefault();uz.classList.add("dragover")});uz.addEventListener("dragleave",function(){uz.classList.remove("dragover")});uz.addEventListener("drop",function(e){e.preventDefault();uz.classList.remove("dragover");if(e.dataTransfer.files.length)uploadGalleryFiles(e.dataTransfer.files)});fi.addEventListener("change",function(){if(fi.files.length)uploadGalleryFiles(fi.files);fi.value=""});function uploadGalleryFiles(files){var fd=new FormData();for(var i=0;i<files.length;i++)fd.append("files",files[i]);var hint=document.getElementById("galleryUploadHint");hint.textContent="上传中...";fetch("/api/gallery/"+encodeURIComponent(albumId)+"/upload",{method:"POST",body:fd}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast("\\u2705 "+j.message,"success");loadPhotos();hint.innerHTML="上传成功！继续拖拽图片到此处可继续上传<br><span style=\\"font-size:12px\\">支持多选，JPG / PNG / GIF / WebP / AVIF / SVG，最大 20MB</span>"}else{showToast("\\u274c "+(j.error||"上传失败"),"error");hint.innerHTML="点击或拖拽图片到此处上传到相册<br><span style=\\"font-size:12px\\">支持多选，JPG / PNG / GIF / WebP / AVIF / SVG，最大 20MB</span>"}}).catch(function(){showToast("\\u274c 网络错误","error")})}})();';
  }
  // 表单提交
  body += 'document.getElementById("galleryForm").addEventListener("submit",function(e){';
  body += 'e.preventDefault();var submitBtn=e.submitter;setLoading(submitBtn,true);';
  body += 'var fd=new FormData(e.target);';
  body += 'var b={id:fd.get("id"),name:fd.get("name"),description:fd.get("description"),date:fd.get("date"),location:fd.get("location"),tags:fd.get("tags"),cover:fd.get("cover"),password:fd.get("password"),passwordHint:fd.get("passwordHint")};';
  body += 'fetch("/api/gallery",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)})';
  body += '.then(function(r){return r.json()}).then(function(j){';
  body += 'if(j.ok){showToast("\\u2705 "+j.message,"success",3000);setTimeout(function(){location.href="/gallery-admin/edit?id="+encodeURIComponent(j.id)},800)}';
  body += 'else{showToast("\\u274c "+(j.error||"保存失败"),"error",5000);setLoading(submitBtn,false)}}';
  body += ').catch(function(){showToast("\\u274c 网络错误","error");setLoading(submitBtn,false)})});';
  body += '</script>';

  res.send(wrapHTML(formTitle, body));
}

// ── 编辑/新建页 ──
app.get("/new", function(req, res) { serveEditor(null, res); });
app.get("/edit", function(req, res) {
  var slug = req.query.slug;
  if (!slug) return res.redirect("/");
  if (!validateSlug(slug)) return res.status(400).send(wrapHTML("错误", '<div class="container"><h1>无效的 Slug</h1><p>slug 只能包含字母、数字、中文、连字符和下划线。</p><a href="/" class="btn btn-ghost">← 返回列表</a></div>'));
  serveEditor(slug, res);
});

function serveEditor(slug, res) {
  var data = JSON.parse(JSON.stringify(FM_DEFAULTS));
  var content = "";
  var isNew = true;

  if (slug) {
    var filePath = findPostFile(slug);
    if (filePath) {
      var raw = fs.readFileSync(filePath, "utf-8");
      var parsed = matter(raw);
      var d = serializeFM(parsed.data);
      for (var k in d) { if (d[k] !== undefined && d[k] !== null) data[k] = d[k]; }
      content = parsed.content;
      isNew = false;
    }
  }

  var formTitle = isNew ? "新建文章" : "编辑: " + (data.title || slug);
  var staged = isStaged(slug);
  var safeSlugForJS = escJS(slug || "");

  var body = '<div class="container"><header><h1>' + esc(formTitle) + '</h1><a href="/" class="btn btn-ghost">← 返回列表</a></header>';
  body += '<form id="postForm"><div class="form-grid">';

  // 标题
  body += '<div class="form-group"><label>标题 *</label><input type="text" name="title" value="' + esc(data.title) + '" required placeholder="文章标题"></div>';
  // Slug
  body += '<div class="form-group"><label>Slug（文件名）</label><input type="text" name="slug" value="' + esc(slug || "") + '" placeholder="留空自动生成"' + (slug ? ' readonly style="background:#f1f5f9"' : '') + '><span class="help-text">作为 .md 文件名，留空则自动生成哈希值，如 post-k5x2m8a1</span></div>';
  // 日期
  var defaultDate = data.published ? String(data.published).slice(0, 10) : new Date().toISOString().slice(0, 10);
  body += '<div class="form-group"><label>发布日期（自动同步）</label><div style="display:flex;align-items:center;gap:6px;padding:8px 0">';
  body += '<span id="sysDate" style="font-size:20px;font-weight:600;font-family:\'JetBrains Mono\',monospace;color:#1a1a1a;letter-spacing:1px">' + defaultDate + '</span>';
  body += '<span style="color:#94a3b8;font-size:12px;margin-left:4px">📅 实时同步系统日期</span>';
  body += '</div></div>';
  body += '<div class="form-group"><label>发布时间（系统同步）</label><div style="display:flex;align-items:center;gap:6px;padding:8px 0">';
  body += '<span id="sysTime" style="font-size:20px;font-weight:600;font-family:\'JetBrains Mono\',monospace;color:#1a1a1a;letter-spacing:1px">--:--:--</span>';
  body += '<span style="color:#94a3b8;font-size:12px;margin-left:4px">⏱ 实时同步系统时钟</span>';
  body += '</div></div>';
  // 分类 / 标签
  body += '<div class="form-group"><label>分类</label><input type="text" name="category" value="' + esc(data.category || "") + '" placeholder="如：技术、随笔"></div>';
  body += '<div class="form-group"><label>标签（逗号分隔）</label><input type="text" name="tags" value="' + esc((data.tags || []).join(", ")) + '" placeholder="前端, Astro, 教程"></div>';

  // ── 封面图片区域 ──
  body += '<div class="form-group full"><label>封面图片</label>';
  body += '<div class="cover-section">';
  body += '<div class="cover-row">';
  body += '<div class="cover-upload"><div class="upload-zone" id="uploadZone" onclick="document.getElementById(\'fileInput\').click()">';
  body += '<input type="file" id="fileInput" accept="image/*">';
  body += '<div id="uploadHint">点击或拖拽图片到此处上传<br><span style="font-size:12px">支持 JPG / PNG / GIF / WebP / AVIF / SVG，最大 20MB</span></div>';
  body += '</div></div>';
  body += '<div><img class="cover-preview" id="coverPreview"></div>';
  body += '</div>';
  // 隐藏字段 + 预览
  body += '<input type="hidden" name="image" id="imageField" value="' + esc(data.image || "") + '">';
  body += '<div style="margin-top:8px;display:flex;align-items:center;gap:12px">';
  body += '<span class="help-text">当前值: <code id="imageCurrentValue">' + esc(data.image || "(空)") + '</code></span>';
  var thumbSrc = data.image ? "/api/thumb/" + encodeURIComponent(data.image) : "";
  body += '<img class="cover-preview' + (data.image ? " active" : "") + '" id="currentCover" style="width:80px;height:50px" src="' + esc(thumbSrc) + '">';
  body += '</div></div></div>';

  // 其他字段
  body += '<div class="form-group"><label>作者</label><input type="text" name="author" value="' + esc(data.author || "") + '"></div>';
  body += '<div class="form-group"><label>语言</label><input type="text" name="lang" value="' + esc(data.lang || "") + '" placeholder="留空默认中文"></div>';
  body += '<div class="form-group full"><label>描述</label><input type="text" name="description" value="' + esc(data.description || "") + '" placeholder="文章摘要，用于 SEO 和列表展示"></div>';
  body += '<div class="form-group"><label><input type="checkbox" name="draft"' + (data.draft ? " checked" : "") + '> 草稿（不发布）</label></div>';
  body += '<div class="form-group"><label><input type="checkbox" name="pinned"' + (data.pinned ? " checked" : "") + '> 置顶</label></div>';
  body += '<div class="form-group"><label><input type="checkbox" name="comment"' + (data.comment !== false ? " checked" : "") + '> 开启评论</label></div>';
  body += '<div class="form-group"><label>来源链接</label><input type="text" name="sourceLink" value="' + esc(data.sourceLink || "") + '"></div>';
  body += '<div class="form-group"><label>授权名称</label><input type="text" name="licenseName" value="' + esc(data.licenseName || "") + '"></div>';
  body += '<div class="form-group"><label>授权链接</label><input type="text" name="licenseUrl" value="' + esc(data.licenseUrl || "") + '"></div>';
  body += '<div class="form-group"><label>密码保护</label><input type="text" name="password" value="' + esc(data.password || "") + '" placeholder="留空不加密"></div>';
  body += '<div class="form-group"><label>密码提示</label><input type="text" name="passwordHint" value="' + esc(data.passwordHint || "") + '"></div>';
  body += '</div>'; // form-grid

  // 编辑器
  body += '<div style="margin-top:20px"><div style="display:flex;align-items:center;gap:12px;margin-bottom:8px"><label style="font-size:13px;font-weight:500;color:#475569">正文（Markdown）</label><button type="button" class="btn btn-ghost btn-sm" onclick="togglePreview()">预览</button></div>';
  body += '<div class="editor-layout"><div class="form-group editor" style="padding:0">';
  body += '<div class="editor-toolbar">';
  body += '<button type="button" class="btn btn-ghost btn-sm" onclick="toggleBodyUpload()">📷 插入图片</button>';
  body += '<button type="button" class="btn btn-ghost btn-sm" onclick="insertLink()">🔗 插入链接</button>';
  body += '</div>';
  body += '<div id="bodyUploadPanel" style="display:none;padding:0 10px 6px">';
  body += '<div class="body-upload-zone" id="bodyUploadZone" onclick="document.getElementById(\'bodyFileInput\').click()">';
  body += '<input type="file" id="bodyFileInput" accept="image/*">';
  body += '点击或拖拽图片到此处上传，自动插入到正文光标位置</div></div>';
  body += '<textarea name="content" id="editor" placeholder="在这里写 Markdown...">' + esc(content) + '</textarea></div>';
  body += '<div class="preview-panel" id="preview" style="display:none"></div></div></div>';

  // 操作按钮
  body += '<div class="form-actions">';
  body += '<button type="submit" name="action" value="push" class="btn btn-primary" id="saveBtn">保存并推送</button>';
  body += '<button type="submit" name="action" value="stage" class="btn btn-warning" id="stageBtn">保存并暂存</button>';
  if (staged) {
    body += '<button type="button" class="btn btn-ghost" onclick="unstage()" style="margin-left:auto">取消暂存</button>';
  }
  body += '<a href="/" class="btn btn-ghost">取消</a>';
  body += '</div>';
  body += '</form></div>';

  body += '<script src="/editor.js"></script>';
  body += '<script>';
  body += 'initEditor(' + JSON.stringify({ image: data.image || "", slug: slug || "" }) + ');';
  if (staged) {
    body += 'function unstage(){fetch("/api/staging/remove",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({slug:"' + safeSlugForJS + '"})}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast("已取消暂存","info");setTimeout(function(){location.reload()},500)}else{showToast("操作失败","error")}})}';
  }
  body += '</script>';

  res.send(wrapHTML(formTitle, body));
}

// ── 编辑器 JS ──
app.get("/editor.js", function(req, res) {
  res.setHeader("Content-Type", "application/javascript");
  res.send([
    '// Aurora Admin Editor',
    'function initEditor(cfg) {',
    '  var pv = false;',
    '',
    '  // 系统时钟 + 日期',
    '  var sysTimeEl = document.getElementById("sysTime");',
    '  var sysDateEl = document.getElementById("sysDate");',
    '  function pad2(n) { return String(n).padStart(2, "0"); }',
    '  function syncClock() {',
    '    var now = new Date();',
    '    sysTimeEl.textContent = pad2(now.getHours()) + ":" + pad2(now.getMinutes()) + ":" + pad2(now.getSeconds());',
    '    if (sysDateEl) sysDateEl.textContent = now.getFullYear() + "-" + pad2(now.getMonth()+1) + "-" + pad2(now.getDate());',
    '  }',
    '  syncClock(); setInterval(syncClock, 1000);',
    '',
    '  // 预览',
    '  function togglePreview() {',
    '    pv = !pv;',
    '    document.getElementById("preview").style.display = pv ? "block" : "none";',
    '    if (pv) updPreview();',
    '  }',
    '  window.togglePreview = togglePreview;',
    '',
    '  function updPreview() {',
    '    var md = document.getElementById("editor").value;',
    '    var h = md',
    '      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")',
    '      .replace(/^### (.+)$/gm, "<h3>$1</h3>")',
    '      .replace(/^## (.+)$/gm, "<h2>$1</h2>")',
    '      .replace(/^# (.+)$/gm, "<h1>$1</h1>")',
    '      .replace(/\\*\\*(.+?)\\*\\*/g, "<strong>$1</strong>")',
    '      .replace(/\\*(.+?)\\*/g, "<em>$1</em>")',
    '      .replace(/```([\\s\\S]*?)```/g, "<pre><code>$1</code></pre>")',
    '      .replace(/`(.+?)`/g, "<code>$1</code>")',
    '      .replace(/^- (.+)$/gm, "\\u2022 $1")',
    '      .replace(/\\[(.+?)\\]\\((.+?)\\)/g, \'<a href="$2">$1</a>\')',
    '      .replace(/\\n\\n/g, "</p><p>")',
    '      .replace(/\\n/g, "<br>");',
    '    document.getElementById("preview").innerHTML = "<p>" + h + "</p>";',
    '  }',
    '  document.getElementById("editor").addEventListener("input", function() { if (pv) updPreview(); });',
    '',
    '  // 更新封面显示',
    '  function updateImageDisplay(val) {',
    '    document.getElementById("imageField").value = val;',
    '    document.getElementById("imageCurrentValue").textContent = val || "(空)";',
    '    var pv = document.getElementById("currentCover");',
    '    if (val) {',
    '      pv.src = "/api/thumb/" + encodeURIComponent(val);',
    '      pv.classList.add("active");',
    '    } else {',
    '      pv.src = "";',
    '      pv.classList.remove("active");',
    '    }',
    '  }',
    '  window.updateImageDisplay = updateImageDisplay;',
    '',
    '  // 上传',
    '  var uz = document.getElementById("uploadZone");',
    '  var fi = document.getElementById("fileInput");',
    '  uz.addEventListener("dragover", function(e) { e.preventDefault(); uz.classList.add("dragover"); });',
    '  uz.addEventListener("dragleave", function() { uz.classList.remove("dragover"); });',
    '  uz.addEventListener("drop", function(e) {',
    '    e.preventDefault(); uz.classList.remove("dragover");',
    '    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);',
    '  });',
    '  fi.addEventListener("change", function() { if (fi.files.length) uploadFiles(fi.files); });',
    '',
    '  function uploadFiles(files) {',
    '    var file = files[0];',
    '    var fd = new FormData();',
    '    fd.append("file", file);',
    '    var hint = document.getElementById("uploadHint");',
    '    hint.textContent = "上传中...";',
    '    fi.value = "";',
    '    fetch("/api/upload", { method: "POST", body: fd })',
    '      .then(function(r) { return r.json(); })',
    '      .then(function(j) {',
    '        if (j.ok) {',
    '          showToast("\\u2705 上传成功: " + j.filename, "success");',
    '          updateImageDisplay(j.path);',
    '          var pv = document.getElementById("coverPreview");',
    '          pv.src = "/api/thumb/" + encodeURIComponent(j.path);',
    '          pv.classList.add("active");',
    '          hint.innerHTML = "上传成功: " + j.filename + " (" + j.size + ")";',
    '          // 封面图片仅更新封面字段，不插入正文',
    '        } else {',
    '          showToast("\\u274c " + (j.error || "上传失败"), "error");',
    '          hint.textContent = "点击或拖拽图片到此处上传";',
    '        }',
    '      })',
    '      .catch(function(e) {',
    '        showToast("\\u274c 网络错误: " + e.message, "error");',
    '        hint.textContent = "点击或拖拽图片到此处上传";',
    '      });',
    '  }',
    '',
    '  // ── 正文图片上传 ──',
    '  function toggleBodyUpload() {',
    '    var p = document.getElementById("bodyUploadPanel");',
    '    p.style.display = p.style.display === "none" ? "block" : "none";',
    '  }',
    '  window.toggleBodyUpload = toggleBodyUpload;',
    '',
    '  // 插入链接',
    '  function insertLink() {',
    '    var text = prompt("链接文字:", "链接文字");',
    '    if (text === null) return;',
    '    var url = prompt("链接 URL:", "https://");',
    '    if (!url) return;',
    '    var md = "[" + text + "](" + url + ")";',
    '    var ed = document.getElementById("editor");',
    '    var s = ed.selectionStart, e = ed.selectionEnd;',
    '    ed.value = ed.value.slice(0, s) + md + ed.value.slice(e);',
    '    ed.selectionStart = ed.selectionEnd = s + md.length;',
    '    ed.focus();',
    '  }',
    '  window.insertLink = insertLink;',
    '',
    '  var bodyUz = document.getElementById("bodyUploadZone");',
    '  var bodyFi = document.getElementById("bodyFileInput");',
    '  bodyUz.addEventListener("dragover", function(e) { e.preventDefault(); bodyUz.classList.add("dragover"); });',
    '  bodyUz.addEventListener("dragleave", function() { bodyUz.classList.remove("dragover"); });',
    '  bodyUz.addEventListener("drop", function(e) {',
    '    e.preventDefault(); bodyUz.classList.remove("dragover");',
    '    if (e.dataTransfer.files.length) uploadBodyImage(e.dataTransfer.files[0]);',
    '  });',
    '  bodyFi.addEventListener("change", function() { if (bodyFi.files.length) uploadBodyImage(bodyFi.files[0]); bodyFi.value = ""; });',
    '',
    '  function uploadBodyImage(file) {',
    '    var fd = new FormData();',
    '    fd.append("file", file);',
    '    bodyUz.textContent = "上传中...";',
    '    fetch("/api/upload", { method: "POST", body: fd })',
    '      .then(function(r) { return r.json(); })',
    '      .then(function(j) {',
    '        if (j.ok) {',
    '          var ed = document.getElementById("editor");',
    '          var md = "\\n![" + j.filename + "](" + j.publicPath + ")\\n";',
    '          var s = ed.selectionStart, e = ed.selectionEnd;',
    '          ed.value = ed.value.slice(0, s) + md + ed.value.slice(e);',
    '          ed.selectionStart = ed.selectionEnd = s + md.length;',
    '          ed.focus();',
    '          showToast("\\u2705 已插入图片: " + j.filename, "success");',
    '          bodyUz.innerHTML = \'<input type="file" id="bodyFileInput" accept="image/*">点击或拖拽图片到此处上传，自动插入到正文光标位置\';',
    '          bodyFi = document.getElementById("bodyFileInput");',
    '          bodyFi.addEventListener("change", function() { if (bodyFi.files.length) uploadBodyImage(bodyFi.files[0]); bodyFi.value = ""; });',
    '        } else {',
    '          showToast("\\u274c " + (j.error || "上传失败"), "error");',
    '          bodyUz.innerHTML = \'<input type="file" id="bodyFileInput" accept="image/*">点击或拖拽图片到此处上传，自动插入到正文光标位置\';',
    '          bodyFi = document.getElementById("bodyFileInput");',
    '          bodyFi.addEventListener("change", function() { if (bodyFi.files.length) uploadBodyImage(bodyFi.files[0]); bodyFi.value = ""; });',
    '        }',
    '      })',
    '      .catch(function(e) { showToast("\\u274c 网络错误: " + e.message, "error"); });',
    '  }',
    '',
    '  // 表单提交',
    '  document.getElementById("postForm").addEventListener("submit", function(e) {',
    '    e.preventDefault();',
    '    var submitBtn = e.submitter;',
    '    var action = submitBtn ? submitBtn.value : "push";',
    '    setLoading(submitBtn, true);',
    '    var fd = new FormData(e.target);',
    '    var now = new Date();',
    '    var pad2 = function(n){return String(n).padStart(2,"0")};',
    '    var dateVal = now.getFullYear()+"-"+pad2(now.getMonth()+1)+"-"+pad2(now.getDate());',
    '    var b = {',
    '      title: fd.get("title"),',
    '      slug: fd.get("slug"),',
    '      published: dateVal,',
    '      tags: fd.get("tags"),',
    '      category: fd.get("category"),',
    '      description: fd.get("description"),',
    '      image: fd.get("image"),',
    '      author: fd.get("author"),',
    '      lang: fd.get("lang"),',
    '      draft: fd.has("draft"),',
    '      pinned: fd.has("pinned"),',
    '      comment: fd.has("comment"),',
    '      sourceLink: fd.get("sourceLink"),',
    '      licenseName: fd.get("licenseName"),',
    '      licenseUrl: fd.get("licenseUrl"),',
    '      password: fd.get("password"),',
    '      passwordHint: fd.get("passwordHint"),',
    '      content: fd.get("content"),',
    '      action: action',
    '    };',
    '    fetch("/api/post", {',
    '      method: "POST",',
    '      headers: { "Content-Type": "application/json" },',
    '      body: JSON.stringify(b)',
    '    })',
    '    .then(function(r) { return r.json(); })',
    '    .then(function(j) {',
    '      if (j.ok) {',
    '        showToast("\\u2705 " + j.message, "success", 4000);',
    '        if (action === "stage" && j.redirect === "new") {',
    '          setTimeout(function() { location.href = "/new"; }, 1200);',
    '        } else {',
    '          setTimeout(function() { location.href = "/"; }, 1500);',
    '        }',
    '      } else {',
    '        showToast("\\u274c " + (j.error || "保存失败"), "error", 5000);',
    '        setLoading(submitBtn, false);',
    '      }',
    '    })',
    '    .catch(function() {',
    '      showToast("\\u274c 网络错误", "error");',
    '      setLoading(submitBtn, false);',
    '    });',
    '  });',
    '}'
  ].join("\n"));
});

// ── API: 保存文章 ──
app.post("/api/post", rateLimit(30, 60000), async function(req, res) {
  try {
    var body = req.body;
    var slug = body.slug;
    var title = body.title;
    var published = body.published;
    var tags = body.tags;
    var content = body.content;
    var action = body.action || "push";

    if (!slug || !slug.trim()) {
      var now = new Date();
      var timeStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0") + String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0") + String(now.getSeconds()).padStart(2, "0");
      slug = "post-" + generateSlugHash((title || "untitled") + timeStr);
    }
    slug = sanitizeSlug(slug);
    slug = slug.replace(/\.md$/, "");

    if (!validateSlug(slug)) {
      return res.json({ ok: false, error: "无效的 slug，只能包含字母、数字、中文、连字符和下划线" });
    }

    if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });

    // 后端自动获取当前时间：使用上海时区（Asia/Shanghai, UTC+8）
    var now = new Date();
    var shanghaiNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
    var publishedDate;
    if (!published) {
      publishedDate = shanghaiNow;
    } else if (published.indexOf("T") >= 0) {
      publishedDate = new Date(published);
    } else {
      var shHH = String(shanghaiNow.getHours()).padStart(2, "0");
      var shMM = String(shanghaiNow.getMinutes()).padStart(2, "0");
      var shSS = String(shanghaiNow.getSeconds()).padStart(2, "0");
      publishedDate = new Date(published + "T" + shHH + ":" + shMM + ":" + shSS + "+08:00");
    }

    var fm = {
      title: title || slug,
      published: publishedDate,
      draft: body.draft || false,
      description: body.description || "",
      image: body.image || "",
      tags: typeof tags === "string" ? tags.split(",").map(function(t) { return t.trim(); }).filter(Boolean) : (tags || []),
      category: body.category || null,
      lang: body.lang || "",
      pinned: body.pinned || false,
      author: body.author || "",
      sourceLink: body.sourceLink || "",
      licenseName: body.licenseName || "",
      licenseUrl: body.licenseUrl || "",
      comment: body.comment !== false,
      password: body.password || "",
      passwordHint: body.passwordHint || "",
    };

    var fileContent = matter.stringify(content || "", fm);
    var filePath = path.join(POSTS_DIR, slug + ".md");
    fs.writeFileSync(filePath, fileContent, "utf-8");

    if (action === "stage") {
      // 暂存：只写文件，不提交不推送
      addToStaging(slug, title || slug);
      res.json({ ok: true, message: "「" + (title || slug) + "」已保存到暂存列表", slug: slug, redirect: "new" });
    } else {
      // 推送：提交并推送到仓库
      await git.add(".");
      await git.commit("📝 更新文章: " + (title || slug));
      await git.push("origin", currentBranch);
      removeFromStaging(slug);
      res.json({ ok: true, message: "「" + (title || slug) + "」已保存并推送到仓库", slug: slug });
    }
  } catch (e) {
    console.error("Save error:", e);
    res.json({ ok: false, error: e.message });
  }
});

// ── API: 删除文章 ──
app.delete("/api/post/:slug", rateLimit(30, 60000), async function(req, res) {
  try {
    var slug = sanitizeSlug(req.params.slug);
    if (!validateSlug(slug)) {
      return res.json({ ok: false, error: "无效的 slug" });
    }
    var filePath = safeFindPostFile(slug);
    if (!filePath) return res.json({ ok: false, error: "文件不存在" });

    var wasStaged = isStaged(slug);

    fs.unlinkSync(filePath);
    removeFromStaging(slug);

    if (wasStaged) {
      // 暂存中的文章 → 只删本地，不推送
      res.json({ ok: true, message: "文章「" + slug + "」已删除（未推送，无需同步仓库）" });
    } else {
      // 已推送的文章 → 需要 commit + push 从仓库删除
      await git.add(".");
      await git.commit("🗑️ 删除文章: " + slug);
      await git.push("origin", currentBranch);
      res.json({ ok: true, message: "文章「" + slug + "」已从仓库删除并推送" });
    }
  } catch (e) {
    console.error("Delete error:", e);
    res.json({ ok: false, error: e.message });
  }
});

// ── API: 删除动态 ──
app.delete("/api/dynamic/:slug", rateLimit(30, 60000), async function(req, res) {
  try {
    var slug = sanitizeSlug(req.params.slug);
    if (!validateSlug(slug)) {
      return res.json({ ok: false, error: "无效的 slug" });
    }

    var dynamicDir = path.join(PROJECT_ROOT, "src", "content", "dynamic");
    var filePath = path.join(dynamicDir, slug + ".md");
    if (!fs.existsSync(filePath)) {
      var directFile = path.join(dynamicDir, slug);
      if (fs.existsSync(directFile) && fs.lstatSync(directFile).isFile()) {
        filePath = directFile;
      } else {
        return res.json({ ok: false, error: "动态文件不存在" });
      }
    }

    fs.unlinkSync(filePath);

    var dynamicIndexPath = path.join(dynamicDir, "index.json");
    if (fs.existsSync(dynamicIndexPath)) {
      try {
        var dynamicIndex = JSON.parse(fs.readFileSync(dynamicIndexPath, "utf-8"));
        var filtered = (Array.isArray(dynamicIndex) ? dynamicIndex : []).filter(function(item) {
          var candidate = (item.slug || item.id || "").toString();
          return candidate !== slug;
        });
        fs.writeFileSync(dynamicIndexPath, JSON.stringify(filtered, null, 2), "utf-8");
      } catch (e) {
        console.warn("Update dynamic index failed:", e.message);
      }
    }

    await git.add(".");
    await git.commit("🗑️ 删除动态: " + slug);
    await git.push("origin", currentBranch);

    res.json({ ok: true, message: "动态「" + slug + "」已从本地删除并推送" });
  } catch (e) {
    console.error("Delete dynamic error:", e);
    res.json({ ok: false, error: e.message });
  }
});

// ── 新建动态页 ──
var DYNAMIC_DIR = path.join(PROJECT_ROOT, "src", "content", "dynamic");

app.get("/new-dynamic", rateLimit(30, 60000), function(req, res) {
  var body = '<div class="app-shell">';
  body += '<header class="app-header">';
  body += '<div class="header-brand">';
  body += '<div class="brand-mark"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 5 L38 22 L55 28 L38 34 L32 52 L26 34 L9 28 L26 22 Z" fill="white"/></svg></div>';
  body += '<div class="header-brand-text"><strong>Aurora</strong><span>新建动态</span></div>';
  body += '</div>';
  body += '<div class="header-actions"><a href="/" class="mini-btn">🏠 返回后台</a></div>';
  body += '</header>';
  body += '<div class="app-main" style="flex-direction:column"><div class="main-column" style="width:100%">';
  body += '<div class="list-card"><div class="list-card-body">';
  body += '<form id="dynamicForm"><div class="form-grid">';
  body += '<div class="form-group full"><label>动态内容 *</label>';
  body += '<textarea name="content" id="editor" style="min-height:200px;width:100%;padding:12px;border:1px solid #e2e8f0;border-radius:8px;font-family:inherit;font-size:14px;line-height:1.7;resize:vertical" placeholder="写下你想说的...支持 Markdown 和图片语法 ![alt](url)"></textarea></div>';
  body += '<div class="form-group"><label>发布时间（自动同步）</label><div style="display:flex;align-items:center;gap:12px;padding:8px 0">';
  body += '<span id="sysDate" style="font-size:20px;font-weight:600;font-family:\'JetBrains Mono\',monospace;color:#1a1a1a;letter-spacing:1px">--</span>';
  body += '<span id="sysTime" style="font-size:20px;font-weight:600;font-family:\'JetBrains Mono\',monospace;color:#1a1a1a;letter-spacing:1px">--:--:--</span>';
  body += '<span style="color:#94a3b8;font-size:12px">⏱ 实时同步</span>';
  body += '</div></div>';
  body += '<div class="form-group"><label>位置（可选）</label>';
  body += '<input type="text" name="location" style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px" placeholder="如：日本东京"></div>';
  body += '<div class="form-group"><label><input type="checkbox" name="pinned"> 置顶</label></div>';
  body += '</div>';
  body += '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">';
  body += '<div class="body-upload-zone" id="bodyUploadZone" onclick="document.getElementById(\'bodyFileInput\').click()" style="flex:1;min-width:200px">';
  body += '<input type="file" id="bodyFileInput" accept="image/*">';
  body += '📷 点击或拖拽图片到此处上传</div>';
  body += '<button type="button" class="btn btn-ghost" onclick="insertLink()" style="align-self:center">🔗 插入链接</button>';
  body += '</div>';
  body += '<div class="form-actions"><button type="submit" class="btn btn-primary">保存并推送</button>';
  body += '<a href="/" class="btn btn-ghost">取消</a></div>';
  body += '</form></div></div></div></div>';
  body += '<script src="/dynamic-editor.js"></script>';
  res.send(wrapHTML("新建动态", body));
});

// ── 动态编辑器 JS ──
app.get("/dynamic-editor.js", function(req, res) {
  res.setHeader("Content-Type", "application/javascript");
  res.send([
    '// 时钟同步',
    'var sysTimeEl=document.getElementById("sysTime"),sysDateEl=document.getElementById("sysDate");',
    'function pad2(n){return String(n).padStart(2,"0")}',
    'function syncClock(){var now=new Date();',
    'sysTimeEl.textContent=pad2(now.getHours())+":"+pad2(now.getMinutes())+":"+pad2(now.getSeconds());',
    'sysDateEl.textContent=now.getFullYear()+"-"+pad2(now.getMonth()+1)+"-"+pad2(now.getDate());}',
    'syncClock();setInterval(syncClock,1000);',
    '// 插入链接',
    'function insertLink(){var text=prompt("链接文字:","链接文字");if(text===null)return;',
    'var url=prompt("链接 URL:","https://");if(!url)return;',
    'var md="["+text+"]("+url+")";var ed=document.getElementById("editor");',
    'var s=ed.selectionStart,e=ed.selectionEnd;',
    'ed.value=ed.value.slice(0,s)+md+ed.value.slice(e);',
    'ed.selectionStart=ed.selectionEnd=s+md.length;ed.focus();}',
    '// 表单提交',
    'document.getElementById("dynamicForm").addEventListener("submit",function(e){',
    'e.preventDefault();var btn=e.submitter;setLoading(btn,true);',
    'var fd=new FormData(e.target);',
    'var b={content:fd.get("content"),location:fd.get("location")||"",pinned:fd.has("pinned")};',
    'fetch("/api/dynamic",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)})',
    '.then(function(r){return r.json()}).then(function(j){',
    'if(j.ok){showToast("\\u2705 "+j.message,"success",3000);setTimeout(function(){location.href="/"},1200)}',
    'else{showToast("\\u274c "+(j.error||"保存失败"),"error",5000);setLoading(btn,false)}}',
    ').catch(function(){showToast("\\u274c 网络错误","error");setLoading(btn,false)})});',
    '(function(){var uz=document.getElementById("bodyUploadZone");var fi=document.getElementById("bodyFileInput");',
    'uz.addEventListener("dragover",function(e){e.preventDefault();uz.classList.add("dragover")});',
    'uz.addEventListener("dragleave",function(){uz.classList.remove("dragover")});',
    'uz.addEventListener("drop",function(e){e.preventDefault();uz.classList.remove("dragover");if(e.dataTransfer.files.length)uploadBodyImage(e.dataTransfer.files[0])});',
    'fi.addEventListener("change",function(){if(fi.files.length)uploadBodyImage(fi.files[0]);fi.value=""});',
    'function uploadBodyImage(file){var fd=new FormData();fd.append("file",file);uz.textContent="上传中...";',
    'fetch("/api/upload",{method:"POST",body:fd}).then(function(r){return r.json()}).then(function(j){',
    'if(j.ok){var ed=document.getElementById("editor");var md="\\n!["+j.filename+"]("+j.publicPath+")\\n";',
    'var s=ed.selectionStart,e=ed.selectionEnd;ed.value=ed.value.slice(0,s)+md+ed.value.slice(e);',
    'ed.selectionStart=ed.selectionEnd=s+md.length;ed.focus();showToast("\\u2705 已插入图片","success");',
    'uz.innerHTML=\'<input type="file" id="bodyFileInput" accept="image/*">点击或拖拽图片到此处上传，自动插入到正文光标位置\';',
    'document.getElementById("bodyFileInput").addEventListener("change",function(){if(this.files.length)uploadBodyImage(this.files[0]);this.value=""});',
    '}else{showToast("\\u274c "+(j.error||"上传失败"),"error");uz.innerHTML=\'<input type="file" id="bodyFileInput" accept="image/*">点击或拖拽图片到此处上传\';',
    'document.getElementById("bodyFileInput").addEventListener("change",function(){if(this.files.length)uploadBodyImage(this.files[0]);this.value=""});',
    '}}).catch(function(){showToast("\\u274c 网络错误","error")})}})();'
  ].join("\n"));
});

// ── API: 保存动态 ──
app.post("/api/dynamic", rateLimit(30, 60000), async function(req, res) {
  try {
    var content = req.body.content;
    var location = req.body.location || "";
    var pinned = req.body.pinned || false;
    if (!content || !content.trim()) return res.json({ ok: false, error: "请输入动态内容" });
    if (!fs.existsSync(DYNAMIC_DIR)) fs.mkdirSync(DYNAMIC_DIR, { recursive: true });

    var now = new Date();
    var sh = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
    var y = sh.getFullYear(), mo = String(sh.getMonth()+1).padStart(2,"0"), d = String(sh.getDate()).padStart(2,"0");
    var hh = String(sh.getHours()).padStart(2,"0"), mm = String(sh.getMinutes()).padStart(2,"0"), ss = String(sh.getSeconds()).padStart(2,"0");
    var timestamp = y+"-"+mo+"-"+d+" "+hh+":"+mm+":"+ss;
    var slug = y+"-"+mo+"-"+d+"-"+hh+mm+ss;
    var filePath = path.join(DYNAMIC_DIR, slug+".md");
    if (fs.existsSync(filePath)) return res.json({ ok: false, error: "文件已存在，请稍后重试" });

    var fm = "---\npublished: "+timestamp+"\n"+(pinned?"pinned: true\n":"")+(location?"location: "+location+"\n":"")+"---\n\n"+content.trim()+"\n";
    fs.writeFileSync(filePath, fm, "utf-8");

    await git.add(".");
    await git.commit("📝 新建动态: "+slug);
    await git.push("origin", currentBranch);
    res.json({ ok: true, message: "动态已保存并推送", slug: slug });
  } catch(e) {
    console.error("Save dynamic error:", e);
    res.json({ ok: false, error: e.message });
  }
});

// ── API: 单篇推送 ──
app.post("/api/staging/push-single", rateLimit(10, 60000), async function(req, res) {
  try {
    var slugs = (req.body.slugs || []).map(function(s) { return sanitizeSlug(s); }).filter(function(s) { return validateSlug(s); });
    if (slugs.length === 0) return res.json({ ok: false, error: "无有效文章" });

    for (var i = 0; i < slugs.length; i++) {
      removeFromStaging(slugs[i]);
    }

    await git.add(".");
    await git.commit("📦 暂存推送: " + slugs.join(", "));
    await git.push("origin", currentBranch);

    res.json({ ok: true, message: slugs.length + " 篇文章已推送到仓库" });
  } catch (e) {
    console.error("Push single error:", e);
    res.json({ ok: false, error: e.message });
  }
});

// ── API: 批量推送 ──
app.post("/api/staging/batch-push", rateLimit(5, 60000), async function(req, res) {
  try {
    var stagingList = loadStaging();
    if (stagingList.length === 0) return res.json({ ok: false, error: "暂存列表为空" });

    var count = stagingList.length;
    var slugs = stagingList.map(function(s) { return s.slug; });

    saveStaging([]);
    await git.add(".");
    await git.commit("📦 批量推送 " + count + " 篇文章: " + slugs.join(", "));
    await git.push("origin", currentBranch);

    res.json({ ok: true, message: count + " 篇文章已全部推送到仓库" });
  } catch (e) {
    console.error("Batch push error:", e);
    res.json({ ok: false, error: e.message });
  }
});

// ── API: 移除暂存（同时删除文件） ──
app.post("/api/staging/remove", rateLimit(30, 60000), function(req, res) {
  try {
    var slug = sanitizeSlug(req.body.slug);
    if (!validateSlug(slug)) return res.json({ ok: false, error: "无效的 slug" });
    // 删除实际文件
    var filePath = safeFindPostFile(slug);
    if (filePath) {
      fs.unlinkSync(filePath);
    }
    removeFromStaging(slug);
    res.json({ ok: true, message: "已从暂存列表移除并删除文件" });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ══════════════════════════════════════════════
// ── Gallery API ──
// ══════════════════════════════════════════════

// ── API: 获取相册列表 ──
app.get("/api/gallery", rateLimit(60, 60000), function(req, res) {
  try {
    var config = parseGalleryConfig();
    var albums = config.albums.map(function(album) {
      var photos = getAlbumPhotos(album.id);
      var totalSize = photos.reduce(function(s, p) { return s + p.size; }, 0);
      return {
        id: album.id,
        name: album.name,
        description: album.description || "",
        date: album.date || "",
        location: album.location || "",
        tags: album.tags || [],
        cover: album.cover || "",
        password: album.password || "",
        passwordHint: album.passwordHint || "",
        photoCount: photos.length,
        totalSize: formatBytes(totalSize)
      };
    });
    res.json({ ok: true, albums: albums, columnWidth: config.columnWidth || 240 });
  } catch (e) {
    res.json({ ok: false, error: e.message, albums: [] });
  }
});

// ── API: 创建/更新相册 ──
app.post("/api/gallery", rateLimit(30, 60000), async function(req, res) {
  try {
    var body = req.body;
    var albumId = (body.id || "").trim();
    var albumName = (body.name || "").trim();

    if (!albumId) return res.json({ ok: false, error: "请填写相册 ID" });
    // 使用更严格的验证
    if (!validateAlbumIdSafe(albumId)) {
      return res.json({ ok: false, error: "相册 ID 只能包含字母、数字、连字符和下划线" });
    }
    if (!albumName) return res.json({ ok: false, error: "请填写相册名称" });

    var config = parseGalleryConfig();
    var existIdx = -1;
    for (var i = 0; i < config.albums.length; i++) {
      if (config.albums[i].id === albumId) { existIdx = i; break; }
    }

    var tags = typeof body.tags === "string"
      ? body.tags.split(",").map(function(t) { return t.trim(); }).filter(Boolean)
      : (body.tags || []);

    var album = {
      id: albumId,
      name: albumName,
      description: body.description || "",
      date: body.date || "",
      location: body.location || "",
      tags: tags,
      cover: body.cover || "",
      password: body.password || "",
      passwordHint: body.passwordHint || ""
    };

    if (existIdx >= 0) {
      config.albums[existIdx] = album;
    } else {
      config.albums.push(album);
    }

    // 确保目录存在
    var albumDir = path.join(GALLERY_DIR, albumId);
    if (!fs.existsSync(albumDir)) fs.mkdirSync(albumDir, { recursive: true });

    // 写入配置
    fs.writeFileSync(GALLERY_CONFIG_FILE, serializeGalleryConfig(config), "utf-8");

    var msg = existIdx >= 0 ? "相册「" + albumName + "」已更新" : "相册「" + albumName + "」已创建";
    res.json({ ok: true, message: msg, id: albumId });
  } catch (e) {
    console.error("Gallery save error:", e);
    res.json({ ok: false, error: e.message });
  }
});

// ── API: 删除相册 ──
app.delete("/api/gallery/:id", rateLimit(30, 60000), async function(req, res) {
  try {
    var albumId = req.params.id;
    // 使用更严格的验证
    if (!validateAlbumIdSafe(albumId)) {
      return res.json({ ok: false, error: "无效的相册 ID" });
    }

    var config = parseGalleryConfig();
    var existIdx = -1;
    for (var i = 0; i < config.albums.length; i++) {
      if (config.albums[i].id === albumId) { existIdx = i; break; }
    }
    if (existIdx === -1) return res.json({ ok: false, error: "相册不存在" });

    var albumName = config.albums[existIdx].name;

    // 从配置中移除
    config.albums.splice(existIdx, 1);
    fs.writeFileSync(GALLERY_CONFIG_FILE, serializeGalleryConfig(config), "utf-8");

    // 删除目录
    var albumDir = path.join(GALLERY_DIR, albumId);
    if (fs.existsSync(albumDir)) {
      fs.rmSync(albumDir, { recursive: true, force: true });
    }

    // Git 提交
    await git.add(".");
    await git.commit("🗑️ 删除相册: " + albumName);
    await git.push("origin", currentBranch);

    res.json({ ok: true, message: "相册「" + albumName + "」已删除" });
  } catch (e) {
    console.error("Gallery delete error:", e);
    res.json({ ok: false, error: e.message });
  }
});

// ── API: 上传相册图片 ──
app.post("/api/gallery/:id/upload", rateLimit(30, 60000), function(req, res) {
  galleryUpload.array("files", 50)(req, res, function(err) {
    if (err) return res.json({ ok: false, error: err.message || "上传失败" });
    if (!req.files || req.files.length === 0) return res.json({ ok: false, error: "未选择文件" });
    var results = req.files.map(function(f) {
      return { name: f.filename, size: formatBytes(f.size), path: "/gallery/" + req.params.id + "/" + f.filename };
    });
    res.json({ ok: true, message: "成功上传 " + results.length + " 张图片", files: results });
  });
});

// ── API: 获取相册图片列表 ──
app.get("/api/gallery/:id/photos", rateLimit(60, 60000), function(req, res) {
  try {
    var albumId = req.params.id;
    // 使用更严格的验证
    if (!validateAlbumIdSafe(albumId)) {
      return res.json({ ok: false, error: "无效的相册 ID：只能包含字母、数字、连字符和下划线" });
    }
    // 确保路径在 GALLERY_DIR 内
    var albumDir = path.join(GALLERY_DIR, albumId);
    if (!isPathContained(albumDir, GALLERY_DIR)) {
      return res.json({ ok: false, error: "路径不安全" });
    }

    var albumDir = path.join(GALLERY_DIR, albumId);
    var photos = [];
    if (fs.existsSync(albumDir)) {
      photos = getAlbumPhotos(albumId).map(function(p) {
        return { name: p.name, size: formatBytes(p.size), path: p.path, modified: p.modified };
      });
    }

    // 读取 urls.txt
    var urlsFile = path.join(albumDir, "urls.txt");
    var urls = [];
    if (fs.existsSync(urlsFile)) {
      urls = fs.readFileSync(urlsFile, "utf-8").split("\n").map(function(l) { return l.trim(); }).filter(Boolean);
    }

    res.json({ ok: true, photos: photos, urls: urls });
  } catch (e) {
    res.json({ ok: false, error: e.message, photos: [] });
  }
});

// ── API: 删除相册图片 ──
app.delete("/api/gallery/:id/photo", rateLimit(30, 60000), function(req, res) {
  try {
    var albumId = req.params.id;
    var photoName = req.query.name;
    
    // 使用更严格的验证
    if (!validateAlbumIdSafe(albumId)) {
      return res.json({ ok: false, error: "无效的相册 ID" });
    }
    if (!photoName || !validateFileName(photoName)) {
      return res.json({ ok: false, error: "无效的文件名：只能包含字母、数字、中文、连字符、下划线和点" });
    }

    var photoPath = path.join(GALLERY_DIR, albumId, photoName);
    var albumDir = path.join(GALLERY_DIR, albumId);
    
    // 确保路径在 GALLERY_DIR 内
    if (!isPathContained(photoPath, albumDir)) {
      return res.json({ ok: false, error: "路径不安全" });
    }
    if (!fs.existsSync(photoPath)) {
      return res.json({ ok: false, error: "文件不存在" });
    }

    fs.unlinkSync(photoPath);
    res.json({ ok: true, message: "图片「" + photoName + "」已删除" });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ── API: 保存远程图片 URL 列表 ──
app.post("/api/gallery/:id/urls", rateLimit(30, 60000), function(req, res) {
  try {
    var albumId = req.params.id;
    // 使用更严格的验证
    if (!validateAlbumIdSafe(albumId)) {
      return res.json({ ok: false, error: "无效的相册 ID" });
    }

    var albumDir = path.join(GALLERY_DIR, albumId);
    // 确保路径在 GALLERY_DIR 内
    if (!isPathContained(albumDir, GALLERY_DIR)) {
      return res.json({ ok: false, error: "路径不安全" });
    }
    if (!fs.existsSync(albumDir)) fs.mkdirSync(albumDir, { recursive: true });

    // 验证每个 URL
    var urls = (req.body.urls || [])
      .map(function(u) { return String(u).trim(); })
      .filter(function(u) {
        // 只允许 http/https URL
        return u && /^https?:\/\//.test(u) && u.length < 2048;
      });
    
    var urlsFile = path.join(albumDir, "urls.txt");
    fs.writeFileSync(urlsFile, urls.join("\n"), "utf-8");

    res.json({ ok: true, message: "URL 列表已保存（" + urls.length + " 条）" });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
//  站点配置 (Site Config) — 壁纸/视频/音乐/公告/友链/关于我
// ═══════════════════════════════════════════════════════════════════════

// Path helpers
var siteConfigPath = path.join(CONTENT_DIR, "site-config.md");
function readSiteConfig() {
  try { return fs.readFileSync(siteConfigPath, "utf-8"); } catch(e) { return ""; }
}
function writeSiteConfig(content) {
  fs.writeFileSync(siteConfigPath, content, "utf-8");
}

function parseSiteConfig(text) {
  var cfg = {
    wallpaper: "", video: "", bgmSong: "", bgmId: "",
    announcement: "", friends: [], about: "", fonts: []
  };
  if (!text) return cfg;

  var sections = text.split("\n## ").slice(1);
  sections.forEach(function(section) {
    var lines = section.split("\n");
    var title = lines[0].trim().toLowerCase();
    var body = lines.slice(1).join("\n").trim();

    if (title === "wallpaper") {
      var m = body.match(/url:\s*(.*)/);
      if (m) cfg.wallpaper = m[1].trim();
    }
    else if (title === "video") {
      var m = body.match(/url:\s*(.*)/);
      if (m) cfg.video = m[1].trim();
    }
    else if (title === "bgm") {
      var ms = body.match(/song:\s*(.*)/);
      var mi = body.match(/id:\s*(.*)/);
      if (ms) cfg.bgmSong = ms[1].trim();
      if (mi) cfg.bgmId = mi[1].trim();
    }
    else if (title === "announcement") {
      cfg.announcement = body;
    }
    else if (title === "friends") {
      var friends = [];
      var lines = body.split("\n");
      var current = null;
      lines.forEach(function(line) {
        var lm = line.match(/^name:\s*(.*)/);
        var lu = line.match(/^url:\s*(.*)/);
        var li = line.match(/^icon:\s*(.*)/);
        var ld = line.match(/^desc:\s*(.*)/);
        if (lm) { current = { name: lm[1].trim(), url: "", icon: "", desc: "" }; friends.push(current); }
        if (lu && current) current.url = lu[1].trim();
        if (li && current) current.icon = li[1].trim();
        if (ld && current) current.desc = ld[1].trim();
      });
      cfg.friends = friends;
    }
    else if (title === "about") {
      cfg.about = body;
    }
  });
  return cfg;
}

function writeSiteConfigFromObj(cfg) {
  var md = "";
  md += "## Wallpaper\n\nurl: " + (cfg.wallpaper || "") + "\n";
  md += "\n## Video\n\nurl: " + (cfg.video || "") + "\n";
  md += "\n## BGM\n\nsong: " + (cfg.bgmSong || "") + "\nid: " + (cfg.bgmId || "") + "\n";
  md += "\n## Announcement\n\n" + (cfg.announcement || "") + "\n";
  md += "\n## Friends\n\n";
  (cfg.friends || []).forEach(function(f) {
    md += "- name: " + (f.name || "") + "\n  url: " + (f.url || "") + "\n  icon: " + (f.icon || "") + "\n  desc: " + (f.desc || "") + "\n";
  });
  md += "\n## About\n\n" + (cfg.about || "") + "\n";
  writeSiteConfig(md);
}

// ── 站点配置页面 ──
app.get("/site-config", rateLimit(30, 60000), function(req, res) {
  try {
    var cfg = parseSiteConfig(readSiteConfig());
    var friendsJSON = JSON.stringify(cfg.friends);

    var body = '<div class="container">';
    body += '<header><h1>' + icCog + ' 站点配置</h1>';
    body += '<div><a href="/" class="btn btn-ghost">← 返回列表</a></div></header>';
    body += '<form id="siteConfigForm" style="max-width:720px;margin:0 auto">';

    // Wallpaper
    body += '<div style="background:#fff;border-radius:10px;border:1px solid #e8e8e8;padding:20px;margin-bottom:16px">';
    body += '<h3 style="margin:0 0 12px;font-size:15px">🖼️ 封面壁纸</h3>';
    body += '<input type="text" id="wallpaper" value="' + esc(cfg.wallpaper) + '" placeholder="图片 URL" style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px">';
    if (cfg.wallpaper) {
      body += '<div style="margin-top:8px;border-radius:6px;overflow:hidden;max-height:160px"><img src="' + esc(cfg.wallpaper) + '" style="width:100%;object-fit:cover;max-height:160px" onerror="this.style.display=\'none\'"></div>';
    }
    body += '</div>';

    // Video
    body += '<div style="background:#fff;border-radius:10px;border:1px solid #e8e8e8;padding:20px;margin-bottom:16px">';
    body += '<h3 style="margin:0 0 12px;font-size:15px">🎬 背景视频</h3>';
    body += '<input type="text" id="video" value="' + esc(cfg.video) + '" placeholder="视频 URL (mp4/webm)" style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px">';
    body += '</div>';

    // BGM
    body += '<div style="background:#fff;border-radius:10px;border:1px solid #e8e8f0;padding:20px;margin-bottom:16px">';
    body += '<h3 style="margin:0 0 12px;font-size:15px">🎵 背景音乐</h3>';
    body += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
    body += '<input type="text" id="bgmSong" value="' + esc(cfg.bgmSong) + '" placeholder="歌曲名" style="padding:8px 12px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px">';
    body += '<input type="text" id="bgmId" value="' + esc(cfg.bgmId) + '" placeholder="网易云 ID" style="padding:8px 12px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px">';
    body += '</div></div>';

    // Announcement
    body += '<div style="background:#fff;border-radius:10px;border:1px solid #e8e8e8;padding:20px;margin-bottom:16px">';
    body += '<h3 style="margin:0 0 12px;font-size:15px">📢 公告</h3>';
    body += '<textarea id="announcement" rows="3" style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;resize:vertical" placeholder="支持 Markdown">' + esc(cfg.announcement) + '</textarea>';
    body += '</div>';

    // Friends
    body += '<div style="background:#fff;border-radius:10px;border:1px solid #e8e8f0;padding:20px;margin-bottom:16px">';
    body += '<h3 style="margin:0 0 12px;font-size:15px">👥 友链</h3>';
    body += '<div id="friendsList"></div>';
    body += '<button type="button" class="btn btn-ghost btn-sm" onclick="addFriend()" style="margin-top:8px">+ 添加友链</button>';
    body += '</div>';

    // About
    body += '<div style="background:#fff;border-radius:10px;border:1px solid #e8e8f0;padding:20px;margin-bottom:16px">';
    body += '<h3 style="margin:0 0 12px;font-size:15px">👤 关于我</h3>';
    body += '<textarea id="about" rows="5" style="width:100%;padding:8px 12px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;resize:vertical;font-family:inherit" placeholder="个人介绍，支持 Markdown">' + esc(cfg.about) + '</textarea>';
    body += '</div>';

    body += '<div style="text-align:right;margin-top:20px;padding-bottom:40px">';
    body += '<button type="submit" class="btn btn-primary" id="saveBtn">💾 保存配置</button>';
    body += '</div>';

    body += '</form></div>';

    body += '<script>';
    body += 'var friendsData = ' + friendsJSON + ';';
    body += 'function renderFriends() {';
    body += '  var c = document.getElementById("friendsList"); c.innerHTML = "";';
    body += '  friendsData.forEach(function(f, i) {';
    body += '    var d = document.createElement("div"); d.style.cssText = "display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:center";';
    body += '    d.innerHTML = \'<input value="\' + (f.name||"") + \'" placeholder="名称" style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px" onchange="friendsData[\' + i + \'].name=this.value">\' + \'<input value="\' + (f.url||"") + \'" placeholder="链接" style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px" onchange="friendsData[\' + i + \'].url=this.value">\' + \'<input value="\' + (f.icon||"") + \'" placeholder="图标 URL" style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px" onchange="friendsData[\' + i + \'].icon=this.value">\' + \'<input value="\' + (f.desc||"") + \'" placeholder="描述" style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px" onchange="friendsData[\' + i + \'].desc=this.value">\' + \'<button type="button" class="btn btn-danger btn-sm" onclick="friendsData.splice(\' + i + \',1);renderFriends()">×</button>\';';
    body += '    c.appendChild(d);';
    body += '  });';
    body += '}';
    body += 'function addFriend() { friendsData.push({name:"",url:"",icon:"",desc:""}); renderFriends(); }';
    body += '';
    body += 'renderFriends();';
    body += '';
    body += 'document.getElementById("siteConfigForm").addEventListener("submit", function(e) {';
    body += '  e.preventDefault();';
    body += '  var btn = document.getElementById("saveBtn"); btn.textContent = "保存中..."; btn.disabled = true;';
    body += '  var data = {';
    body += '    wallpaper: document.getElementById("wallpaper").value,';
    body += '    video: document.getElementById("video").value,';
    body += '    bgmSong: document.getElementById("bgmSong").value,';
    body += '    bgmId: document.getElementById("bgmId").value,';
    body += '    announcement: document.getElementById("announcement").value,';
    body += '    friends: friendsData,';
    body += '    about: document.getElementById("about").value';
    body += '  };';
    body += '  fetch("/api/site-config", {';
    body += '    method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(data)';
    body += '  }).then(function(r){return r.json()}).then(function(j){';
    body += '    if(j.ok){showToast("配置已保存","success")} else {showToast(j.error||"保存失败","error")}';
    body += '    btn.textContent = "💾 保存配置"; btn.disabled = false;';
    body += '  }).catch(function(){showToast("网络错误","error"); btn.textContent = "💾 保存配置"; btn.disabled = false;});';
    body += '});';
    body += '</script>';

    res.send(wrapHTML("站点配置", body));
  } catch(e) {
    res.status(500).send(wrapHTML("错误", '<div class="container"><h1>错误</h1><pre>' + esc(e.message) + '</pre></div>'));
  }
});

// ── 站点配置 API ──
app.post("/api/site-config", rateLimit(30, 60000), function(req, res) {
  try {
    var data = req.body;
    writeSiteConfigFromObj(data);
    res.json({ ok: true, message: "配置已保存" });
  } catch(e) {
    res.json({ ok: false, error: e.message });
  }
});

// ── 公告 API ──
app.get("/api/announcement", rateLimit(60, 60000), function(req, res) {
  try {
    var cfg = parseSiteConfig(readSiteConfig());
    res.json({ ok: true, announcement: cfg.announcement });
  } catch(e) {
    res.json({ ok: false, error: e.message, announcement: "" });
  }
});

// ── 友链 API ──
app.get("/api/friends", rateLimit(60, 60000), function(req, res) {
  try {
    var cfg = parseSiteConfig(readSiteConfig());
    res.json({ ok: true, friends: cfg.friends });
  } catch(e) {
    res.json({ ok: false, error: e.message, friends: [] });
  }
});

// ── 启动 ──
async function start() {
  try {
    currentBranch = (await git.branchCurrent()).trim();
    console.log("📌 当前 Git 分支: " + currentBranch);
  } catch (e) {
    console.log("⚠️  无法检测 Git 分支，默认使用 main");
  }

    // ── 启动时同步图片到 public ──
  function syncImagesToPublic() {
    try {
      if (!fs.existsSync(IMAGES_DIR)) return;
      if (!fs.existsSync(PUBLIC_IMAGES_DIR)) fs.mkdirSync(PUBLIC_IMAGES_DIR, { recursive: true });
      var items = fs.readdirSync(IMAGES_DIR, { withFileTypes: true });
      for (var i = 0; i < items.length; i++) {
        if (i >= items.length) break;
        var srcPath = path.join(IMAGES_DIR, items[i].name);
        var dstPath = path.join(PUBLIC_IMAGES_DIR, items[i].name);
        if (items[i].isFile() && isPathContained(dstPath, PUBLIC_IMAGES_DIR) && !fs.existsSync(dstPath)) {
          fs.copyFileSync(srcPath, dstPath);
        }
      }
    } catch (e) { /* non-fatal */ }
  }

  syncImagesToPublic();

// ── 友链管理页（默认进入的二级页面） ──
app.get("/config/friends", rateLimit(30, 60000), function(req, res) {
  try {
    var cfg = parseSiteConfig(readSiteConfig());
    var friends = Array.isArray(cfg.friends) ? cfg.friends : [];

    var body = '<div class="container" style="max-width:1200px;">';
    body += '<header style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px">';
    body += '<h1 style="margin:0;font-size:22px">底层修改</h1>';
    body += '<div style="display:flex;gap:8px"><button class="btn btn-primary" onclick="publishConfig()">推送更新</button><a href="/" class="btn btn-ghost">返回后台</a></div>';
    body += '</header>';

    body += '<div class="form-section" style="background:#fff;border:1px solid #e8e8e8;border-radius:12px;padding:20px;box-shadow:0 12px 30px rgba(15,23,42,.04);margin-bottom:20px">';
    body += '<h3 style="margin:0 0 12px">快捷入口</h3>';
    body += '<div style="display:flex;flex-wrap:wrap;gap:10px">';
    body += '<a href="/config/wallpaper" class="btn btn-ghost">博客壁纸</a>';
    body += '<a href="/config/video" class="btn btn-ghost">背景视频</a>';
    body += '<a href="/config/music" class="btn btn-ghost">背景音乐</a>';
    body += '<a href="/config/friends" class="btn btn-primary">友链</a>';
    body += '</div>';
    body += '</div>';

    body += '<div class="form-section" style="background:#fff;border:1px solid #e8e8e8;border-radius:12px;padding:20px;box-shadow:0 12px 30px rgba(15,23,42,.04)">';
    body += '<h3 style="margin:0 0 12px">友链列表</h3>';
    body += '<div id="friendsList"></div>';
    body += '<button type="button" class="btn btn-ghost btn-sm" onclick="addFriend()" style="margin-top:12px">+ 添加友链</button>';
    body += '</div>';
    body += '<div class="form-actions"><button class="btn btn-success" onclick="saveFriends()">保存</button></div>';
    body += '</div></div>';

    body += '<script>';
    body += 'function normalizeFriend(raw){var item=raw||{};return {title:item.title||item.name||"",imgurl:item.imgurl||item.icon||"",desc:item.desc||"",siteurl:item.siteurl||item.url||"",tags:Array.isArray(item.tags)?item.tags:[],weight:Number(item.weight)||1,enabled:item.enabled!==false};}';
    body += 'var friendsData = ' + JSON.stringify(friends.map(function(f) { return normalizeFriend(f); })) + ';';
    body += 'function renderFriends(){var c=document.getElementById("friendsList"); c.innerHTML=""; if(!friendsData.length){c.innerHTML="<div class=\"empty-state\" style=\"padding:30px\">暂无友链</div>"; return;} friendsData.forEach(function(f,i){var item=normalizeFriend(f); var d=document.createElement("div"); d.style.cssText="display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:8px;margin-bottom:10px;align-items:center"; d.innerHTML=\'<input value="\'+(item.title||item.name||"")+\'" placeholder="名称" style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px" onchange="friendsData[\'+i+\'] = Object.assign(normalizeFriend(friendsData[\'+i+\']), {title:this.value,name:this.value})">\'+\'<input value="\'+(item.siteurl||item.url||"")+\'" placeholder="链接" style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px" onchange="friendsData[\'+i+\'] = Object.assign(normalizeFriend(friendsData[\'+i+\']), {siteurl:this.value,url:this.value})">\'+\'<input value="\'+(item.imgurl||item.icon||"")+\'" placeholder="图标 URL" style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px" onchange="friendsData[\'+i+\'] = Object.assign(normalizeFriend(friendsData[\'+i+\']), {imgurl:this.value,icon:this.value})">\'+\'<input value="\'+(item.desc||"\")+\'" placeholder="描述" style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px" onchange="friendsData[\'+i+\'] = Object.assign(normalizeFriend(friendsData[\'+i+\']), {desc:this.value})">\'+\'<button type="button" class="btn btn-danger btn-sm" onclick="friendsData.splice(\'+i+\',1);renderFriends()">×</button>\'; c.appendChild(d); }); }';
    body += 'function addFriend(){ friendsData.push({title:"",name:"",siteurl:"",url:"",imgurl:"",icon:"",desc:"",enabled:true,weight:1,tags:[]}); renderFriends(); }';
    body += 'function saveFriends(){ var payload = friendsData.map(function(f){ return normalizeFriend(f); }); fetch("/api/config/friends", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ friends: payload })}).then(function(r){return r.json()}).then(function(j){ if(j.ok){showToast("✅ 已保存","success")} else {showToast(j.error||"保存失败","error")} }).catch(function(){showToast("网络错误","error")}); }';
    body += 'function publishConfig(){ saveFriends(); fetch("/api/config/publish", {method:"POST"}).then(function(r){return r.json()}).then(function(j){ if(j.ok){showToast("✅ "+j.message,"success")} else {showToast("❌ "+(j.error||"推送失败"),"error")} }); }';
    body += 'renderFriends();';
    body += '</script>';
    body += '</div></div>';
    res.send(wrapHTML("底层修改", body));
  } catch (e) {
    res.status(500).send(wrapHTML("错误", '<div class="container"><h1>错误</h1><pre>' + esc(e.message) + '</pre></div>'));
  }
});

// ── 封面壁纸管理页 ──
app.get("/config/wallpaper", rateLimit(30, 60000), function(req, res) {
  var cfg = loadSiteConfig();
  var desktopFiles = scanFiles(WALLPAPER_DIR, [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);
  var mobileFiles = scanFiles(MOBILE_WALLPAPER_DIR, [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);
  var publicDesktop = scanFiles(path.join(PUBLIC_IMAGES_DIR, "DesktopWallpaper"), [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);
  var publicMobile = scanFiles(path.join(PUBLIC_IMAGES_DIR, "MobileWallpaper"), [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);
  // 标记来源目录，以便正确生成缩略图路径
  desktopFiles.forEach(function(f) { f._src = "src"; f._subdir = "CustomWallpaper"; });
  mobileFiles.forEach(function(f) { f._src = "src"; f._subdir = "MobileWallpaper"; });
  publicDesktop.forEach(function(f) { f._src = "public"; f._subdir = "DesktopWallpaper"; });
  publicMobile.forEach(function(f) { f._src = "public"; f._subdir = "MobileWallpaper"; });

  function renderWallpaperCards(files, type, publicFiles) {
    var allFiles = files.concat(publicFiles);
    if (allFiles.length === 0) return '<div class="empty-state" style="padding:30px"><p>暂无壁纸文件</p></div>';
    var paths = type === "mobile" ? cfg.wallpapers.mobile : cfg.wallpapers.desktop;
    return '<div class="card-grid">' + allFiles.map(function(f) {
      var relPath = "/assets/images/" + (f._subdir || (type === "mobile" ? "MobileWallpaper" : "CustomWallpaper")) + "/" + f.name;
      var used = paths.indexOf(relPath) !== -1;
      var badge = used ? '<span class="badge badge-success" style="position:absolute;top:8px;left:8px;z-index:1;font-size:11px;padding:2px 6px;border-radius:4px;background:#16a34a;color:#fff">使用中</span>' : '';
      // 通过 /api/thumb/ 代理加载图片，确保浏览器可预览
      var thumbSrc = "/api/thumb/" + f._src + "/assets/images/" + f._subdir + "/" + f.name;
      return '<div class="card-item" style="position:relative;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;background:#f8fafc">' + badge +
        '<div style="width:100%;aspect-ratio:16/10;overflow:hidden;background:#f1f5f9;display:flex;align-items:center;justify-content:center">' +
        '<img src="' + thumbSrc + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block" onerror="this.style.display=\'none\'">' +
        '</div>' +
        '<div style="padding:8px 10px"><span style="font-size:12px;color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block" title="' + f.name + '">' + f.name + '</span>' +
        '<div style="display:flex;gap:4px;margin-top:6px">' +
        '<button class="btn btn-danger btn-sm" onclick="deleteWallpaper(\'' + relPath + '\')" title="删除">删除</button></div></div></div>';
    }).join("") + '</div>';
  }

  var body = '<div class="container" style="max-width:1200px;">';
  body += '<header style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px">';
  body += '<h1 style="margin:0;font-size:22px">封面壁纸</h1>';
  body += '<div style="display:flex;gap:8px"><button class="btn btn-primary" onclick="publishConfig()">推送更新</button><a href="/" class="btn btn-ghost">返回后台</a></div>';
  body += '</header>';

  body += '<div class="form-section" style="background:#fff;border:1px solid #e8e8e8;border-radius:12px;padding:20px;box-shadow:0 12px 30px rgba(15,23,42,.04)"><h3>上传新壁纸</h3>';
  body += '<div class="upload-zone" id="wallpaperUploadZone" onclick="document.getElementById(\'wallpaperFileInput\').click()">';
  body += '<input type="file" id="wallpaperFileInput" accept="image/*" style="display:none" multiple>';
  body += '<p style="margin:0">📁 点击或拖拽壁纸文件到此处上传</p>';
  body += '<p style="margin:4px 0 0;font-size:12px">支持 JPG, PNG, GIF, WebP, AVIF 格式</p></div></div>';

  body += '<div class="form-section"><h3>桌面壁纸 (' + (cfg.wallpapers.desktop.length) + ' 个)</h3>';
  body += renderWallpaperCards(desktopFiles, "desktop", publicDesktop);
  body += '</div>';

  body += '<div class="form-section"><h3>移动端壁纸 (' + (cfg.wallpapers.mobile.length) + ' 个)</h3>';
  body += renderWallpaperCards(mobileFiles, "mobile", publicMobile);
  body += '</div></div>';

  body += '<script>';
  body += 'function uploadWallpaper(file,type){var fd=new FormData();fd.append("file",file);fd.append("type",type||"desktop");showToast("上传中...","info",10000);fetch("/api/config/wallpaper/upload",{method:"POST",body:fd}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast("✅ 上传成功","success");setTimeout(function(){location.reload()},800)}else{showToast("❌ "+(j.error||"上传失败"),"error")}}).catch(function(){showToast("❌ 网络错误","error")})}';
  body += 'var wz=document.getElementById("wallpaperUploadZone"),wi=document.getElementById("wallpaperFileInput");';
  body += 'wz.addEventListener("dragover",function(e){e.preventDefault();wz.classList.add("dragover")});';
  body += 'wz.addEventListener("dragleave",function(){wz.classList.remove("dragover")});';
  body += 'wz.addEventListener("drop",function(e){e.preventDefault();wz.classList.remove("dragover");for(var i=0;i<e.dataTransfer.files.length;i++)uploadWallpaper(e.dataTransfer.files[i])});';
  body += 'wi.addEventListener("change",function(){for(var i=0;i<wi.files.length;i++)uploadWallpaper(wi.files[i]);wi.value=""});';
  body += 'function deleteWallpaper(p){if(!confirm("确定删除 ？"))return;fetch("/api/config/wallpaper/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({path:p})}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast("✅ 已删除","success");setTimeout(function(){location.reload()},800)}else{showToast("❌ "+(j.error||"删除失败"),"error")}})}';
  body += 'function publishConfig(){fetch("/api/config/publish",{method:"POST"}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast("✅ "+j.message,"success")}else{showToast("❌ "+(j.error||"推送失败"),"error")}})}';
  body += '</script>';
  body += '</div></div>';
  res.send(wrapHTML("封面壁纸", body));
});

// ── 背景视频管理页 ──
app.get("/config/video", rateLimit(30, 60000), function(req, res) {
  var cfg = loadSiteConfig();
  var files = scanFiles(VIDEO_DIR, [".mp4", ".webm", ".ogg", ".mov"]);

  function renderCards() {
    if (files.length === 0) return '<div class="empty-state" style="padding:30px"><p>暂无视频文件</p></div>';
    return '<table class="list-table"><thead><tr><th>文件名</th><th>大小</th><th style="text-align:right">操作</th></tr></thead><tbody>' +
      files.map(function(f) {
        var isActive = cfg.video && cfg.video.indexOf(f.name) !== -1;
        var badge = isActive ? ' <span style="font-size:11px;padding:2px 6px;border-radius:4px;background:#dbeafe;color:#1e40af;font-weight:500">当前使用</span>' : '';
        return '<tr><td style="display:flex;align-items:center;gap:8px"><span style="font-size:16px">🎬</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + f.name + '">' + f.name + '</span>' + badge + '</td>' +
          '<td style="color:#94a3b8">' + f.size + '</td>' +
          '<td style="text-align:right"><div style="display:flex;gap:6px;justify-content:flex-end">' +
          (isActive ? '' : '<button class="btn btn-primary btn-sm" onclick="selectVideo(\'' + f.name + '\')">选用</button>') +
          '<button class="btn btn-danger btn-sm" onclick="deleteVideo(\'' + f.name + '\')">删除</button>' +
          '</div></td></tr>';
      }).join("") + '</tbody></table>';
  }

  var body = '<div class="container" style="max-width:1200px;">';
  body += '<header style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px">';
  body += '<h1 style="margin:0;font-size:22px">背景视频</h1>';
  body += '<div style="display:flex;gap:8px"><button class="btn btn-primary" onclick="publishConfig()">推送更新</button><a href="/" class="btn btn-ghost">返回后台</a></div>';
  body += '</header>';

  body += '<div class="form-section" style="background:#fff;border:1px solid #e8e8e8;border-radius:12px;padding:20px;box-shadow:0 12px 30px rgba(15,23,42,.04)"><h3>🎬 视频文件 (' + files.length + ' 个)</h3>';
  body += '<div class="upload-zone" id="videoUploadZone" onclick="document.getElementById(\'videoFileInput\').click()">';
  body += '<input type="file" id="videoFileInput" accept="video/*" style="display:none">';
  body += '<p style="margin:0">📁 点击或拖拽视频文件到此处上传</p>';
  body += '<p style="margin:4px 0 0;font-size:12px">支持 MP4, WebM, OGG, MOV 格式</p></div>';

  if (cfg.video) {
    body += '<div style="margin:16px 0;padding:12px;background:#f8fafc;border-radius:8px;display:flex;align-items:center;gap:12px">';
    body += '<span style="font-size:13px;color:#64748b">当前视频:</span>';
    body += '<code style="font-size:12px;background:#e2e8f0;padding:2px 8px;border-radius:4px">' + cfg.video + '</code>';
    body += '</div>';
  }

  body += renderCards();
  body += '</div></div>';

  body += '<script>';
  body += 'function uploadVideo(file){var fd=new FormData();fd.append("file",file);showToast("上传中...","info",10000);fetch("/api/config/video/upload",{method:"POST",body:fd}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast("✅ 上传成功: "+j.filename,"success");setTimeout(function(){location.reload()},800)}else{showToast("❌ "+(j.error||"上传失败"),"error")}}).catch(function(){showToast("❌ 网络错误","error")})}';
  body += 'var vz=document.getElementById("videoUploadZone"),vi=document.getElementById("videoFileInput");';
  body += 'vz.addEventListener("dragover",function(e){e.preventDefault();vz.classList.add("dragover")});';
  body += 'vz.addEventListener("dragleave",function(){vz.classList.remove("dragover")});';
  body += 'vz.addEventListener("drop",function(e){e.preventDefault();vz.classList.remove("dragover");uploadVideo(e.dataTransfer.files[0])});';
  body += 'vi.addEventListener("change",function(){if(vi.files.length)uploadVideo(vi.files[0]);vi.value=""});';
  body += 'function selectVideo(name){fetch("/api/config/video/select",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filename:name})}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast("✅ 已选用","success");setTimeout(function(){location.reload()},800)}else{showToast("❌ "+(j.error||"操作失败"),"error")}})}';
  body += 'function deleteVideo(name){if(!confirm("确定删除 "+name+" ？"))return;fetch("/api/config/video/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filename:name})}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast("✅ 已删除","success");setTimeout(function(){location.reload()},800)}else{showToast("❌ "+(j.error||"删除失败"),"error")}})}';
  body += 'function publishConfig(){fetch("/api/config/publish",{method:"POST"}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast("✅ "+j.message,"success")}else{showToast("❌ "+(j.error||"推送失败"),"error")}})}';
  body += '</script>';
  body += '</div></div>';
  res.send(wrapHTML("背景视频", body));
});

// ── 背景音乐管理页 ──
app.get("/config/music", rateLimit(30, 60000), function(req, res) {
  var cfg = loadSiteConfig();
  var files = scanFiles(MUSIC_DIR, [".mp3", ".ogg", ".wav", ".flac", ".aac", ".m4a"]);

  function renderMusicList() {
    if (cfg.music.length === 0) return '<div class="empty-state" style="padding:30px"><p>暂无音乐</p></div>';
    return '<div style="display:flex;flex-direction:column;gap:8px">' + cfg.music.map(function(m, i) {
      var cover = (m.cover || '');
      var coverHtml = cover ? '<img src="' + cover + '" alt="cover" style="width:48px;height:48px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;background:#fff">' : '<div style="width:48px;height:48px;border-radius:8px;background:#e2e8f0;color:#64748b;display:flex;align-items:center;justify-content:center;font-size:18px">🎵</div>';
      return '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:#f8fafc;border-radius:8px">' +
        coverHtml +
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">' +
        '<div style="font-weight:500;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (m.name || '未命名') + '</div>' +
        '<div style="font-size:12px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (m.artist || '未知歌手') + ' · ' + (m.url || '') + '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
        '<input value="' + (cover || '') + '" placeholder="封面 URL" style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:12px;min-width:180px" onchange="musicData[' + i + '].cover=this.value">' +
        '<button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'music-cover-input-' + i + '\').click()">上传封面</button>' +
        '<input id="music-cover-input-' + i + '" type="file" accept="image/*" style="display:none" onchange="handleMusicCoverUpload(' + i + ', this.files[0])">' +
        '</div>' +
        '</div>' +
        '<button class="btn btn-danger btn-sm" onclick="removeMusic(' + i + ')">删除</button>' +
        '</div>';
    }).join("") + '</div>';
  }

  var body = '<div class="container" style="max-width:1200px;">';
  body += '<header style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px">';
  body += '<h1 style="margin:0;font-size:22px">背景音乐</h1>';
  body += '<div style="display:flex;gap:8px"><button class="btn btn-primary" onclick="publishConfig()">推送更新</button><a href="/" class="btn btn-ghost">返回后台</a></div>';
  body += '</header>';

  body += '<div class="form-section" style="background:#fff;border:1px solid #e8e8e8;border-radius:12px;padding:20px;box-shadow:0 12px 30px rgba(15,23,42,.04)"><h3>上传音乐文件</h3>';
  body += '<div class="upload-zone" id="musicUploadZone" onclick="document.getElementById(\'musicFileInput\').click()">';
  body += '<input type="file" id="musicFileInput" accept="audio/*" style="display:none">';
  body += '<p style="margin:0">📁 点击或拖拽音频文件到此处上传</p>';
  body += '<p style="margin:4px 0 0;font-size:12px">支持 MP3, OGG, WAV, FLAC, AAC, M4A 格式</p></div></div>';

  body += '<div class="form-section"><h3>本地音乐文件 (' + files.length + ' 个)</h3>';
  if (files.length > 0) {
    body += '<div style="display:flex;flex-direction:column;gap:6px">' + files.map(function(f) {
      var isInPlaylist = cfg.music.some(function(m) { return m.url && m.url.indexOf(f.name) !== -1; });
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#f8fafc;border-radius:6px">' +
        '<span style="font-size:14px">🎵</span>' +
        '<span style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + f.name + '</span>' +
        '<span style="font-size:12px;color:#94a3b8">' + f.size + '</span>' +
        (isInPlaylist ? '<span style="font-size:11px;color:#16a34a">已添加</span>' : '<button class="btn btn-primary btn-sm" onclick="addMusic(\'' + f.name + '\')">添加</button>') +
        '<button class="btn btn-danger btn-sm" onclick="deleteMusicFile(\'' + f.name + '\')">删除</button>' +
        '</div>';
    }).join("") + '</div>';
  } else {
    body += '<p style="color:#94a3b8;font-size:13px">暂无本地音乐文件</p>';
  }
  body += '</div>';

  body += '<div class="form-section"><h3>播放列表 (' + cfg.music.length + ' 首)</h3>';
  body += '<div id="musicList">' + renderMusicList() + '</div>';
  body += '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">';
  body += '<input id="musicName" placeholder="歌曲名" style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;width:120px">';
  body += '<input id="musicArtist" placeholder="歌手" style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;width:100px">';
  body += '<input id="musicUrl" placeholder="URL (如 /assets/music/xxx.mp3)" style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;flex:1;min-width:180px">';
  body += '<input id="musicCover" placeholder="封面 URL" style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;width:180px">';
  body += '<button class="btn btn-success btn-sm" onclick="addMusicManual()">手动添加</button>';
  body += '</div></div></div>';

  body += '<script>';
  body += 'var musicData=' + JSON.stringify(cfg.music) + ';';
  body += 'function uploadMusic(file){var fd=new FormData();fd.append("file",file);showToast("上传中...","info",10000);fetch("/api/config/music/upload",{method:"POST",body:fd}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast("✅ 上传成功","success");setTimeout(function(){location.reload()},800)}else{showToast("❌ "+(j.error||"上传失败"),"error")}}).catch(function(){showToast("❌ 网络错误","error")})}';
  body += 'function uploadMusicCover(index,file){if(!file)return;var fd=new FormData();fd.append("file",file);showToast("上传封面中...","info",10000);fetch("/api/config/music/cover-upload",{method:"POST",body:fd}).then(function(r){return r.json()}).then(function(j){if(j.ok){musicData[index].cover=j.path;saveMusicList();showToast("✅ 封面已更新","success")}else{showToast("❌ "+(j.error||"封面上传失败"),"error")}}).catch(function(){showToast("❌ 网络错误","error")})}';
  body += 'function handleMusicCoverUpload(index,file){uploadMusicCover(index,file);var input=document.getElementById("music-cover-input-"+index);if(input) input.value=""; }';
  body += 'var mz=document.getElementById("musicUploadZone"),mi=document.getElementById("musicFileInput");';
  body += 'mz.addEventListener("dragover",function(e){e.preventDefault();mz.classList.add("dragover")});';
  body += 'mz.addEventListener("dragleave",function(){mz.classList.remove("dragover")});';
  body += 'mz.addEventListener("drop",function(e){e.preventDefault();mz.classList.remove("dragover");uploadMusic(e.dataTransfer.files[0])});';
  body += 'mi.addEventListener("change",function(){if(mi.files.length)uploadMusic(mi.files[0]);mi.value=""});';
  body += 'function addMusic(name){musicData.push({name:name.replace(/\.[^.]+$/,""),artist:"",url:"/assets/music/"+name,cover:"",lrc:""});saveMusicList()}';
  body += 'function addMusicManual(){var n=document.getElementById("musicName").value,a=document.getElementById("musicArtist").value,u=document.getElementById("musicUrl").value,c=document.getElementById("musicCover").value;if(!u){showToast("请填写URL","error");return}musicData.push({name:n||"未命名",artist:a||"未知歌手",url:u,cover:c||"",lrc:""});saveMusicList()}';
  body += 'function removeMusic(i){musicData.splice(i,1);saveMusicList()}';
  body += 'function saveMusicList(){fetch("/api/config/music/update",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({music:musicData})}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast("✅ 已保存","success");setTimeout(function(){location.reload()},800)}else{showToast("❌ "+(j.error||"保存失败"),"error")}})}';
  body += 'function deleteMusicFile(name){if(!confirm("确定删除 "+name+" ？"))return;fetch("/api/config/music/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filename:name})}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast("✅ 已删除","success");setTimeout(function(){location.reload()},800)}else{showToast("❌ "+(j.error||"删除失败"),"error")}})}';
  body += 'function publishConfig(){fetch("/api/config/publish",{method:"POST"}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast("✅ "+j.message,"success")}else{showToast("❌ "+(j.error||"推送失败"),"error")}})}';
  body += '</script>';
  body += '</div></div>';
  res.send(wrapHTML("背景音乐", body));
});

// ── 公告管理页 ──
app.get("/config/announcement", rateLimit(30, 60000), function(req, res) {
  var cfg = loadSiteConfig();
  var a = cfg.announcement || { title: "", content: "", closable: true, link: { enable: false, text: "", url: "", external: false } };

  var body = '<div class="container" style="max-width:920px;">';
  body += '<header><h1>公告管理</h1>';
  body += '<div style="display:flex;gap:8px"><a href="/" class="btn btn-ghost">← 返回后台</a><button class="btn btn-primary" onclick="publishConfig()">推送更新</button></div>';
  body += '</header>';

  body += '<div style="background:#fff;border:1px solid #e8e8e8;border-radius:12px;padding:20px;box-shadow:0 12px 30px rgba(15,23,42,.04)">';
  body += '<div class="form-grid">';
  body += '<div class="form-group full"><label>公告标题</label><input id="annTitle" value="' + (a.title || '').replace(/"/g, '&quot;') + '" placeholder="输入公告标题"></div>';
  body += '<div class="form-group full"><label>公告内容</label><textarea id="annContent" rows="4" style="min-height:100px;resize:vertical;font-family:inherit">' + (a.content || '') + '</textarea></div>';
  body += '<div class="form-group"><label><input type="checkbox" id="annClosable" ' + (a.closable !== false ? 'checked' : '') + '> 可关闭</label></div>';
  body += '<div class="form-group"><label><input type="checkbox" id="annLinkEnable" ' + (a.link && a.link.enable ? 'checked' : '') + '> 包含链接</label></div>';
  body += '<div class="form-group full" id="linkFields" style="' + (a.link && a.link.enable ? '' : 'display:none') + '">';
  body += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
  body += '<input id="annLinkText" value="' + ((a.link && a.link.text) || '').replace(/"/g, '&quot;') + '" placeholder="链接文字" style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;width:150px">';
  body += '<input id="annLinkUrl" value="' + ((a.link && a.link.url) || '').replace(/"/g, '&quot;') + '" placeholder="链接URL" style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;flex:1">';
  body += '<label style="font-size:13px;display:flex;align-items:center;gap:4px"><input type="checkbox" id="annLinkExternal" ' + (a.link && a.link.external ? 'checked' : '') + '> 新窗口</label>';
  body += '</div></div>';
  body += '</div></div>';

  body += '<div class="form-actions"><button class="btn btn-success" onclick="saveAnnouncement()">保存</button></div>';
  body += '</div>';

  body += '<script>';
  body += 'document.getElementById("annLinkEnable").addEventListener("change",function(){document.getElementById("linkFields").style.display=this.checked?"":"none"});';
  body += 'function saveAnnouncement(){var a={title:document.getElementById("annTitle").value,content:document.getElementById("annContent").value,closable:document.getElementById("annClosable").checked,link:{enable:document.getElementById("annLinkEnable").checked,text:document.getElementById("annLinkText").value,url:document.getElementById("annLinkUrl").value,external:document.getElementById("annLinkExternal").checked}};fetch("/api/config/announcement",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({announcement:a})}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast("✅ 已保存","success")}else{showToast("❌ "+(j.error||"保存失败"),"error")}})}';
  body += 'function publishConfig(){saveAnnouncement();fetch("/api/config/publish",{method:"POST"}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast("✅ "+j.message,"success")}else{showToast("❌ "+(j.error||"推送失败"),"error")}})}';
  body += '</script>';
  res.send(wrapHTML("公告管理", body));
});

// ── 关于我管理页（直接进入编辑页，不带导航栏） ──
app.get("/config/about", rateLimit(30, 60000), function(req, res) {
  var cfg = loadSiteConfig();
  var aboutContent = cfg.about || "";

  var body = '<div class="container" style="max-width:920px;">';
  body += '<header><h1>关于我</h1>';
  body += '<div style="display:flex;gap:8px"><a href="/" class="btn btn-ghost">← 返回后台</a><button class="btn btn-primary" onclick="publishConfig()">推送更新</button></div>';
  body += '</header>';

  body += '<div style="background:#fff;border:1px solid #e8e8e8;border-radius:12px;padding:20px;box-shadow:0 12px 30px rgba(15,23,42,.04)">';
  body += '<div class="form-group"><label>个人介绍 (Markdown)</label>';
  body += '<textarea id="aboutContent" rows="15" style="min-height:300px;resize:vertical;font-family:inherit;width:100%;padding:12px;border:1px solid #e2e8f0;border-radius:8px" placeholder="在这里写下你的个人介绍...">' + esc(aboutContent) + '</textarea></div>';
  body += '</div>';

  body += '<div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn btn-success" onclick="saveAbout()">保存</button></div>';
  body += '</div>';

  body += '<script>';
  body += 'function saveAbout(){fetch("/api/config/about",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({about:document.getElementById("aboutContent").value})}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast("✅ 已保存","success")}else{showToast("❌ "+(j.error||"保存失败"),"error")}})}';
  body += 'function publishConfig(){saveAbout();fetch("/api/config/publish",{method:"POST"}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast("✅ "+j.message,"success")}else{showToast("❌ "+(j.error||"推送失败"),"error")}})}';
  body += '</script>';
  res.send(wrapHTML("关于我", body));
});

  var PORT = process.env.PORT || 3000;
  app.listen(PORT, function() {
    console.log("");
    console.log("🚀 Aurora 后台已启动");
    console.log("   地址: http://localhost:" + PORT);
    console.log("   文章目录: " + POSTS_DIR);
    console.log("   图片目录: " + IMAGES_DIR);
    console.log("");
  });
}

start();
