/**
 * 云服务接入的真实浏览器验证（Chrome + CDP，无第三方依赖）
 * 用法：node cloud-verify.js
 * 检查项：SDK 加载 / 排行榜读取（真实数据）/ 匿名写入被 RLS 拒绝 / AI 军师调用 / 登录表单校验
 */
'use strict';
var { spawn } = require('child_process');
var fs = require('fs');
var os = require('os');
var path = require('path');

var CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
var PORT = 9333;
var URL_ = 'https://menggui-sushe-79127.app.workbuddy.host/';
var PUBLIC = {
  endpoint: 'https://menggui-sushe-79127.app.workbuddy.host',
  oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
  publishableKey: 'wbpk_3d7L9vA1CdD01pOTgrrXQ9_G567DakCjQx2WhquYfJPjVadg7zTzxHD'
};

var fails = [];
function check(name, ok, detail) {
  console.log((ok ? '  [PASS] ' : '  [FAIL] ') + name + (detail ? '  → ' + detail : ''));
  if (!ok) fails.push(name + (detail ? '（' + detail + '）' : ''));
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/* ---------- 极简 CDP 客户端 ---------- */
function CDP(ws) {
  var id = 0, waiting = {};
  ws.addEventListener('message', function (ev) {
    var m = JSON.parse(ev.data);
    if (m.id && waiting[m.id]) { var w = waiting[m.id]; delete waiting[m.id]; w(m); }
  });
  return function (method, params) {
    id++;
    var myId = id;
    return new Promise(function (resolve, reject) {
      waiting[myId] = resolve;
      ws.send(JSON.stringify({ id: myId, method: method, params: params || {} }));
      setTimeout(function () { if (waiting[myId]) { delete waiting[myId]; reject(new Error('timeout ' + method)); } }, 30000);
    });
  };
}

async function main() {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mgcdp-'));
  var chrome = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + dir,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    '--window-size=720,1280', 'about:blank'
  ], { stdio: 'ignore' });

  var wsUrl = null;
  for (var i = 0; i < 40 && !wsUrl; i++) {
    await sleep(500);
    try {
      var r = await fetch('http://127.0.0.1:' + PORT + '/json/version');
      wsUrl = (await r.json()).webSocketDebuggerUrl;
    } catch (e) { }
  }
  if (!wsUrl) { console.log('无法启动 Chrome 调试端口'); process.exit(1); }

  var ws = new WebSocket(wsUrl);
  await new Promise(function (res) { ws.addEventListener('open', res); });
  var send = CDP(ws);

  var list0 = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
  var target = list0.filter(function (x) { return x.type === 'page'; })[0];
  if (!target) { console.log('没有可用的页面 target'); process.exit(1); }
  var tws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(function (res) { tws.addEventListener('open', res); });
  var t = CDP(tws);
  await t('Page.enable');
  await t('Runtime.enable');
  await t('Emulation.setDeviceMetricsOverride', { width: 720, height: 1280, deviceScaleFactor: 1, mobile: false });
  await t('Page.navigate', { url: URL_ });
  await sleep(8000);
  var diag = await t('Runtime.evaluate', {
    expression: 'location.href + " | title=" + document.title + " | ready=" + document.readyState + " | scripts=" + document.scripts.length',
    returnByValue: true
  });
  console.log('页面状态: ' + (diag && diag.result && diag.result.result && diag.result.result.value));

  async function evalJs(expr) {
    var r = await t('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    var res = r && r.result;                       // Runtime.evaluate 的返回值
    if (res && res.exceptionDetails) {
      return { __err: (res.exceptionDetails.exception && res.exceptionDetails.exception.description) || 'eval error' };
    }
    return res && res.result && res.result.value;
  }
  async function click(x, y) {
    await t('Input.dispatchMouseEvent', { type: 'mousePressed', x: x, y: y, button: 'left', clickCount: 1 });
    await t('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x, y: y, button: 'left', clickCount: 1 });
    await sleep(400);
  }

  console.log('\n=== 1. 页面与 SDK ===');
  var hasSdk = await evalJs('typeof window.WorkBuddyCloud');
  check('云服务 SDK 已加载（CDN）', hasSdk === 'object', 'typeof=' + hasSdk);
  var scene = await evalJs('(window.MengGuiCore && MengGuiCore.getState()) ? MengGuiCore.getState().scene : "no-core"');
  check('游戏核心已启动', scene === 'menu', 'scene=' + scene);
  var btnIds = await evalJs('(function(){var s=window.MengGuiCore.getState();return (s.btns||[]).map(function(b){return b.id;}).join(",");})()');
  check('主菜单出现「云端战绩」入口', /cloud/.test(String(btnIds)), btnIds);

  console.log('\n=== 2. 打开云端面板（真实点击）===');
  var cloudBtn = await evalJs('(function(){var b=window.MengGuiCore.getState().btns.filter(function(x){return x.id==="cloud";})[0];return b?{x:b.x+b.w/2,y:b.y+b.h/2}:null;})()');
  if (!cloudBtn) { check('找到云端按钮', false); }
  else {
    await click(cloudBtn.x, cloudBtn.y);
    var vis = await evalJs('!document.getElementById("mgcloud").classList.contains("mgc-hide")');
    check('云端面板已打开', vis === true);
    await sleep(2500);
    var list = await evalJs('document.getElementById("mgc-list").innerText');
    check('排行榜读到真实云端数据', /躺平之王/.test(String(list)), String(list).split('\n')[0]);
    var loginVisible = await evalJs('!document.getElementById("mgc-login").classList.contains("mgc-hide")');
    check('未登录时展示登录表单', loginVisible === true);
  }

  console.log('\n=== 3. 登录表单校验（不发出请求）===');
  await evalJs('document.getElementById("mgc-phone").value="1380013";');
  await evalJs('document.getElementById("mgc-send").click();');
  await sleep(600);
  var perr = await evalJs('document.getElementById("mgc-phoneErr").textContent');
  check('非 11 位手机号被前端拦截', /11 位手机号/.test(String(perr)), '提示=' + perr);
  await evalJs('document.getElementById("mgc-phone").value="13800138000";');
  await evalJs('document.getElementById("mgc-phone").dispatchEvent(new Event("input"));');
  var perr2 = await evalJs('document.getElementById("mgc-phoneErr").textContent');
  check('重新输入手机号后错误清除', String(perr2) === '', '提示="' + perr2 + '"');

  console.log('\n=== 4. 安全边界：未登录写入应被 RLS 拒绝 ===');
  await evalJs('document.getElementById("mgcloud").classList.add("mgc-hide")');
  var anonWrite = await evalJs(`(async function(){
    var c = window.WorkBuddyCloud.createWorkBuddyCloud({endpoint:${JSON.stringify(PUBLIC.endpoint)},oauthRelayBaseUrl:${JSON.stringify(PUBLIC.oauthRelayBaseUrl)},publishableKey:${JSON.stringify(PUBLIC.publishableKey)}});
    var r = await c.database.from('mg_matches').insert({mode:'solo',diff:'normal',win:true,wave:9,kills:99,duration:60,sent:0,loot:0}).select();
    return { err: r.error ? (r.error.code || r.error.message) : null, rows: (r.data||[]).length };
  })()`);
  check('匿名写入被拒绝', !!anonWrite && !!anonWrite.err && anonWrite.rows === 0,
    'err=' + (anonWrite && anonWrite.err) + ' rows=' + (anonWrite && anonWrite.rows));

  console.log('\n=== 5. AI 军师（免密钥大模型，流式）===');
  var llm = await evalJs(`(async function(){
    var c = window.WorkBuddyCloud.createWorkBuddyCloud({endpoint:${JSON.stringify(PUBLIC.endpoint)},oauthRelayBaseUrl:${JSON.stringify(PUBLIC.oauthRelayBaseUrl)},publishableKey:${JSON.stringify(PUBLIC.publishableKey)}});
    var ms = await c.llm.models.list();
    var pick = null;
    for (var i=0;i<ms.length;i++){ if (ms[i].disabled!==true && ms[i].enabled!==false && ms[i].id==='hunyuan-chat'){ pick=ms[i]; break; } }
    if (!pick) for (var j=0;j<ms.length;j++){ if (ms[j].disabled!==true && ms[j].enabled!==false){ pick=ms[j]; break; } }
    if (!pick) return { model:null, text:'无可用模型' };
    var out='';
    var st = c.llm.chat.completions.create({ model: pick.id, messages:[
      { role:'system', content:'你是猛鬼宿舍（躺平塔防小游戏）的战术军师。用中文给出简短、具体、可执行的复盘建议，最多 3 句话。' },
      { role:'user', content:'本局数据：模式=单人闯关，难度=普通，结果=被猛鬼抓走，坚持到第 7 波，击杀 88 只，用时 210 秒。请复盘。' }
    ], stream:true });
    for await (var ch of st){ var d = ch && ch.choices && ch.choices[0] && ch.choices[0].delta; if (d && d.content) out += d.content; }
    return { model: pick.id, text: out };
  })()`);
  check('AI 军师返回内容', !!llm && !!llm.text && llm.text.length > 10 && !/^AI 点评失败/.test(llm.text),
    'model=' + (llm && llm.model) + ' 字数=' + (llm && llm.text ? llm.text.length : 0));
  if (llm && llm.text) console.log('  军师回复：' + String(llm.text).slice(0, 160).replace(/\n/g, ' '));

  console.log('\n=== 6. 未登录结束一局的提示链路 ===');
  await click(360, 748);            // 单人闯关
  await sleep(500);
  await click(520, 555);            // 普通难度
  await sleep(800);
  var inPlay = await evalJs('window.MengGuiCore.getState().scene');
  check('进入对战场景', inPlay === 'play', 'scene=' + inPlay);
  /* 让第一波立刻开始，并拆掉门、把床位打到濒死，等待猛鬼完成最后一击 */
  await evalJs('(function(){var s=window.MengGuiCore.getState();s.timer=0.1;s.speed=2;})()');
  await sleep(4000);
  await evalJs('(function(){var s=window.MengGuiCore.getState();s.door.hp=0;s.door.broken=true;s.bed.hp=1;})()');
  var after = null;
  for (var w = 0; w < 30; w++) {
    await sleep(1000);
    after = await evalJs('(function(){var s=window.MengGuiCore.getState();return {scene:s.scene, msg:s.cloud.msg, btns:(s.btns||[]).map(function(b){return b.id;}).join(",")};})()');
    if (after && /win|lose/.test(String(after.scene))) break;
  }
  check('床位被打爆后进入结算', after && /win|lose/.test(String(after && after.scene)), 'scene=' + (after && after.scene));
  check('结算页给出云端提示', after && /登录|同步/.test(String(after && after.msg)), 'msg=' + (after && after.msg));
  check('结算页出现云端入口', after && /cloud/.test(String(after && after.btns)), (after && after.btns));

  try { tws.close(); ws.close(); } catch (e) { }
  chrome.kill();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { }

  console.log('\n============================');
  if (fails.length) { console.log('失败 ' + fails.length + ' 项：\n - ' + fails.join('\n - ')); process.exit(1); }
  console.log('云服务接入验证全部通过');
}

main().catch(function (e) { console.error('验证脚本异常：', e && e.message); process.exit(1); });
