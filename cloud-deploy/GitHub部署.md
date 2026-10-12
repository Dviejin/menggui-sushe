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

### 1. 仓库已建好 ✅

仓库地址：**<https://github.com/Dviejin/menggui-sushe>**（Public）。

25 个文件已经全部推上去了，并与本地做过逐字节比对，内容完全一致。
唯一还差的是 `.github/workflows/deploy.yml` —— 原因见下。

### 2. 你只需要做这一件事：把工作流文件补上（1 分钟）

GitHub 规定：**写 `.github/workflows/` 下的文件需要 token 额外具备 `workflow` 权限**。
之前用的令牌只勾了 `repo`，GitHub 会故意返回 404（而不是 403）来拒绝，
所以这个文件我推不上去，得由你这边完成。两种办法，随便挑一个：

#### 办法 1：在 GitHub 网页上建（推荐，不用再生成令牌）

1. 打开 <https://github.com/Dviejin/menggui-sushe> → 点右上角绿色 **Code** 按钮旁边的 **Add file** → **Create new file**
2. 文件名框里**完整输入**这一串（GitHub 会自动把斜杠变成目录）：
   ```
   .github/workflows/deploy.yml
   ```
3. 用编辑器打开本机的 `D:\1-微信文件\2026-10-09-14-12-01\menggui-sushe\.github\workflows\deploy.yml`，
   **全选复制 → 粘贴**到网页的编辑框里
4. 拉到最下面，点 **Commit changes**（直接提交到 main 即可）

#### 办法 2：重新生成一个带 workflow 权限的令牌

打开下面这个链接（权限已预填好，拉到最下面点 Generate token）：

<https://github.com/settings/tokens/new?scopes=repo,workflow&description=menggui-deploy>

把生成的 `ghp_` 开头的令牌发给我，剩下的我来做。

### 3. 把本地仓库和远端对齐（让以后的 `git push` 能用）

远端的文件是我通过 API 直接写的，和本地仓库的历史不是同一条线。在你自己的 PowerShell 里跑一遍即可拉齐：

```powershell
cd D:\1-微信文件\2026-10-09-14-12-01\menggui-sushe
git fetch origin main
git reset --soft origin/main
git add -A
git commit -m "对齐远端仓库"
git push -u origin main
```

跑完 `git status` 应该是干净的，之后你改完游戏直接 `git add -A && git commit -m "..." && git push` 就行。

> 如果 `git fetch`/`git push` 在你这儿也报 `schannel: server closed abruptly` 之类网络错误，
> 那就走办法 1 上传工作流文件，日常改动发给我、我走 API 推送即可。

### 4. 生成一对专用 SSH 密钥（给 GitHub 用，不要用自己的老密钥）

```powershell
ssh-keygen -t ed25519 -C "github-deploy" -f "$env:USERPROFILE\.ssh\gh_deploy"
```
一路回车，不要设密码。

### 5. 把公钥放到服务器上（让 GitHub 有权限登录）

```powershell
type "$env:USERPROFILE\.ssh\gh_deploy.pub" | ssh root@你的公网IP "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
```

### 6. 把私钥告诉 GitHub

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

### 7. 完事 —— 试一下

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

1. 代码已经在仓库里了，这步跳过
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
