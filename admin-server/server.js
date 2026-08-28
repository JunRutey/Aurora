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

// ── HTML helpers ──
const STYLE = [
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
  // ── Dashboard Layout ──
  ".dashboard{display:flex;gap:20px;max-width:1100px;margin:0 auto;padding:24px 20px}",
  ".dashboard-main{flex:1;min-width:0}",
  ".dashboard-side{width:280px;flex-shrink:0;display:flex;flex-direction:column;gap:16px}",
  ".widget{background:#fff;border-radius:10px;border:1px solid #e8e8e8;overflow:hidden}",
  ".widget-header{padding:14px 16px 10px;font-size:13px;font-weight:600;color:#374151;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;justify-content:space-between}",
  ".widget-body{padding:12px 16px 16px}",
  ".widget-link{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:6px;font-size:13px;color:#475569;transition:all .15s;text-decoration:none}",
  ".widget-link:hover{background:#f8fafc;color:#2563eb;text-decoration:none}",
  ".widget-link svg{width:16px;height:16px;opacity:.45;flex-shrink:0}",
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
  ".staged-badge{display:inline-block;padding:2px 6px;border-radius:4px;background:#fef3c7;color:#92400e;font-size:11px;font-weight:500;margin-left:6px}"
].join("\n");

const TOAST_SCRIPT = [
  "function showToast(msg,type,duration){duration=duration||3000;var t=document.getElementById('toast');t.textContent=msg;t.className='toast '+(type||'info');requestAnimationFrame(function(){t.classList.add('show')});setTimeout(function(){t.classList.remove('show')},duration)}",
  "function setLoading(btn,loading){if(loading){btn.dataset.origText=btn.textContent;btn.textContent='处理中...';btn.disabled=true}else{btn.textContent=btn.dataset.origText||btn.textContent;btn.disabled=false}}"
].join("\n");

