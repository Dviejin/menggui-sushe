# 猛鬼宿舍 · 联机版

纯前端 Canvas 实现的塔防生存游戏，支持双人跨网联机对战。灵感来自微信小游戏《猛鬼宿舍》。

- **单机**：睡觉产金币 → 建发电机 / 电磁炮 / 冷凝塔 → 扛住 12 波猛鬼 → 门破后守护床
- **联机**：两人各自防守一间宿舍，同时互相投放鬼兵、偷电、破门咒干扰对手
- **难度**：轻松 / 普通 / 困难 / 噩梦 四档，影响血量、数量、伤害与经济

## 快速开始

```bash
node server/server.js        # 启动联机服务器，默认 :8080
```

浏览器打开 `http://localhost:8080` 即可玩；把局域网地址 `http://你的内网IP:8080` 发给同一 WiFi 下的朋友即可联机。

## 目录结构

| 路径 | 说明 |
|---|---|
| `index.html` | 游戏全部内容。核心逻辑包在 `CORE:BEGIN / CORE:END` 之间，不依赖 DOM，可被小游戏复用 |
| `server/server.js` | 零依赖 Node 联机服务器。房间状态存在进程内存，所以**必须单实例常驻** |
| `build-minigame.js` | 从 `index.html` 抽取核心，生成微信小游戏工程 `minigame/game.js` |
| `minigame/` | 微信小游戏工程 |
| `deploy/` | 部署快照（`index.html` + `server.js` + `package.json`） |
| `cloud-deploy/` | 云端部署物料：一键脚本、systemd、Docker、Caddy、部署手册 |
| `.github/workflows/deploy.yml` | push 到 main 时自动部署到你的云服务器 |

## 测试

```bash
node smoke-test.js                  # 冒烟：零异常 + 页面渲染
node balance-test.js 20 1           # AI 自动闯关 20 局，验证难度平衡
node net-test.js                    # 端到端联机：建房/加入/干扰/结算
node net-test.js http://公网地址    # 对已部署的服务器跑联机测试
```

## 部署

- **手把手教程**：[`cloud-deploy/部署步骤.md`](./cloud-deploy/部署步骤.md)
- **GitHub 自动部署**：[`cloud-deploy/GitHub部署.md`](./cloud-deploy/GitHub部署.md)
- **选型对比**：[`cloud-deploy/README.md`](./cloud-deploy/README.md)

一句话总结：买一台腾讯云 / 阿里云轻量 2核2G（约 68 元/年），放行 TCP 8080，
在项目目录执行 `.\cloud-deploy\deploy-from-windows.ps1 -Ip 你的公网IP` 即可上线。

> 联机服务器把房间存在进程内存里，因此**不能**部署到 Serverless 或会休眠的免费容器
> （Vercel / Netlify / Cloudflare Workers / Render 免费层）——房间会丢。

## 技术要点

- 逻辑分辨率 `720×1280`，等比缩放居中；所有 UI 用 Canvas 绘制
- 核心层不触碰 `window` / `document`，通过适配层注入 `request` / `copy` / `cloud` 等能力，
  同一份代码同时跑在浏览器和微信小游戏里
- 联机采用 HTTP 轮询同步（非 WebSocket），穿透性好、实现简单
- 服务端对客户端上报的动作做白名单校验与数值裁剪，防止作弊
