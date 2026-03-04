# 🐳 Docker 部署指南

## 快速开始

### 方式一：Docker Hub 拉取（推荐）

```bash
# 1. 创建项目目录
mkdir author && cd author

# 2. 创建 docker-compose.yml
cat > docker-compose.yml << 'EOF'
services:
  author-app:
    image: yuanshijiloong/author:latest
    container_name: author-studio
    ports:
      - "3000:3000"
    env_file:
      - path: .env
        required: false
    restart: unless-stopped
EOF

# 3. 启动
docker compose up -d

# 4. 访问 http://localhost:3000
```

### 方式二：源码构建

```bash
# 1. 克隆仓库
git clone https://github.com/YuanShiJiLoong/author.git
cd author

# 2. 构建并启动
docker compose up -d --build

# 3. 访问 http://localhost:3000
```

## 配置 API Key

有两种方式配置：

### 方式 A：应用内配置（最简单）
启动后直接在应用内 ⚙️ 设置中填写 API Key，无需任何额外配置。

### 方式 B：环境变量配置
```bash
# 复制模板
cp .env.example .env

# 编辑 .env，填入你的 Key
# 例如使用智谱AI：
#   API_KEY=你的Key

# 重启生效
docker compose restart
```

## 自定义端口

```bash
# 方式1：修改 docker-compose.yml 中的端口映射
ports:
  - "8080:3000"   # 改为 8080

# 方式2：通过环境变量
PORT=8080 docker compose up -d
```

## 更新

### Docker Hub 拉取方式
```bash
docker compose down
docker compose pull
docker compose up -d
```

### 源码构建方式
```bash
git pull
docker compose down
docker compose up -d --build
```

## 反向代理（去掉端口号 + 自动 HTTPS）

如果你有域名，可以用 Caddy 反向代理，实现 `https://你的域名` 直接访问，不需要端口号：

```bash
# 1. 编辑 Caddyfile，将 author.example.com 替换为你的域名
nano Caddyfile

# 2. 使用带 Caddy 的 compose 文件启动
docker compose -f docker-compose.caddy.yml up -d

# 3. 访问 https://你的域名（自动签发 SSL 证书）
```

> ⚠️ 确保域名已解析到服务器 IP，且服务器 80/443 端口未被占用。

## 常见问题

### Q: 数据存储在哪里？
A: 数据存储在浏览器的 IndexedDB 和 localStorage 中，与容器无关。清除浏览器数据会丢失内容，重建容器不会。

### Q: 可以在手机/平板上使用吗？
A: 可以。部署到服务器后，在同一局域网内用手机浏览器访问 `http://服务器IP:3000` 即可。

### Q: 支持 HTTPS 吗？
A: Author 本身不内置 HTTPS。建议在前面加一层反向代理（如 Nginx、Caddy 或 Traefik），由反向代理处理 SSL 证书。

### Q: Docker Desktop 支持 Windows 吗？
A: 支持 Windows 10/11，需要启用 WSL2 或 Hyper-V。安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/) 后即可使用。
