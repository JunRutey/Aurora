const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "server.js");
let content = fs.readFileSync(file, "utf8");
const marker = "// ── 背景音乐管理页 ──";
const startIdx = content.indexOf(marker);
if (startIdx === -1) { console.log("Marker not found"); process.exit(1); }
const nextSection = "// ── 公告管理页 ──";
const endIdx = content.indexOf(nextSection, startIdx);
if (endIdx === -1) { console.log("Next section not found"); process.exit(1); }
const newSection = fs.readFileSync(path.join(__dirname, "_music_new.txt"), "utf8");
content = content.substring(0, startIdx) + newSection + content.substring(endIdx);
fs.writeFileSync(file, content, "utf8");
console.log("Done, lines:", content.split("\n").length);
fs.unlinkSync(__filename);
