# Docker 部署指南

这份文档介绍如何使用 GitHub Actions 自动构建 Docker 镜像并部署到生产环境。

## 🚀 部署架构

```
GitHub Actions → Docker Registry (GHCR) → 生产服务器 → Docker Compose → Caddy 反向代理
```

## 📋 前置准备

### 1. 服务器环境
```bash
# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装 Docker Compose
sudo apt-get install docker-compose-plugin

# 创建项目目录
sudo mkdir -p /opt/poker-score
sudo chown $USER:$USER /opt/poker-score
```

### 2. GitHub Secrets 配置
在 GitHub 仓库设置中添加以下 Secrets：

| Secret 名称 | 描述 | 示例 |
|-------------|------|------|
| `DEPLOY_HOST` | 服务器域名/IP | `your-server.com` |
| `DEPLOY_USER` | 服务器用户名 | `ubuntu` |
| `DEPLOY_PATH` | 部署路径 | `/opt/poker-score` |
| `DEPLOY_SSH_KEY` | SSH 私钥 | 完整的 SSH 私钥内容 |

### 3. SSH 密钥设置
```bash
# 本地生成 SSH 密钥对
ssh-keygen -t ed25519 -C "deploy@poker-score"

# 将公钥添加到服务器
ssh-copy-id -i ~/.ssh/id_ed25519.pub user@your-server.com

# 将私钥内容添加到 GitHub Secrets
cat ~/.ssh/id_ed25519
```

## 🔧 配置文件说明

### Dockerfile
多阶段构建，优化镜像大小：
- `deps`: 安装依赖
- `builder`: 构建应用
- `runner`: 生产运行环境

### docker-compose.yml (本地开发)
- 完整的开发环境
- 包含数据库持久化
- 集成 Caddy 反向代理

### docker-compose.prod.yml (生产环境)
- 使用 GHCR 镜像
- 生产级配置
- 健康检查和日志轮转

### Caddyfile
- 自动 HTTPS
- WebSocket 支持
- 静态资源缓存
- 安全头设置

## 🚀 部署流程

### 自动部署
1. 推送代码到 `main` 分支
2. GitHub Actions 自动触发
3. 构建并推送 Docker 镜像到 GHCR
4. 自动部署到生产服务器
5. 执行健康检查

### 手动部署
```bash
# 克隆仓库到服务器
cd /opt/poker-score
git clone <your-repo> .

# 修改配置
cp docker-compose.prod.yml docker-compose.yml
vim Caddyfile  # 修改域名

# 部署
./deploy.sh
```

## 🔍 管理命令

### 服务器操作
```bash
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 更新镜像
docker compose pull && docker compose up -d
```

### 部署脚本操作
```bash
# 完整部署
./deploy.sh

# 只备份数据库
./deploy.sh backup

# 只拉取镜像
./deploy.sh pull

# 只部署应用
./deploy.sh deploy

# 健康检查
./deploy.sh health

# 查看状态
./deploy.sh status

# 清理资源
./deploy.sh cleanup
```

## 📊 监控和日志

### 应用日志
```bash
# 实时日志
docker compose logs -f poker-score

# Caddy 日志
docker compose logs -f caddy

# 查看最近日志
docker compose logs --tail=100 poker-score
```

### 健康检查
访问 `https://your-domain.com` 检查应用状态

### 数据库备份
```bash
# 手动备份
./deploy.sh backup

# 自动备份 (crontab)
0 2 * * * /opt/poker-score/deploy.sh backup
```

## 🛠️ 故障排除

### 常见问题

#### 1. 健康检查失败
```bash
# 检查容器状态
docker compose ps

# 查看应用日志
docker compose logs poker-score

# 检查端口
netstat -tlnp | grep 3000
```

#### 2. SSL 证书问题
```bash
# 检查 Caddy 日志
docker compose logs caddy

# 重启 Caddy
docker compose restart caddy
```

#### 3. 数据库连接问题
```bash
# 检查数据目录权限
ls -la data/db/

# 重新生成数据库
docker compose exec poker-score npx prisma db push
```

#### 4. WebSocket 连接问题
确保 Caddyfile 中包含 WebSocket 支持配置：
```caddyfile
header_up Upgrade {>Upgrade}
header_up Connection {>Connection}
```

### 回滚部署
```bash
# 查看镜像历史
docker images | grep poker-score

# 使用特定版本
docker tag ghcr.io/username/poker-score:old-tag ghcr.io/username/poker-score:latest
docker compose up -d
```

## 🔐 安全考虑

1. **SSH 密钥管理**: 定期轮换 SSH 密钥
2. **镜像扫描**: GitHub Actions 包含安全扫描
3. **防火墙配置**: 只开放必要端口 (80, 443, 22)
4. **定期更新**: 保持基础镜像和依赖最新
5. **日志监控**: 监控异常访问和错误

## 📈 性能优化

1. **镜像优化**: 使用 Alpine 基础镜像
2. **缓存策略**: 利用 Docker 构建缓存
3. **静态资源**: Caddy 自动压缩和缓存
4. **数据库**: 考虑使用外部数据库

## 🎯 生产环境清单

- [ ] 域名 DNS 配置
- [ ] SSL 证书自动续期
- [ ] 数据库备份策略
- [ ] 监控和告警
- [ ] 日志轮转配置
- [ ] 安全防火墙规则
- [ ] 定期安全更新