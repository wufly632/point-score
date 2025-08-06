#!/bin/bash

# 生产环境部署脚本
set -e

# 配置变量
PROJECT_DIR="/opt/poker-score"
COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DIR="$PROJECT_DIR/backups"
LOG_FILE="$PROJECT_DIR/deploy.log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# 检查是否为 root 用户
if [[ $EUID -eq 0 ]]; then
   error "请不要使用 root 用户运行此脚本"
fi

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    error "Docker 未安装，请先安装 Docker"
fi

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    error "Docker Compose 未安装，请先安装 Docker Compose"
fi

# 创建必要目录
create_directories() {
    log "创建必要目录..."
    mkdir -p "$PROJECT_DIR/data/db"
    mkdir -p "$PROJECT_DIR/data/logs"
    mkdir -p "$PROJECT_DIR/data/caddy-data"
    mkdir -p "$PROJECT_DIR/data/caddy-config"
    mkdir -p "$BACKUP_DIR"
    success "目录创建完成"
}

# 备份数据库
backup_database() {
    log "备份数据库..."
    if [ -f "$PROJECT_DIR/data/db/custom.db" ]; then
        TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        cp "$PROJECT_DIR/data/db/custom.db" "$BACKUP_DIR/custom_${TIMESTAMP}.db"
        success "数据库备份完成: custom_${TIMESTAMP}.db"
        
        # 保留最近 7 天的备份
        find "$BACKUP_DIR" -name "custom_*.db" -mtime +7 -delete
        log "清理旧备份完成"
    else
        warning "数据库文件不存在，跳过备份"
    fi
}

# 拉取最新镜像
pull_images() {
    log "拉取最新 Docker 镜像..."
    cd "$PROJECT_DIR"
    
    if docker compose -f "$COMPOSE_FILE" pull; then
        success "镜像拉取完成"
    else
        error "镜像拉取失败"
    fi
}

# 部署应用
deploy_app() {
    log "开始部署应用..."
    cd "$PROJECT_DIR"
    
    # 停止旧容器
    log "停止现有服务..."
    docker compose -f "$COMPOSE_FILE" down --remove-orphans
    
    # 启动新容器
    log "启动新服务..."
    if docker compose -f "$COMPOSE_FILE" up -d; then
        success "服务启动完成"
    else
        error "服务启动失败"
    fi
}

# 健康检查
health_check() {
    log "执行健康检查..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log "健康检查 (第 $attempt/$max_attempts 次)..."
        
        if curl -f -s "http://localhost:3000" > /dev/null 2>&1; then
            success "健康检查通过！"
            return 0
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            error "健康检查失败，服务可能未正常启动"
        fi
        
        sleep 10
        ((attempt++))
    done
}

# 清理资源
cleanup() {
    log "清理无用的 Docker 资源..."
    docker image prune -f
    docker container prune -f
    success "资源清理完成"
}

# 显示状态
show_status() {
    log "显示服务状态..."
    cd "$PROJECT_DIR"
    docker compose -f "$COMPOSE_FILE" ps
    docker compose -f "$COMPOSE_FILE" logs --tail=50
}

# 主函数
main() {
    log "开始部署 Poker Score 应用..."
    
    create_directories
    backup_database
    pull_images
    deploy_app
    health_check
    cleanup
    show_status
    
    success "🎉 部署完成！"
    log "应用已成功部署并运行在 http://localhost:3000"
}

# 如果有参数，执行相应操作
case "${1:-}" in
    "backup")
        backup_database
        ;;
    "pull")
        pull_images
        ;;
    "deploy")
        deploy_app
        ;;
    "health")
        health_check
        ;;
    "status")
        show_status
        ;;
    "cleanup")
        cleanup
        ;;
    *)
        main
        ;;
esac