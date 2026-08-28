const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const simpleGit = require("simple-git");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const POSTS_DIR = path.join(PROJECT_ROOT, "src", "content", "posts");
const git = simpleGit(PROJECT_ROOT);
let currentBranch = "main";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const FM_DEFAULTS = {
  title: "", published: new Date().toISOString().slice(0, 10), draft: false,
  description: "", image: "", tags: [], category: "", lang: "", pinned: false,
  author: "", sourceLink: "", licenseName: "", licenseUrl: "", comment: true,
  password: "", passwordHint: "",
};

// ── HTML helpers (avoid template literals to prevent backtick conflicts) ──
const STYLE = [
  "*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}",
  "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans SC',sans-serif;background:#fafafa;color:#1a1a1a;line-height:1.6}",
  "a{color:#2563eb;text-decoration:none}a:hover{text-decoration:underline}",
  ".container{max-width:960px;margin:0 auto;padding:24px 20px}",
  "header{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px}",
  "header h1{font-size:20px;font-weight:600}header h1 span{color:#94a3b8;font-weight:400;font-size:14px;margin-left:8px}",
  ".btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:6px;border:none;font-size:14px;font-weight:500;cursor:pointer;transition:all .15s}",
  ".btn-primary{background:#2563eb;color:#fff}.btn-primary:hover{background:#1d4ed8}",
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
  ".preview-panel h1,.preview-panel h2,.preview-panel h3{margin:16px 0 8px}",
  ".preview-panel p{margin-bottom:12px}",
  ".preview-panel code{background:#f1f5f9;padding:2px 6px;border-radius:3px;font-size:13px}",
  ".preview-panel pre{background:#1e293b;color:#e2e8f0;padding:16px;border-radius:6px;overflow-x:auto;margin-bottom:12px}",
  ".preview-panel pre code{background:none;padding:0;color:inherit}",
  "@media(max-width:768px){.form-grid{grid-template-columns:1fr}.editor-layout{flex-direction:column}}"
].join("\n");

const TOAST_SCRIPT = [
  "function showToast(msg,type,duration){duration=duration||3000;var t=document.getElementById('toast');t.textContent=msg;t.className='toast '+(type||'info');requestAnimationFrame(function(){t.classList.add('show')});setTimeout(function(){t.classList.remove('show')},duration)}",
  "function setLoading(btn,loading){if(loading){btn.dataset.origText=btn.textContent;btn.textContent='处理中...';btn.disabled=true}else{btn.textContent=btn.dataset.origText||btn.textContent;btn.disabled=false}}"
].join("\n");

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
    if (data[k] instanceof Date) out[k] = data[k].toISOString().slice(0, 10);
    else out[k] = data[k];
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

