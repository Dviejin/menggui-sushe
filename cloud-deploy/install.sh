#!/usr/bin/env bash
# =============================================================
#  猛鬼宿舍联机版 · 裸机一键部署脚本
#  适用：Ubuntu 20+/Debian 11+/CentOS 7+/Rocky/Alma 等 systemd 发行版
#
#  用法：把整个项目目录传到服务器后执行
#        cd menggui-sushe/cloud-deploy
#        chmod +x install.sh && sudo ./install.sh
#
#  可选环境变量：
#        PORT=9000 sudo ./install.sh     # 换个端口
#        SKIP_FIREWALL=1 sudo ./install.sh  # 不动防火墙（云平台用安全组时推荐）
# =============================================================
set -euo pipefail

PORT="${PORT:-8080}"
INSTALL_DIR="/opt/menggui-sushe"
SERVICE_NAME="menggui"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log()  { printf '\033[36m[部署]\033[0m %s\n' "$*"; }
ok()   { printf '\033[32m[完成]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[提示]\033[0m %s\n' "$*"; }
die()  { printf '\033[31m[失败]\033[0m %s\n' "$*"; exit 1; }

[ "$(id -u)" -eq 0 ] || die "请用 sudo 运行：sudo ./install.sh"

# ---------- 1. 校验源文件 ----------
[ -f "$SRC_DIR/server/server.js" ] || [ -f "$SRC_DIR/server.js" ] || die "找不到 server.js，请在项目目录下执行"
[ -f "$SRC_DIR/index.html" ]       || die "找不到 index.html，请在项目目录下执行"

SRV="$SRC_DIR/server/server.js"
[ -f "$SRV" ] || SRV="$SRC_DIR/server.js"

# ---------- 2. 安装 Node.js ----------
node_ok() {
  command -v node >/dev/null 2>&1 || return 1
  local v; v="$(node -v 2>/dev/null | sed 's/^v//' | cut -d. -f1)"
  [ -n "$v" ] && [ "$v" -ge 18 ] 2>/dev/null
}

detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64) echo "x64" ;;
    aarch64|arm64) echo "arm64" ;;
    *) echo "" ;;
  esac
}

# 方式一：从国内镜像拉官方二进制（国内机器最快、最稳，同时也是 ARM 机器唯一可靠途径）
install_node_binary() {
  local arch; arch="$(detect_arch)"
  [ -n "$arch" ] || return 1
  if ! command -v curl >/dev/null 2>&1; then
    command -v apt-get >/dev/null 2>&1 && apt-get install -y -qq curl xz-utils >/dev/null 2>&1
    command -v yum     >/dev/null 2>&1 && yum install -y -q curl xz >/dev/null 2>&1
    command -v dnf     >/dev/null 2>&1 && dnf install -y -q curl xz >/dev/null 2>&1
  fi
  local ver="v22.11.0"
  local url="https://npmmirror.com/mirrors/node/${ver}/node-${ver}-linux-${arch}.tar.xz"
  log "从国内镜像下载 Node ${ver} (${arch}) ..."
  curl -fsSL --max-time 180 "$url" -o /tmp/node.tar.xz || return 1
  rm -rf /usr/local/bin/node /usr/local/lib/node_modules >/dev/null 2>&1
  tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 || return 1
  rm -f /tmp/node.tar.xz
  hash -r 2>/dev/null
  node_ok
}

# 方式二：NodeSource 官方源
install_node_repo() {
  log "通过 NodeSource 安装 Node 22 ..."
  if command -v apt-get >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq curl ca-certificates >/dev/null || return 1
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1 || return 1
    apt-get install -y -qq nodejs >/dev/null 2>&1 || return 1
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y curl >/dev/null 2>&1 || return 1
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - >/dev/null 2>&1 || return 1
    dnf install -y nodejs >/dev/null 2>&1 || return 1
  elif command -v yum >/dev/null 2>&1; then
    yum install -y curl >/dev/null 2>&1 || return 1
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - >/dev/null 2>&1 || return 1
    yum install -y nodejs >/dev/null 2>&1 || return 1
  else
    return 1
  fi
  hash -r 2>/dev/null
  node_ok
}

