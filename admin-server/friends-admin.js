/**
 * friends-admin.js
 * 友链管理页面的前端 JavaScript
 */

function normalizeFriend(raw) {
  var item = raw || {};
  return {
    title: item.title || item.name || "",
    imgurl: item.imgurl || item.icon || "",
    desc: item.desc || "",
    siteurl: item.siteurl || item.url || "",
    tags: Array.isArray(item.tags) ? item.tags : [],
    weight: Number(item.weight) || 1,
    enabled: item.enabled !== false
  };
}

var friendsData = [];

function mkInput(label, value, idx, field, type) {
  type = type || "text";
  var ph = type === "number" ? "1" : (type === "url" ? "https://..." : "");
  var extra = type === "number" ? ' min="1" step="1"' : "";
  var val = String(value).replace(/"/g, "&quot;");
  var isNum = type === "number" ? ",true" : "";
  return '<div><p style="font-size:11px;color:#94a3b8;margin-bottom:4px">' + label + '</p>' +
    '<input type="' + type + '" value="' + val + '"' + extra + ' placeholder="' + ph + '" ' +
    'style="width:100%;padding:6px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;box-sizing:border-box" ' +
    'onchange="updateField(' + idx + ',' + JSON.stringify(field) + ',this.value' + isNum + ')" /></div>';
}

function updateField(idx, field, value, isNum) {
  if (field === "tags") {
    friendsData[idx].tags = value.split(",").map(function(t) { return t.trim(); }).filter(Boolean);
  } else if (isNum) {
    friendsData[idx][field] = Number(value) || 1;
  } else {
    friendsData[idx][field] = value;
  }
}

function renderFriends() {
  var c = document.getElementById("friendsList");
  c.innerHTML = "";
  if (!friendsData.length) {
    c.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8">暂无友链，点击上方按钮添加</div>';
    return;
  }
  friendsData.forEach(function(f, i) {
    var item = normalizeFriend(f);
    var card = document.createElement("div");
    card.style.cssText = "border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:12px;background:#fafafa;position:relative";
    card.setAttribute("draggable", "true");
    card.setAttribute("data-index", i);

    card.ondragstart = function(e) {
      e.dataTransfer.setData("text/plain", String(i));
      this.style.opacity = "0.5";
    };
    card.ondragend = function() { this.style.opacity = "1"; };
    card.ondragover = function(e) { e.preventDefault(); this.style.borderColor = "#2563eb"; };
    card.ondragleave = function() { this.style.borderColor = "#e2e8f0"; };
    card.ondrop = function(e) {
      e.preventDefault();
      this.style.borderColor = "#e2e8f0";
      var from = parseInt(e.dataTransfer.getData("text/plain"));
      var to = parseInt(this.getAttribute("data-index"));
      if (from !== to) {
        var m = friendsData.splice(from, 1)[0];
        friendsData.splice(to, 0, m);
        renderFriends();
      }
    };

    var h = '<div style="display:flex;gap:12px;align-items:flex-start">';
    h += '<div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:2px;padding-top:6px">';
    h += '<span style="font-size:14px;color:#94a3b8;cursor:grab;user-select:none">⋮⋮</span>';
    h += '<button onclick="moveFriend(' + i + ',-1)" title="上移" style="cursor:pointer;background:none;border:none;color:#94a3b8;font-size:12px;padding:2px">▲</button>';
    h += '<button onclick="moveFriend(' + i + ',1)" title="下移" style="cursor:pointer;background:none;border:none;color:#94a3b8;font-size:12px;padding:2px">▼</button>';
    h += '</div>';
    h += '<div style="flex-shrink:0;width:56px;height:56px;border-radius:8px;overflow:hidden;background:#e2e8f0">';
    h += '<img src="' + item.imgurl + '" style="width:100%;height:100%;object-fit:cover" />';
    h += '</div>';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">';
    h += mkInput("站点名称", item.title, i, "title");
    h += mkInput("站点链接", item.siteurl, i, "siteurl", "url");
    h += mkInput("头像链接", item.imgurl, i, "imgurl", "url");
    h += mkInput("站点描述", item.desc, i, "desc");
    h += '</div>';
    h += '<div style="display:flex;gap:8px;align-items:end;flex-wrap:wrap">';
    h += mkInput("标签(逗号分隔)", item.tags.join(","), i, "tags");
    h += mkInput("权重", item.weight, i, "weight", "number");
    h += '<div><p style="font-size:11px;color:#94a3b8;margin-bottom:4px">启用</p>';
    h += '<label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer">';
    h += '<input type="checkbox" ' + (item.enabled ? "checked" : "") + ' onchange="friendsData[' + i + '].enabled=this.checked" />';
    h += '<span style="font-size:12px;color:#64748b">启用</span></label></div>';
    h += '<button type="button" class="btn btn-danger btn-sm" onclick="friendsData.splice(' + i + ',1);renderFriends()">删除</button>';
    h += '</div></div></div>';
    card.innerHTML = h;
    c.appendChild(card);
  });
}

function moveFriend(idx, dir) {
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= friendsData.length) return;
  var temp = friendsData[idx];
  friendsData[idx] = friendsData[newIdx];
  friendsData[newIdx] = temp;
  renderFriends();
}

function addFriend() {
  friendsData.push({ title: "", name: "", siteurl: "", url: "", imgurl: "", icon: "", desc: "", enabled: true, weight: 1, tags: [] });
  renderFriends();
  var list = document.getElementById("friendsList");
  if (list.lastElementChild) {
    list.lastElementChild.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function saveFriends() {
  var payload = friendsData.map(function(f) { return normalizeFriend(f); });
  fetch("/api/config/friends", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ friends: payload })
  }).then(function(r) { return r.json(); }).then(function(j) {
    if (j.ok) { showToast("\u2705 已保存", "success"); }
    else { showToast(j.error || "保存失败", "error"); }
  }).catch(function() { showToast("网络错误", "error"); });
}

function publishConfig() {
  saveFriends();
  fetch("/api/config/publish", { method: "POST" }).then(function(r) { return r.json(); }).then(function(j) {
    if (j.ok) { showToast("\u2705 " + j.message, "success"); }
    else { showToast("\u274c " + (j.error || "推送失败"), "error"); }
  });
}