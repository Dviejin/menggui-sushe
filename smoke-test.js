/**
 * 无浏览器依赖的冒烟测试：用桩 Canvas 在 Node 中驱动核心逻辑数万帧，
 * 检查运行时异常、波次推进、金币增长与建造流程。
 * 用法： node smoke-test.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
var block = html.match(/<script id="game-core">([\s\S]*?)<\/script>/)[1];
var core = block.slice(block.indexOf('/* CORE:BEGIN */'), block.indexOf('/* CORE:END */'));

/* ---------- 桩 Canvas ---------- */
var rec = { texts: [] };
function makeCtx() {
  var f = function () { return proxy; };
  var proxy = new Proxy(f, {
    get: function (t, k) {
      if (typeof k === 'symbol') return undefined;
      if (k === 'fillText' || k === 'strokeText') return function (s) { rec.texts.push(String(s)); };
      if (k === 'measureText') return function () { return { width: 10 }; };
      return proxy;
    },
    set: function () { return true; },
    apply: function () { return proxy; },
    has: function () { return true; }
  });
  return proxy;
}
var ctxStub = makeCtx();
var canvasStub = { width: 0, height: 0, getContext: function () { return ctxStub; } };

/* ---------- 虚拟时钟 ---------- */
var vtime = 0;
var sandbox = {
  console: console,
  Math: Math,
  Date: Date,
  JSON: JSON,
  performance: { now: function () { return vtime; } },
  requestAnimationFrame: function () { return 0; },
  isFinite: isFinite,
  String: String,
  Number: Number,
  Object: Object,
  Array: Array,
  Error: Error
};
vm.createContext(sandbox);
vm.runInContext(core, sandbox, { filename: 'game-core.js' });

var Core = sandbox.MengGuiCore;
if (!Core) { console.error('核心未加载'); process.exit(1); }

var pointerCb = null, frameCb = null;
Core.startGame({
  canvas: canvasStub,
  getView: function () { return { w: 720, h: 1280, dpr: 1 }; },
  onPointer: function (cb) { pointerCb = cb; },
  onFrame: function (cb) { frameCb = cb; },
  getAudio: function () { return null; }
});

/* ---------- 模拟操作 ---------- */
function tap(x, y) { if (pointerCb) pointerCb(x, y); }
var BTN = {
  gun: [126, 1062], miner: [360, 1062], frost: [592, 1062],
  repair: [126, 1178], doorup: [360, 1178], speed: [592, 1178]
};
function cell(c, r) { return [135 + 150 * c, 390 + 110 * r]; }

var errors = [];
function step(n) {
  for (var i = 0; i < n; i++) {
    vtime += 33.34;
    try { frameCb(); } catch (err) { errors.push(err.stack || String(err)); if (errors.length > 3) throw err; }
  }
}

function sample(tag) {
  var t = rec.texts;
  var wave = '', gold = '';
  for (var i = t.length - 1; i >= 0 && (!wave || !gold); i--) {
    if (!wave && /波|准备中/.test(t[i])) wave = t[i];
    if (!gold && /^\d+$/.test(t[i])) gold = t[i];
  }
  console.log(tag + '  波次状态=' + wave + '  金币≈' + gold);
  rec.texts.length = 0;
}

step(2);
tap(360, 748);            // 单人闯关
step(2);
tap(520, 555);            // 难度：普通
step(2);
var S = Core.getState();
console.log('场景=' + S.scene + ' 难度=' + S.diff.name + ' 初始金币=' + Math.round(S.gold));
if (S.scene !== 'play') { console.error('未进入游戏场景'); process.exit(3); }

// 开局：建 2 炮台 + 1 发电机
var plan = [
  ['gun', 1, 0], ['gun', 2, 0], ['miner', 0, 0],
  ['gun', 1, 1], ['miner', 0, 2], ['frost', 2, 1]
];
for (var p = 0; p < plan.length; p++) {
  var it = plan[p];
  tap(BTN[it[0]][0], BTN[it[0]][1]);
  var cc = cell(it[1], it[2]);
  tap(cc[0], cc[1]);
  step(120);   // 约 4 秒
  sample('建造 ' + it[0] + ' @(' + it[1] + ',' + it[2] + ')');
}

// 道具栏：急冻(196,144) 空袭(278,144) 暴富(360,144) 抢修(442,144) 狂暴(524,144)
tap(196, 144); step(3);
var S2 = Core.getState();
console.log('急冻道具：freezeT=' + S2.freezeT.toFixed(2) + ' 冷却=' + Math.ceil(S2.items.freeze) + 's（应 >0 且进入冷却）');
tap(360, 144); step(3);
console.log('暴富道具：金币=' + Math.round(Core.getState().gold) + ' boostT=' + Core.getState().goldBoostT.toFixed(1));
tap(524, 144); step(3);
console.log('狂暴道具：rageT=' + Core.getState().rageT.toFixed(1));
tap(442, 144); step(3);
console.log('抢修道具：门=' + Math.round(Core.getState().door.hp) + '/' + Core.getState().door.max);

tap(BTN.speed[0], BTN.speed[1]);   // 加速 x2
step(900); sample('加速后 ~30s');
tap(BTN.doorup[0], BTN.doorup[1]); step(30); sample('升级门');
tap(BTN.repair[0], BTN.repair[1]); step(30); sample('修门');

step(5400); sample('长跑 ~3 分钟游戏内时间');

// 联机页面渲染：桩环境无 request，应显示"不支持联网"且不能报错
Core.getState().scene = 'net';
rec.texts.length = 0;
step(4);
var netTxt = rec.texts.join(' | ');
var netBtns = ['创建房间', '加入房间', '重新检测服务器', '返回'].every(function (s) { return netTxt.indexOf(s) >= 0; });
console.log('联机页渲染：显示不支持联网=' + /不支持联网/.test(netTxt) + ' 按钮齐全=' + netBtns);
rec.texts.length = 0;

// 干扰面板 + 对手面板 + 停电遮罩的渲染（强制进入联机态势，仅验证不报错）
var GS = Core.getState();
GS.scene = 'play'; GS.netOn = true; GS.netPanel = true; GS.blackoutT = 5;
GS.stat.sent = 3;
step(4);
var panelTxt = rec.texts.join(' | ');
var okSaber = ['干扰对手', '鬼兵突袭', '猛鬼狂潮', '鬼王降临', '偷电拉闸', '破门咒'].every(function (s) { return panelTxt.indexOf(s) >= 0; });
var okWar = /停电中/.test(panelTxt) && /VS/.test(panelTxt);
console.log('干扰面板渲染=' + okSaber + ' 对手面板与停电遮罩=' + okWar);
rec.texts.length = 0;
GS.netPanel = false; GS.netOn = false;

// 统计最终状态
var fin = rec.texts.slice(-400);
var hasWin = fin.some(function (s) { return /胜利|被猛鬼抓走/.test(s); });
console.log('---');
console.log('运行时异常数: ' + errors.length);
if (errors.length) console.log(errors[0]);
console.log('结束画面出现: ' + (hasWin ? '是' : '否（仍在进行中）'));
console.log('最近文本: ' + fin.slice(-14).join(' | '));
if (errors.length) process.exit(2);
console.log('冒烟测试通过');
