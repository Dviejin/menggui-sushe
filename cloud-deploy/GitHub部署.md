# 能放到 GitHub 上部署吗？两种可行路线

## 先说结论：GitHub Pages 不行，但 GitHub 很有用

| 你的想法 | 能不能行 | 原因 |
|---|---|---|
| 代码放 GitHub Pages，游戏直接能联机 | ❌ **不行** | Pages 只托管静态文件（HTML/CSS/JS），**没有 Node 服务端**。而你的房间状态活在服务进程的内存里，必须有常驻进程 |
| 用 GitHub 管代码，**自动部署**到云服务器 | ✅ **强烈推荐** | 用 GitHub Actions，`git push` 一下就自动上线，还免费生成操作记录 |
| GitHub 直连云平台托管（Render 等） | ✅ 可行但要妥协 | 见方案 B，会有休眠和高延迟问题 |
| Cloudflare Workers + Durable Objects（免费、天然单例，技术上最优雅） | ⚠️ **不推荐** | 技术上完美匹配房间模型，但 Cloudflare 在中国大陆访问很不稳定，经常丢包/超时 |

一句话：**GitHub 当"版本仓库 + 自动化触发器"，服务器还是那台云服务器** —— 这样既保留了国内低延迟，又拿到了自动化。

---

## 方案 A（推荐）：GitHub Actions 自动部署到你的云服务器

我已经把流水线写好了，就在 `.github/workflows/deploy.yml`。本地仓库也已初始化好。

### 1. 在 GitHub 建个仓库

浏览器打开 <https://github.com/new> ，Repository name 填 **`menggui-sushe`**，
Visibility 选 Public（或 Private，私有仓库 Actions 每月也有 2000 分钟免费额度），
**不要勾选**添加 README / .gitignore / License（本地已经有了），然后 Create repository。

> 用户名：`Dviejin`，仓库名：`menggui-sushe`，下面所有命令都已按这个填好，直接复制即可。
> 本地的 `git remote` 也已经配好了，所以你创建完仓库后**只需要执行最后那条 push**。
> 你的仓库地址：<https://github.com/Dviejin/menggui-sushe>

### 2. 推上去（两种方式，任选一种）

#### 方式 1：用项目里自带的 GitHub CLI（推荐，免安装）

我已经把 GitHub CLI 下载解压到项目里了（在 `.ghcli/`，约 15MB，已被 .gitignore 排除不会提交）。
直接复制这两条：

```powershell
cd D:\1-微信文件\2026-10-09-14-12-01\menggui-sushe
.\.ghcli\bin\gh.exe auth login --web
```

第一条命令会给你一个**一次性码**（形如 `ABCD-1234`），它还会提示按回车打开浏览器。
去 <https://github.com/login/device> 输入这个码并点授权，回来就登录好了。

```powershell
.\.ghcli\bin\gh.exe repo create menggui-sushe --public --source=. --remote=origin --push
```

第二条会自动建仓、连远端、推送代码，一步到位。
想建私有仓库就把 `--public` 换成 `--private`。

#### 方式 2：自己建仓库 + 纯 git push

到 <https://github.com/new> 建一个空仓库（name 填 `menggui-sushe`，**别勾选** README/.gitignore/License），
远端我已经配好了，你只要：

```powershell
cd D:\1-微信文件\2026-10-09-14-12-01\menggui-sushe
git push -u origin main
```

> **第一次 push 的认证**，按出现的情况处理：
> - 弹出 GitHub 登录窗口 / 浏览器 → 直接授权即可（你已经登录过，通常点一下就过）
> - 提示输入用户名密码 → 密码框要填的是 **Personal Access Token**，不是账号密码。
>   到 <https://github.com/settings/tokens> → Generate new token (classic) → 勾选 **repo** → 生成后粘贴进去
> - 一直卡在 `Logon failed` → 用这条一次性命令（把 `<TOKEN>` 换成刚生成的令牌）：
>   ```powershell
>   git push https://Dviejin:<TOKEN>@github.com/Dviejin/menggui-sushe.git main
>   ```

> 说明：本来可以装 GitHub CLI 一条命令搞定，但这台机器连 GitHub 下载通道不通
> （winget 和直连 release CDN 都会超时），所以走上面这条同样只需 1 分钟的路。

### 3. 生成一对专用 SSH 密钥（给 GitHub 用，不要用自己的老密钥）

```powershell
ssh-keygen -t ed25519 -C "github-deploy" -f "$env:USERPROFILE\.ssh\gh_deploy"
```
一路回车，不要设密码。

