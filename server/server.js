/**
 * 猛鬼宿舍 · 联机服务器（零依赖，Node 原生 http）
 *
 * 启动：  node server.js          （默认 8080）
 *         PORT=9000 node server.js
 *
 * 打开：  本机浏览器   http://localhost:8080
 *        同局域网设备 http://<本机内网IP>:8080
 *
 * 说明：服务器同时托管游戏页面，因此客户端用相对路径 /api/... 请求，
 *      手机无需额外配置服务器地址。
 */
'use strict';
var http = require('http');
var fs = require('fs');
var path = require('path');
var os = require('os');

var PORT = parseInt(process.env.PORT || '8080', 10);
/* 页面位置：优先与 server.js 同级（部署版），否则取上一级（开发版） */
var PAGE = (function () {
  var cands = [path.join(__dirname, 'index.html'), path.join(__dirname, '..', 'index.html')];
  for (var i = 0; i < cands.length; i++) { if (fs.existsSync(cands[i])) return cands[i]; }
  return cands[0];
})();

/* ---------- 房间存储（内存） ---------- */
var rooms = Object.create(null);   // id -> room
var byCode = Object.create(null);  // code -> id
var seq = 1;

function genCode() {
  for (var i = 0; i < 500; i++) {
    var c = String(Math.floor(1000 + Math.random() * 9000));
    if (!byCode[c]) return c;
  }
  return String(Date.now() % 10000);
}
function makeRoom(diff) {
  var id = 'r' + (seq++) + '_' + Date.now().toString(36);
  var code = genCode();
  var room = {
    id: id, code: code, diff: (typeof diff === 'number' ? diff : 1),
    status: 'wait',
    host: null, guest: null,
    events: [],
    createdAt: Date.now(), lastAct: Date.now()
  };
  rooms[id] = room;
  byCode[code] = id;
  return room;
}
function publicRoom(r) {
  return {
    id: r.id, code: r.code, diff: r.diff, status: r.status,
    host: r.host ? { uid: r.host.uid, nick: r.host.nick } : null,
    guest: r.guest ? { uid: r.guest.uid, nick: r.guest.nick } : null
  };
}
function seatOf(r, uid) {
  if (r.host && r.host.uid === uid) return r.host;
  if (r.guest && r.guest.uid === uid) return r.guest;
  return null;
}
function otherSeat(r, uid) {
  if (r.host && r.host.uid === uid) return r.guest;
  if (r.guest && r.guest.uid === uid) return r.host;
  return null;
}
function baseState(uid, nick) {
  return { uid: uid, nick: nick || '玩家', wave: 0, kills: 0, bedPct: 1, doorPct: 1, alive: true, finished: false, win: false, time: 0, sent: 0, lootKills: 0, shield: 0 };
}

/* 允许的对对手动作：type -> {min,max,def} 约束 value */
var ACTIONS = {
  send_ghost:  { min: 1, max: 5, def: 2 },
  ghost_horde: { min: 1, max: 8, def: 4 },
  ghost_king:  { min: 1, max: 1, def: 1 },
  power_out:   { min: 1, max: 15, def: 8 },
  door_curse:  { min: 1, max: 60, def: 35 }
};

/* ---------- 清理过期房间 ---------- */
setInterval(function () {
  var now = Date.now(), keys = Object.keys(rooms);
  for (var i = 0; i < keys.length; i++) {
    var r = rooms[keys[i]];
    if (now - r.lastAct > 10 * 60 * 1000) {
      delete byCode[r.code];
      delete rooms[keys[i]];
    }
  }
}, 60000).unref();

