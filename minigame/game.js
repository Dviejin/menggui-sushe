/* CORE:BEGIN */
var MengGuiCore = (function () {
  'use strict';

  /* ==================== 常量与配置 ==================== */
  var VW = 720, VH = 1280;

  var GRID = { x: 65, y: 340, cols: 4, rows: 4, cw: 140, ch: 100, gap: 10 };
  var HALL = { y0: 192, y1: 284 };
  var WALL = { y0: 286, y1: 318 };
  var DOOR = { x0: 250, x1: 470, cx: 360, cy: 302 };
  var BED  = { cx: 360, cy: 872, w: 250, h: 150 };
  var ROOM = { x0: 30, x1: 690, y0: 318, y1: 988 };
  var ITEMBAR = { y: 112, d: 64, gap: 18 };
  var MAP_W = 660, MAP_X = 30;

  var TOWER = {
    gun: {
      name: '电磁炮', short: '炮', color: '#5ad1ff', hp: 420,
      cost: [50, 100, 180],
      dmg: [14, 32, 64], rate: [1.3, 1.6, 2.0], range: [250, 285, 320], bspd: 540
    },
    miner: {
      name: '发电机', short: '电', color: '#ffd35a', hp: 380,
      cost: [60, 130, 230],
      income: [3, 7, 15]
    },
    frost: {
      name: '冷凝塔', short: '冰', color: '#9ad9ff', hp: 400,
      cost: [80, 150, 260],
      slow: [0.40, 0.55, 0.70], range: [220, 250, 290], dps: [8, 16, 28]
    }
  };
  var TOWER_ORDER = ['gun', 'miner', 'frost'];

  var DOOR_LV = {
    hp: [1000, 2000, 3500, 5600],
    up: [150, 320, 600],
    rebuild: [220, 320, 460, 620]
  };
  var DOOR_REPAIR_COST_RATIO = 0.18;
  var DOOR_REPAIR_RATIO = 0.40;
  var GHOST_VS_BUILDING = 0.7;

  /* ---- 难度 ---- */
  var DIFFS = [
    { id: 'easy',   name: '轻松', desc: '新手试玩 · 鬼少钱多', waves: 10, hpM: 0.75, cntM: 0.80, dmgM: 0.75, goldM: 1.35, startGold: 240, bedHp: 3000, tint: '#5ad17a' },
    { id: 'normal', name: '普通', desc: '标准挑战 · 推荐',     waves: 12, hpM: 1.00, cntM: 1.00, dmgM: 1.00, goldM: 1.00, startGold: 180, bedHp: 2600, tint: '#5ad1ff' },
    { id: 'hard',   name: '困难', desc: '手忙脚乱 · 钱变少',   waves: 14, hpM: 1.35, cntM: 1.20, dmgM: 1.25, goldM: 0.85, startGold: 140, bedHp: 2200, tint: '#ffa552' },
    { id: 'hell',   name: '噩梦', desc: '鬼潮地狱 · 慎入',     waves: 14, hpM: 1.50, cntM: 1.25, dmgM: 1.35, goldM: 0.78, startGold: 140, bedHp: 2000, tint: '#ff5d7a' }
  ];

  /* ---- 道具 ---- */
  var ITEMS = {
    freeze: { name: '急冻', icon: 'freeze', cost: 100, cd: 26, desc: '全场猛鬼冻结 3.5 秒' },
    bomb:   { name: '空袭', icon: 'bomb',   cost: 180, cd: 32, desc: '全场猛鬼受到重创' },
    gold:   { name: '暴富', icon: 'gold',   cost: 0,   cd: 42, desc: '立刻 +160 金币，10 秒双倍收益' },
    heal:   { name: '抢修', icon: 'heal',   cost: 150, cd: 34, desc: '门回满血，床位恢复 40%' },
    rage:   { name: '狂暴', icon: 'rage',   cost: 120, cd: 30, desc: '炮台射速翻倍 8 秒' },
    shield: { name: '铁幕', icon: 'shield', cost: 150, cd: 36, desc: '6 秒内免疫对手投放的猛鬼，并双倍缴获' },
    saber:  { name: '干扰', icon: 'saber',  cost: 0,   cd: 1,  desc: '打开干扰面板恶心对手' }
  };
  /* 联机干扰道具（在干扰面板里使用） */
  var SABERS = [
    { id: 'send',  name: '鬼兵突袭', cost: 130, cd: 20, icon: 'send',  type: 'send_ghost', value: 2,  desc: '投放 2 只强化猛鬼',            tip: '鬼兵突袭' },
    { id: 'horde', name: '猛鬼狂潮', cost: 260, cd: 40, icon: 'horde', type: 'ghost_horde', value: 4,  desc: '一次性投放 4 只猛鬼',          tip: '猛鬼狂潮' },
    { id: 'king',  name: '鬼王降临', cost: 340, cd: 55, icon: 'king',  type: 'ghost_king',  value: 1,  desc: '投放强化 BOSS，血厚伤害高',   tip: '鬼王降临' },
    { id: 'black', name: '偷电拉闸', cost: 200, cd: 42, icon: 'black', type: 'power_out',   value: 8,  desc: '对手发电机停摆 8 秒',         tip: '偷电拉闸' },
    { id: 'curse', name: '破门咒',   cost: 170, cd: 38, icon: 'curse', type: 'door_curse',  value: 35, desc: '对手的门立即损失 35% 血量',   tip: '破门咒' }
  ];
  var SABER_MAP = {};
  (function () { for (var i = 0; i < SABERS.length; i++) SABER_MAP[SABERS[i].id] = SABERS[i]; })();
  /* 缴获倍率：击杀对手投放的猛鬼可额外获得赏金 */
  var LOOT_BONUS = 0.8;

  var PREP_TIME = 8, FIRST_PREP = 15;

  /* ==================== 运行时状态 ==================== */
  var A = null, cv = null, ctx = null, AC = null;
  var VIEW = { w: 0, h: 0, dpr: 1 };
  var T = { s: 1, ox: 0, oy: 0 };
  var G = null;
  var lastT = 0, sfxGate = {};

  /* ==================== 工具 ==================== */
  function nowMs() {
    if (typeof performance !== 'undefined' && performance.now) return performance.now();
    return Date.now();
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function dist(x1, y1, x2, y2) { var dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); }
  function fmt(n) { return String(Math.floor(n)); }
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function font(size, weight) {
    return (weight || 'bold') + ' ' + size + 'px -apple-system,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
  }
  function text(c, str, x, y, size, color, align, weight) {
    c.font = font(size, weight);
    c.fillStyle = color;
    c.textAlign = align || 'center';
    c.textBaseline = 'middle';
    c.fillText(str, x, y);
  }
  function bar(c, x, y, w, h, pct, col, bg) {
    rr(c, x, y, w, h, h / 2); c.fillStyle = bg || 'rgba(0,0,0,0.55)'; c.fill();
    if (pct > 0) { rr(c, x, y, Math.max(h, w * clamp(pct, 0, 1)), h, h / 2); c.fillStyle = col; c.fill(); }
  }

  /* ==================== 音效 ==================== */
  function sfx(name, gate) {
    if (!AC) return;
    if (gate) {
      var t0 = nowMs();
      if (sfxGate[name] && t0 - sfxGate[name] < gate) return;
      sfxGate[name] = t0;
    }
    try {
      var t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
      o.connect(g); g.connect(AC.destination);
      var f = 440, dur = 0.08, type = 'square', vol = 0.06;
      if (name === 'shoot') { f = 900; dur = 0.05; type = 'square'; vol = 0.028; }
      else if (name === 'hit') { f = 240; dur = 0.05; type = 'triangle'; vol = 0.04; }
      else if (name === 'die') { f = 190; dur = 0.20; type = 'sawtooth'; vol = 0.055; }
      else if (name === 'build') { f = 520; dur = 0.12; type = 'sine'; vol = 0.075; }
      else if (name === 'coin') { f = 1180; dur = 0.06; type = 'sine'; vol = 0.04; }
      else if (name === 'door') { f = 95; dur = 0.35; type = 'square'; vol = 0.09; }
      else if (name === 'item') { f = 720; dur = 0.22; type = 'triangle'; vol = 0.09; }
      else if (name === 'win') { f = 660; dur = 0.55; type = 'sine'; vol = 0.11; }
      else if (name === 'lose') { f = 120; dur = 0.65; type = 'sawtooth'; vol = 0.11; }
      else if (name === 'deny') { f = 150; dur = 0.08; type = 'square'; vol = 0.05; }
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (name === 'die' || name === 'lose' || name === 'door') o.frequency.exponentialRampToValueAtTime(Math.max(40, f * 0.35), t + dur);
      if (name === 'item') o.frequency.exponentialRampToValueAtTime(1400, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur);
    } catch (e) { }
  }

  /* ==================== 网格 ==================== */
  function cellCenter(c, r) {
    return { x: GRID.x + c * (GRID.cw + GRID.gap) + GRID.cw / 2, y: GRID.y + r * (GRID.ch + GRID.gap) + GRID.ch / 2 };
  }
  function cellAt(x, y) {
    for (var r = 0; r < GRID.rows; r++) for (var c = 0; c < GRID.cols; c++) {
      var p = cellCenter(c, r);
      if (Math.abs(x - p.x) <= GRID.cw / 2 + GRID.gap / 2 && Math.abs(y - p.y) <= GRID.ch / 2 + GRID.gap / 2) return { c: c, r: r, p: p };
    }
    return null;
  }
  function buildingAt(c, r) {
    for (var i = 0; i < G.buildings.length; i++) if (G.buildings[i].col === c && G.buildings[i].row === r) return G.buildings[i];
    return null;
  }

  /* ==================== 初始化 ==================== */
  function newItems() {
    var o = { freeze: 0, bomb: 0, gold: 0, heal: 0, rage: 0, shield: 0, saber: 0 };
    for (var i = 0; i < SABERS.length; i++) o[SABERS[i].id] = 0;
    return o;
  }

  function initGame(diffIdx) {
    var d = DIFFS[diffIdx || 1];
    G = {
      scene: 'menu', diff: d, diffIdx: diffIdx || 1,
      gold: d.startGold, kills: 0, wave: 0, phase: 'prep', timer: FIRST_PREP,
      queue: [], spawnT: 0, speed: 1, time: 0,
      door: { lv: 1, hp: DOOR_LV.hp[0], max: DOOR_LV.hp[0], broken: false, shake: 0, flash: 0 },
      bed: { hp: d.bedHp, max: d.bedHp, shake: 0, flash: 0 },
      buildings: [], ghosts: [], bullets: [], parts: [], floats: [],
      sel: null, place: null, tip: '', tipT: 0, btns: [], ghostId: 1, income: 1,
      items: newItems(), freezeT: 0, rageT: 0, goldBoostT: 0, itemFx: 0,
      netOn: false, netPanel: false, blackoutT: 0, recDone: false, shieldT: 0,
      feed: [],
      stat: { sent: 0, got: 0, lootKills: 0, loot: 0 },
      cloud: { signed: false, nick: '', msg: '', coach: '', stats: null }
    };
  }

  /* ==================== 云服务（能力由适配层注入） ==================== */
  function cloudApply(st) {
    if (!st || !G) return;
    if (typeof st.signed === 'boolean') G.cloud.signed = st.signed;
    if (st.nick) {
      G.cloud.nick = st.nick;
      /* 登录后用云端昵称参加联机，队友看到的是同一个名字 */
      if (!NET.room) NET.nick = st.nick;
    }
    if (typeof st.msg === 'string') G.cloud.msg = st.msg;
    if (typeof st.coach === 'string') G.cloud.coach = st.coach;
    if (st.stats) G.cloud.stats = st.stats;
    lastKey = '';
  }
  function openCloudPanel() {
    if (!A.cloud) { tip('当前环境未接入云服务'); sfx('deny'); return; }
    A.cloud.open(cloudApply);
  }
  /* 一局结束后把战绩交给云端（登录则入库 + 生成 AI 点评） */
  function cloudSubmit(win) {
    if (!A.cloud || !G) return;
    G.cloud.msg = '正在同步云端…';
    G.cloud.coach = '';
    A.cloud.submit({
      mode: G.netOn ? 'net' : 'solo',
      diff: G.diff ? G.diff.id : '',
      diffName: G.diff ? G.diff.name : '',
      win: !!win,
      wave: Math.max(1, G.wave || 0),
      kills: G.kills || 0,
      duration: Math.round(G.time || 0),
      sent: G.stat ? G.stat.sent : 0,
      loot: G.stat ? G.stat.lootKills : 0
    }, cloudApply);
  }
  /* 画布上按固定字数折行（结算页展示 AI 点评） */
  function wrapLines(s, per, max) {
    s = String(s || '').replace(/\s+/g, ' ');
    var out = [], i = 0;
    while (i < s.length && out.length < max) { out.push(s.slice(i, i + per)); i += per; }
    if (i < s.length && out.length) out[out.length - 1] = out[out.length - 1].slice(0, per - 1) + '…';
    return out;
  }

  function startPlay(diffIdx, netOn) {
    initGame(diffIdx);
    G.scene = 'play';
    G.netOn = !!netOn;
  }

  /* ==================== 特效 ==================== */
  function float(x, y, str, color, size) {
    if (G.floats.length > 40) G.floats.shift();
    G.floats.push({ x: x, y: y, vy: -46, t: 0, life: 0.95, s: str, c: color || '#ffd85a', z: size || 26 });
  }
  function burst(x, y, color, n, spd) {
    for (var i = 0; i < n; i++) {
      if (G.parts.length > 340) break;
      var a = rnd(0, Math.PI * 2), v = rnd(0.35, 1) * (spd || 150);
      G.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, t: 0, life: rnd(0.35, 0.75), c: color, s: rnd(3, 7) });
    }
  }
  function tip(msg) { G.tip = msg; G.tipT = 2.4; }

  /* ==================== 建造 / 门 ==================== */
  function lvCost(b) { var def = TOWER[b.type]; return b.lv >= 3 ? -1 : def.cost[b.lv]; }
  function sellBack(b) { var def = TOWER[b.type], s = 0; for (var i = 0; i < b.lv; i++) s += def.cost[i]; return Math.floor(s * 0.5); }
  function tryBuild(c, r, type) {
    if (buildingAt(c, r)) { tip('该位置已有建筑'); return; }
    var def = TOWER[type], cost = def.cost[0];
    if (G.gold < cost) { tip('金币不足'); sfx('deny'); return; }
    var p = cellCenter(c, r);
    G.gold -= cost;
    G.buildings.push({ type: type, lv: 1, col: c, row: r, x: p.x, y: p.y, hp: def.hp, max: def.hp, invested: cost, t: rnd(0, 6), angle: -Math.PI / 2, cd: 0, flash: 0 });
    burst(p.x, p.y, def.color, 10, 120);
    float(p.x, p.y - 30, '-' + cost, '#ff9d9d', 22);
    sfx('build');
  }
  function tryUpgrade(b) {
    var cost = lvCost(b);
    if (cost < 0) { tip('已是最高等级'); sfx('deny'); return; }
    if (G.gold < cost) { tip('金币不足'); sfx('deny'); return; }
    var def = TOWER[b.type], ratio = b.hp / b.max;
    G.gold -= cost; b.lv++; b.invested += cost;
    b.max = def.hp * (1 + 0.8 * (b.lv - 1)); b.hp = b.max * ratio;
    burst(b.x, b.y, def.color, 14, 150);
    float(b.x, b.y - 34, 'Lv' + b.lv, def.color, 26);
    sfx('build');
  }
  function trySell(b) {
    var back = sellBack(b);
    G.gold += back;
    G.buildings.splice(G.buildings.indexOf(b), 1);
    burst(b.x, b.y, '#9aa4bd', 12, 130);
    float(b.x, b.y - 30, '+' + back, '#ffd85a', 24);
    G.sel = null; sfx('coin');
  }
  function doorRepairCost() { return Math.ceil(G.door.max * DOOR_REPAIR_COST_RATIO); }
  function tryRepairDoor() {
    if (G.door.broken) {
      var rc = DOOR_LV.rebuild[G.door.lv - 1];
      if (G.gold < rc) { tip('金币不足，无法重建'); sfx('deny'); return; }
      G.gold -= rc; G.door.broken = false; G.door.hp = Math.floor(G.door.max * 0.5);
      float(DOOR.cx, DOOR.cy - 60, '门已重建', '#7dffa8', 26);
      burst(DOOR.cx, DOOR.cy, '#c9a24a', 16, 150); sfx('build'); return;
    }
    if (G.door.hp >= G.door.max) { tip('门是完好的'); sfx('deny'); return; }
    var cost = doorRepairCost();
    if (G.gold < cost) { tip('金币不足'); sfx('deny'); return; }
    G.gold -= cost;
    G.door.hp = Math.min(G.door.max, G.door.hp + Math.ceil(G.door.max * DOOR_REPAIR_RATIO));
    float(DOOR.cx, DOOR.cy - 60, '+' + Math.ceil(G.door.max * DOOR_REPAIR_RATIO), '#7dffa8', 24);
    sfx('build');
  }
  function tryUpgradeDoor() {
    if (G.door.lv >= 4) { tip('门已是最高等级'); sfx('deny'); return; }
    var cost = DOOR_LV.up[G.door.lv - 1];
    if (G.gold < cost) { tip('金币不足'); sfx('deny'); return; }
    G.gold -= cost; G.door.lv++;
    G.door.max = DOOR_LV.hp[G.door.lv - 1]; G.door.hp = G.door.max; G.door.broken = false;
    float(DOOR.cx, DOOR.cy - 60, '铁门 Lv' + G.door.lv, '#7dffa8', 26);
    burst(DOOR.cx, DOOR.cy, '#8fd6ff', 18, 160); sfx('build');
  }

  /* ==================== 道具 ==================== */
  function itemList() {
    return G.netOn ? ['freeze', 'bomb', 'gold', 'heal', 'shield', 'saber'] : ['freeze', 'bomb', 'gold', 'heal', 'rage'];
  }
  function itemBtnPos(i, n) {
    n = n || 5;
    var d = ITEMBAR.d, gap = ITEMBAR.gap;
    if (n >= 6) { d = 58; gap = 12; }
    var total = n * d + (n - 1) * gap;
    var x0 = (VW - total) / 2;
    return { x: x0 + i * (d + gap), y: ITEMBAR.y, w: d, h: d };
  }
  function useItem(id) {
    if (G.scene !== 'play') return;
    if (id === 'saber') {
      if (!G.netOn || !NET.room) { tip('联机未连接'); sfx('deny'); return; }
      G.netPanel = true; G.sel = null; G.place = null; return;
    }
    var it = ITEMS[id];
    if (G.items[id] > 0) { tip('冷却中 ' + Math.ceil(G.items[id]) + 's'); sfx('deny'); return; }
    if (G.gold < it.cost) { tip('金币不足'); sfx('deny'); return; }
    G.gold -= it.cost;
    G.items[id] = it.cd;
    G.itemFx = 0.4;
    sfx('item');

    if (id === 'freeze') {
      G.freezeT = 3.5;
      for (var i = 0; i < G.ghosts.length; i++) burst(G.ghosts[i].x, G.ghosts[i].y, '#9ad9ff', 6, 90);
      float(VW / 2, 620, '全场急冻！', '#9ad9ff', 40);
    } else if (id === 'bomb') {
      var dmg = 150 + G.wave * 22;
      for (var k = G.ghosts.length - 1; k >= 0; k--) {
        var g = G.ghosts[k];
        damageGhost(g, dmg);
        burst(g.x, g.y, '#ffb35a', 12, 180);
      }
      for (var b = 0; b < 22; b++) burst(rnd(60, 660), rnd(200, 700), '#ffd85a', 2, 200);
      float(VW / 2, 620, '空袭轰炸！', '#ffb35a', 40);
    } else if (id === 'gold') {
      G.gold += 160; G.goldBoostT = 10;
      float(VW / 2, 620, '+160 金币 · 双倍收益', '#ffd85a', 34);
    } else if (id === 'heal') {
      G.door.broken = false; G.door.hp = G.door.max;
      G.bed.hp = Math.min(G.bed.max, G.bed.hp + G.bed.max * 0.4);
      float(DOOR.cx, DOOR.cy - 80, '门已修好', '#7dffa8', 30);
      float(BED.cx, BED.cy - 110, '+' + Math.round(G.bed.max * 0.4), '#7dffa8', 30);
    } else if (id === 'rage') {
      G.rageT = 8;
      float(VW / 2, 620, '炮台狂暴！', '#ff8adf', 36);
    } else if (id === 'shield') {
      G.shieldT = 6;
      float(VW / 2, 620, '铁幕护盾展开！', '#7dffa8', 34);
      burst(VW / 2, 640, '#7dffa8', 24, 220);
      pushFeed('你展开了铁幕护盾', '#7dffa8');
    }
  }
  /* 联机干扰道具 */
  function useSaber(id) {
    var sb = SABER_MAP[id];
    if (!sb) return;
    if (G.scene !== 'play') return;
    if (!G.netOn || !NET.room) { tip('联机未连接'); sfx('deny'); return; }
    if (G.items[id] > 0) { tip('冷却中 ' + Math.ceil(G.items[id]) + 's'); sfx('deny'); return; }
    if (G.gold < sb.cost) { tip('金币不足'); sfx('deny'); return; }
    G.gold -= sb.cost; G.items[id] = sb.cd; G.itemFx = 0.4;
    G.stat.sent++;
    netAction(sb.type, sb.value);
    G.netPanel = false;
    float(VW / 2, 620, '已派出「' + sb.tip + '」', '#ff8adf', 32);
    tip('「' + sb.tip + '」已送达对手！');
    pushFeed('你向对手使用了「' + sb.tip + '」', '#ff9de0');
    sfx('item');
  }

  /* ==================== 波次 ==================== */
  function waveStat(n) {
    var d = G.diff;
    return {
      cnt: Math.max(3, Math.round((3 + Math.round(n * 1.5)) * d.cntM)),
      hp: 78 * Math.pow(1.29, n - 1) * d.hpM,
      spd: 30 + n * 2,
      dmg: (12 + n * 3) * d.dmgM,
      coin: (12 + n * 6) * d.goldM,
      boss: (n % 4 === 0)
    };
  }
  function beginWave(n) {
    G.wave = n; G.phase = 'fight';
    var st = waveStat(n);
    G.queue = [];
    var per = Math.ceil(st.cnt / 3);
    for (var i = 0; i < st.cnt; i++) G.queue.push({ at: Math.floor(i / per) * 3.2, boss: (st.boss && i === st.cnt - 1) });
    G.spawnT = 0;
    tip('第 ' + n + ' 波猛鬼来袭！');
  }
  function spawnGhost(isBoss, hpBoost) {
    var n = Math.max(1, G.wave), st = waveStat(n);
    var hp = st.hp, dmg = st.dmg, coin = st.coin, spd = st.spd, r = 20;
    if (isBoss) { hp *= 8; dmg *= 2; coin *= 8; spd *= 0.8; r = 34; }
    if (hpBoost) hp *= hpBoost;
    G.ghosts.push({
      id: G.ghostId++, x: rnd(70, 650), y: rnd(HALL.y0 + 16, HALL.y1 - 16),
      hp: hp, max: hp, dmg: dmg, spd: spd, coin: coin, r: r,
      boss: !!isBoss, cd: rnd(0, 0.4), slow: 0, hitT: 0, t: rnd(0, 6), dead: false, fromNet: !!NET.mark
    });
    NET.mark = false;
  }
  /* 对手投放的猛鬼入场：铁幕护盾期间直接拦截并双倍缴获 */
  function spawnFromNet(isBoss, hpBoost) {
    if (G.shieldT > 0) {
      var st = waveStat(Math.max(1, G.wave));
      var coin = st.coin * (isBoss ? 8 : 1) * LOOT_BONUS * 2;
      G.gold += coin; G.stat.loot += coin; G.stat.lootKills++; G.kills++;
      float(VW / 2, 600, '铁幕拦截！缴获 +' + Math.round(coin), '#7dffa8', 32);
      pushFeed('铁幕拦截了对手的猛鬼，缴获 ' + Math.round(coin) + ' 金', '#7dffa8');
      burst(VW / 2, 640, '#7dffa8', 22, 220);
      sfx('die', 60);
      return;
    }
    NET.mark = true; spawnGhost(isBoss, hpBoost);
  }
  function killGhost(g) {
    if (g.dead) return;
    g.dead = true; G.kills++;
    G.gold += g.coin;
    float(g.x, g.y - g.r - 8, '+' + Math.round(g.coin), '#ffd85a', g.boss ? 34 : 24);
    if (g.fromNet) {
      var loot = g.coin * LOOT_BONUS;
      G.gold += loot; G.stat.loot += loot; G.stat.lootKills++;
      float(g.x, g.y - g.r - 36, '缴获 +' + Math.round(loot), '#7dffa8', 22);
    }
    burst(g.x, g.y, g.boss ? '#ff6fd8' : '#a97bff', g.boss ? 30 : 12, g.boss ? 220 : 150);
    sfx('die', 60);
  }
  function damageGhost(g, d) {
    g.hp -= d; g.hitT = 0.12;
    if (g.hp <= 0) killGhost(g);
  }

  /* ==================== 战斗更新 ==================== */
  function nearestBuilding(x, y) {
    var best = null, bd = 1e9;
    for (var i = 0; i < G.buildings.length; i++) {
      var b = G.buildings[i], d = dist(x, y, b.x, b.y);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  function ghostTarget(g) {
    if (!G.door.broken) return { x: DOOR.cx, y: DOOR.cy - 16, kind: 'door', ref: null };
    var b = nearestBuilding(g.x, g.y);
    if (b) return { x: b.x, y: b.y, kind: 'b', ref: b };
    return { x: BED.cx, y: BED.cy, kind: 'bed', ref: null };
  }
  function updateGhosts(dt) {
    var i, g;
    for (i = 0; i < G.ghosts.length; i++) {
      for (var j = i + 1; j < G.ghosts.length; j++) {
        var a = G.ghosts[i], b = G.ghosts[j];
        var dx = b.x - a.x, dy = b.y - a.y, md = a.r + b.r, d2 = dx * dx + dy * dy;
        if (d2 < md * md && d2 > 0.01) {
          var d = Math.sqrt(d2), push = (md - d) * 0.5, nx = dx / d, ny = dy / d;
          a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
        }
      }
    }
    var frozen = G.freezeT > 0;
    for (i = G.ghosts.length - 1; i >= 0; i--) {
      g = G.ghosts[i];
      if (g.dead) { G.ghosts.splice(i, 1); continue; }
      g.t += dt;
      if (g.hitT > 0) g.hitT -= dt;
      g.cd -= dt;
      var tg = ghostTarget(g);
      var need = g.r + (tg.kind === 'bed' ? 60 : 26);
      var dd = dist(g.x, g.y, tg.x, tg.y);
      if (dd > need) {
        if (!frozen) {
          var sp = g.spd * (1 - clamp(g.slow, 0, 0.8)) * dt;
          g.x += (tg.x - g.x) / dd * sp; g.y += (tg.y - g.y) / dd * sp;
        }
        g.x = clamp(g.x, 50, 670); g.y = clamp(g.y, HALL.y0, ROOM.y1 - 30);
      } else if (g.cd <= 0 && !frozen) {
        g.cd = 0.9;
        if (tg.kind === 'door') {
          G.door.hp -= g.dmg; G.door.shake = 0.22; G.door.flash = 0.2;
          burst(g.x, g.y + 10, '#d9a24a', 5, 110);
          float(DOOR.cx + rnd(-30, 30), DOOR.cy + 26, '-' + Math.round(g.dmg), '#ff8a8a', 20);
          if (G.door.hp <= 0) {
            G.door.hp = 0; G.door.broken = true; tip('门被攻破了！');
            burst(DOOR.cx, DOOR.cy, '#c98a3a', 34, 220); sfx('door');
          }
        } else if (tg.kind === 'b') {
          var b2 = tg.ref;
          b2.hp -= g.dmg * GHOST_VS_BUILDING; b2.flash = 0.18;
          burst(b2.x, b2.y, '#ff8a8a', 5, 110);
          if (b2.hp <= 0) {
            G.buildings.splice(G.buildings.indexOf(b2), 1);
            if (G.sel === b2) G.sel = null;
            burst(b2.x, b2.y, '#8b93a8', 20, 170); tip('一门炮台被摧毁了');
          }
        } else {
          G.bed.hp -= g.dmg; G.bed.shake = 0.3; G.bed.flash = 0.25;
          burst(g.x, g.y + 14, '#ff6b6b', 6, 120);
          float(BED.cx + rnd(-40, 40), BED.cy - 70, '-' + Math.round(g.dmg), '#ff8a8a', 22);
          if (G.bed.hp <= 0) { G.bed.hp = 0; endGame(false); return; }
        }
        sfx('hit', 70);
      }
    }
  }
  function findTarget(x, y, range) {
    var best = null, bd = 1e9;
    for (var i = 0; i < G.ghosts.length; i++) {
      var g = G.ghosts[i];
      if (g.dead) continue;
      var d = dist(x, y, g.x, g.y);
      if (d <= range && d < bd) { bd = d; best = g; }
    }
    return best;
  }
  function updateBuildings(dt) {
    var i, b, def;
    for (i = 0; i < G.ghosts.length; i++) G.ghosts[i].slow = 0;
    var boost = G.goldBoostT > 0 ? 2 : 1;
    for (i = G.buildings.length - 1; i >= 0; i--) {
      b = G.buildings[i]; def = TOWER[b.type];
      b.t += dt;
      if (b.flash > 0) b.flash -= dt;
      if (b.type === 'miner') {
        if (G.blackoutT <= 0) G.gold += def.income[b.lv - 1] * dt * boost;
      } else if (b.type === 'frost') {
        var rg = def.range[b.lv - 1], sl = def.slow[b.lv - 1], dp = def.dps[b.lv - 1];
        for (var k = 0; k < G.ghosts.length; k++) {
          var g = G.ghosts[k];
          if (g.dead) continue;
          if (dist(b.x, b.y, g.x, g.y) <= rg) {
            if (sl > g.slow) g.slow = sl;
            g.hp -= dp * dt;
            if (Math.random() < dt * 2.2) G.parts.push({ x: g.x + rnd(-10, 10), y: g.y + rnd(-10, 10), vx: rnd(-20, 20), vy: rnd(-60, -20), t: 0, life: 0.5, c: '#9ad9ff', s: rnd(2, 4) });
            if (g.hp <= 0) killGhost(g);
          }
        }
      } else {
        var range = def.range[b.lv - 1];
        var tgt = findTarget(b.x, b.y, range);
        if (tgt) {
          b.angle = Math.atan2(tgt.y - b.y, tgt.x - b.x);
          b.cd -= dt * (G.rageT > 0 ? 2 : 1);
          if (b.cd <= 0) {
            b.cd = 1 / def.rate[b.lv - 1];
            G.bullets.push({ x: b.x + Math.cos(b.angle) * 26, y: b.y + Math.sin(b.angle) * 26, tgt: tgt, dmg: def.dmg[b.lv - 1], spd: def.bspd, life: 1.6, t: 0, crit: b.lv >= 3 && Math.random() < 0.2 });
            b.flash = 0.08; sfx('shoot', 110);
          }
        } else b.cd = 0;
      }
    }
  }
  function updateBullets(dt) {
    for (var i = G.bullets.length - 1; i >= 0; i--) {
      var p = G.bullets[i];
      p.t += dt; p.life -= dt;
      var tg = p.tgt;
      if (!tg || tg.dead || p.life <= 0) { G.bullets.splice(i, 1); continue; }
      var d = dist(p.x, p.y, tg.x, tg.y), step = p.spd * dt;
      if (d <= step + tg.r * 0.6) {
        damageGhost(tg, p.crit ? p.dmg * 2 : p.dmg);
        burst(tg.x, tg.y, p.crit ? '#ffe27a' : '#7fe3ff', p.crit ? 10 : 5, 130);
        G.bullets.splice(i, 1); continue;
      }
      p.x += (tg.x - p.x) / d * step; p.y += (tg.y - p.y) / d * step;
    }
  }
  function updateEffects(dt) {
    var i;
    for (i = G.parts.length - 1; i >= 0; i--) {
      var p = G.parts[i]; p.t += dt;
      if (p.t >= p.life) { G.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt;
    }
    for (i = G.floats.length - 1; i >= 0; i--) {
      var f = G.floats[i]; f.t += dt;
      if (f.t >= f.life) { G.floats.splice(i, 1); continue; }
      f.y += f.vy * dt; f.vy *= (1 - 1.4 * dt);
    }
    if (G.tipT > 0) G.tipT -= dt;
    if (G.door.shake > 0) G.door.shake -= dt;
    if (G.door.flash > 0) G.door.flash -= dt;
    if (G.bed.shake > 0) G.bed.shake -= dt;
    if (G.bed.flash > 0) G.bed.flash -= dt;
    if (G.itemFx > 0) G.itemFx -= dt;
    if (G.blackoutT > 0) G.blackoutT -= dt;
    if (G.feed && G.feed.length) {
      for (i = G.feed.length - 1; i >= 0; i--) {
        G.feed[i].t -= dt;
        if (G.feed[i].t <= 0) G.feed.splice(i, 1);
      }
    }
    for (var k in G.items) if (G.items[k] > 0) G.items[k] -= dt;
  }

  function endGame(win) {
    // 结算只允许发生一次：战绩记录必须在这里做，
    // 不能依赖结算页被渲染那一帧（否则切后台/未渲染就丢战绩）
    if (G.recDone) return;
    G.recDone = true;
    G.scene = win ? 'win' : 'lose';
    G.netPanel = false;
    sfx(win ? 'win' : 'lose');
    if (G.netOn) { NET.finished = true; NET.win = win; netSync(); }
    recordResult(win);
    G.btns = [];
    cloudSubmit(win);
  }
  /* 对手先撑不住 → 立刻结算本局（不必自己再打完） */
  function checkNetVerdict() {
    if (!G || G.scene !== 'play' || !G.netOn) return;
    if (NET.opp && NET.opp.finished && !NET.opp.win) {
      tip('对手已被猛鬼抓走！');
      endGame(true);
    }
  }
  function recordResult(win) {
    if (!NET.record) NET.record = { win: 0, lose: 0 };
    NET.record[win ? 'win' : 'lose']++;    if (A.onRecord) { try { A.onRecord(NET.record); } catch (e) { } }
  }

  function updatePlay(dt) {
    G.time += dt;
    if (G.freezeT > 0) G.freezeT -= dt;
    if (G.rageT > 0) G.rageT -= dt;
    if (G.goldBoostT > 0) G.goldBoostT -= dt;
    if (G.blackoutT > 0) G.blackoutT -= dt;
    if (G.shieldT > 0) {
      G.shieldT -= dt;
      if (G.shieldT <= 0) { G.shieldT = 0; pushFeed('铁幕护盾结束', '#8b93a8'); }
    }

    G.gold += 1 * dt * (G.goldBoostT > 0 ? 2 : 1) * G.diff.goldM;
    G.income = 1;
    if (G.blackoutT <= 0) {
      for (var i = 0; i < G.buildings.length; i++) if (G.buildings[i].type === 'miner') G.income += TOWER.miner.income[G.buildings[i].lv - 1];
    }

    if (G.phase === 'prep') {
      G.timer -= dt;
      if (G.timer <= 0) beginWave(G.wave + 1);
    } else {
      G.spawnT += dt;
      while (G.queue.length && G.queue[0].at <= G.spawnT) { var q = G.queue.shift(); spawnGhost(q.boss); }
      if (!G.queue.length && !G.ghosts.length) {
        if (G.wave >= G.diff.waves) { endGame(true); return; }
        G.phase = 'prep'; G.timer = PREP_TIME;
        tip('第 ' + G.wave + ' 波清空！' + PREP_TIME + '秒后下一波');
      }
    }
    updateBuildings(dt); updateGhosts(dt); updateBullets(dt); updateEffects(dt);
  }

  /* ==================== 联机 ==================== */
  var NET = {
    room: null, uid: '', nick: '', step: 'menu', code: '', input: '', err: '',
    syncT: 0, busy: false,
    opp: { nick: '对手', wave: 0, kills: 0, bedPct: 1, doorPct: 1, alive: true, finished: false, win: false, sent: 0, lootKills: 0, time: 0, shield: 0 },
    prev: null, record: { win: 0, lose: 0 },
    finished: false, win: false, mark: false, baseUrl: '',
    conn: 'idle', hint: '', pending: null,
    diffIdx: 1, invite: '', autoJoin: ''
  };

  function api(path, body) {
    if (!A.request) return { then: function () { return { 'catch': function () { } }; } };
    return A.request({ url: (NET.baseUrl || '') + path, method: 'POST', body: body || {}, timeout: 6000 });
  }

  /* 依次尝试候选服务器地址，ping 通即锁定；由适配层提供候选列表 */
  function requestProbe() {
    netProbe(A.getBaseList ? A.getBaseList() : []);
  }
  function netProbe(list) {
    if (!A.request) { NET.conn = 'fail'; NET.hint = '当前环境不支持联网'; return; }
    var arr = (list || []).slice();
    // 适配层直接指定的地址（如 ?server=）也算候选，避免被后续探测覆盖掉
    if (NET.baseUrl && arr.indexOf(NET.baseUrl) < 0) arr.unshift(NET.baseUrl);
    NET.conn = 'probing'; NET.hint = '正在检测服务器…';
    var i = 0;
    function done() {
      /* 邀请链接：连上后直接进入房间 */
      if (NET.autoJoin) {
        var code = NET.autoJoin; NET.autoJoin = '';
        if (G) G.scene = 'net';
        NET.step = 'join'; NET.input = code; NET.err = '';
        netJoin();
        return;
      }
      if (NET.pending) { var f = NET.pending; NET.pending = null; f(); }
    }
    function next() {
      if (i >= arr.length) {
        NET.conn = 'fail';
        NET.hint = NET.hintFail || '未检测到联机服务器，请运行 node server/server.js';
        return;
      }
      var cand = arr[i++];
      A.request({ url: cand + '/api/ping', method: 'POST', body: {}, timeout: 2500 })
        .then(function (r) {
          if (r && r.ok) {
            NET.baseUrl = cand; NET.conn = 'ok'; NET.err = '';
            NET.hint = '已连接 ' + (cand || '同源');
            if (A.onBase) A.onBase(cand, true);
            done();
          } else next();
        })['catch'](function () { next(); });
    }
    next();
  }
  /* 尚未连通时先自动重连，连通后再执行动作 */
  function ensureConn(then) {
    if (NET.conn === 'ok') { then(); return; }
    NET.err = '正在连接服务器…';
    NET.pending = then;
    requestProbe();
  }
  function myState() {
    return {
      uid: NET.uid, nick: NET.nick,
      wave: G ? G.wave : 0, kills: G ? G.kills : 0,
      bedPct: G ? G.bed.hp / G.bed.max : 1,
      doorPct: G ? (G.door.broken ? 0 : G.door.hp / G.door.max) : 1,
      alive: G ? G.bed.hp > 0 : true,
      finished: NET.finished, win: NET.win,
      time: G ? Math.round(G.time) : 0,
      sent: G ? G.stat.sent : 0,
      lootKills: G ? G.stat.lootKills : 0,
      shield: G ? Math.round(G.shieldT * 10) / 10 : 0
    };
  }
  function netCreate() {
    if (NET.busy) return;
    ensureConn(function () {
      NET.busy = true; NET.err = '';
      api('/api/room', { action: 'create', uid: NET.uid, nick: NET.nick, diff: NET.diffIdx }).then(function (res) {
        NET.busy = false;
        if (!res || !res.ok) { NET.err = (res && res.msg) || '服务器不可用'; return; }
        NET.room = res.room; NET.code = res.room.code; NET.step = 'wait'; NET.err = '';
        NET.invite = inviteUrl(res.room.code);
      })['catch'](function () { NET.busy = false; NET.conn = 'fail'; NET.err = '连接中断，请重试'; });
    });
  }
  /* 快速匹配：优先进同难度等待房，没有就自己开一间 */
  function netQuick() {
    if (NET.busy) return;
    ensureConn(function () {
      NET.busy = true; NET.err = '';
      api('/api/room', { action: 'quick', uid: NET.uid, nick: NET.nick, diff: NET.diffIdx }).then(function (res) {
        NET.busy = false;
        if (!res || !res.ok) { NET.err = (res && res.msg) || '服务器不可用'; return; }
        NET.room = res.room; NET.code = res.room.code; NET.step = 'wait';
        NET.invite = inviteUrl(res.room.code);
        if (res.room.diff != null) NET.diffIdx = res.room.diff;
        NET.err = res.matched === 'new' ? '已开好房间，把房间码发给好友即可' : '';
      })['catch'](function () { NET.busy = false; NET.conn = 'fail'; NET.err = '连接中断，请重试'; });
    });
  }
  function inviteUrl(code) {
    var base = (A.pageUrl || NET.baseUrl || '').replace(/[?#].*$/, '');
    if (!base) return '';
    return base + '?room=' + code;
  }
  function shortUrl(u) {
    if (!u) return '';
    var s = u.replace(/^https?:\/\//, '');
    return s.length > 44 ? (s.slice(0, 41) + '...') : s;
  }
  function netJoin() {
    if (NET.busy || NET.input.length !== 4) return;
    ensureConn(function () {
      NET.busy = true; NET.err = '';
      api('/api/room', { action: 'join', code: NET.input, uid: NET.uid, nick: NET.nick }).then(function (res) {
        NET.busy = false;
        if (!res || !res.ok) { NET.err = (res && res.msg) || '房间不存在'; return; }
        NET.room = res.room; NET.code = res.room.code; NET.step = 'wait'; NET.err = '';
        if (res.room.diff != null) NET.diffIdx = res.room.diff;
        NET.invite = inviteUrl(res.room.code);
      })['catch'](function () { NET.busy = false; NET.conn = 'fail'; NET.err = '连接中断，请重试'; });
    });
  }
  function netAction(type, value) {
    if (!NET.room) return;
    api('/api/action', { roomId: NET.room.id, uid: NET.uid, type: type, value: value });
  }
  function pushFeed(msg, col) {
    if (!G || !G.feed) return;
    G.feed.push({ msg: msg, col: col || '#c9d2e6', t: 4.2 });
    if (G.feed.length > 4) G.feed.shift();
  }
  function netStartBattle() {
    if (!NET.room) return;
    var diff = (NET.room.diff != null) ? NET.room.diff : G.diffIdx;
    NET.step = 'playing';
    NET.finished = false; NET.win = false; NET.prev = null;
    if (NET.record) { NET.record.win = NET.record.win || 0; }
    startPlay(diff, true);
  }
  function netSync() {
    if (!NET.room) return;
    api('/api/state', { roomId: NET.room.id, uid: NET.uid, st: myState() }).then(function (res) {
      if (!res || !res.ok) { if (res && res.msg) NET.err = res.msg; return; }
      if (res.room) NET.room = res.room;
      if (res.opp) { trackOpp(res.opp); NET.opp = res.opp; }
      /* 收到对手状态立即判定：对手出局就当场结算，不必等下一帧 */
      checkNetVerdict();
      if (res.events && G && G.scene === 'play') {
        for (var i = 0; i < res.events.length; i++) {
          var e = res.events[i], k;
          if (e.type === 'send_ghost' || e.type === 'ghost_horde') {
            var n = e.value || 1;
            var boost = (e.type === 'send_ghost' ? 1.2 : 1) * G.diff.hpM;
            for (k = 0; k < n; k++) spawnFromNet(false, boost);
            G.stat.got += n;
            tip('对手给你送来了 ' + n + ' 只猛鬼！击杀可缴获赏金');
            pushFeed('对手投放了 ' + n + ' 只猛鬼', '#ff7b7b');
            sfx('door');
          } else if (e.type === 'ghost_king') {
            spawnFromNet(true, 0.55 * G.diff.hpM);
            G.stat.got += 1;
            tip('鬼王降临！小心应付');
            pushFeed('鬼王杀进了你的宿舍！', '#ff5d7a');
            sfx('door');
          } else if (e.type === 'power_out') {
            G.blackoutT = e.value || 8;
            tip('有人拉了你的电闸！发电机停转 ' + Math.round(G.blackoutT) + ' 秒');
            pushFeed('遭到偷电拉闸，发电机停摆！', '#ffb35a');
            sfx('deny');
          } else if (e.type === 'door_curse') {
            curseDoor(e.value || 35);
          }
        }
      }
    })['catch'](function () { });
  }
  /* 对手动态 → 战报 */
  function trackOpp(o) {
    var p = NET.prev;
    if (!p) { NET.prev = { wave: o.wave, bedPct: o.bedPct, doorPct: o.doorPct, finished: o.finished, shield: o.shield || 0 }; return; }
    if (!p.shield && o.shield > 0) pushFeed('对手展开了铁幕，暂缓投放', '#7dffa8');
    if (o.wave > p.wave && o.wave > 0) pushFeed('对手推进到第 ' + o.wave + ' 波', '#8fd6ff');
    if (p.doorPct > 0 && o.doorPct <= 0) pushFeed('对手的宿舍门被打爆了', '#ffd85a');
    if (p.bedPct > 0.6 && o.bedPct <= 0.6) pushFeed('对手床位跌破 60%', '#ff9d5a');
    if (p.bedPct > 0.3 && o.bedPct <= 0.3) pushFeed('对手快撑不住了！', '#7dffa8');
    if (!p.finished && o.finished) pushFeed(o.win ? '对手已经通关，你要更快！' : '对手已被猛鬼抓走！', o.win ? '#ff7b7b' : '#7dffa8');
    p.wave = o.wave; p.bedPct = o.bedPct; p.doorPct = o.doorPct; p.finished = o.finished; p.shield = o.shield || 0;
  }
  /* 破门咒：门按百分比掉血，门已破则改为灼烧床位 */
  function curseDoor(pct) {
    sfx('door');
    if (G.door.broken) {
      var hurt = Math.ceil(G.bed.max * 0.12);
      G.bed.hp = Math.max(1, G.bed.hp - hurt); G.bed.shake = 0.4; G.bed.flash = 0.3;
      float(BED.cx, BED.cy - 90, '-' + hurt, '#ff7b7b', 26);
      tip('破门咒绕过了你的破门，床位受损！');
      pushFeed('破门咒攻入了你的床位！', '#ff7b7b');
      return;
    }
    var lose = Math.ceil(G.door.hp * clamp(pct, 0, 100) / 100);
    G.door.hp -= lose; G.door.flash = 0.3; G.door.shake = 0.35;
    float(DOOR.cx, DOOR.cy - 60, '-' + lose, '#ff7b7b', 26);
    burst(DOOR.cx, DOOR.cy, '#b48bff', 18, 170);
    if (G.door.hp <= 0) {
      G.door.hp = 0; G.door.broken = true;
      tip('门被对手的破门咒轰碎了！');
      pushFeed('你的宿舍门被破门咒轰碎！', '#ff7b7b');
      return;
    }
    tip('遭到破门咒，宿舍门 -' + pct + '%');
    pushFeed('遭到破门咒，宿舍门受损！', '#ff7b7b');
  }
  function battleVerdict() {
    if (!G.netOn) return null;
    var me = { wave: G.wave, kills: G.kills, time: G.time, win: G.scene === 'win' };
    var op = NET.opp;
    // 我先倒下：对手还在坚守 → 直接判负（规则是"先撑不住的一方判负"）
    if (!me.win && !op.finished) return { done: true, win: false, text: '你先撑不住了，对手仍在坚守' };
    if (!op.finished) return { done: false, win: false, text: '对手仍在坚持…' };
    if (me.win && !op.win) return { done: true, win: true, text: '你守住了宿舍，对手倒下了' };
    if (!me.win && op.win) return { done: true, win: false, text: '对手通关，你被猛鬼抓走' };
    if (me.win && op.win) {
      if (me.time <= op.time) return { done: true, win: true, text: '双方通关，你更快（' + Math.round(me.time) + 's vs ' + Math.round(op.time) + 's）' };
      return { done: true, win: false, text: '双方通关，对手更快（' + Math.round(op.time) + 's vs ' + Math.round(me.time) + 's）' };
    }
    if (me.wave > op.wave) return { done: true, win: true, text: '你坚持到第 ' + me.wave + ' 波，对手第 ' + op.wave + ' 波' };
    if (me.wave < op.wave) return { done: true, win: false, text: '对手坚持到第 ' + op.wave + ' 波，你第 ' + me.wave + ' 波' };
    if (me.kills >= op.kills) return { done: true, win: true, text: '同波次，你击杀更多（' + me.kills + ' vs ' + op.kills + '）' };
    return { done: true, win: false, text: '同波次，对手击杀更多（' + op.kills + ' vs ' + me.kills + '）' };
  }

  /* ==================== 按钮 ==================== */
  function mk(id, title, sub, enabled, tone, icon, shape) {
    return { id: id, title: title, sub: sub, enabled: enabled !== false, tone: tone || 'gold', icon: icon || null, shape: shape || 'rect' };
  }
  function layout() {
    var list = [], i;
    if (G.scene === 'menu') {
      list.push(mk('solo', '单人闯关', '选择难度开始', true, 'gold', 'solo'));
      list.push(mk('net', '联机对战', '互相投放干扰，比谁先倒下', true, 'purple', 'net'));
      if (A.cloud) {
        list.push(mk('cloud', G.cloud.signed ? '云端战绩榜' : '登录 · 云端战绩', G.cloud.signed ? ('已登录：' + G.cloud.nick) : '登录后战绩上排行榜', true, 'blue', null));
      }
      list.push(mk('help', '玩法说明', '', true, 'gray', null));
      for (i = 0; i < list.length; i++) { list[i].x = 160; list[i].y = 700 + i * 116; list[i].w = 400; list[i].h = 96; }
      G.btns = list; return;
    }
    if (G.scene === 'diff') {
      for (i = 0; i < DIFFS.length; i++) {
        var d = DIFFS[i];
        var b = mk('diff_' + i, d.name, d.desc, true, 'gray', null);
        b.x = 50 + (i % 2) * 320; b.y = 470 + ((i / 2) | 0) * 200; b.w = 300; b.h = 170;
        b.tint = d.tint;
        list.push(b);
      }
      var back = mk('back', '返回', '', true, 'gray', null);
      back.x = 260; back.y = 900; back.w = 200; back.h = 80;
      list.push(back);
      G.btns = list; return;
    }
    if (G.scene === 'net') {
      if (NET.step === 'menu') {
        for (i = 0; i < DIFFS.length; i++) {
          var d = DIFFS[i], on = i === NET.diffIdx;
          var db = mk('ndiff_' + i, d.name, d.waves + '波', true, on ? 'gold' : 'gray', null);
          db.x = 40 + i * 165; db.y = 414; db.w = 150; db.h = 72; db.on = on;
          list.push(db);
        }
        list.push(mk('ncreate', '创建房间', '生成房间码 / 邀请链接', true, 'green', 'net'));
        list.push(mk('njoin', '加入房间', '输入好友的 4 位房间码', true, 'blue', null));
        list.push(mk('nquick', '快速匹配', '自动进入在等人的房间', true, 'purple', null));
        list.push(mk('mrecon', '重新检测服务器', NET.conn === 'ok' ? '已连接，可点此重连' : '查找联机服务', true, 'gray', null));
        list.push(mk('back', '返回', '', true, 'gray', null));
        for (i = 4; i < list.length; i++) { list[i].x = 160; list[i].y = 546 + (i - 4) * 100; list[i].w = 400; list[i].h = 88; }
      } else if (NET.step === 'join') {
        var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
        for (i = 0; i < keys.length; i++) {
          var k = keys[i];
          var bb = mk('k_' + k, k === 'del' ? '删除' : (k === 'ok' ? '确定' : k), '', (k !== 'ok') || NET.input.length === 4, k === 'ok' ? 'green' : (k === 'del' ? 'red' : 'gray'), null);
          bb.x = 156 + (i % 3) * 144; bb.y = 520 + ((i / 3) | 0) * 116; bb.w = 120; bb.h = 96;
          list.push(bb);
        }
        var bk = mk('back', '返回', '', true, 'gray', null);
        bk.x = 260; bk.y = 1000; bk.w = 200; bk.h = 80;
        list.push(bk);
      } else if (NET.step === 'wait') {
        var ready = NET.room && NET.room.status === 'playing';
        if (NET.invite) {
          var cp = mk('ncopy', '复制邀请链接', '发给微信好友，点开直接进房', true, 'blue', null);
          cp.x = 130; cp.y = 700; cp.w = 460; cp.h = 80;
          list.push(cp);
        }
        var go = mk('ngo', ready ? '开始对战' : '等待对手加入…', ready ? '双方已就位' : '把房间码或链接发给好友', ready, ready ? 'gold' : 'gray', null);
        go.x = 160; go.y = 800; go.w = 400; go.h = 100;
        list.push(go);
        var cc = mk('back', '退出房间', '', true, 'gray', null);
        cc.x = 160; cc.y = 920; cc.w = 400; cc.h = 90;
        list.push(cc);
      }
      G.btns = list; return;
    }
    if (G.scene === 'play') {
      if (G.netPanel) { G.btns = saberLayout(); return; }
      var arr = itemList();
      for (i = 0; i < arr.length; i++) {
        var id = arr[i], it = ITEMS[id];
        var p = itemBtnPos(i, arr.length);
        var usable = G.items[id] <= 0 && G.gold >= it.cost;
        var ib = mk('item_' + id, it.name, '', usable, 'item', it.icon, 'round');
        ib.x = p.x; ib.y = p.y; ib.w = p.w; ib.h = p.h;
        ib.cdRatio = clamp(G.items[id] / it.cd, 0, 1);
        ib.cost = it.cost;
        list.push(ib);
      }
      if (G.sel) {
        var s = G.sel, c = lvCost(s);
        list.push(mk('up', c < 0 ? '已满级' : '升级 Lv' + (s.lv + 1), c < 0 ? '' : '花费 ' + c, c >= 0 && G.gold >= c, 'blue', 'up'));
        list.push(mk('sell', '拆除', '返还 ' + sellBack(s), true, 'red', 'sell'));
        list.push(mk('cancel', '取消', '', true, 'gray', null));
      } else {
        for (i = 0; i < TOWER_ORDER.length; i++) {
          var t = TOWER_ORDER[i], df = TOWER[t];
          list.push(mk('build_' + t, df.name, '造价 ' + df.cost[0], G.gold >= df.cost[0], 'gold', t));
        }
        if (G.door.broken) list.push(mk('repair', '重建门', '花费 ' + DOOR_LV.rebuild[G.door.lv - 1], G.gold >= DOOR_LV.rebuild[G.door.lv - 1], 'green', 'door'));
        else {
          var full = G.door.hp >= G.door.max;
          list.push(mk('repair', full ? '门完好' : '修门', full ? '' : '花费 ' + doorRepairCost(), !full && G.gold >= doorRepairCost(), 'green', 'door'));
        }
        if (G.door.lv >= 4) list.push(mk('doorup', '门已满级', '', false, 'gray', 'door'));
        else {
          var dc = DOOR_LV.up[G.door.lv - 1];
          list.push(mk('doorup', '加固门 Lv' + (G.door.lv + 1), '花费 ' + dc, G.gold >= dc, 'blue', 'door'));
        }
        list.push(mk('speed', G.speed === 1 ? '加速 ×2' : '回到 ×1', '游戏速度', true, G.speed === 1 ? 'purple' : 'gray', 'speed'));
      }
      var bw = 213, bh = 96, gap = 20, x0 = 20, y0 = 1014, idx = 0;
      for (i = arr.length; i < list.length; i++) {
        var col = idx % 3, row = (idx / 3) | 0;
        list[i].x = x0 + col * (bw + gap); list[i].y = y0 + row * (bh + gap); list[i].w = bw; list[i].h = bh;
        idx++;
      }
      G.btns = list; return;
    }
    if ((G.scene === 'win' || G.scene === 'lose') && A.cloud) {
      list.push(mk('cloud', G.cloud.signed ? '云端战绩榜' : '登录 · 云端战绩', G.cloud.msg || '登录后战绩上排行榜', true, 'blue', null));
    }
    list.push(mk('again', '再来一局', '', true, 'gold', null));
    list.push(mk('menu', '返回主菜单', '', true, 'gray', null));
    for (i = 0; i < list.length; i++) { list[i].x = 160; list[i].y = 800 + i * 116; list[i].w = 400; list[i].h = 96; }
    G.btns = list;
  }

  /* 干扰面板的按钮布局：5 个干扰手段 + 关闭 */
  function saberLayout() {
    var list = [], i;
    for (i = 0; i < SABERS.length; i++) {
      var s = SABERS[i];
      var ok = G.items[s.id] <= 0 && G.gold >= s.cost && !!NET.room;
      var b = mk('sab_' + s.id, s.name, G.items[s.id] > 0 ? ('冷却 ' + Math.ceil(G.items[s.id]) + 's') : (s.desc + '　' + s.cost + '金'), ok, 'purple', s.icon);
      b.cool = Math.ceil(G.items[s.id]);
      list.push(b);
    }
    list.push(mk('sab_close', '关闭', '稍后再来', true, 'gray', null));
    for (i = 0; i < list.length; i++) {
      list[i].x = 60; list[i].y = 336 + i * 104; list[i].w = 600; list[i].h = 88;
    }
    return list;
  }

  function doAction(id) {
    if (id === 'solo') { G.scene = 'diff'; return; }
    if (id === 'help') { G.scene = 'help'; return; }
    if (id.indexOf('sab_') === 0) {
      var sid = id.slice(4);
      if (sid === 'close') G.netPanel = false;
      else useSaber(sid);
      lastKey = '';
      return;
    }
    if (id === 'back') {
      if (G.scene === 'net') { NET.step = 'menu'; NET.room = null; }
      else G.scene = 'menu';
      return;
    }
    if (id === 'menu') { G.scene = 'menu'; NET.room = null; NET.step = 'menu'; NET.finished = false; return; }
    if (id === 'cloud') { openCloudPanel(); return; }
    if (id === 'again') {
      if (G.netOn && NET.room) { NET.finished = false; NET.win = false; NET.step = 'wait'; G.scene = 'net'; }
      else startPlay(G.diffIdx, false);
      return;
    }
    if (id.indexOf('diff_') === 0) { startPlay(parseInt(id.slice(5), 10) || 0, false); return; }
    if (id === 'net') {
      NET.step = 'menu'; NET.err = ''; G.scene = 'net';
      if (!A.request) NET.err = '当前环境不支持联网（请用 server.js 打开）';
      else if (NET.conn !== 'ok') requestProbe();
      return;
    }
    if (id === 'mrecon') { NET.err = ''; NET.conn = 'idle'; requestProbe(); return; }
    if (id.indexOf('ndiff_') === 0) { NET.diffIdx = parseInt(id.slice(6), 10) || 0; lastKey = ''; return; }
    if (id === 'ncreate') { netCreate(); return; }
    if (id === 'njoin') { NET.step = 'join'; NET.input = ''; NET.err = ''; return; }
    if (id === 'nquick') { netQuick(); return; }
    if (id === 'ncopy') {
      if (NET.invite && A.copy) {
        var okcp = A.copy(NET.invite);
        NET.err = okcp ? ('已复制邀请链接，发给好友即可（房间码 ' + NET.code + '）') : ('复制失败，请直接把房间码 ' + NET.code + ' 告诉好友');
      } else {
        NET.err = '当前环境不支持复制，请把房间码 ' + NET.code + ' 发给好友';
      }
      return;
    }
    if (id.indexOf('k_') === 0) {
      var k = id.slice(2);
      if (k === 'del') NET.input = NET.input.slice(0, -1);
      else if (k === 'ok') { if (NET.input.length === 4) netJoin(); }
      else if (NET.input.length < 4) NET.input += k;
      return;
    }
    if (id === 'ngo') { netStartBattle(); return; }
    if (id.indexOf('item_') === 0) { useItem(id.slice(5)); return; }
    if (G.scene !== 'play') return;
    if (id === 'cancel') { G.sel = null; return; }
    if (id === 'speed') { G.speed = G.speed === 1 ? 2 : 1; return; }
    if (id === 'repair') { tryRepairDoor(); return; }
    if (id === 'doorup') { tryUpgradeDoor(); return; }
    if (id === 'up' && G.sel) { tryUpgrade(G.sel); return; }
    if (id === 'sell' && G.sel) { trySell(G.sel); return; }
    if (id.indexOf('build_') === 0) {
      var t = id.slice(6);
      if (G.place === t) G.place = null;
      else { G.place = t; tip('点击空地放置「' + TOWER[t].name + '」'); }
      return;
    }
  }

  function hitBtn(x, y) {
    var list = G.btns || [];
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }
  function onPointer(rx, ry) {
    if (!G) return;
    if (AC && AC.state === 'suspended' && AC.resume) { try { AC.resume(); } catch (e) { } }
    var x = (rx - T.ox) / T.s, y = (ry - T.oy) / T.s;
    var b = hitBtn(x, y);
    if (b) {
      if (!b.enabled) { sfx('deny'); if (G.scene === 'play' && b.id.indexOf('item_') === 0) tip('冷却中或金币不足'); return; }
      doAction(b.id); return;
    }
    if (G.scene === 'help') { G.scene = 'menu'; return; }
    if (G.scene !== 'play') return;
    var cell = cellAt(x, y);
    if (cell) {
      var bd = buildingAt(cell.c, cell.r);
      if (bd) { G.sel = bd; G.place = null; return; }
      if (G.place) { tryBuild(cell.c, cell.r, G.place); return; }
      tip('先选择要建造的设施，再点空地'); return;
    }
    G.sel = null; G.place = null;
  }

  /* ==================== 绘制 ==================== */
  function drawFloor() {
    var c = ctx;
    c.fillStyle = '#171d2e';
    c.fillRect(MAP_X, HALL.y0, MAP_W, HALL.y1 - HALL.y0);
    c.strokeStyle = 'rgba(255,255,255,0.045)'; c.lineWidth = 2;
    for (var gx = MAP_X; gx <= MAP_X + MAP_W; gx += 55) { c.beginPath(); c.moveTo(gx, HALL.y0); c.lineTo(gx, HALL.y1); c.stroke(); }
    for (var gy = HALL.y0; gy <= HALL.y1; gy += 46) { c.beginPath(); c.moveTo(MAP_X, gy); c.lineTo(MAP_X + MAP_W, gy); c.stroke(); }
    text(c, '走 廊 · 猛鬼从此来袭', 360, HALL.y0 + 18, 21, 'rgba(160,170,200,0.5)');

    c.fillStyle = '#3a2f26';
    c.fillRect(ROOM.x0, ROOM.y0, ROOM.x1 - ROOM.x0, ROOM.y1 - ROOM.y0);
    c.strokeStyle = 'rgba(0,0,0,0.16)'; c.lineWidth = 3;
    for (var wx = ROOM.x0 + 34; wx < ROOM.x1; wx += 68) { c.beginPath(); c.moveTo(wx, ROOM.y0); c.lineTo(wx, ROOM.y1); c.stroke(); }
    var grd = c.createLinearGradient(0, ROOM.y0, 0, ROOM.y1);
    grd.addColorStop(0, 'rgba(0,0,0,0.30)'); grd.addColorStop(0.35, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.35)');
    c.fillStyle = grd; c.fillRect(ROOM.x0, ROOM.y0, ROOM.x1 - ROOM.x0, ROOM.y1 - ROOM.y0);

    c.fillStyle = '#333c52';
    c.fillRect(MAP_X, WALL.y0, DOOR.x0 - MAP_X, WALL.y1 - WALL.y0);
    c.fillRect(DOOR.x1, WALL.y0, MAP_X + MAP_W - DOOR.x1, WALL.y1 - WALL.y0);
    c.fillStyle = '#2b3346';
    c.fillRect(MAP_X - 8, WALL.y0, 8, ROOM.y1 - WALL.y0);
    c.fillRect(MAP_X + MAP_W, WALL.y0, 8, ROOM.y1 - WALL.y0);
  }
  function drawGridSlots() {
    var c = ctx;
    for (var r = 0; r < GRID.rows; r++) for (var col = 0; col < GRID.cols; col++) {
      var p = cellCenter(col, r);
      if (buildingAt(col, r)) continue;
      var x = p.x - GRID.cw / 2, y = p.y - GRID.ch / 2;
      c.setLineDash([8, 7]); c.lineWidth = 2;
      c.strokeStyle = G.place ? 'rgba(255,214,90,0.55)' : 'rgba(255,255,255,0.10)';
      rr(c, x + 4, y + 4, GRID.cw - 8, GRID.ch - 8, 12); c.stroke();
      c.setLineDash([]);
      if (G.place) { c.fillStyle = 'rgba(255,214,90,0.07)'; rr(c, x + 4, y + 4, GRID.cw - 8, GRID.ch - 8, 12); c.fill(); }
    }
    if (G.sel) {
      c.lineWidth = 4; c.strokeStyle = '#ffd85a';
      rr(c, G.sel.x - GRID.cw / 2, G.sel.y - GRID.ch / 2, GRID.cw, GRID.ch, 14); c.stroke();
      var def = TOWER[G.sel.type];
      if (G.sel.type !== 'miner') {
        c.beginPath(); c.arc(G.sel.x, G.sel.y, def.range[G.sel.lv - 1], 0, Math.PI * 2);
        c.fillStyle = 'rgba(120,200,255,0.07)'; c.fill();
        c.strokeStyle = 'rgba(120,200,255,0.35)'; c.lineWidth = 2; c.stroke();
      }
    }
  }
  function drawDoor() {
    var c = ctx, d = G.door;
    var sx = d.shake > 0 ? rnd(-3, 3) : 0;
    var x0 = DOOR.x0, x1 = DOOR.x1, y0 = WALL.y0 - 2, y1 = WALL.y1 + 2;
    if (d.broken) {
      c.fillStyle = '#0d0f18'; c.fillRect(x0, y0, x1 - x0, y1 - y0);
      c.strokeStyle = 'rgba(255,120,90,0.5)'; c.lineWidth = 3;
      c.beginPath();
      for (var i = 0; i <= 8; i++) {
        var px = x0 + (x1 - x0) * (i / 8), py = y0 + (i % 2 ? 10 : -4);
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.stroke();
      text(c, '门已破损', DOOR.cx, y0 + 14, 19, '#ff8a7a');
      return;
    }
    c.fillStyle = '#4a5570'; c.fillRect(x0 - 6, y0 - 4, x1 - x0 + 12, y1 - y0 + 8);
    var cols = ['#8a5a33', '#7d7f8c', '#5f7fa8', '#8a6bd8'];
    c.save(); c.translate(sx, 0);
    c.fillStyle = cols[d.lv - 1]; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (d.flash > 0) { c.fillStyle = 'rgba(255,90,70,' + (0.5 * (d.flash / 0.2)) + ')'; c.fillRect(x0, y0, x1 - x0, y1 - y0); }
    c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = 2;
    for (var k = 1; k <= 3; k++) { var yy = y0 + (y1 - y0) * (k / 4); c.beginPath(); c.moveTo(x0 + 6, yy); c.lineTo(x1 - 6, yy); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,0.35)';
    for (var j = 0; j < 6; j++) {
      var jx = x0 + 18 + j * ((x1 - x0 - 36) / 5);
      c.beginPath(); c.arc(jx, y0 + 8, 3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(jx, y1 - 8, 3, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = '#ffd85a'; c.beginPath(); c.arc(x1 - 22, (y0 + y1) / 2, 6, 0, Math.PI * 2); c.fill();
    c.restore();
    var bw = 240, bx = DOOR.cx - bw / 2, by = y0 - 34;
    bar(c, bx, by, bw, 16, d.hp / d.max, d.hp / d.max > 0.35 ? '#5ad17a' : '#ff6b6b');
    text(c, '宿舍门 Lv' + d.lv, bx, by - 12, 20, '#cdd6ea', 'left');
    text(c, fmt(d.hp) + ' / ' + fmt(d.max), bx + bw, by + 8, 18, '#ffffff', 'right');
  }
  function drawBed() {
    var c = ctx, b = G.bed;
    var sx = b.shake > 0 ? rnd(-4, 4) : 0, sy = b.shake > 0 ? rnd(-2, 2) : 0;
    var x = BED.cx - BED.w / 2 + sx, y = BED.cy - BED.h / 2 + sy;
    c.save();
    c.fillStyle = '#6b4a2f'; rr(c, x, y, BED.w, BED.h, 16); c.fill();
    c.fillStyle = '#7d573a'; rr(c, x + 8, y + 8, BED.w - 16, BED.h - 16, 12); c.fill();
    c.fillStyle = '#e8e2d4'; rr(c, x + 12, y + 16, BED.w - 24, BED.h - 30, 10); c.fill();
    c.fillStyle = '#ffffff'; rr(c, x + 22, y + 22, 78, 44, 12); c.fill();
    var breathe = Math.sin(G.time * 2.2) * 3;
    c.fillStyle = '#5aa9e6'; rr(c, x + 78, y + 20 + breathe, BED.w - 100, BED.h - 40, 14); c.fill();
    c.fillStyle = '#4b93cc'; rr(c, x + 78, y + BED.h - 34 + breathe, BED.w - 100, 14, 7); c.fill();
    var hx = x + 61, hy = y + 44;
    c.fillStyle = '#ffd9b3'; c.beginPath(); c.arc(hx, hy, 26, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3b2a20'; c.beginPath(); c.arc(hx, hy - 8, 26, Math.PI, Math.PI * 2); c.fill();
    c.strokeStyle = '#3b2a20'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(hx - 14, hy + 2); c.quadraticCurveTo(hx - 8, hy + 8, hx - 2, hy + 2); c.stroke();
    c.beginPath(); c.moveTo(hx + 2, hy + 2); c.quadraticCurveTo(hx + 8, hy + 8, hx + 14, hy + 2); c.stroke();
    var zt = (G.time % 3) / 3;
    c.globalAlpha = clamp(1 - zt, 0, 1);
    text(c, 'Z', x + 96, y + 8 - zt * 30, 24 + zt * 8, '#ffffff');
    c.globalAlpha = 1;
    if (b.flash > 0) { c.fillStyle = 'rgba(255,60,60,' + (0.35 * (b.flash / 0.25)) + ')'; rr(c, x, y, BED.w, BED.h, 16); c.fill(); }
    c.restore();
    var bw = 200, bx = BED.cx - bw / 2, by = y - 34;
    bar(c, bx, by, bw, 14, b.hp / b.max, b.hp / b.max > 0.35 ? '#5ad17a' : '#ff6b6b');
    text(c, '你的床位', bx, by - 11, 19, '#cdd6ea', 'left');
    text(c, fmt(b.hp) + ' / ' + fmt(b.max), bx + bw, by + 7, 17, '#ffffff', 'right');
  }
  function drawBuilding(b) {
    var c = ctx, def = TOWER[b.type], x = b.x, y = b.y;
    c.save();
    c.fillStyle = '#222b3d'; rr(c, x - 56, y - 44, 112, 88, 14); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 2; rr(c, x - 56, y - 44, 112, 88, 14); c.stroke();
    if (b.type === 'gun') {
      c.fillStyle = '#39445c'; c.beginPath(); c.arc(x, y + 6, 30, 0, Math.PI * 2); c.fill();
      c.save(); c.translate(x, y + 6); c.rotate(b.angle);
      c.fillStyle = G.rageT > 0 ? '#ff8adf' : '#5ad1ff';
      rr(c, 0, -9, 46, 18, 6); c.fill();
      c.fillStyle = '#2a3a52'; rr(c, 40, -12, 12, 24, 5); c.fill();
      c.restore();
      c.fillStyle = '#7fe3ff'; c.beginPath(); c.arc(x, y + 6, 13, 0, Math.PI * 2); c.fill();
    } else if (b.type === 'miner') {
      c.fillStyle = '#4a3d22'; rr(c, x - 34, y - 24, 68, 52, 10); c.fill();
      c.fillStyle = '#ffd35a';
      c.beginPath();
      c.moveTo(x + 4, y - 20); c.lineTo(x - 12, y + 4); c.lineTo(x - 1, y + 4);
      c.lineTo(x - 6, y + 22); c.lineTo(x + 14, y - 4); c.lineTo(x + 2, y - 4);
      c.closePath(); c.fill();
      var pulse = 0.5 + 0.5 * Math.sin(b.t * 4);
      c.globalAlpha = 0.25 + 0.35 * pulse; c.fillStyle = '#ffd35a';
      c.beginPath(); c.arc(x, y, 40 + pulse * 6, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
    } else {
      c.fillStyle = '#22405c'; c.beginPath(); c.arc(x, y + 2, 28, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#9ad9ff'; c.lineWidth = 4; c.lineCap = 'round';
      for (var i = 0; i < 3; i++) {
        var a = b.t * 1.2 + i * Math.PI / 3;
        c.beginPath(); c.moveTo(x - Math.cos(a) * 20, y + 2 - Math.sin(a) * 20); c.lineTo(x + Math.cos(a) * 20, y + 2 + Math.sin(a) * 20); c.stroke();
      }
      c.fillStyle = '#e8fbff'; c.beginPath(); c.arc(x, y + 2, 8, 0, Math.PI * 2); c.fill();
    }
    for (var lv = 0; lv < b.lv; lv++) {
      c.fillStyle = def.color; c.beginPath(); c.arc(x - 20 + lv * 20, y + 34, 5, 0, Math.PI * 2); c.fill();
    }
    text(c, def.name, x, y - 34, 17, 'rgba(230,238,255,0.85)');
    if (b.flash > 0) { c.fillStyle = 'rgba(255,255,255,' + (0.35 * clamp(b.flash / 0.18, 0, 1)) + ')'; rr(c, x - 56, y - 44, 112, 88, 14); c.fill(); }
    if (b.hp < b.max) bar(c, x - 46, y + 42, 92, 8, b.hp / b.max, '#ff7b7b');
    c.restore();
  }
  function drawGhost(g) {
    var c = ctx;
    var bob = Math.sin(g.t * 6) * 3;
    var x = g.x, y = g.y + bob, s = g.r;
    c.save();
    c.fillStyle = 'rgba(0,0,0,0.28)';
    c.beginPath(); c.save(); c.translate(g.x, g.y + s * 0.95); c.scale(1, 0.38);
    c.arc(0, 0, s * 0.9, 0, Math.PI * 2); c.fill(); c.restore();
    var body = g.fromNet ? '#ff4fd8' : (g.boss ? '#8b2fd8' : '#7a4fd8');
    if (g.hitT > 0) body = '#ffffff';
    c.fillStyle = body;
    c.beginPath(); c.arc(x, y, s, Math.PI, 0); c.lineTo(x + s, y + s * 0.75);
    var seg = 4;
    for (var i = seg; i >= 0; i--) {
      var px = x - s + (2 * s) * (i / seg), py = y + s * 0.75 + (i % 2 === 0 ? 0 : -s * 0.22);
      c.lineTo(px, py);
    }
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 2; c.stroke();
    c.fillStyle = g.hitT > 0 ? '#ffffff' : '#3d2b6b';
    c.beginPath(); c.moveTo(x - s * 0.62, y - s * 0.62); c.lineTo(x - s * 0.28, y - s * 1.18); c.lineTo(x - s * 0.14, y - s * 0.6); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(x + s * 0.62, y - s * 0.62); c.lineTo(x + s * 0.28, y - s * 1.18); c.lineTo(x + s * 0.14, y - s * 0.6); c.closePath(); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(x - s * 0.32, y - s * 0.12, s * 0.28, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x + s * 0.32, y - s * 0.12, s * 0.28, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff3b5c';
    c.beginPath(); c.arc(x - s * 0.30 + Math.sin(g.t * 3) * 2, y - s * 0.10, s * 0.13, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x + s * 0.34 + Math.sin(g.t * 3) * 2, y - s * 0.10, s * 0.13, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(x - s * 0.34, y + s * 0.28); c.lineTo(x - s * 0.18, y + s * 0.52); c.lineTo(x - s * 0.02, y + s * 0.28);
    c.lineTo(x + s * 0.14, y + s * 0.52); c.lineTo(x + s * 0.30, y + s * 0.28);
    c.closePath(); c.fill();
    if (g.boss) {
      c.fillStyle = '#ffd85a';
      c.beginPath();
      c.moveTo(x - s * 0.5, y - s * 0.95); c.lineTo(x - s * 0.28, y - s * 1.5); c.lineTo(x, y - s * 1.05);
      c.lineTo(x + s * 0.28, y - s * 1.5); c.lineTo(x + s * 0.5, y - s * 0.95);
      c.closePath(); c.fill();
    }
    if (g.slow > 0 || G.freezeT > 0) {
      c.fillStyle = G.freezeT > 0 ? 'rgba(150,220,255,0.45)' : 'rgba(150,220,255,0.30)';
      c.beginPath(); c.arc(x, y, s + 4, 0, Math.PI * 2); c.fill();
    }
    c.restore();
    if (g.hp < g.max) {
      var bw = s * 2.2, bx = x - bw / 2, by = y - s - (g.boss ? 34 : 20);
      bar(c, bx, by, bw, g.boss ? 9 : 6, g.hp / g.max, '#ff6b6b');
    }
  }
  function drawEffects() {
    var c = ctx, i;
    for (i = 0; i < G.parts.length; i++) {
      var p = G.parts[i];
      c.globalAlpha = clamp(1 - p.t / p.life, 0, 1);
      c.fillStyle = p.c; c.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
    c.globalAlpha = 1;
    for (i = 0; i < G.bullets.length; i++) {
      var b = G.bullets[i];
      c.fillStyle = b.crit ? '#ffe27a' : '#7fe3ff';
      c.beginPath(); c.arc(b.x, b.y, b.crit ? 7 : 5, 0, Math.PI * 2); c.fill();
      var ang = Math.atan2(b.tgt.y - b.y, b.tgt.x - b.x);
      c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x - Math.cos(ang) * 14, b.y - Math.sin(ang) * 14); c.stroke();
    }
    for (i = 0; i < G.floats.length; i++) {
      var f = G.floats[i];
      c.globalAlpha = clamp(1 - f.t / f.life, 0, 1);
      c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,0.55)';
      c.font = font(f.z); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.strokeText(f.s, f.x, f.y); c.fillStyle = f.c; c.fillText(f.s, f.x, f.y);
      c.globalAlpha = 1;
    }
  }

  function drawHUD() {
    var c = ctx;
    c.fillStyle = 'rgba(10,13,24,0.92)'; c.fillRect(0, 0, VW, 104);
    c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, 104); c.lineTo(VW, 104); c.stroke();
    c.fillStyle = '#ffd85a'; c.beginPath(); c.arc(52, 52, 22, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#8a6410'; c.beginPath(); c.arc(52, 52, 15, 0, Math.PI * 2); c.fill();
    text(c, '¥', 52, 53, 20, '#ffd85a');
    text(c, fmt(G.gold), 84, 44, 34, G.goldBoostT > 0 ? '#7dffa8' : '#ffe9a8', 'left');
    text(c, '+' + G.income.toFixed(0) + '/秒' + (G.goldBoostT > 0 ? ' ×2' : ''), 84, 76, 20, '#8fe0a0', 'left');
    var wtxt = G.phase === 'prep' ? ('准备中 ' + Math.max(0, Math.ceil(G.timer)) + 's') : ('第 ' + G.wave + ' / ' + G.diff.waves + ' 波');
    text(c, wtxt, VW - 24, 42, 28, G.phase === 'prep' ? '#8fd6ff' : '#ff9d9d', 'right');
    text(c, G.diff.name + ' · 击杀 ' + G.kills + ' · ×' + G.speed, VW - 24, 76, 20, '#9aa4bd', 'right');
    bar(c, 240, 90, 240, 8, G.wave / G.diff.waves, '#ffd85a');
  }

  var TONE = {
    gold: { bg: '#2a2415', bd: '#ffd85a', fg: '#ffe9a8' },
    blue: { bg: '#16233a', bd: '#5ad1ff', fg: '#bfe9ff' },
    green: { bg: '#16301f', bd: '#5ad17a', fg: '#b6f5c6' },
    red: { bg: '#331820', bd: '#ff7b7b', fg: '#ffc4c4' },
    purple: { bg: '#241a3a', bd: '#b48bff', fg: '#dccbff' },
    gray: { bg: '#20242f', bd: '#6b7385', fg: '#b9c0d0' },
    item: { bg: '#141a28', bd: '#8fd6ff', fg: '#e6f4ff' }
  };
  function drawIcon(c, kind, x, y, color) {
    c.save(); c.translate(x, y);
    c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 3; c.lineCap = 'round';
    if (kind === 'gun') { c.fillRect(-4, -12, 18, 8); c.beginPath(); c.arc(-2, 0, 8, 0, Math.PI * 2); c.fill(); }
    else if (kind === 'miner') { c.beginPath(); c.moveTo(2, -14); c.lineTo(-8, 2); c.lineTo(0, 2); c.lineTo(-3, 14); c.lineTo(9, -3); c.lineTo(1, -3); c.closePath(); c.fill(); }
    else if (kind === 'frost') { for (var i = 0; i < 3; i++) { var a = i * Math.PI / 3; c.beginPath(); c.moveTo(-Math.cos(a) * 13, -Math.sin(a) * 13); c.lineTo(Math.cos(a) * 13, Math.sin(a) * 13); c.stroke(); } }
    else if (kind === 'door') { c.fillRect(-11, -14, 22, 28); c.fillStyle = '#1a1d28'; c.beginPath(); c.arc(6, 0, 3, 0, Math.PI * 2); c.fill(); }
    else if (kind === 'speed') { c.beginPath(); c.moveTo(-12, -13); c.lineTo(2, 0); c.lineTo(-12, 13); c.closePath(); c.fill(); c.beginPath(); c.moveTo(2, -13); c.lineTo(14, 0); c.lineTo(2, 13); c.closePath(); c.fill(); }
    else if (kind === 'up') { c.beginPath(); c.moveTo(0, -13); c.lineTo(13, 6); c.lineTo(-13, 6); c.closePath(); c.fill(); }
    else if (kind === 'sell') { c.beginPath(); c.arc(0, 0, 12, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(-8, -8); c.lineTo(8, 8); c.stroke(); }
    else if (kind === 'solo') { c.beginPath(); c.arc(0, -6, 8, 0, Math.PI * 2); c.fill(); c.beginPath(); c.moveTo(-12, 14); c.quadraticCurveTo(0, 0, 12, 14); c.stroke(); }
    else if (kind === 'net') {
      c.beginPath(); c.arc(-8, -8, 6, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(8, -8, 6, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(-8, 10, 6, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(8, 10, 6, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(-8, -2); c.lineTo(8, -2); c.moveTo(0, -2); c.lineTo(0, 8); c.stroke();
    }
    else if (kind === 'freeze') {
      for (var k = 0; k < 3; k++) { var an = k * Math.PI / 3; c.beginPath(); c.moveTo(-Math.cos(an) * 15, -Math.sin(an) * 15); c.lineTo(Math.cos(an) * 15, Math.sin(an) * 15); c.stroke(); }
      c.lineWidth = 2;
      for (var m = 0; m < 3; m++) { var am = m * Math.PI / 3 + 1.05; c.beginPath(); c.moveTo(Math.cos(am) * 9, Math.sin(am) * 9); c.lineTo(Math.cos(am) * 14, Math.sin(am) * 14); c.moveTo(-Math.cos(am) * 9, -Math.sin(am) * 9); c.lineTo(-Math.cos(am) * 14, -Math.sin(am) * 14); c.stroke(); }
    }
    else if (kind === 'bomb') { c.beginPath(); c.arc(0, 2, 11, 0, Math.PI * 2); c.fill(); c.lineWidth = 3; c.beginPath(); c.moveTo(4, -8); c.lineTo(12, -16); c.stroke(); c.beginPath(); c.arc(13, -18, 3, 0, Math.PI * 2); c.fill(); }
    else if (kind === 'gold') { c.beginPath(); c.arc(0, 0, 13, 0, Math.PI * 2); c.fill(); c.fillStyle = '#1a1d28'; c.font = font(16); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('¥', 0, 0); }
    else if (kind === 'heal') { c.fillRect(-4, -14, 8, 28); c.fillRect(-14, -4, 28, 8); }
    else if (kind === 'rage') { c.beginPath(); c.moveTo(2, -16); c.lineTo(-9, 2); c.lineTo(0, 2); c.lineTo(-3, 16); c.lineTo(11, -3); c.lineTo(1, -3); c.closePath(); c.fill(); }
    else if (kind === 'shield') {
      c.beginPath(); c.moveTo(0, -15); c.lineTo(12, -8); c.lineTo(12, 4);
      c.quadraticCurveTo(12, 12, 0, 16); c.quadraticCurveTo(-12, 12, -12, 4);
      c.lineTo(-12, -8); c.closePath(); c.stroke();
      c.globalAlpha = 0.35; c.fill(); c.globalAlpha = 1;
    }
    else if (kind === 'send') {
      c.beginPath(); c.arc(0, -2, 12, Math.PI, 0); c.lineTo(12, 7); c.lineTo(-12, 7); c.closePath(); c.fill();
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(-4, -3, 3, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(4, -3, 3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ff3b5c'; c.beginPath(); c.arc(-4, -3, 1.5, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(4, -3, 1.5, 0, Math.PI * 2); c.fill();
    }
    else if (kind === 'saber') {
      c.beginPath(); c.arc(0, -1, 13, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(-9, 6); c.lineTo(-5, 13); c.lineTo(-1, 6); c.lineTo(3, 13); c.lineTo(7, 6); c.closePath(); c.fill();
      c.fillStyle = '#0d1018'; c.beginPath(); c.arc(-5, -2, 3, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(5, -2, 3, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#0d1018'; c.lineWidth = 2; c.beginPath(); c.arc(0, 4, 5, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    }
    else if (kind === 'horde') {
      c.beginPath(); c.arc(-10, -2, 7, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(10, -2, 7, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(0, 9, 9, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#0d1018';
      c.beginPath(); c.arc(-10, -2, 2, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(10, -2, 2, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(-4, 7, 2, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(4, 7, 2, 0, Math.PI * 2); c.fill();
    }
    else if (kind === 'king') {
      c.beginPath(); c.moveTo(-13, 8); c.lineTo(-13, -4); c.lineTo(-7, 2); c.lineTo(0, -12); c.lineTo(7, 2); c.lineTo(13, -4); c.lineTo(13, 8); c.closePath(); c.fill();
      c.strokeStyle = '#0d1018'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-7, 12); c.lineTo(7, 12); c.stroke();
    }
    else if (kind === 'black') {
      c.beginPath(); c.moveTo(4, -15); c.lineTo(-7, 1); c.lineTo(1, 1); c.lineTo(-3, 15); c.lineTo(9, -2); c.lineTo(1, -2); c.closePath(); c.fill();
      c.strokeStyle = color; c.lineWidth = 3;
      c.beginPath(); c.arc(-11, 9, 5, -0.4 * Math.PI, 0.9 * Math.PI); c.stroke();
    }
    else if (kind === 'curse') {
      c.fillRect(-11, -13, 22, 26);
      c.strokeStyle = '#0d1018'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(-11, -3); c.lineTo(-3, 3); c.lineTo(-8, 8); c.lineTo(2, 13); c.stroke();
    }
    c.restore();
  }
  function drawBtn(b) {
    var c = ctx;
    if (b.shape === 'round') {
      var cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = b.w / 2;
      c.save();
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2);
      c.fillStyle = '#141a28'; c.fill();
      c.lineWidth = 3; c.strokeStyle = b.enabled ? '#8fd6ff' : '#3d4657'; c.stroke();
      if (b.cdRatio > 0) {
        c.beginPath(); c.moveTo(cx, cy);
        c.arc(cx, cy, r - 1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * b.cdRatio);
        c.closePath(); c.fillStyle = 'rgba(4,8,18,0.72)'; c.fill();
        text(c, String(Math.ceil(b.cdRatio * ITEMS[b.id.slice(5)].cd)), cx, cy, 24, '#ffffff');
      } else {
        drawIcon(c, b.icon, cx, cy - 6, b.enabled ? '#8fd6ff' : '#4d566b');
        text(c, b.title, cx, cy + 20, 16, b.enabled ? '#e6f4ff' : '#4d566b');
      }
      if (b.cost > 0) {
        c.beginPath(); c.arc(b.x + b.w - 10, b.y + 10, 13, 0, Math.PI * 2);
        c.fillStyle = '#2a2415'; c.fill();
        c.lineWidth = 2; c.strokeStyle = '#ffd85a'; c.stroke();
        text(c, String(b.cost), b.x + b.w - 10, b.y + 10, 15, '#ffd85a');
      }
      c.restore();
      return;
    }
    var t = TONE[b.tone] || TONE.gray;
    var active = (G.place && b.id === 'build_' + G.place);
    c.save();
    c.globalAlpha = b.enabled ? 1 : 0.45;
    rr(c, b.x, b.y, b.w, b.h, 16);
    c.fillStyle = active ? '#3d3418' : t.bg; c.fill();
    c.lineWidth = active ? 5 : 3; c.strokeStyle = b.tint || t.bd; c.stroke();
    if (b.icon) drawIcon(c, b.icon, b.x + 34, b.y + b.h / 2, b.tint || t.bd);
    var tx = b.icon ? b.x + 62 : b.x + b.w / 2;
    text(c, b.title, tx, b.y + (b.sub ? b.h / 2 - 14 : b.h / 2), 26, b.tint || t.fg, b.icon ? 'left' : 'center');
    if (b.sub) text(c, b.sub, tx, b.y + b.h / 2 + 18, 19, b.enabled ? '#9aa4bd' : '#7b8296', b.icon ? 'left' : 'center');
    c.restore();
  }
  function drawPanel() {
    var c = ctx;
    c.fillStyle = '#0d1018'; c.fillRect(0, 988, VW, VH - 988);
    c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, 988); c.lineTo(VW, 988); c.stroke();
    var msg = '';
    if (G.tipT > 0 && G.tip) msg = G.tip;
    else if (G.sel) { var d = TOWER[G.sel.type]; msg = '已选中：' + d.name + ' Lv' + G.sel.lv + '　（' + d.short + '）'; }
    else if (G.place) msg = '点击空地放置「' + TOWER[G.place].name + '」（再点按钮可取消）';
    else if (G.netOn) msg = '对手：' + NET.opp.nick + '　第 ' + NET.opp.wave + ' 波 · 击杀 ' + NET.opp.kills + ' · 床位 ' + Math.round(NET.opp.bedPct * 100) + '%';
    else msg = '睡觉产金币 → 建炮台打猛鬼 → 别让门和床被打爆';
    text(c, msg, VW / 2, 1000, 21, G.tipT > 0 ? '#ffd85a' : (G.netOn ? '#ff9de0' : '#8b93a8'));
    for (var i = 0; i < G.btns.length; i++) drawBtn(G.btns[i]);
  }

  /* 右下角：对手实时状态 + 战报（放在床位右侧的空闲区） */
  function drawWarPanel() {
    var c = ctx, x = 496, y = 786, w = 190, h = 206, op = NET.opp;
    c.save();
    rr(c, x, y, w, h, 16);
    c.fillStyle = 'rgba(8,11,20,0.74)'; c.fill();
    c.lineWidth = 2; c.strokeStyle = op.finished ? 'rgba(125,255,168,0.55)' : 'rgba(255,157,224,0.45)'; c.stroke();
    c.restore();
    text(c, 'VS ' + (op.nick || '对手'), x + w / 2, y + 22, 20, '#ff9de0');
    text(c, '第 ' + op.wave + ' 波 · 杀 ' + op.kills, x + w / 2, y + 45, 16, '#9aa4bd', 'center', 'normal');
    text(c, '床', x + 12, y + 73, 16, '#cdd6ea', 'left', 'normal');
    bar(c, x + 36, y + 65, w - 48, 13, op.bedPct, op.bedPct > 0.35 ? '#7dffa8' : '#ff6b6b');
    text(c, '门', x + 12, y + 99, 16, '#cdd6ea', 'left', 'normal');
    bar(c, x + 36, y + 91, w - 48, 13, op.doorPct, op.doorPct > 0.35 ? '#5ad1ff' : '#ff6b6b');
    if (op.finished) text(c, op.win ? '已通关' : '已出局', x + w / 2, y + 127, 19, op.win ? '#7dffa8' : '#ff7b7b');
    else if (op.shield > 0) text(c, '对手铁幕中 ' + op.shield.toFixed(1) + 's', x + w / 2, y + 127, 16, '#7dffa8', 'center', 'normal');
    else text(c, '对手已投放 ' + (op.sent || 0) + ' 次干扰', x + w / 2, y + 127, 15, '#8b93a8', 'center', 'normal');
    for (var i = 0; i < G.feed.length && i < 3; i++) {
      var f = G.feed[i];
      c.globalAlpha = clamp(f.t / 1.2, 0, 1);
      text(c, f.msg, x + w - 10, y + 154 + i * 22, 15, f.col, 'right', 'normal');
      c.globalAlpha = 1;
    }
  }
  /* 铁幕护盾：床位周围展开青色力场 */
  function drawShield() {
    var c = ctx;
    var a = 0.16 + 0.10 * Math.sin(G.time * 6);
    c.save();
    c.strokeStyle = 'rgba(125,255,168,' + (0.55 + 0.25 * Math.sin(G.time * 6)).toFixed(3) + ')';
    c.lineWidth = 4;
    c.beginPath(); c.ellipse(BED.cx, BED.cy, 118, 78, 0, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(125,255,168,' + a.toFixed(3) + ')'; c.fill();
    c.restore();
    text(c, '铁幕 ' + G.shieldT.toFixed(1) + 's', BED.cx, BED.cy - 96, 22, '#7dffa8');
  }
  /* 断电：画面变暗并提示（此时发电机不产出） */
  function drawBlackout() {
    var c = ctx;
    c.fillStyle = 'rgba(6,10,26,0.46)'; c.fillRect(0, 0, VW, VH);
    var blink = (Math.floor(G.blackoutT * 4) % 2) === 0;
    text(c, '停电中 · 发电机停摆 ' + G.blackoutT.toFixed(1) + 's', VW / 2, 252, 30, blink ? '#ffd85a' : '#8b93a8');
  }
  /* 干扰面板背景（按钮由 drawPanel 统一绘制） */
  function drawSaberBg() {
    var c = ctx;
    c.fillStyle = 'rgba(4,6,12,0.86)'; c.fillRect(0, 0, VW, VH);
    text(c, '干扰对手', VW / 2, 266, 46, '#b48bff');
    text(c, '金币就是子弹：削弱他的同时，他也在削弱你', VW / 2, 308, 21, '#8b93a8', 'center', 'normal');
    if (G.stat.sent) text(c, '本局已投放 ' + G.stat.sent + ' 次干扰', VW / 2, 976, 21, '#ff9de0');
  }

  function drawMenu() {
    var c = ctx;
    text(c, '猛鬼宿舍', VW / 2, 300, 78, '#ffd85a');
    text(c, '躺平发育 · 塔防生存', VW / 2, 378, 30, '#8fd6ff');
    text(c, '守住床位，撑过所有波次', VW / 2, 440, 24, '#8b93a8', 'center', 'normal');
    for (var i = 0; i < G.btns.length; i++) drawBtn(G.btns[i]);
    text(c, '（仿制学习用途 · 非官方版本）', VW / 2, VH - 56, 20, '#5c6478', 'center', 'normal');
  }
  function drawDiff() {
    var c = ctx;
    text(c, '选择难度', VW / 2, 280, 56, '#ffd85a');
    text(c, '难度影响猛鬼强度、金币收益与总波数', VW / 2, 350, 24, '#8b93a8', 'center', 'normal');
    for (var i = 0; i < G.btns.length; i++) {
      var b = G.btns[i];
      drawBtn(b);
      if (b.tint) {
        var d = DIFFS[parseInt(b.id.slice(5), 10) || 0];
        text(c, d.waves + ' 波 · 鬼血 ×' + d.hpM + ' · 金币 ×' + d.goldM, b.x + b.w / 2, b.y + b.h - 34, 19, '#9aa4bd');
      }
    }
  }
  function drawNet() {
    var c = ctx;
    text(c, '联机对战', VW / 2, 240, 56, '#b48bff');
    if (NET.step === 'menu') {
      text(c, '双方各自守自己的宿舍，用金币给对手投放干扰', VW / 2, 262, 23, '#8b93a8', 'center', 'normal');
      text(c, '先撑不住的一方判负 · 难度越高，对手的鬼越凶', VW / 2, 296, 23, '#8b93a8', 'center', 'normal');
      if (NET.record && (NET.record.win || NET.record.lose)) {
        text(c, '联机战绩：' + NET.record.win + ' 胜 ' + NET.record.lose + ' 负', VW / 2, 332, 24, '#ffd85a');
      }
      var cs = NET.conn;
      var ccol = cs === 'ok' ? '#7dffa8' : (cs === 'probing' ? '#ffd85a' : '#ff7b7b');
      var stxt = cs === 'ok' ? ('服务器已连接：' + (NET.baseUrl || '同源'))
        : cs === 'probing' ? '正在检测联机服务器…'
          : A.request ? '未检测到联机服务器，点下方按钮重连' : '当前环境不支持联网';
      text(c, stxt, VW / 2, 368, 22, ccol, 'center', 'normal');
      if (NET.err) text(c, NET.err, VW / 2, 398, 22, '#ff7b7b', 'center', 'normal');
      else if (cs === 'fail') text(c, '请先在 menggui-sushe 目录执行 node server/server.js', VW / 2, 398, 20, '#8b93a8', 'center', 'normal');
      var dd = DIFFS[NET.diffIdx];
      text(c, '对战难度（房主决定 · 加入者自动同步）', VW / 2, 392 + 8, 22, '#cdd6ea', 'center', 'normal');
      text(c, dd.name + '：' + dd.desc + ' · ' + dd.waves + ' 波', VW / 2, 512, 22, dd.tint, 'center', 'normal');
    } else if (NET.step === 'join') {
      text(c, '输入好友的 4 位房间码', VW / 2, 340, 28, '#cdd6ea');
      c.fillStyle = '#141a28'; rr(c, 220, 400, 280, 90, 14); c.fill();
      c.lineWidth = 3; c.strokeStyle = '#5ad1ff'; rr(c, 220, 400, 280, 90, 14); c.stroke();
      var s = NET.input;
      for (var i = 0; i < 4; i++) text(c, s[i] || '-', 255 + i * 70, 445, 46, s[i] ? '#ffd85a' : '#3d4657');
      if (NET.err) text(c, NET.err, VW / 2, 512, 24, '#ff7b7b');
    } else if (NET.step === 'wait') {
      text(c, '房间码', VW / 2, 300, 28, '#cdd6ea');
      c.fillStyle = '#141a28'; rr(c, 200, 340, 320, 120, 16); c.fill();
      c.lineWidth = 4; c.strokeStyle = '#ffd85a'; rr(c, 200, 340, 320, 120, 16); c.stroke();
      text(c, NET.code || '----', VW / 2, 400, 64, '#ffd85a');
      var d2 = DIFFS[NET.diffIdx] || DIFFS[1];
      text(c, '难度：' + d2.name + ' · ' + d2.waves + ' 波', VW / 2, 500, 25, d2.tint);
      var hasOpp = NET.room && NET.room.status === 'playing';
      text(c, hasOpp ? ('对手已加入：' + (NET.room.guest ? NET.room.guest.nick : '玩家')) : '等待好友加入…', VW / 2, 545, 25, hasOpp ? '#7dffa8' : '#8b93a8');
      if (NET.invite) {
        text(c, '把邀请链接发给微信好友，点开即自动填好房间码', VW / 2, 592, 21, '#8b93a8', 'center', 'normal');
        text(c, shortUrl(NET.invite), VW / 2, 626, 20, '#5ad1ff', 'center', 'normal');
      } else {
        text(c, '把房间码告诉好友，让他在联机页点「加入房间」', VW / 2, 600, 21, '#8b93a8', 'center', 'normal');
      }
      if (NET.err) text(c, NET.err, VW / 2, 668, 23, '#ff7b7b');
    }
    for (var k = 0; k < G.btns.length; k++) drawBtn(G.btns[k]);
  }
  function drawHelp() {
    var c = ctx;
    text(c, '玩法说明', VW / 2, 240, 56, '#ffd85a');
    var lines = [
      '① 躺在床上自动赚金币，每秒结算',
      '② 在房间空地建造电磁炮 / 发电机 / 冷凝塔',
      '③ 猛鬼从走廊来袭：先拆门，再拆你的床',
      '④ 门可加固与修复；炮台也能当肉盾',
      '⑤ 道具：急冻 / 空袭 / 暴富 / 抢修 / 狂暴',
      '⑥ 联机最后一格打开「干扰面板」：鬼兵 / 鬼潮 /',
      '     鬼王 / 拉闸断电 / 破门咒，用钱打崩对手',
      '⑦ 联机专属「铁幕」：6 秒内免疫对手投放的猛鬼',
      '     并双倍缴获赏金，专治对手乱送鬼',
      '⑧ 击杀对手投放的猛鬼可获得额外缴获赏金',
      '⑨ 撑过全部波次即胜利，床位被打爆则失败'
    ];
    for (var i = 0; i < lines.length; i++) text(c, lines[i], VW / 2, 380 + i * 54, 26, '#c9d2e6', 'center', 'normal');
    text(c, '点击任意处返回', VW / 2, 900, 24, '#5c6478', 'center', 'normal');
  }
  function drawResult() {
    var c = ctx;
    var win = G.scene === 'win';
    var v = G.netOn ? battleVerdict() : null;
    var title = win ? '躺平胜利！' : '被猛鬼抓走了…';
    var sub = win ? '你成功守住了宿舍' : '坚持到第 ' + Math.max(1, G.wave) + ' 波';
    if (v && v.done) { title = v.win ? '对战胜利！' : '对战失败'; sub = v.text; }
    else if (v && !v.done) sub = v.text;
    text(c, title, VW / 2, 330, 60, (v ? (v.win ? '#7dffa8' : '#ff7b7b') : (win ? '#7dffa8' : '#ff7b7b')));
    text(c, sub, VW / 2, 424, 26, '#c9d2e6');
    if (G.netOn && NET.opp && NET.opp.nick) {
      var rows = [
        ['波次', String(Math.max(1, G.wave)), String(NET.opp.wave)],
        ['击杀', String(G.kills), String(NET.opp.kills)],
        ['用时', fmt(G.time) + 's', (NET.opp.time || 0) + 's'],
        ['投放干扰', String(G.stat.sent), String(NET.opp.sent || 0)],
        ['缴获击杀', String(G.stat.lootKills), String(NET.opp.lootKills || 0)]
      ];
      var ty = 466;
      text(c, '本局数据对比', VW / 2, ty, 25, '#ffd85a');
      text(c, '你', 300, ty + 42, 22, '#8fd6ff');
      text(c, NET.opp.nick, 470, ty + 42, 22, '#ff9de0');
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i], yy = ty + 76 + i * 38;
        text(c, r[0], 120, yy, 21, '#9aa4bd', 'left', 'normal');
        text(c, r[1], 330, yy, 23, '#ffe9a8', 'right');
        text(c, r[2], 500, yy, 23, '#dccbff', 'right');
      }
      text(c, '难度 ' + G.diff.name + ' · 缴获金币 ' + fmt(G.stat.loot), VW / 2, ty + 76 + rows.length * 38 + 16, 21, '#8b93a8', 'center', 'normal');
    } else {
      text(c, '难度 ' + G.diff.name + ' · 击杀 ' + G.kills + ' · 用时 ' + fmt(G.time) + 's', VW / 2, 500, 26, '#ffd85a');
    }
    /* 云端同步状态 + AI 军师点评 */
    var cl = G.cloud || {};
    var cy = G.netOn ? 776 : 556;
    if (cl.msg) text(c, cl.msg, VW / 2, cy, 20, cl.signed ? '#7dffa8' : '#8b93a8', 'center', 'normal');
    if (cl.coach) {
      var ls = wrapLines(cl.coach, 22, G.netOn ? 0 : 3);
      for (var k = 0; k < ls.length; k++) {
        text(c, ls[k], VW / 2, cy + 34 + k * 28, 19, '#9fd7ff', 'center', 'normal');
      }
    }
    for (var i = 0; i < G.btns.length; i++) drawBtn(G.btns[i]);
  }

  function render() {
    var c = ctx;
    c.fillStyle = '#07080f'; c.fillRect(0, 0, VW, VH);
    drawFloor();
    if (G.scene === 'play' || G.scene === 'win' || G.scene === 'lose') {
      drawGridSlots();
      for (var i = 0; i < G.buildings.length; i++) drawBuilding(G.buildings[i]);
      drawBed(); drawDoor();
      for (var j = 0; j < G.ghosts.length; j++) drawGhost(G.ghosts[j]);
      drawEffects();
      if (G.scene === 'play') {
        if (G.shieldT > 0) drawShield();
        if (G.blackoutT > 0) drawBlackout();
        drawHUD();
        if (G.netOn) drawWarPanel();
        if (G.netPanel) drawSaberBg();
        drawPanel();
      }
    }
    if (G.scene === 'menu') { c.fillStyle = 'rgba(4,6,12,0.82)'; c.fillRect(0, 0, VW, VH); drawMenu(); }
    else if (G.scene === 'diff') { c.fillStyle = 'rgba(4,6,12,0.88)'; c.fillRect(0, 0, VW, VH); drawDiff(); }
    else if (G.scene === 'net') { c.fillStyle = 'rgba(4,6,12,0.88)'; c.fillRect(0, 0, VW, VH); drawNet(); }
    else if (G.scene === 'help') { c.fillStyle = 'rgba(4,6,12,0.92)'; c.fillRect(0, 0, VW, VH); drawHelp(); }
    else if (G.scene === 'win' || G.scene === 'lose') { c.fillStyle = 'rgba(4,6,12,0.86)'; c.fillRect(0, 0, VW, VH); drawResult(); }
  }

  /* ==================== 主循环 ==================== */
  function resize() {
    var v = A.getView();
    VIEW = v;
    cv.width = Math.max(1, Math.round(v.w * v.dpr));
    cv.height = Math.max(1, Math.round(v.h * v.dpr));
    T.s = Math.min(v.w / VW, v.h / VH);
    T.ox = (v.w - VW * T.s) / 2;
    T.oy = (v.h - VH * T.s) / 2;
  }

  var lastKey = '';
  function refreshButtons() {
    if (G.scene === 'play') {
      var it = G.items;
      var cds = Math.ceil(it.freeze) + ',' + Math.ceil(it.bomb) + ',' + Math.ceil(it.gold) + ',' + Math.ceil(it.heal) + ',' + Math.ceil(it.rage) + ',' + Math.ceil(it.shield) + ',' + Math.ceil(it.send) + ',' + Math.ceil(it.horde) + ',' + Math.ceil(it.king) + ',' + Math.ceil(it.black) + ',' + Math.ceil(it.curse);
      var key = (G.netPanel ? 's|' : 'p|') + (G.sel ? (G.sel.type + G.sel.lv + G.sel.col + G.sel.row + Math.floor(G.sel.hp)) : '') + '|' + Math.floor(G.gold) + '|' + G.door.lv + '|' + Math.floor(G.door.hp) + '|' + G.door.broken + '|' + G.speed + '|' + G.place + '|' + cds;
      if (key !== lastKey) { layout(); lastKey = key; }
    } else if (G.scene === 'net') {
      var nk = 'n|' + NET.step + '|' + NET.input + '|' + NET.diffIdx + '|' + (NET.room ? (NET.room.status + (NET.room.guest ? '1' : '0')) : '0') + '|' + (NET.invite ? '1' : '0');
      if (nk !== lastKey) { layout(); lastKey = nk; }
    } else {
      var cl = G.cloud || {};
      var ck = G.scene + '|' + (cl.signed ? '1' : '0') + '|' + cl.nick + '|' + cl.msg + '|' + cl.coach;
      if (lastKey !== ck) { layout(); lastKey = ck; }
    }
  }

  function frame() {
    var v = A.getView();
    if (v.w !== VIEW.w || v.h !== VIEW.h || v.dpr !== VIEW.dpr) resize();
    var t = nowMs();
    var raw = (t - lastT) / 1000;
    lastT = t;
    if (!isFinite(raw) || raw < 0) raw = 0;
    var dt = Math.min(raw, 1 / 20);

    if (G.scene === 'play') updatePlay(dt * G.speed);
    else if (G) updateEffects(dt);
    checkNetVerdict();

    if (G && ((G.scene === 'play' && G.netOn) || G.scene === 'net' || (G.netOn && (G.scene === 'win' || G.scene === 'lose')))) {
      NET.syncT -= dt;
      if (NET.syncT <= 0) { NET.syncT = 1.2; if (NET.room) netSync(); }
    }

    refreshButtons();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#07080f'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(VIEW.dpr * T.s, 0, 0, VIEW.dpr * T.s, VIEW.dpr * T.ox, VIEW.dpr * T.oy);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, VW, VH); ctx.clip();
    render();
    ctx.restore();
  }

  /* ==================== 入口 ==================== */
  function startGame(adapter) {
    A = adapter;
    cv = A.canvas;
    ctx = cv.getContext('2d');
    NET.baseUrl = A.baseUrl || '';
    if (A.getAudio) { try { AC = A.getAudio(); } catch (e) { AC = null; } }
    NET.uid = 'u' + Math.random().toString(36).slice(2, 10);
    NET.nick = '舍友' + Math.random().toString(36).slice(2, 5).toUpperCase();
    /* 通过邀请链接进入：预填房间码，连上服务器后自动加入 */
    var rp = String(A.roomParam || '').replace(/\D/g, '').slice(0, 4);
    if (rp.length === 4) { NET.autoJoin = rp; NET.input = rp; }
    if (A.getRecord) { try { var r0 = A.getRecord(); if (r0 && typeof r0.win === 'number') NET.record = r0; } catch (e) { } }
    initGame(1);
    resize();
    lastT = nowMs();
    lastKey = '';
    layout();
    A.onPointer(onPointer);
    A.onFrame(frame);
    if (A.getBaseList) netProbe(A.getBaseList());
    /* 云服务：初始化 + 处理微信登录回调 + 恢复已登录账号 */
    if (A.cloud && A.cloud.init) { try { A.cloud.init(cloudApply); } catch (e) { } }
  }

  return {
    startGame: startGame,
    getState: function () { return G; },
    net: NET,
    probe: function (list, failMsg) { if (failMsg) NET.hintFail = failMsg; netProbe(list); }
  };
})();

/* ===== 微信小游戏适配层 ===== */
// 联机服务器地址：把 server/server.js 部署到可访问的机器后，把地址填在这里
// （微信小游戏真机需在「开发管理-服务器域名」里配置该地址，或临时开启「不校验合法域名」）
var SERVER_BASE = "https://menggui-sushe-79127.app.workbuddy.host";
var canvas = wx.createCanvas();
var winInfo = (function () {
  try { if (wx.getWindowInfo) return wx.getWindowInfo(); } catch (err) { }
  return wx.getSystemInfoSync();
})();
var audioCtx = null;

MengGuiCore.startGame({
  canvas: canvas,
  getView: function () {
    return {
      w: winInfo.windowWidth || winInfo.screenWidth,
      h: winInfo.windowHeight || winInfo.screenHeight,
      dpr: winInfo.pixelRatio || 1
    };
  },
  onPointer: function (cb) {
    wx.onTouchStart(function (ev) {
      var t = (ev.changedTouches && ev.changedTouches[0]) || (ev.touches && ev.touches[0]);
      if (t) cb(t.clientX, t.clientY);
    });
  },
  onFrame: function (cb) {
    function loop() { cb(); requestAnimationFrame(loop); }
    requestAnimationFrame(loop);
  },
  getAudio: function () {
    if (audioCtx) return audioCtx;
    try { audioCtx = wx.createWebAudioContext ? wx.createWebAudioContext() : null; }
    catch (err) { audioCtx = null; }
    return audioCtx;
  },
  request: function (o) {
    return new Promise(function (resolve, reject) {
      wx.request({
        url: o.url,
        method: o.method || "POST",
        data: o.body || {},
        header: { "content-type": "application/json" },
        dataType: "json",
        timeout: o.timeout || 6000,
        success: function (r) { resolve(r.data); },
        fail: function (e) { reject(e); }
      });
    });
  },
  getBaseList: function () { return SERVER_BASE ? [SERVER_BASE] : []; },
  roomParam: "",
  pageUrl: SERVER_BASE,
  copy: function (t) {
    try { wx.setClipboardData({ data: t }); return true; } catch (err) { return false; }
  },
  getRecord: function () {
    try { var s = wx.getStorageSync("mg_record"); if (s && typeof s.win === "number") return s; } catch (err) { }
    return { win: 0, lose: 0 };
  },
  onRecord: function (r) { try { wx.setStorageSync("mg_record", r); } catch (err) { } },

  /* ---- 云端战绩：小游戏无 DOM，用原生弹窗 + 剪贴板降级 ---- */
  cloud: (function () {
    var PUBLIC = {
      endpoint: 'https://menggui-sushe-79127.app.workbuddy.host',
      oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
      publishableKey: 'wbpk_3d7L9vA1CdD01pOTgrrXQ9_G567DakCjQx2WhquYfJPjVadg7zTzxHD'
    };
    var sdk = null, err = "", cbs = [];
    function emit(st) { for (var i = 0; i < cbs.length; i++) { try { cbs[i](st); } catch (e) { } } }
    function ensure() {
      if (sdk) return sdk;
      var f = null;
      try { if (typeof createWorkBuddyCloud === "function") f = createWorkBuddyCloud; } catch (e) { }
      if (!f) { try { if (typeof global !== "undefined" && global.WorkBuddyCloud) f = global.WorkBuddyCloud.createWorkBuddyCloud; } catch (e) { } }
      if (!f) { err = "小游戏端未加载云服务 SDK，云端功能请在网页版使用"; return null; }
      try { sdk = f(PUBLIC); err = ""; } catch (e) { sdk = null; err = "云服务初始化失败"; }
      return sdk;
    }
    function localStats() {
      try { var s = wx.getStorageSync("mg_cloud"); if (s) return s; } catch (e) { }
      return { win: 0, lose: 0, best: 0, kills: 0 };
    }
    function saveLocal(p) {
      var s = localStats();
      if (p.win) s.win++; else s.lose++;
      s.best = Math.max(s.best, p.wave || 0);
      s.kills += p.kills || 0;
      try { wx.setStorageSync("mg_cloud", s); } catch (e) { }
      return s;
    }
    function coach(match, cb) {
      if (!sdk || !sdk.llm) return null;
      var sys = "你是猛鬼宿舍（躺平塔防小游戏）的战术军师。请用中文给出简短、具体、可执行的复盘建议，最多 3 句话。";
      var usr = "本局数据：模式=" + (match.mode === "net" ? "联机对战" : "单人闯关") + "，难度=" + (match.diffName || match.diff || "普通") + "，结果=" + (match.win ? "守住胜利" : "被猛鬼抓走") + "，坚持到第 " + match.wave + " 波，击杀 " + match.kills + " 只，用时 " + match.duration + " 秒。请复盘。";
      var out = "";
      return sdk.llm.models.list().then(function (list) {
        var pick = null, i, m;
        for (i = 0; i < (list || []).length; i++) { m = list[i]; if (m && m.disabled !== true && m.enabled !== false && m.id === "hunyuan-chat") { pick = m; break; } }
        if (!pick) { for (i = 0; i < (list || []).length; i++) { m = list[i]; if (m && m.disabled !== true && m.enabled !== false) { pick = m; break; } } }
        if (!pick) return null;
        var st = sdk.llm.chat.completions.create({ model: pick.id, messages: [{ role: "system", content: sys }, { role: "user", content: usr }], stream: true });
        return (async function () { for await (var ch of st) { var d = ch && ch.choices && ch.choices[0] && ch.choices[0].delta; if (d && d.content) out += d.content; } return out; })();
      }).then(function (t) { if (t && cb) cb({ signed: true, coach: t }); })["catch"](function () { });
    }
    return {
      init: function (cb) {
        if (cb) cbs.push(cb);
        ensure();
        if (!sdk) { emit({ signed: false, msg: err }); return; }
        sdk.auth.getSession().then(function (r) {
          var u = r && r.data && r.data.user;
          emit(u ? { signed: true, nick: (u.nickname || u.name || "舍友") } : { signed: false });
        }, function () { emit({ signed: false }); });
      },
      open: function (cb) {
        if (cb && cbs.indexOf(cb) < 0) cbs.push(cb);
        ensure();
        if (!sdk) {
          wx.showModal({
            title: '云端战绩',
            content: '小游戏端暂不支持登录，请到网页版体验云端排行榜与 AI 军师。\n网页地址：' + (SERVER_BASE || 'https://menggui-sushe-79127.app.workbuddy.host'),
            confirmText: '复制地址',
            success: function (r) {
              if (r.confirm) { try { wx.setClipboardData({ data: SERVER_BASE || "https://menggui-sushe-79127.app.workbuddy.host" }); } catch (e) { } }
            }
          });
          return;
        }
        wx.showModal({
          title: '云同步',
          content: '登录后战绩将同步到云端排行榜，并生成 AI 复盘。请在网页版登录。',
          showCancel: false
        });
      },
      submit: function (p, cb) {
        if (cb && cbs.indexOf(cb) < 0) cbs.push(cb);
        var s = ensure();
        if (!s) { var st = saveLocal(p); emit({ signed: false, msg: "已存本地（" + st.win + "胜" + st.lose + "负），登录网页版可上榜", stats: st }); return; }
        s.auth.getSession().then(function (r) {
          var u = r && r.data && r.data.user;
          if (!u) { var st2 = saveLocal(p); emit({ signed: false, msg: "未登录，战绩已存本地", stats: st2 }); return; }
          var uid = u.id || u.uid || u.sub;
          var nick = u.nickname || u.name || "舍友";
          s.database.from('mg_matches').insert({ mode: p.mode, diff: p.diff, diff_name: p.diffName, win: !!p.win, wave: p.wave, kills: p.kills, duration: p.duration, sent: p.sent, loot: p.loot })['catch'](function () { });
          s.database.from('mg_players').select('id,wins,losses,best_wave,total_kills,score').eq('owner_id', uid).maybeSingle().then(function (q) {
            var row = q && q.data;
            var nw = (row ? row.wins : 0) + (p.win ? 1 : 0);
            var nl = (row ? row.losses : 0) + (p.win ? 0 : 1);
            var bw = Math.max(row ? row.best_wave : 0, p.wave || 0);
            var tk = (row ? row.total_kills : 0) + (p.kills || 0);
            var sc = nw * 120 - nl * 40 + bw * 25 + Math.floor(tk / 10);
            if (row) {
              s.database.from('mg_players').update({ nick: nick, wins: nw, losses: nl, best_wave: bw, total_kills: tk, score: sc, updated_at: new Date().toISOString() }).eq('owner_id', uid)['catch'](function () { });
            } else {
              s.database.from('mg_players').insert({ owner_id: uid, nick: nick, wins: nw, losses: nl, best_wave: bw, total_kills: tk, score: sc })['catch'](function () { });
            }
            emit({ signed: true, nick: nick, msg: '已同步到云端排行榜', stats: { win: nw, lose: nl, best: bw, kills: tk } });
          });
        });
      }
    };
  })()
});

MengGuiCore.probe(SERVER_BASE ? [SERVER_BASE] : [],
  SERVER_BASE ? ("连不上 " + SERVER_BASE + "，请确认 server.js 已启动、且开发者工具已关闭域名校验")
              : "未配置服务器地址：请在 game.js 顶部 SERVER_BASE 填入电脑的局域网 IP");