function parseDateFlexible(s) {
  if (!s) return new Date(NaN);
  var str = String(s);
  if (str.indexOf("T") >= 0) return new Date(str);
  return new Date(str.replace(" ", "T") + "Z");
}
function esc(s) {
  if (s == null) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function wrapHTML(title, body) {
  return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>' + esc(title) + ' - Aurora Admin</title><style>' + STYLE + '</style></head><body>' + body + '<div id="toast" class="toast"></div><script>' + TOAST_SCRIPT + '</script></body></html>';
}

function formatBytes(b) {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(1) + " MB";
}

function serializeFM(data) {
  var out = {};
  for (var k in data) {
    if (data[k] instanceof Date) {
      // 带Z后缀，确保前端能正确识别UTC时间
      out[k] = data[k].toISOString();
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
    var item = items[i];
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

// ── SVG Icons ──
var icDoc = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
var icFolder = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
var icTag = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>';
var icPin = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>';
var icEdit = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
var icDash = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>';
var icPackage = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';
var icInbox = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>';
var icRefresh = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>';

// ── API: 上传图片 ──
app.post("/api/upload", function(req, res) {
  upload.single("file")(req, res, function(err) {
    if (err) return res.json({ ok: false, error: err.message || "上传失败" });
    if (!req.file) return res.json({ ok: false, error: "未选择文件" });
    // 同步到 public 目录，确保 markdown 正文中的图片可被 web 服务器直接提供
    try {
      if (!fs.existsSync(PUBLIC_IMAGES_DIR)) fs.mkdirSync(PUBLIC_IMAGES_DIR, { recursive: true });
      fs.copyFileSync(req.file.path, path.join(PUBLIC_IMAGES_DIR, req.file.filename));
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
app.get("/api/post-meta.json", function(req, res) {
  try {
    res.json(getAllPosts().map(function(p) {
      return { id: p.slug, title: p.data.title || p.slug, published: p.data.published || "", draft: !!p.data.draft, pinned: !!p.data.pinned };
    }));
  } catch(e) { res.json([]); }
});

// ── API: 已有图片 ──
app.get("/api/images", function(req, res) {
  try {
    var images = scanImages(IMAGES_DIR, "src/assets/images");
    images.sort();
    res.json({ ok: true, images: images });
  } catch (e) { res.json({ ok: false, error: e.message, images: [] }); }
});

// ── API: 图片缩略图 ──
app.get("/api/thumb/*", function(req, res) {
  var relPath = req.params[0] || "";
  if (relPath.includes("..")) return res.status(403).send("Forbidden");
  var filePath = path.join(PROJECT_ROOT, relPath);
  if (!fs.existsSync(filePath)) return res.status(404).send("Not found");
  res.sendFile(filePath);
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
      return '<tr><td><a href="/edit?slug=' + encodeURIComponent(p.slug) + '">' + esc(p.data.title || p.slug) + '</a> ' + badges.join(" ") + '</td><td>' + date + '</td><td>' + (tags || '<span style="color:#cbd5e1">-</span>') + '</td><td>' + p.size + '</td><td class="actions"><a href="/edit?slug=' + encodeURIComponent(p.slug) + '" class="btn btn-ghost btn-sm">编辑</a><button class="btn btn-danger btn-sm" onclick="deletePost(\'' + esc(p.slug) + '\')">删除</button></td></tr>';
    }).join("\n");

    // ── Dashboard ──
    var body = '';
    body += '<div style="max-width:1100px;margin:0 auto;padding:24px 20px 0">';
    body += '<header style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">';
    body += '<h1 style="font-size:20px;font-weight:600;display:flex;align-items:center;gap:8px">' + icDash + ' Aurora<span style="color:#94a3b8;font-weight:400;font-size:14px;margin-left:4px">后台管理</span></h1>';
    body += '<div style="display:flex;gap:8px"><a href="/" class="btn btn-ghost btn-sm">' + icRefresh + ' 刷新</a><a href="/new" class="btn btn-primary">+ 新建文章</a></div>';
    body += '</header>';
    body += '<div class="stats-summary">';
    body += '<div class="stat-chip">' + icDoc + ' <strong>' + totalPosts + '</strong> 篇文章</div>';
    body += '<div class="stat-chip">' + icFolder + ' <strong>' + catCount + '</strong> 个分类</div>';
    body += '<div class="stat-chip">' + icTag + ' <strong>' + tagCount + '</strong> 个标签</div>';
    body += '<div class="stat-chip">' + icPin + ' <strong>' + pinnedCount + '</strong> 篇置顶</div>';
    if (stagedCount > 0) body += '<div class="stat-chip">' + icPackage + ' <strong>' + stagedCount + '</strong> 篇暂存</div>';
    body += '</div></div>';

    body += '<div class="dashboard">';

    // ── Main ──
    body += '<div class="dashboard-main">';
    if (posts.length === 0) {
      body += '<div class="empty" style="background:#fff;border-radius:10px;border:1px solid #e8e8e8"><p>还没有文章</p><a href="/new" class="btn btn-primary">写第一篇</a></div>';
    } else {
      body += '<div style="background:#fff;border-radius:10px;border:1px solid #e8e8e8;overflow:hidden">';
      body += '<table class="post-table"><thead><tr><th>标题</th><th>日期</th><th>标签</th><th>大小</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table>';
      body += '</div>';
    }
    body += '</div>';

    // ── Sidebar ──
    body += '<div class="dashboard-side">';
    body += '<div class="widget"><div class="widget-header">快捷操作</div><div class="widget-body">';
    body += '<a href="/new" class="widget-link">' + icEdit + ' 新建文章</a>';
    body += '<a href="/" class="widget-link">' + icRefresh + ' 刷新列表</a>';
    body += '<a href="/staging" class="widget-link">' + icInbox + ' 暂存列表' + (stagedCount > 0 ? ' <span style="background:#f59e0b;color:#fff;font-size:11px;padding:1px 6px;border-radius:8px;margin-left:auto">' + stagedCount + '</span>' : '') + '</a>';
    body += '</div></div>';

    // ── 暂存概览 widget ──
    var stagingList = loadStaging();
    if (stagingList.length > 0) {
      body += '<div class="widget"><div class="widget-header">' + icPackage + ' 待推送 <span style="color:#94a3b8;font-size:11px">' + stagingList.length + ' 篇</span></div><div class="widget-body">';
      stagingList.slice(0, 5).forEach(function(s) {
        body += '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;font-size:13px;color:#475569;border-bottom:1px solid #f8f9fa">';
        body += '<a href="/edit?slug=' + encodeURIComponent(s.slug) + '" style="color:inherit;text-decoration:none">' + esc(s.title || s.slug) + '</a>';
        body += '<span style="color:#94a3b8;font-size:11px">' + (s.stagedAt ? new Date(s.stagedAt).toLocaleDateString("zh-CN") : "") + '</span>';
        body += '</div>';
      });
      if (stagingList.length > 5) body += '<div style="text-align:center;padding:8px 0"><a href="/staging" style="font-size:12px">查看全部</a></div>';
      body += '</div></div>';
    }
    body += '</div></div>';

    body += '<script>function deletePost(slug){if(!confirm("确定删除 "+slug+" ?"))return;var btn=event.target;setLoading(btn,true);fetch("/api/post/"+encodeURIComponent(slug),{method:"DELETE"}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast(j.message,"success");setTimeout(function(){location.reload()},800)}else{showToast(j.error||"删除失败","error")}}).catch(function(){showToast("网络错误","error")});setLoading(btn,false)}</script>';

    res.send(wrapHTML("文章列表", body));
  } catch (e) {
    res.status(500).send(wrapHTML("错误", '<div class="container"><h1>错误</h1><pre>' + esc(e.message) + '</pre></div>'));
  }
});

// ── 暂存列表页 ──
app.get("/staging", function(req, res) {
  try {
    var stagingList = loadStaging();
    var allPosts = getAllPosts();

    var body = '<div class="container">';
    body += '<header><h1>' + icInbox + ' 暂存列表<span style="color:#94a3b8;font-weight:400;font-size:14px;margin-left:8px">' + stagingList.length + ' 篇待推送</span></h1>';
    body += '<div style="display:flex;gap:8px"><a href="/" class="btn btn-ghost">← 返回列表</a>';
    if (stagingList.length > 0) {
      body += '<button class="btn btn-success" onclick="batchPush()">' + icPackage + ' 全部推送到仓库</button>';
    }
    body += '</div></header>';

    if (stagingList.length === 0) {
      body += '<div class="empty" style="background:#fff;border-radius:10px;border:1px solid #e8e8e8;padding:60px 20px">';
      body += '<p style="color:#94a3b8">暂存列表为空</p>';
      body += '<a href="/new" class="btn btn-primary">新建文章</a>';
      body += '</div>';
    } else {
      body += '<div style="background:#fff;border-radius:10px;border:1px solid #e8e8e8;overflow:hidden">';
      body += '<table class="post-table"><thead><tr><th>标题</th><th>暂存时间</th><th>操作</th></tr></thead><tbody>';
      stagingList.forEach(function(s) {
        var post = allPosts.find(function(p) { return p.slug === s.slug; });
        var date = s.stagedAt ? new Date(s.stagedAt).toLocaleString("zh-CN", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hour12:false }) : "-";
        body += '<tr>';
        body += '<td><a href="/edit?slug=' + encodeURIComponent(s.slug) + '">' + esc(post ? (post.data.title || s.slug) : s.title || s.slug) + '</a></td>';
        body += '<td>' + date + '</td>';
        body += '<td class="actions">';
        body += '<a href="/edit?slug=' + encodeURIComponent(s.slug) + '" class="btn btn-ghost btn-sm">编辑</a>';
        body += '<button class="btn btn-ghost btn-sm" onclick="pushOne(\'' + esc(s.slug) + '\',this)">推送</button>';
        body += '<button class="btn btn-danger btn-sm" onclick="removeStaged(\'' + esc(s.slug) + '\')">移除</button>';
        body += '</td></tr>';
      });
      body += '</tbody></table>';
      body += '</div>';
    }
    body += '</div>';

    body += '<script>';
    body += 'function pushOne(slug,btn){setLoading(btn,true);fetch("/api/staging/push-single",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({slugs:[slug]})}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast(j.message,"success");setTimeout(function(){location.reload()},800)}else{showToast(j.error||"推送失败","error");setLoading(btn,false)}}).catch(function(){showToast("网络错误","error");setLoading(btn,false)})}';
    body += 'function removeStaged(slug){if(!confirm("从暂存列表移除 "+slug+" ?"))return;fetch("/api/staging/remove",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({slug:slug})}).then(function(r){return r.json()}).then(function(j){if(j.ok){location.reload()}else{showToast(j.error||"操作失败","error")}}).catch(function(){showToast("网络错误","error")})}';
    body += 'function batchPush(){if(!confirm("确认将所有暂存文章推送到仓库？"))return;var btn=document.querySelector(".btn-success");setLoading(btn,true);fetch("/api/staging/batch-push",{method:"POST"}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast(j.message,"success",4000);setTimeout(function(){location.reload()},1500)}else{showToast(j.error||"推送失败","error");setLoading(btn,false)}}).catch(function(){showToast("网络错误","error");setLoading(btn,false)})}';
    body += '</script>';

    res.send(wrapHTML("暂存列表", body));
  } catch (e) {
    res.status(500).send(wrapHTML("错误", '<div class="container"><h1>错误</h1><pre>' + esc(e.message) + '</pre></div>'));
  }
});

// ── 编辑/新建页 ──
app.get("/new", function(req, res) { serveEditor(null, res); });
app.get("/edit", function(req, res) {
  if (!req.query.slug) return res.redirect("/");
  serveEditor(req.query.slug, res);
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

  var body = '<div class="container"><header><h1>' + esc(formTitle) + '</h1><a href="/" class="btn btn-ghost">← 返回列表</a></header>';
  body += '<form id="postForm"><div class="form-grid">';

  // 标题
  body += '<div class="form-group"><label>标题 *</label><input type="text" name="title" value="' + esc(data.title) + '" required placeholder="文章标题"></div>';
  // Slug
  body += '<div class="form-group"><label>Slug（文件名）</label><input type="text" name="slug" value="' + esc(slug || "") + '" placeholder="留空自动生成"' + (slug ? ' readonly style="background:#f1f5f9"' : '') + '><span class="help-text">作为 .md 文件名，如 my-post</span></div>';
  // 日期
  var defaultDate = data.published ? String(data.published).slice(0, 10) : new Date().toISOString().slice(0, 10);
  body += '<div class="form-group"><label>发布日期 *</label><input type="date" name="publishedDate" value="' + esc(defaultDate) + '"></div>';
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
    body += 'function unstage(){fetch("/api/staging/remove",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({slug:"' + esc(slug) + '"})}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast("已取消暂存","info");setTimeout(function(){location.reload()},500)}else{showToast("操作失败","error")}})}';
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
    '  // 系统时钟',
    '  var sysTimeEl = document.getElementById("sysTime");',
    '  function pad2(n) { return String(n).padStart(2, "0"); }',
    '  function syncClock() {',
    '    var now = new Date();',
    '    sysTimeEl.textContent = pad2(now.getHours()) + ":" + pad2(now.getMinutes()) + ":" + pad2(now.getSeconds());',
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
    '          var md = "\
![" + j.filename + "](" + j.publicPath + ")\
";',
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
    '    var dateVal = fd.get("publishedDate") || new Date().toISOString().slice(0, 10);',
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
app.post("/api/post", async function(req, res) {
  try {
    var body = req.body;
    var slug = body.slug;
    var title = body.title;
    var published = body.published;
    var tags = body.tags;
    var content = body.content;
    var action = body.action || "push";

    if (!slug || !slug.trim()) {
      slug = (title || "").toLowerCase().replace(/[^\w\u4e00-\u9fff\s-]/g, "").replace(/[\s_]+/g, "-").replace(/^-|-$/g, "") || ("post-" + Date.now());
    }
    slug = slug.trim().replace(/\.md$/, "");

    if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });

    // 后端自动获取当前时间：仅日期→补UTC时间；完整ISO→直接解析
    var now = new Date();
    var publishedDate;
    if (!published) {
      publishedDate = now;
    } else if (published.indexOf("T") >= 0) {
      publishedDate = new Date(published);
    } else {
      var utcHH = String(now.getUTCHours()).padStart(2, "0");
      var utcMM = String(now.getUTCMinutes()).padStart(2, "0");
      var utcSS = String(now.getUTCSeconds()).padStart(2, "0");
      publishedDate = new Date(published + "T" + utcHH + ":" + utcMM + ":" + utcSS + ".000Z");
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
app.delete("/api/post/:slug", async function(req, res) {
  try {
    var slug = req.params.slug;
    var filePath = findPostFile(slug);
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

// ── API: 单篇推送 ──
app.post("/api/staging/push-single", async function(req, res) {
  try {
    var slugs = (req.body.slugs || []).filter(Boolean);
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
app.post("/api/staging/batch-push", async function(req, res) {
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

// ── API: 移除暂存 ──
app.post("/api/staging/remove", function(req, res) {
  try {
    var slug = req.body.slug;
    if (!slug) return res.json({ ok: false, error: "缺少 slug" });
    removeFromStaging(slug);
    res.json({ ok: true, message: "已从暂存列表移除" });
  } catch (e) {
    res.json({ ok: false, error: e.message });
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
        var srcPath = path.join(IMAGES_DIR, items[i].name);
        var dstPath = path.join(PUBLIC_IMAGES_DIR, items[i].name);
        if (items[i].isFile() && !fs.existsSync(dstPath)) {
          fs.copyFileSync(srcPath, dstPath);
        }
      }
    } catch (e) { /* non-fatal */ }
  }

  syncImagesToPublic();

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
