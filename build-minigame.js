/**
 * 从 index.html 提取游戏核心代码，生成微信小游戏工程（minigame/）。
 * 用法： node build-minigame.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var os = require('os');

var root = __dirname;
var html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

/* 构建时自动带上本机局域网 IP，方便手机在同一 WiFi 下联机（可手动修改 game.js 顶部） */
function lanIp() {
  var nets = os.networkInterfaces(), list = [];
  Object.keys(nets).forEach(function (k) {
    (nets[k] || []).forEach(function (n) {
      if (n && n.family === 'IPv4' && !n.internal) list.push(n.address);
    });
  });
  return list[0] || '';
}
var LANIP = lanIp();
/* 可传入公网地址：node build-minigame.js https://xxx.workbuddy.host */
var SERVER_BASE = (process.argv[2] && String(process.argv[2]).trim()) || (LANIP ? ('http://' + LANIP + ':8080') : '');

var m = html.match(/<script id="game-core">([\s\S]*?)<\/script>/);
if (!m) { console.error('未找到 game-core 脚本块'); process.exit(1); }
var block = m[1];
var b = block.indexOf('/* CORE:BEGIN */');
var e = block.indexOf('/* CORE:END */');
if (b < 0 || e < 0) { console.error('未找到 CORE 标记'); process.exit(1); }
var core = block.slice(b, e);

