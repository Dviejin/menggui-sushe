# =============================================================
#  猛鬼宿舍联机版 · Windows 本机一键推送部署
#
#  作用：把你电脑上改好的游戏传到云服务器，并自动完成部署。
#        Win10 1809+ 自带 ssh/scp，无需安装任何软件。
#
#  用法（打开 PowerShell，进到项目目录）：
#        .\cloud-deploy\deploy-from-windows.ps1 -Ip 123.45.67.89
#
#  常用参数：
#        -Ip        服务器公网 IP（必填）
#        -User      登录用户名，默认 root
#        -Port      游戏端口，默认 8080
#        -SkipTest  部署完不跑联机验收测试
# =============================================================
param(
    [Parameter(Mandatory = $true)][string]$Ip,
    [string]$User = "root",
    [int]$Port = 8080,
    [switch]$SkipTest
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$target = "menggui-sushe"

function Say($msg, $color = "Cyan") { Write-Host "[部署] $msg" -ForegroundColor $color }

# ---------- 0. 环境自检 ----------
foreach ($cmd in @("ssh", "scp")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Host "[失败] 本机没有 $cmd 命令。" -ForegroundColor Red
        Write-Host "       请到 设置 → 应用 → 可选功能 → 添加『OpenSSH 客户端』，" -ForegroundColor Yellow
        Write-Host "       或者改用 OrcaTerm / FinalShell 等工具手动上传。" -ForegroundColor Yellow
        exit 1
    }
}

$indexHtml  = Join-Path $root "index.html"
$serverJs   = Join-Path $root "server\server.js"
$installSh  = Join-Path $PSScriptRoot "install.sh"
foreach ($f in @($indexHtml, $serverJs, $installSh)) {
    if (-not (Test-Path $f)) { Write-Host "[失败] 找不到文件：$f" -ForegroundColor Red; exit 1 }
}

Say "目标服务器：$User@$Ip   游戏端口：$Port"
$remote = "${User}@${Ip}"

# ---------- 1. 准备远端目录 ----------
Say "准备远端目录 ~/$target ..."
ssh $remote "mkdir -p ~/$target/server ~/$target/cloud-deploy" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[失败] SSH 连接不上。请检查：公网 IP 是否正确、22 端口是否放行、用户名是否为 $User" -ForegroundColor Red
    exit 1
}

# ---------- 2. 上传文件 ----------
Say "上传 index.html ..."
scp $indexHtml "${remote}:~/$target/index.html"
if ($LASTEXITCODE -ne 0) { Write-Host "[失败] 上传 index.html 失败" -ForegroundColor Red; exit 1 }

Say "上传 server.js ..."
scp $serverJs "${remote}:~/$target/server/server.js"
if ($LASTEXITCODE -ne 0) { Write-Host "[失败] 上传 server.js 失败" -ForegroundColor Red; exit 1 }

Say "上传 install.sh ..."
scp $installSh "${remote}:~/$target/cloud-deploy/install.sh"
if ($LASTEXITCODE -ne 0) { Write-Host "[失败] 上传 install.sh 失败" -ForegroundColor Red; exit 1 }

# ---------- 3. 远端执行部署 ----------
Say "在服务器上执行一键部署（这一步会装 Node，可能需要 1-3 分钟）..."
$chmodPart = "chmod +x ~/$target/cloud-deploy/install.sh && cd ~/$target/cloud-deploy"
$sudoPart  = 'if [ "$(id -u)" = "0" ]; then PORT=' + $Port + ' bash install.sh; else PORT=' + $Port + ' sudo bash install.sh; fi'
$deployCmd = $chmodPart + " && " + $sudoPart
ssh $remote $deployCmd
if ($LASTEXITCODE -ne 0) {
    Write-Host "[失败] 部署脚本执行出错，可以到服务器上运行 journalctl -u menggui -n 50 看日志" -ForegroundColor Red
    exit 1
}

# ---------- 4. 本地验收 ----------
$url = "http://${Ip}:${Port}"
Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Green
Write-Host "   部署完成！把这个链接发到微信群就能一起玩：" -ForegroundColor Green
Write-Host "   $url" -ForegroundColor Yellow
Write-Host "  ============================================================" -ForegroundColor Green
Write-Host ""

if (-not $SkipTest) {
    Say "正在跑联机端到端验收测试..."
    Push-Location $root
    try {
        & node (Join-Path $root "net-test.js") $url
    } finally {
        Pop-Location
    }
}