// ── 列表页 ──
app.get("/", function(req, res) {
  try {
    var posts = getAllPosts();
    posts.sort(function(a, b) { return new Date(b.data.published) - new Date(a.data.published); });
    var rows = posts.map(function(p) {
      var tags = (p.data.tags || []).map(function(t) { return '<span class="tag">' + esc(t) + '</span>'; }).join("");
      var badges = [];
      if (p.data.draft) badges.push('<span class="draft-badge">草稿</span>');
      if (p.data.pinned) badges.push('<span class="pinned-badge">置顶</span>');
      var date = p.data.published ? new Date(p.data.published).toLocaleDateString("zh-CN") : "-";
      return '<tr><td><a href="/edit?slug=' + encodeURIComponent(p.slug) + '">' + esc(p.data.title || p.slug) + '</a> ' + badges.join(" ") + '</td><td>' + date + '</td><td>' + (tags || '<span style="color:#cbd5e1">-</span>') + '</td><td>' + p.size + '</td><td class="actions"><a href="/edit?slug=' + encodeURIComponent(p.slug) + '" class="btn btn-ghost btn-sm">编辑</a><button class="btn btn-danger btn-sm" onclick="deletePost(\'' + esc(p.slug) + '\')">删除</button></td></tr>';
    }).join("\n");

    var body = '<div class="container"><header><h1>Aurora<span>后台管理</span></h1><a href="/new" class="btn btn-primary">+ 新建文章</a></header>';
    if (posts.length === 0) {
      body += '<div class="empty"><p>还没有文章</p><a href="/new" class="btn btn-primary">写第一篇</a></div>';
    } else {
      body += '<table class="post-table"><thead><tr><th>标题</th><th>日期</th><th>标签</th><th>大小</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table>';
    }
    body += '</div>';
    body += '<script>function deletePost(slug){if(!confirm("确定删除 "+slug+" ?"))return;var btn=event.target;setLoading(btn,true);fetch("/api/post/"+encodeURIComponent(slug),{method:"DELETE"}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast("✅ "+j.message,"success");setTimeout(function(){location.reload()},800)}else{showToast("❌ "+(j.error||"删除失败"),"error")}}).catch(function(){showToast("❌ 网络错误","error")});setLoading(btn,false)}</script>';

    res.send(wrapHTML("文章列表", body));
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

  var body = '<div class="container"><header><h1>' + esc(formTitle) + '</h1><a href="/" class="btn btn-ghost">← 返回列表</a></header>';
  body += '<form id="postForm"><div class="form-grid">';

  // 标题
  body += '<div class="form-group"><label>标题 *</label><input type="text" name="title" value="' + esc(data.title) + '" required placeholder="文章标题"></div>';
  // Slug
  body += '<div class="form-group"><label>Slug（文件名）</label><input type="text" name="slug" value="' + esc(slug || "") + '" placeholder="留空自动生成"' + (slug ? ' readonly style="background:#f1f5f9"' : '') + '><span class="help-text">作为 .md 文件名，如 my-post</span></div>';
  // 日期
  body += '<div class="form-group"><label>发布日期 *</label><input type="date" name="published" value="' + esc(data.published ? String(data.published).slice(0, 10) : new Date().toISOString().slice(0, 10)) + '"></div>';
  // 分类
  body += '<div class="form-group"><label>分类</label><input type="text" name="category" value="' + esc(data.category || "") + '" placeholder="如：技术、随笔"></div>';
  // 标签
  body += '<div class="form-group"><label>标签（逗号分隔）</label><input type="text" name="tags" value="' + esc((data.tags || []).join(", ")) + '" placeholder="前端, Astro, 教程"></div>';
  // 图片
  body += '<div class="form-group"><label>封面图片路径</label><input type="text" name="image" value="' + esc(data.image || "") + '" placeholder="./images/cover.avif"></div>';
  // 作者
  body += '<div class="form-group"><label>作者</label><input type="text" name="author" value="' + esc(data.author || "") + '"></div>';
  // 语言
  body += '<div class="form-group"><label>语言</label><input type="text" name="lang" value="' + esc(data.lang || "") + '" placeholder="留空默认中文"></div>';
  // 描述
  body += '<div class="form-group full"><label>描述</label><input type="text" name="description" value="' + esc(data.description || "") + '" placeholder="文章摘要，用于 SEO 和列表展示"></div>';
  // 复选框
  body += '<div class="form-group"><label><input type="checkbox" name="draft"' + (data.draft ? " checked" : "") + '> 草稿（不发布）</label></div>';
  body += '<div class="form-group"><label><input type="checkbox" name="pinned"' + (data.pinned ? " checked" : "") + '> 置顶</label></div>';
  body += '<div class="form-group"><label><input type="checkbox" name="comment"' + (data.comment !== false ? " checked" : "") + '> 开启评论</label></div>';
  // 来源/授权
  body += '<div class="form-group"><label>来源链接</label><input type="text" name="sourceLink" value="' + esc(data.sourceLink || "") + '"></div>';
  body += '<div class="form-group"><label>授权名称</label><input type="text" name="licenseName" value="' + esc(data.licenseName || "") + '"></div>';
  body += '<div class="form-group"><label>授权链接</label><input type="text" name="licenseUrl" value="' + esc(data.licenseUrl || "") + '"></div>';
  // 密码
  body += '<div class="form-group"><label>密码保护</label><input type="text" name="password" value="' + esc(data.password || "") + '" placeholder="留空不加密"></div>';
  body += '<div class="form-group"><label>密码提示</label><input type="text" name="passwordHint" value="' + esc(data.passwordHint || "") + '"></div>';

  body += '</div>'; // form-grid

  // 编辑器
  body += '<div style="margin-top:20px"><div style="display:flex;align-items:center;gap:12px;margin-bottom:8px"><label style="font-size:13px;font-weight:500;color:#475569">正文（Markdown）</label><button type="button" class="btn btn-ghost btn-sm" onclick="togglePreview()">预览</button></div>';
  body += '<div class="editor-layout"><div class="form-group editor"><textarea name="content" id="editor" placeholder="在这里写 Markdown...">' + esc(content) + '</textarea></div>';
  body += '<div class="preview-panel" id="preview" style="display:none"></div></div></div>';

  // 操作按钮
  body += '<div class="form-actions"><button type="submit" class="btn btn-primary" id="saveBtn">保存并推送</button><a href="/" class="btn btn-ghost">取消</a></div>';
  body += '</form></div>';

  // 脚本
  body += '<script>';
  body += 'var pv=false;function togglePreview(){pv=!pv;document.getElementById("preview").style.display=pv?"block":"none";if(pv)updPreview()}';
  body += 'function updPreview(){var md=document.getElementById("editor").value;var h=md.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/^### (.+)$/gm,"<h3>$1</h3>").replace(/^## (.+)$/gm,"<h2>$1</h2>").replace(/^# (.+)$/gm,"<h1>$1</h1>").replace(/\\*\\*(.+?)\\*\\*/g,"<strong>$1</strong>").replace(/\\*(.+?)\\*/g,"<em>$1</em>").replace(/```([\\s\\S]*?)```/g,"<pre><code>$1</code></pre>").replace(/`(.+?)`/g,"<code>$1</code>").replace(/^- (.+)$/gm,"• $1").replace(/\\[(.+?)\\]\\((.+?)\\)/g,"<a href=\\"$2\\">$1</a>").replace(/\\n\\n/g,"</p><p>").replace(/\\n/g,"<br>");document.getElementById("preview").innerHTML="<p>"+h+"</p>"}';
  body += 'document.getElementById("editor").addEventListener("input",function(){if(pv)updPreview()})';
  body += 'document.getElementById("postForm").addEventListener("submit",function(e){e.preventDefault();var btn=document.getElementById("saveBtn");setLoading(btn,true);var fd=new FormData(e.target);var b={title:fd.get("title"),slug:fd.get("slug"),published:fd.get("published"),tags:fd.get("tags"),category:fd.get("category"),description:fd.get("description"),image:fd.get("image"),author:fd.get("author"),lang:fd.get("lang"),draft:fd.has("draft"),pinned:fd.has("pinned"),comment:fd.has("comment"),sourceLink:fd.get("sourceLink"),licenseName:fd.get("licenseName"),licenseUrl:fd.get("licenseUrl"),password:fd.get("password"),passwordHint:fd.get("passwordHint"),content:fd.get("content")};fetch("/api/post",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}).then(function(r){return r.json()}).then(function(j){if(j.ok){showToast("✅ "+j.message,"success",4000);setTimeout(function(){location.href="/"},1500)}else{showToast("❌ "+(j.error||"保存失败"),"error",5000)}}).catch(function(){showToast("❌ 网络错误","error")});setLoading(btn,false)})';
  body += '</script>';

  res.send(wrapHTML(formTitle, body));
}

// ── API: 保存文章 ──
app.post("/api/post", async function(req, res) {
  try {
    var body = req.body;
    var slug = body.slug;
    var title = body.title;
    var published = body.published;
    var tags = body.tags;
    var content = body.content;

    if (!slug || !slug.trim()) {
      slug = (title || "").toLowerCase().replace(/[^\w\u4e00-\u9fff\s-]/g, "").replace(/[\s_]+/g, "-").replace(/^-|-$/g, "") || ("post-" + Date.now());
    }
    slug = slug.trim().replace(/\.md$/, "");

    if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });

    var fm = {
      title: title || slug,
      published: published || new Date().toISOString().slice(0, 10),
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

    await git.add(".");
    await git.commit("📝 更新文章: " + (title || slug));
    await git.push("origin", currentBranch);

    res.json({ ok: true, message: "文章「" + (title || slug) + "」已保存并推送", slug: slug });
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

    fs.unlinkSync(filePath);
    await git.add(".");
    await git.commit("🗑️ 删除文章: " + slug);
    await git.push("origin", currentBranch);

    res.json({ ok: true, message: "文章「" + slug + "」已删除并推送" });
  } catch (e) {
    console.error("Delete error:", e);
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

  var PORT = process.env.PORT || 3000;
  app.listen(PORT, function() {
    console.log("");
    console.log("🚀 Aurora 后台已启动");
    console.log("   地址: http://localhost:" + PORT);
    console.log("   文章目录: " + POSTS_DIR);
    console.log("");
  });
}

start();