### 4. 把公钥放到服务器上（让 GitHub 有权限登录）

```powershell
type "$env:USERPROFILE\.ssh\gh_deploy.pub" | ssh root@你的公网IP "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
```

### 5. 把私钥告诉 GitHub

```powershell
Get-Content "$env:USERPROFILE\.ssh\gh_deploy" | Set-Clipboard
```
然后去仓库的
**Settings → Secrets and variables → Actions → New repository secret**
（直达：<https://github.com/Dviejin/menggui-sushe/settings/secrets/actions>），添加：

| Name | Value |
|---|---|
| `SSH_PRIVATE_KEY` | 刚复制的私钥全文（含 `-----BEGIN` / `-----END` 两行） |
| `SERVER_HOST` | 你的公网 IP |
| `SERVER_USER` | 登录用户名，一般填 `root` |

> 可选：Settings → Secrets and variables → Actions → **Variables** 里加 `SERVER_PORT`（不填默认 8080）。

### 6. 完事 —— 试一下

以后改完游戏只要三步：

```powershell
git add -A
git commit -m "调整平衡"
git push
```

GitHub 会自动：上传文件 → 在服务器跑 install.sh → 做健康检查 → 告诉你成功还是失败。
去仓库的 **Actions** 标签页能看到全过程日志，成功后 summary 里会直接给出游戏链接。

不想 push 也想部署？Actions 页面右上角有 **Run workflow** 按钮，可以手动触发。

---

## 方案 B：不想管服务器？用 Render 一键托管

仓库根目录的 `render.yaml` 就是给 Render 用的「Blueprint」配置。流程：

1. 把代码推到 GitHub（同上第 1–2 步）
2. 打开 <https://dashboard.render.com/blueprints> → New Blueprint Instance → 选中你的仓库
3. 一路下一步，它会自动识别 `render.yaml` 并部署

**但请先看清楚这几个代价**：

| 问题 | 说明 |
|---|---|
| 🛌 免费层会休眠 | 15 分钟没人访问就冻结进程，**下次进来第一次要等几十秒**，且**进行中的房间全部丢失** |
| 💰 不休眠要付费 | Starter 套餐约 **$7/月 ≈ 50 元/月**（比国内轻量贵 8 倍） |
| 🌏 服务器在海外 | Render 无中国大陆节点，新加坡也要 80–150ms，延迟是国内轻量的 5–10 倍 |
| ⚠️ 多副本风险 | 免费层是单实例没问题，升级后要留意不要开启多副本 |

> 同类平台还有 **Zeabur**（有日本节点，$5 免费额度/月）、**Fly.io**（可选东京/新加坡，需绑卡）、**Koyeb**。
> 都支持 GitHub 推送自动部署，但免费额度普遍要么会休眠、要么资源很紧。

---

## 两个方案怎么选

| | 方案 A：GitHub + 云服务器 | 方案 B：Render 等 PaaS |
|---|---|---|
| 年成本 | **约 68 元/年** | 免费（会休眠）/ 约 600 元/年（不休眠） |
| 国内延迟 | **10–25 ms** | 80–150 ms |
| 房间会不会丢 | 基本不会（除非服务器重启） | 免费层必然丢 |
| 需要动手配置 | 5 分钟配一次密钥 | 3 分钟连仓库 |
| 后续更新 | `git push` 自动上线 | `git push` 自动上线 |

> **我的建议**：走方案 A。服务器那一台按 [部署步骤.md](./部署步骤.md) 买好，
> 再花 5 分钟配好 GitHub Actions，你就同时拥有了低延迟和自动化。
> 方案 B 只适合"我完全不想碰服务器"或者"朋友都在海外"的情况。

---

## 常见问题

**Q：Actions 报 `Permission denied (publickey)`？**
私钥粘贴不完整（少了首尾行或多加了空格），或者公钥没正确写进服务器的 `authorized_keys`。重做第 3–5 步。

**Q：Actions 一直停在 ssh 连接？**
服务器的 22 端口没放行，或者 `SERVER_HOST` 填错了。先在**自己电脑上**确认 `ssh root@IP` 能连上。

**Q：我不想让别人看到我的代码？**
建仓库时选 **Private** 即可，GitHub Actions 对私有仓库有一定免费额度（每月 2000 分钟，个人用足够）。

**Q：仓库里会不会泄露我的服务器密码？**
不会。我们用的是 SSH 密钥而非密码，私钥存在 GitHub Secrets 里是加密的，
且 Actions 日志中会自动打码。记得**千万别**把 `gh_deploy`（私钥文件）本身提交进仓库。