var WX_SHELL = [
  '/* ===== 微信小游戏适配层 ===== */',
  '// 联机服务器地址：把 server/server.js 部署到可访问的机器后，把地址填在这里',
  '// （微信小游戏真机需在「开发管理-服务器域名」里配置该地址，或临时开启「不校验合法域名」）',
  'var SERVER_BASE = "' + SERVER_BASE + '";',
  'var canvas = wx.createCanvas();',
  'var winInfo = (function () {',
  '  try { if (wx.getWindowInfo) return wx.getWindowInfo(); } catch (err) { }',
  '  return wx.getSystemInfoSync();',
  '})();',
  'var audioCtx = null;',
  '',
  'MengGuiCore.startGame({',
  '  canvas: canvas,',
  '  getView: function () {',
  '    return {',
  '      w: winInfo.windowWidth || winInfo.screenWidth,',
  '      h: winInfo.windowHeight || winInfo.screenHeight,',
  '      dpr: winInfo.pixelRatio || 1',
  '    };',
  '  },',
  '  onPointer: function (cb) {',
  '    wx.onTouchStart(function (ev) {',
  '      var t = (ev.changedTouches && ev.changedTouches[0]) || (ev.touches && ev.touches[0]);',
  '      if (t) cb(t.clientX, t.clientY);',
  '    });',
  '  },',
  '  onFrame: function (cb) {',
  '    function loop() { cb(); requestAnimationFrame(loop); }',
  '    requestAnimationFrame(loop);',
  '  },',
  '  getAudio: function () {',
  '    if (audioCtx) return audioCtx;',
  '    try { audioCtx = wx.createWebAudioContext ? wx.createWebAudioContext() : null; }',
  '    catch (err) { audioCtx = null; }',
  '    return audioCtx;',
  '  },',
  '  request: function (o) {',
  '    return new Promise(function (resolve, reject) {',
  '      wx.request({',
  '        url: o.url,',
  '        method: o.method || "POST",',
  '        data: o.body || {},',
  '        header: { "content-type": "application/json" },',
  '        dataType: "json",',
  '        timeout: o.timeout || 6000,',
  '        success: function (r) { resolve(r.data); },',
  '        fail: function (e) { reject(e); }',
  '      });',
  '    });',
  '  },',
  '  getBaseList: function () { return SERVER_BASE ? [SERVER_BASE] : []; },',
  '  roomParam: "",',
  '  pageUrl: SERVER_BASE,',
  '  copy: function (t) {',
  '    try { wx.setClipboardData({ data: t }); return true; } catch (err) { return false; }',
  '  },',
  '  getRecord: function () {',
  '    try { var s = wx.getStorageSync("mg_record"); if (s && typeof s.win === "number") return s; } catch (err) { }',
  '    return { win: 0, lose: 0 };',
  '  },',
  '  onRecord: function (r) { try { wx.setStorageSync("mg_record", r); } catch (err) { } },',
  '',
  '  /* ---- 云端战绩：小游戏无 DOM，用原生弹窗 + 剪贴板降级 ---- */',
  '  cloud: (function () {',
  '    var PUBLIC = {',
  "      endpoint: 'https://menggui-sushe-79127.app.workbuddy.host',",
  "      oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',",
  "      publishableKey: 'wbpk_3d7L9vA1CdD01pOTgrrXQ9_G567DakCjQx2WhquYfJPjVadg7zTzxHD'",
  '    };',
  '    var sdk = null, err = "", cbs = [];',
  '    function emit(st) { for (var i = 0; i < cbs.length; i++) { try { cbs[i](st); } catch (e) { } } }',
  '    function ensure() {',
  '      if (sdk) return sdk;',
  '      var f = null;',
  '      try { if (typeof createWorkBuddyCloud === "function") f = createWorkBuddyCloud; } catch (e) { }',
  '      if (!f) { try { if (typeof global !== "undefined" && global.WorkBuddyCloud) f = global.WorkBuddyCloud.createWorkBuddyCloud; } catch (e) { } }',
  '      if (!f) { err = "小游戏端未加载云服务 SDK，云端功能请在网页版使用"; return null; }',
  '      try { sdk = f(PUBLIC); err = ""; } catch (e) { sdk = null; err = "云服务初始化失败"; }',
  '      return sdk;',
  '    }',
  '    function localStats() {',
  '      try { var s = wx.getStorageSync("mg_cloud"); if (s) return s; } catch (e) { }',
  '      return { win: 0, lose: 0, best: 0, kills: 0 };',
  '    }',
  '    function saveLocal(p) {',
  '      var s = localStats();',
  '      if (p.win) s.win++; else s.lose++;',
  '      s.best = Math.max(s.best, p.wave || 0);',
  '      s.kills += p.kills || 0;',
  '      try { wx.setStorageSync("mg_cloud", s); } catch (e) { }',
  '      return s;',
  '    }',
  '    function coach(match, cb) {',
  '      if (!sdk || !sdk.llm) return null;',
  '      var sys = "你是猛鬼宿舍（躺平塔防小游戏）的战术军师。请用中文给出简短、具体、可执行的复盘建议，最多 3 句话。";',
  '      var usr = "本局数据：模式=" + (match.mode === "net" ? "联机对战" : "单人闯关") + "，难度=" + (match.diffName || match.diff || "普通") + "，结果=" + (match.win ? "守住胜利" : "被猛鬼抓走") + "，坚持到第 " + match.wave + " 波，击杀 " + match.kills + " 只，用时 " + match.duration + " 秒。请复盘。";',
  '      var out = "";',
  '      return sdk.llm.models.list().then(function (list) {',
  '        var pick = null, i, m;',
  '        for (i = 0; i < (list || []).length; i++) { m = list[i]; if (m && m.disabled !== true && m.enabled !== false && m.id === "hunyuan-chat") { pick = m; break; } }',
  '        if (!pick) { for (i = 0; i < (list || []).length; i++) { m = list[i]; if (m && m.disabled !== true && m.enabled !== false) { pick = m; break; } } }',
  '        if (!pick) return null;',
  '        var st = sdk.llm.chat.completions.create({ model: pick.id, messages: [{ role: "system", content: sys }, { role: "user", content: usr }], stream: true });',
  '        return (async function () { for await (var ch of st) { var d = ch && ch.choices && ch.choices[0] && ch.choices[0].delta; if (d && d.content) out += d.content; } return out; })();',
  '      }).then(function (t) { if (t && cb) cb({ signed: true, coach: t }); })["catch"](function () { });',
  '    }',
  '    return {',
  '      init: function (cb) {',
  '        if (cb) cbs.push(cb);',
  '        ensure();',
  '        if (!sdk) { emit({ signed: false, msg: err }); return; }',
  "        sdk.auth.getSession().then(function (r) {",
  "          var u = r && r.data && r.data.user;",
  '          emit(u ? { signed: true, nick: (u.nickname || u.name || "舍友") } : { signed: false });',
  '        }, function () { emit({ signed: false }); });',
  '      },',
  '      open: function (cb) {',
  '        if (cb && cbs.indexOf(cb) < 0) cbs.push(cb);',
  '        ensure();',
  '        if (!sdk) {',
  '          wx.showModal({',
  "            title: '云端战绩',",
  "            content: '小游戏端暂不支持登录，请到网页版体验云端排行榜与 AI 军师。\\n网页地址：' + (SERVER_BASE || 'https://menggui-sushe-79127.app.workbuddy.host'),",
  "            confirmText: '复制地址',",
  '            success: function (r) {',
  '              if (r.confirm) { try { wx.setClipboardData({ data: SERVER_BASE || "https://menggui-sushe-79127.app.workbuddy.host" }); } catch (e) { } }',
  '            }',
  '          });',
  '          return;',
  '        }',
  '        wx.showModal({',
  "          title: '云同步',",
  "          content: '登录后战绩将同步到云端排行榜，并生成 AI 复盘。请在网页版登录。',",
  '          showCancel: false',
  '        });',
  '      },',
  '      submit: function (p, cb) {',
  '        if (cb && cbs.indexOf(cb) < 0) cbs.push(cb);',
  '        var s = ensure();',
  '        if (!s) { var st = saveLocal(p); emit({ signed: false, msg: "已存本地（" + st.win + "胜" + st.lose + "负），登录网页版可上榜", stats: st }); return; }',
  '        s.auth.getSession().then(function (r) {',
  '          var u = r && r.data && r.data.user;',
  '          if (!u) { var st2 = saveLocal(p); emit({ signed: false, msg: "未登录，战绩已存本地", stats: st2 }); return; }',
  '          var uid = u.id || u.uid || u.sub;',
  '          var nick = u.nickname || u.name || "舍友";',
  "          s.database.from('mg_matches').insert({ mode: p.mode, diff: p.diff, diff_name: p.diffName, win: !!p.win, wave: p.wave, kills: p.kills, duration: p.duration, sent: p.sent, loot: p.loot })['catch'](function () { });",
  "          s.database.from('mg_players').select('id,wins,losses,best_wave,total_kills,score').eq('owner_id', uid).maybeSingle().then(function (q) {",
  '            var row = q && q.data;',
  '            var nw = (row ? row.wins : 0) + (p.win ? 1 : 0);',
  '            var nl = (row ? row.losses : 0) + (p.win ? 0 : 1);',
  '            var bw = Math.max(row ? row.best_wave : 0, p.wave || 0);',
  '            var tk = (row ? row.total_kills : 0) + (p.kills || 0);',
  '            var sc = nw * 120 - nl * 40 + bw * 25 + Math.floor(tk / 10);',
  '            if (row) {',
  "              s.database.from('mg_players').update({ nick: nick, wins: nw, losses: nl, best_wave: bw, total_kills: tk, score: sc, updated_at: new Date().toISOString() }).eq('owner_id', uid)['catch'](function () { });",
  '            } else {',
  "              s.database.from('mg_players').insert({ owner_id: uid, nick: nick, wins: nw, losses: nl, best_wave: bw, total_kills: tk, score: sc })['catch'](function () { });",
  '            }',
  "            emit({ signed: true, nick: nick, msg: '已同步到云端排行榜', stats: { win: nw, lose: nl, best: bw, kills: tk } });",
  '          });',
  '        });',
  '      }',
  '    };',
  '  })()',
  '});',
  '',
  'MengGuiCore.probe(SERVER_BASE ? [SERVER_BASE] : [],',
  '  SERVER_BASE ? ("连不上 " + SERVER_BASE + "，请确认 server.js 已启动、且开发者工具已关闭域名校验")',
  '              : "未配置服务器地址：请在 game.js 顶部 SERVER_BASE 填入电脑的局域网 IP");',
  ''
].join('\n');

var outDir = path.join(root, 'minigame');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

fs.writeFileSync(path.join(outDir, 'game.js'), core + '\n' + WX_SHELL, 'utf8');

var gameJson = {
  deviceOrientation: 'portrait',
  showStatusBar: false,
  networkTimeout: { request: 5000, connectSocket: 5000, uploadFile: 5000, downloadFile: 5000 }
};
fs.writeFileSync(path.join(outDir, 'game.json'), JSON.stringify(gameJson, null, 2), 'utf8');

var projectCfg = {
  description: '猛鬼宿舍仿制版（学习用途）',
  appid: 'touristappid',
  projectname: 'menggui-sushe',
  miniprogramRoot: './',
  compileType: 'game',
  setting: { es6: true, enhance: false, postcss: false, minified: true, urlCheck: false },
  condition: {}
};
fs.writeFileSync(path.join(outDir, 'project.config.json'), JSON.stringify(projectCfg, null, 2), 'utf8');

console.log('已生成：minigame/game.js, game.json, project.config.json');
