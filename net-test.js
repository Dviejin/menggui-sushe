/**
 * 联机端到端测试：启动 server.js，用两个"客户端"实例完成
 * 创建房间 → 加入房间 → 状态同步 → 送鬼干扰 的完整链路。
 * 用法： node net-test.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var { spawn } = require('child_process');

var PORT = 8099;
/* 传入外部地址则直接对公网跑（不启动本地服务器）：
   node net-test.js https://xxx.workbuddy.host */
var EXTERNAL = (process.argv[2] || '').replace(/\/+$/, '');
var BASE = EXTERNAL || ('http://127.0.0.1:' + PORT);
var ownServer = !EXTERNAL;
var html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
var block = html.match(/<script id="game-core">([\s\S]*?)<\/script>/)[1];
var core = block.slice(block.indexOf('/* CORE:BEGIN */'), block.indexOf('/* CORE:END */'));

function makeCtx() {
  var f = function () { return proxy; };
  var proxy = new Proxy(f, {
    get: function (t, k) { if (typeof k === 'symbol') return undefined; return proxy; },
    set: function () { return true; }, apply: function () { return proxy; }, has: function () { return true; }
  });
  return proxy;
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function makeClient(tag, list) {
  var vtime = 0;
  var sandbox = {
    console: console, Date: Date, JSON: JSON, Promise: Promise,
    performance: { now: function () { return vtime; } },
    requestAnimationFrame: function () { return 0; },
    setTimeout: setTimeout, clearTimeout: clearTimeout,
    isFinite: isFinite, String: String, Number: Number, Object: Object, Array: Array, Error: Error,
    fetch: fetch
  };
  vm.createContext(sandbox);
  vm.runInContext(core, sandbox, { filename: 'core-' + tag + '.js' });
  var ptr = null, fr = null;
  sandbox.MengGuiCore.startGame({
    canvas: { width: 0, height: 0, getContext: function () { return makeCtx(); } },
    getView: function () { return { w: 720, h: 1280, dpr: 1 }; },
    onPointer: function (cb) { ptr = cb; },
    onFrame: function (cb) { fr = cb; },
    getAudio: function () { return null; },
    request: function (o) {
      return fetch(o.url, {
        method: o.method || 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(o.body || {})
      }).then(function (r) { return r.json(); });
    },
    // list 非空时模拟"不知道服务器地址"，交给自动探测（前面的候选项都是错的）
    baseUrl: list ? '' : BASE,
    getBaseList: list ? function () { return list; } : null
  });
  return {
    tag: tag,
    S: function () { return sandbox.MengGuiCore.getState(); },
    N: function () { return sandbox.MengGuiCore.net; },
    tap: function (x, y) { ptr(x, y); },
    tick: function (n) { for (var i = 0; i < n; i++) { vtime += 33.34; fr(); } }
  };
}

function keys(code) {
  // 数字键盘坐标：x=156+(i%3)*144+60, y=520+floor(i/3)*116+48
  var out = [];
  var order = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
  for (var i = 0; i < code.length; i++) {
    var idx = order.indexOf(code[i]);
    out.push([156 + (idx % 3) * 144 + 60, 520 + Math.floor(idx / 3) * 116 + 48]);
  }
  out.push([156 + (11 % 3) * 144 + 60, 520 + Math.floor(11 / 3) * 116 + 48]); // ok
  return out;
}

(async function main() {
  var srv = ownServer ? spawn(process.execPath, [path.join(__dirname, 'server', 'server.js')], {
    env: Object.assign({}, process.env, { PORT: String(PORT) }),
    stdio: 'ignore'
  }) : null;
  await sleep(EXTERNAL ? 200 : 700);

  var fail = [];
  try {
    var ping = await fetch(BASE + '/api/ping').then(function (r) { return r.json(); });
    console.log('服务器就绪: ' + JSON.stringify(ping));

    // 0) 自动探测：不给地址，候选列表前几项故意填错
    var C = makeClient('C', ['http://127.0.0.1:1', 'http://127.0.0.1:2', BASE]);
    C.tick(2);
    for (var p = 0; p < 25 && C.N().conn !== 'ok'; p++) { C.tick(5); await sleep(80); }
    console.log('自动探测: conn=' + C.N().conn + ' 锁定地址=' + C.N().baseUrl + ' 提示=' + C.N().hint);
    if (C.N().conn !== 'ok' || C.N().baseUrl !== BASE) fail.push('自动探测未能定位服务器');

    // 0.1) 探测失败时应给出明确文案
    var D = makeClient('D', ['http://127.0.0.1:1']);
    D.tick(2);
    for (var p2 = 0; p2 < 25 && D.N().conn !== 'fail'; p2++) { D.tick(5); await sleep(60); }
    console.log('无服务器时: conn=' + D.N().conn + ' 提示=' + D.N().hint);
    if (D.N().conn !== 'fail') fail.push('无可用服务器时未进入 fail 状态');

    var A = makeClient('A'), B = makeClient('B');
    A.tick(2); B.tick(2);

    // 1) A 进入联机 → 创建房间
    A.tap(360, 864);            // 联机对战
    A.tick(2);
    console.log('A 场景=' + A.S().scene + ' net.step=' + A.N().step);
    // 1.1 联机难度分级：A 选困难（索引 2），房间应记录该难度
    A.tap(445, 450); A.tick(4);
    console.log('A 选择难度 diffIdx=' + A.N().diffIdx + '（应为 2）');
    if (A.N().diffIdx !== 2) fail.push('联机难度选择未生效');
    A.tap(360, 590);            // 创建房间
    for (var i = 0; i < 20 && !A.N().room; i++) { A.tick(10); await sleep(60); }
    var code = A.N().code;
    console.log('A 创建房间码=' + code + ' status=' + (A.N().room && A.N().room.status) + ' diff=' + (A.N().room && A.N().room.diff));
    if (!code || code.length !== 4) fail.push('A 未拿到房间码');
    if (A.N().room.diff !== 2) fail.push('房间未记录房主选择的难度');
    // 1.2 邀请链接
    console.log('A 邀请链接=' + A.N().invite);
    if (!A.N().invite || A.N().invite.indexOf('?room=' + code) < 0) fail.push('邀请链接未生成');

    // 2) B 加入
    B.tap(360, 864); B.tick(2);
    B.tap(360, 690);            // 加入房间
    B.tick(2);
    var ks = keys(code);
    for (var k = 0; k < ks.length; k++) { B.tap(ks[k][0], ks[k][1]); B.tick(2); }
    for (var j = 0; j < 20 && !B.N().room; j++) { B.tick(10); await sleep(60); }
    console.log('B 加入后 room=' + (B.N().room ? B.N().room.id : 'null') + ' status=' + (B.N().room && B.N().room.status) + ' B难度=' + B.N().diffIdx);
    if (!B.N().room) fail.push('B 未能加入房间');
    if (B.N().diffIdx !== 2) fail.push('加入者未同步房间难度');

    // 3) A 轮询到对手已加入 → 开始对战
    for (var m = 0; m < 20 && !(A.N().room && A.N().room.status === 'playing'); m++) { A.tick(10); await sleep(60); }
    console.log('A 房间 status=' + A.N().room.status + ' 对手=' + (A.N().room.guest ? A.N().room.guest.nick : '-'));
    A.tick(8);                  // 让按钮按最新房间状态刷新
    A.tap(360, 850);            // A 开始对战
    A.tick(4);
    B.tick(8);
    B.tap(360, 850);            // B 开始对战
    B.tick(4);
    console.log('A 场景=' + A.S().scene + ' netOn=' + A.S().netOn + ' | B 场景=' + B.S().scene + ' netOn=' + B.S().netOn);
    if (A.S().scene !== 'play' || B.S().scene !== 'play') fail.push('未能进入对战');
    console.log('对战难度：A=' + A.S().diff.id + '（' + A.S().diff.waves + '波） B=' + B.S().diff.id);
    if (A.S().diff.id !== 'hard' || B.S().diff.id !== 'hard') fail.push('对战未使用房间难度（困难）');
    giveTowers(A, 6); A.S().gold = 9999;   // 困难难度下给 A 防御，保证能撑到对手出局

    // 4) 双方各跑一段，同步状态
    A.tick(900); await sleep(400); A.tick(900); await sleep(400);
    B.tick(900); await sleep(400); B.tick(900); await sleep(400);
    console.log('A 看到对手: 第' + A.N().opp.wave + '波 击杀' + A.N().opp.kills + ' 床位' + Math.round(A.N().opp.bedPct * 100) + '%');
    console.log('B 看到对手: 第' + B.N().opp.wave + '波 击杀' + B.N().opp.kills + ' 床位' + Math.round(B.N().opp.bedPct * 100) + '%');
    if (!A.N().opp || A.N().opp.wave === undefined || !A.N().opp.nick) fail.push('A 未同步到对手状态');

    // 5) 干扰面板（第 5 格）：打开 → 逐一手测试
    function resetCd(client) {
      var it = client.S().items;
      ['send', 'horde', 'king', 'black', 'curse', 'saber'].forEach(function (k) { it[k] = 0; });
    }
    function waitFor(client, pred, tries) {
      return (async function () {
        for (var i = 0; i < (tries || 30); i++) { if (pred()) return true; client.tick(12); await sleep(60); }
        return pred();
      })();
    }
    function sabOpen(client) {
      client.tap(535, 141);   // 道具栏干扰格（联机第 6 格）
      client.tick(4);
    }
    // 服务器对每个座位有 300ms 防刷节流，模拟真人操作节奏
    async function castSab(idx, noHeal) {
      await sleep(360);
      if (!noHeal) B.S().bed.hp = B.S().bed.max;   // 保证 B 在验证期间存活
      A.S().gold = 9999; resetCd(A);
      A.tap(535, 141); A.tick(4);
      A.tap(360, SABY[idx]); A.tick(6);
    }
    function giveTowers(client, n) {
      for (var c = 0; c < n; c++) {
        client.S().buildings.push({
          type: 'gun', lv: 3, col: c, row: 0,
          x: 135 + 150 * c, y: 390,
          hp: 420, max: 420, invested: 330,
          t: 0, angle: -Math.PI / 2, cd: 0, flash: 0
        });
      }
    }
    // 干扰面板 5 项的中心坐标：x=360, y=336+i*104+44
    var SABY = [380, 484, 588, 692, 796];

    A.S().gold = 9999; resetCd(A);
    A.tap(535, 141); A.tick(4);
    console.log('A scene=' + A.S().scene + ' netOn=' + A.S().netOn + ' 道具按钮: ' + A.S().btns.slice(0, 7).map(function (b) { return b.id + '@' + Math.round(b.x) + ',' + Math.round(b.y) + ' ' + b.w + 'x' + b.h + (b.enabled ? '' : '(禁用)'); }).join(' | '));
    console.log('A 干扰面板 netPanel=' + A.S().netPanel + ' 面板按钮数=' + A.S().btns.length);
    if (!A.S().netPanel) fail.push('干扰面板未打开');
    if (A.S().btns.length !== 6) fail.push('干扰面板按钮数异常：' + A.S().btns.length);

    // 5.1 鬼兵突袭
    var before = B.S().ghosts.length;
    await castSab(0);
    await waitFor(B, function () { return B.S().ghosts.length > before; });
    var got = B.S().ghosts.filter(function (g) { return g.fromNet; }).length;
    console.log('B 收到外来猛鬼: ' + got + ' 只 · A投放=' + A.S().stat.sent + ' · B接收=' + B.S().stat.got);
    console.log('B 战报: ' + B.S().feed.map(function (f) { return f.msg; }).join(' / ') + '（共 ' + B.S().feed.length + ' 条）');
    if (got < 2) fail.push('鬼兵突袭未送达');
    if (B.S().feed.length < 1) fail.push('战报未生成');

    // 5.2 偷电拉闸
    await castSab(3);
    await waitFor(B, function () { return B.S().blackoutT > 0; });
    console.log('B 停电剩余=' + B.S().blackoutT.toFixed(1) + 's');
    if (!(B.S().blackoutT > 0)) fail.push('偷电拉闸未生效');

    // 5.3 破门咒（先让 B 的门恢复完好）
    B.S().door.broken = false; B.S().door.hp = B.S().door.max;
    await castSab(4);
    var doorBefore = B.S().door.hp;
    await waitFor(B, function () { return B.S().door.hp < doorBefore; });
    console.log('B 门血量 ' + Math.round(doorBefore) + ' → ' + Math.round(B.S().door.hp) + '（应约 -35%）');
    if (B.S().door.hp >= doorBefore) fail.push('破门咒未生效');

    // 5.4 鬼王降临
    await castSab(2);
    await waitFor(B, function () { return B.S().ghosts.some(function (g) { return g.boss && g.fromNet; }); });
    var kings = B.S().ghosts.filter(function (g) { return g.boss && g.fromNet; }).length;
    console.log('B 收到鬼王: ' + kings + ' 只');
    if (kings < 1) fail.push('鬼王未送达');

    // 5.5 缴获赏金：给 B 装备 4 座炮塔，击杀外来鬼应有额外金币
    giveTowers(B, 4);
    console.log('B 炮塔数=' + B.S().buildings.length);
    B.S().bed.hp = B.S().bed.max;
    await castSab(1);                            // 猛鬼狂潮 4 只
    await waitFor(B, function () { return B.S().stat.lootKills > 0; }, 45);
    console.log('B 缴获击杀=' + B.S().stat.lootKills + ' 缴获金币=' + Math.round(B.S().stat.loot));
    if (B.S().stat.lootKills < 1) fail.push('缴获赏金未生效');

    // 5.6 铁幕护盾：B 开启期间对手投放的猛鬼应被拦截并转为缴获
    B.S().gold = 9999; B.S().items.shield = 0; B.S().shieldT = 0;
    B.tap(465, 141); B.tick(4);                 // 道具栏第 5 格 = 铁幕
    console.log('B 铁幕剩余=' + B.S().shieldT.toFixed(1) + 's');
    if (!(B.S().shieldT > 0)) fail.push('铁幕护盾未开启');
    var netBefore = B.S().ghosts.filter(function (g) { return g.fromNet; }).length;
    var lootBefore = B.S().stat.lootKills;
    await castSab(0);                           // 鬼兵突袭 2 只
    await waitFor(B, function () { return B.S().stat.lootKills > lootBefore; }, 30);
    var netAfter = B.S().ghosts.filter(function (g) { return g.fromNet; }).length;
    console.log('B 铁幕期间外来鬼 ' + netBefore + ' → ' + netAfter + ' · 缴获击杀 +' + (B.S().stat.lootKills - lootBefore));
    if (netAfter > netBefore) fail.push('铁幕未拦截对手投放的猛鬼');
    if (!(B.S().stat.lootKills > lootBefore)) fail.push('铁幕缴获未生效');

    // 5.7 对手面板数据同步
    await sleep(1400); A.tick(40); B.tick(40); await sleep(400); B.tick(20);
    console.log('B 看到对手: ' + B.N().opp.nick + ' 第' + B.N().opp.wave + '波 床' + Math.round(B.N().opp.bedPct * 100) + '% 投放' + B.N().opp.sent + '次');
    if (!(B.N().opp.sent > 0)) fail.push('对手投放次数未同步');

    // 6) 结算链路：拆掉防御并让 B 出局
    B.S().buildings.length = 0;
    B.S().ghosts.length = 0;
    B.S().door.broken = false; B.S().door.hp = 1;
    B.S().bed.hp = 1;
    await castSab(0, true);                      // 外来鬼破门 → 打床
    for (var w = 0; w < 50 && B.S().scene !== 'lose'; w++) { B.tick(20); await sleep(50); }
    console.log('B 场景=' + B.S().scene + ' finished=' + B.N().finished);
    /* 公网往返比本地慢，用轮询等待而非固定步数 */
    for (var wa = 0; wa < 40 && !A.N().opp.finished; wa++) { A.tick(40); await sleep(400); }
    console.log('A 诊断: scene=' + A.S().scene + ' recDone=' + A.S().recDone +
      ' netOn=' + A.S().netOn + ' opp.finished=' + A.N().opp.finished + ' opp.win=' + A.N().opp.win +
      ' sceneOfB=' + B.S().scene);
    console.log('A 看到对手 finished=' + A.N().opp.finished + '（应为 true）');
    if (B.S().scene !== 'lose') fail.push('B 未判定为失败');
    if (!A.N().opp.finished) fail.push('A 未收到对手结束状态');
    console.log('A 战绩记录: ' + A.N().record.win + ' 胜 ' + A.N().record.lose + ' 负（应为 1 胜）');
    if (A.N().record.win < 1) fail.push('战绩未记录');

    // 7) 服务器参数校验：非法动作应拒绝、越界数值应裁剪
    async function postJson(path, obj) {
      return fetch(BASE + path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj)
      }).then(function (r) { return r.json(); });
    }
    var nr = await postJson('/api/room', { action: 'create', uid: 'z1', nick: '校验房主', diff: 1 });
    await postJson('/api/room', { action: 'join', code: nr.room.code, uid: 'z2', nick: '校验访客' });
    var bad = await postJson('/api/action', { roomId: nr.room.id, uid: 'z1', type: 'cheat_win', value: 999 });
    var good = await postJson('/api/action', { roomId: nr.room.id, uid: 'z1', type: 'door_curse', value: 999 });
    var st2 = await postJson('/api/state', { roomId: nr.room.id, uid: 'z2', st: { wave: 1 } });
    var ev = (st2.events || []).filter(function (e) { return e.type === 'door_curse'; })[0];
    console.log('非法动作=' + JSON.stringify(bad) + ' | 越界值 999 → ' + (ev ? ev.value : '未送达'));
    if (bad.ok) fail.push('非法动作未被拒绝');
    if (!good.ok) fail.push('合法动作被误拒');
    if (!ev || ev.value !== 60) fail.push('越界数值未被裁剪（应为 60）');

    // 8) 快速匹配：没人等待时自建房间，有人等待时直接加入
    var Q1 = makeClient('Q1'); Q1.tick(2);
    Q1.tap(360, 864); Q1.tick(2);
    Q1.tap(360, 790);                            // 快速匹配
    for (var q1 = 0; q1 < 20 && !Q1.N().room; q1++) { Q1.tick(10); await sleep(60); }
    console.log('Q1 快速匹配 → 房间码=' + Q1.N().code + ' status=' + (Q1.N().room && Q1.N().room.status));
    if (!Q1.N().room) fail.push('快速匹配未进入房间');
    if (Q1.N().room.status !== 'wait') fail.push('首次快速匹配应自建等待房');
    var Q2 = makeClient('Q2'); Q2.tick(2);
    Q2.tap(360, 864); Q2.tick(2);
    Q2.tap(360, 790);                            // 快速匹配 → 应加入 Q1 的房间
    for (var q2 = 0; q2 < 20 && !Q2.N().room; q2++) { Q2.tick(10); await sleep(60); }
    console.log('Q2 快速匹配 → 房间码=' + Q2.N().code + ' status=' + (Q2.N().room && Q2.N().room.status));
    if (!Q2.N().room) fail.push('Q2 快速匹配未进入房间');
    if (Q2.N().code !== Q1.N().code) fail.push('快速匹配未加入已有等待房');
    if (Q2.N().diffIdx !== Q1.N().diffIdx) fail.push('快速匹配难度未同步');
  } catch (e) {
    fail.push('异常: ' + (e && e.stack || e));
  }

  if (srv) srv.kill();
  console.log('---');
  if (fail.length) { fail.forEach(function (f) { console.log('失败: ' + f); }); process.exit(2); }
  console.log('联机端到端测试通过');
  process.exit(0);
})();