# 方式三：系统自带源（版本可能偏旧，但 server.js 只用 ES5 语法，Node 12 也能跑）
install_node_distro() {
  log "退回系统软件源安装 nodejs（版本可能较旧）..."
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq && apt-get install -y -qq nodejs >/dev/null 2>&1
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y nodejs >/dev/null 2>&1
  elif command -v yum >/dev/null 2>&1; then
    yum install -y nodejs >/dev/null 2>&1
  else
    return 1
  fi
  command -v node >/dev/null 2>&1
}

install_node() {
  if node_ok; then
    ok "已安装 Node $(node -v)，跳过"
    return
  fi
  install_node_binary && { ok "Node $(node -v) 安装完成（镜像二进制）"; return; }
  install_node_repo   && { ok "Node $(node -v) 安装完成（NodeSource）";  return; }
  install_node_distro && { warn "Node $(node -v) 安装完成（系统源，版本较旧但不影响运行）"; return; }
  die "三种方式都失败了，请手动安装 Node 后重跑本脚本"
}
install_node

# ---------- 3. 布置文件 ----------
log "部署文件到 $INSTALL_DIR ..."
mkdir -p "$INSTALL_DIR"
install -m 644 "$SRV"                 "$INSTALL_DIR/server.js"
install -m 644 "$SRC_DIR/index.html"  "$INSTALL_DIR/index.html"
cat > "$INSTALL_DIR/package.json" <<'JSON'
{
  "name": "menggui-sushe",
  "version": "1.0.0",
  "private": true,
  "main": "server.js",
  "scripts": { "start": "node server.js" }
}
JSON
ok "文件就位"

# ---------- 4. 写 systemd 服务 ----------
log "注册 systemd 服务 ${SERVICE_NAME}.service ..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<UNIT
[Unit]
Description=MengGui Sushe Online Server
After=network.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
ExecStart=$(command -v node) ${INSTALL_DIR}/server.js
Environment=PORT=${PORT}
Environment=NODE_ENV=production
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable "$SERVICE_NAME" >/dev/null 2>&1
systemctl restart "$SERVICE_NAME"
sleep 1.5
ok "服务已启动并设为开机自启"

# ---------- 5. 放通端口 ----------
if [ "${SKIP_FIREWALL:-0}" != "1" ]; then
  log "放通 ${PORT} 端口 ..."
  if command -v ufw >/dev/null 2>&1; then
    ufw allow "${PORT}/tcp" >/dev/null 2>&1 || true
  elif command -v firewall-cmd >/dev/null 2>&1; then
    systemctl is-active --quiet firewalld && firewall-cmd --permanent --add-port="${PORT}/tcp" >/dev/null 2>&1 || true
    firewall-cmd --reload >/dev/null 2>&1 || true
  fi
  ok "系统防火墙已放行"
else
  warn "已跳过系统防火墙（请记得在云控制台『安全组/防火墙』放通 ${PORT}）"
fi

# ---------- 6. 健康检查 ----------
sleep 1
PUB_IP="$(curl -fsS --max-time 4 https://api.ipify.org 2>/dev/null || curl -fsS --max-time 4 http://ifconfig.me 2>/dev/null || echo '')"
if PONG="$(curl -fsS --max-time 4 "http://127.0.0.1:${PORT}/api/ping" 2>/dev/null)"; then
  ok "健康检查通过： $PONG"
else
  die "服务未响应，请执行： journalctl -u ${SERVICE_NAME} -n 50 --no-pager"
fi

echo ""
echo "  ============================================================"
echo "   猛鬼宿舍联机服务器已上线"
echo "  ------------------------------------------------------------"
if [ -n "$PUB_IP" ]; then
  echo "   分享给好友的链接:  http://${PUB_IP}:${PORT}"
else
  echo "   分享给好友的链接:  http://<你的公网IP>:${PORT}"
fi
echo "  ------------------------------------------------------------"
echo "   查状态: systemctl status ${SERVICE_NAME}"
echo "   看日志: journalctl -u ${SERVICE_NAME} -f"
echo "   重启:   systemctl restart ${SERVICE_NAME}"
echo "   更新:   替换 ${INSTALL_DIR}/index.html 后执行 systemctl restart ${SERVICE_NAME}"
echo "  ------------------------------------------------------------"
if [ -n "$PUB_IP" ]; then
  echo "   注意: 云服务器请在控制台『安全组』放通 TCP ${PORT}"
  echo "   一切正常后把上面的链接发到微信群，好友点开即可对战"
fi
echo "  ============================================================"
echo ""