/* ---------- HTTP ---------- */
function json(res, obj, code) {
  var body = JSON.stringify(obj);
  res.writeHead(code || 200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}
function readBody(req, cb) {
  var buf = '';
  req.on('data', function (d) {
    buf += d;
    if (buf.length > 1e6) req.destroy();
  });
  req.on('end', function () {
    try { cb(buf ? JSON.parse(buf) : {}); } catch (e) { cb({}); }
  });
}

function handleRoom(body) {
  var uid = String(body.uid || '');
  if (!uid) return { ok: false, msg: '缺少 uid' };
  var nick = String(body.nick || '玩家').slice(0, 12);

  if (body.action === 'create') {
    var r = makeRoom(body.diff);
    r.host = baseState(uid, nick);
    return { ok: true, room: publicRoom(r) };
  }
  /* 快速匹配：优先加入同难度、仍在等人的房间，没有就自己开一间 */
  if (body.action === 'quick') {
    var qd = (typeof body.diff === 'number') ? body.diff : 1;
    var cand = null, any = null, rid;
    for (rid in rooms) {
      var rr2 = rooms[rid];
      if (!rr2.host || rr2.guest) continue;
      if (rr2.host.uid === uid) return { ok: true, room: publicRoom(rr2), matched: 'self' };
      if (Date.now() - rr2.lastAct > 10 * 60 * 1000) continue;
      if (rr2.diff === qd) { cand = rr2; break; }
      if (!any) any = rr2;
    }
    var tg = cand || any;
    if (tg) {
      tg.guest = baseState(uid, nick);
      tg.status = 'playing';
      tg.lastAct = Date.now();
      return { ok: true, room: publicRoom(tg), matched: cand ? 'same' : 'any' };
    }
    var nr = makeRoom(qd);
    nr.host = baseState(uid, nick);
    return { ok: true, room: publicRoom(nr), matched: 'new' };
  }
  if (body.action === 'join') {
    var code = String(body.code || '');
    var id = byCode[code];
    var room = id ? rooms[id] : null;
    if (!room) return { ok: false, msg: '房间不存在' };
    if (room.host && room.host.uid === uid) return { ok: true, room: publicRoom(room) };
    if (!room.guest) {
      room.guest = baseState(uid, nick);
      room.status = 'playing';
      room.diff = (room.host && typeof body.diff === 'number') ? room.diff : room.diff;
    }
    return { ok: true, room: publicRoom(room) };
  }
  if (body.action === 'get') {
    var rid = String(body.roomId || '');
    var rr = rooms[rid];
    if (!rr) return { ok: false, msg: '房间已失效' };
    return { ok: true, room: publicRoom(rr) };
  }
  return { ok: false, msg: '未知操作' };
}

function handleState(body) {
  var room = rooms[String(body.roomId || '')];
  if (!room) return { ok: false, msg: '房间已失效' };
  var seat = seatOf(room, String(body.uid || ''));
  if (!seat) return { ok: false, msg: '不在该房间' };
  room.lastAct = Date.now();

  var st = body.st || {};
  seat.wave = st.wave || 0;
  seat.kills = st.kills || 0;
  seat.bedPct = (typeof st.bedPct === 'number') ? st.bedPct : 1;
  seat.doorPct = (typeof st.doorPct === 'number') ? st.doorPct : 1;
  seat.alive = st.alive !== false;
  seat.finished = !!st.finished;
  seat.win = !!st.win;
  seat.time = st.time || 0;
  seat.sent = st.sent || 0;
  seat.lootKills = st.lootKills || 0;
  seat.shield = st.shield || 0;
  if (st.nick) seat.nick = String(st.nick).slice(0, 12);

  // 取走属于自己的事件
  var mine = [], rest = [];
  for (var i = 0; i < room.events.length; i++) {
    if (room.events[i].to === seat.uid) mine.push(room.events[i]);
    else rest.push(room.events[i]);
  }
  room.events = rest;

  var opp = otherSeat(room, seat.uid);
  return {
    ok: true,
    room: publicRoom(room),
    opp: opp ? {
      uid: opp.uid, nick: opp.nick, wave: opp.wave, kills: opp.kills,
      bedPct: opp.bedPct, doorPct: opp.doorPct, alive: opp.alive,
      finished: opp.finished, win: opp.win, time: opp.time,
      sent: opp.sent, lootKills: opp.lootKills, shield: opp.shield
    } : null,
    events: mine.map(function (e) { return { type: e.type, value: e.value }; })
  };
}

function handleAction(body) {
  var room = rooms[String(body.roomId || '')];
  if (!room) return { ok: false, msg: '房间已失效' };
  var seat = seatOf(room, String(body.uid || ''));
  if (!seat) return { ok: false, msg: '不在该房间' };
  room.lastAct = Date.now();
  var opp = otherSeat(room, seat.uid);
  if (!opp) return { ok: false, msg: '对手未加入' };
  var rule = ACTIONS[body.type];
  if (!rule) return { ok: false, msg: '未知动作' };
  if (seat.lastAct && Date.now() - seat.lastAct < 300) return { ok: false, msg: '手速太快了' };
  seat.lastAct = Date.now();
  var v = parseInt(body.value, 10);
  if (!isFinite(v)) v = rule.def;
  v = Math.max(rule.min, Math.min(rule.max, v));
  room.events.push({ to: opp.uid, type: body.type, value: v, ts: Date.now() });
  return { ok: true };
}

function servePage(res, req) {
  fs.readFile(PAGE, function (err, data) {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('读取 index.html 失败');
      return;
    }
    var html = data.toString('utf8');
    // 把服务器自身的访问地址注入页面，客户端即可自动连上（无需手工配置）
    var hh = (req && req.headers) || {};
    var raw = hh.host || ('127.0.0.1:' + PORT);
    var name = raw.split(':')[0];
    // 内网直连（localhost / 局域网 IP）才补端口；经反向代理时用代理给的协议与域名。
    // 公网 IP 直连（无反代、无 x-forwarded-proto）必须回落成 http，否则会注入成
    // https://IP:8080 导致客户端连不上——这是纯 IP 部署最常见的坑。
    var inner = /^(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(name);
    var base;
    if (inner) {
      base = 'http://' + (raw.indexOf(':') >= 0 ? raw : (raw + ':' + PORT));
    } else {
      var proto = process.env.FORCE_HTTPS === '1' ? 'https' : null;
      if (!proto) {
        proto = (hh['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
        if (!proto) proto = (String(hh['x-forwarded-ssl'] || '').toLowerCase() === 'on') ? 'https' : 'http';
      }
      base = proto + '://' + raw;
    }
    html = html.replace("var INJECT_SERVER = '';", "var INJECT_SERVER = '" + base + "';");
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(html, 'utf8');
  });
}

var server = http.createServer(function (req, res) {
  var url = (req.url || '/').split('?')[0];

  if (req.method === 'OPTIONS') { json(res, { ok: true }); return; }

  if (url === '/' || url === '/index.html') {
    if (req.method === 'GET') { servePage(res, req); return; }
  }
  if (url === '/api/room' || url === '/api/state' || url === '/api/action') {
    if (req.method !== 'POST') { json(res, { ok: false, msg: '仅支持 POST' }, 405); return; }
    readBody(req, function (body) {
      var out;
      try {
        if (url === '/api/room') out = handleRoom(body);
        else if (url === '/api/state') out = handleState(body);
        else out = handleAction(body);
      } catch (e) {
        out = { ok: false, msg: '服务器内部错误' };
      }
      json(res, out);
    });
    return;
  }
  if (url === '/api/ping') { json(res, { ok: true, rooms: Object.keys(rooms).length }); return; }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404');
});

server.listen(PORT, '0.0.0.0', function () {
  var ips = [];
  var nets = os.networkInterfaces();
  Object.keys(nets).forEach(function (k) {
    (nets[k] || []).forEach(function (n) {
      if (n && n.family === 'IPv4' && !n.internal) ips.push(n.address);
    });
  });
  console.log('');
  console.log('  猛鬼宿舍联机服务器已启动');
  console.log('  ------------------------------------------');
  console.log('  本机访问:      http://localhost:' + PORT);
  ips.forEach(function (ip) { console.log('  同局域网访问:  http://' + ip + ':' + PORT); });
  console.log('  ------------------------------------------');
  console.log('  把上面的局域网地址发给好友，进入游戏点「联机对战」即可对战');
  console.log('');
});
