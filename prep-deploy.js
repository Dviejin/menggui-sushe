/**
 * 生成公网部署目录 deploy/
 * 只包含运行联机服务必需的文件（server.js + index.html + package.json），
 * 避免 minigame/ 里的 project.config.json 被误判为小程序工程。
 */
'use strict';
var fs = require('fs');
var path = require('path');

var root = __dirname;
var out = path.join(root, 'deploy');
if (!fs.existsSync(out)) fs.mkdirSync(out);

fs.copyFileSync(path.join(root, 'server', 'server.js'), path.join(out, 'server.js'));
fs.copyFileSync(path.join(root, 'index.html'), path.join(out, 'index.html'));
fs.writeFileSync(path.join(out, 'package.json'), JSON.stringify({
  name: 'menggui-sushe',
  version: '1.0.0',
  private: true,
  description: '猛鬼宿舍 · 联机对战（Node 原生 http，无依赖）',
  main: 'server.js',
  scripts: { start: 'node server.js' }
}, null, 2) + '\n');

console.log('已生成部署目录: ' + out);
fs.readdirSync(out).forEach(function (f) {
  console.log('  - ' + f + '  ' + fs.statSync(path.join(out, f)).size + ' bytes');
});
