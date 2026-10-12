/**
 * 数值平衡模拟：用一个"合格玩家"AI 自动建造/升级，看能否撑过 12 波。
 * 用法： node balance-test.js [局数]
 */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
var block = html.match(/<script id="game-core">([\s\S]*?)<\/script>/)[1];
var core = block.slice(block.indexOf('/* CORE:BEGIN */'), block.indexOf('/* CORE:END */'));

function makeCtx() {
  var f = function () { return proxy; };
  var proxy = new Proxy(f, {
    get: function (t, k) {
      if (typeof k === 'symbol') return undefined;
      return proxy;
    },
    set: function () { return true; },
    apply: function () { return proxy; },
    has: function () { return true; }
  });
  return proxy;
}

function runOne(seed, verbose, diffIdx) {
  var vtime = 0;
  var sandbox = {
    console: console, Math: Math, Date: Date, JSON: JSON,
    performance: { now: function () { return vtime; } },
    requestAnimationFrame: function () { return 0; },
    isFinite: isFinite, String: String, Number: Number, Object: Object, Array: Array, Error: Error,
    // 固定随机种子，保证可复现
    __seed: seed
  };
  sandbox.Math = Object.create(Math);
  var s = seed;
  sandbox.Math.random = function () { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  vm.createContext(sandbox);
  vm.runInContext(core, sandbox, { filename: 'game-core.js' });

  var pointerCb = null, frameCb = null;
  sandbox.MengGuiCore.startGame({
    canvas: { width: 0, height: 0, getContext: function () { return makeCtx(); } },
    getView: function () { return { w: 720, h: 1280, dpr: 1 }; },
    onPointer: function (cb) { pointerCb = cb; },
    onFrame: function (cb) { frameCb = cb; },
    getAudio: function () { return null; }
  });
  var G = null;
  function tap(x, y) { pointerCb(x, y); }
  function step(n) {
    for (var i = 0; i < n; i++) { vtime += 33.34; frameCb(); }
  }
  var BTN = { gun: [126, 1062], miner: [360, 1062], frost: [592, 1062], repair: [126, 1178], doorup: [360, 1178], speed: [592, 1178], up: [126, 1062], cancel: [592, 1062] };
  function cell(c, r) { return [135 + 150 * c, 390 + 110 * r]; }

  tap(360, 748); // 单人闯关
  step(1);
  var di = diffIdx;
  tap(200 + (di % 2) * 320, 555 + ((di / 2) | 0) * 200); // 难度卡片 0..3
  step(1);
  G = sandbox.MengGuiCore.getState();

  var lastWave = 0, guard = 0;
  var log = [];
  while (G.scene === 'play' && guard++ < 8000) {
    step(30); // 1 秒决策一次
    if (G.wave !== lastWave) {
      if (lastWave > 0) log.push('第' + lastWave + '波清空 门HP=' + Math.round(G.door.hp) + '/' + G.door.max + ' 床HP=' + Math.round(G.bed.hp));
      lastWave = G.wave;
    }
    // ---- AI 决策 ----
    var gold = G.gold;
    // 门优先
    if (G.door.broken && gold > 260) { tap(BTN.repair[0], BTN.repair[1]); continue; }
    if (!G.door.broken && G.door.hp < G.door.max * 0.6 && gold > 120) { tap(BTN.repair[0], BTN.repair[1]); continue; }
    if (G.door.lv < 4 && gold > G.door.max * 0.45 + 200) { tap(BTN.doorup[0], BTN.doorup[1]); continue; }
    // 升级最弱的炮台
    var guns = [], miners = [], empty = [];
    for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) {
      var b = null;
      for (var i = 0; i < G.buildings.length; i++) if (G.buildings[i].col === c && G.buildings[i].row === r) b = G.buildings[i];
      if (!b) empty.push([c, r]);
      else if (b.type === 'gun') guns.push(b);
      else if (b.type === 'miner') miners.push(b);
    }
    // 前期先堆炮台火力，中期补发电机，后期全部升级
    var needGuns = miners.length >= 2 ? 11 : 5;
    if (guns.length < needGuns && gold >= 50) {
      tap(BTN.gun[0], BTN.gun[1]);
      var e1 = empty.pop(); if (e1) { var p1 = cell(e1[0], e1[1]); tap(p1[0], p1[1]); }
      continue;
    }
    if (miners.length < 3 && gold >= 130) {
      tap(BTN.miner[0], BTN.miner[1]);
      var e0 = empty.pop(); if (e0) { var p0 = cell(e0[0], e0[1]); tap(p0[0], p0[1]); }
      continue;
    }
    // 有钱就升级炮台
    var target = null;
    for (var k = 0; k < guns.length; k++) if (guns[k].lv < 3) { if (!target || guns[k].lv < target.lv) target = guns[k]; }
    if (target && gold >= 180) {
      // 选中建筑后点升级
      tap(target.x, target.y);
      tap(BTN.up[0], BTN.up[1]);
      tap(BTN.cancel[0], BTN.cancel[1]);
      continue;
    }
  }
  return { scene: G.scene, wave: G.wave, kills: G.kills, time: Math.round(G.time), gold: Math.round(G.gold), log: log, guard: guard };
}

var N = parseInt(process.argv[2] || "3", 10);
var DIFF = parseInt(process.argv[3] || "1", 10);
var wins = 0;
for (var i = 0; i < N; i++) {
  var r = runOne(12345 + i * 7919, i === 0, DIFF);
  if (r.scene === 'win') wins++;
  console.log('第' + (i + 1) + '局: ' + (r.scene === 'win' ? '胜利' : '失败（第' + r.wave + '波）') +
    ' 击杀=' + r.kills + ' 用时=' + r.time + 's 金币=' + r.gold);
  if (i === 0) r.log.forEach(function (l) { console.log('   ' + l); });
}
console.log('--- 胜率 ' + wins + '/' + N);
