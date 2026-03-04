# 🐳 Docker Deployment Guide

## Quick Start

### Option 1: Pull from Docker Hub (Recommended)

```bash
# 1. Create project directory
mkdir author && cd author

# 2. Create docker-compose.yml
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

# 3. Start
docker compose up -d

# 4. Visit http://localhost:3000
```

### Option 2: Build from Source

```bash
# 1. Clone the repository
git clone https://github.com/YuanShiJiLoong/author.git
cd author

# 2. Build and start
docker compose up -d --build

# 3. Visit http://localhost:3000
```

## Configure API Key

Two ways to configure:

### Option A: In-app Settings (Easiest)
After starting, configure your API Key directly in the app's ⚙️ Settings. No extra configuration needed.

### Option B: Environment Variables
```bash
# Copy the template
cp .env.example .env

# Edit .env with your Key
# Example for OpenAI:
#   API_KEY=your-key-here
#   API_BASE_URL=https://api.openai.com/v1
#   API_MODEL=gpt-4o

# Restart to apply
docker compose restart
```

## Custom Port

```bash
# Option 1: Modify port mapping in docker-compose.yml
ports:
  - "8080:3000"   # Change to 8080

# Option 2: Via environment variable
PORT=8080 docker compose up -d
```

## Updating

### Docker Hub Pull
```bash
docker compose down
docker compose pull
docker compose up -d
```

### Source Build
```bash
git pull
docker compose down
docker compose up -d --build
```

## Reverse Proxy (No Port Number + Auto HTTPS)

If you have a domain, use Caddy as a reverse proxy to access via `https://your-domain.com` without a port number:

```bash
# 1. Edit Caddyfile, replace author.example.com with your domain
nano Caddyfile

# 2. Start with the Caddy compose file
docker compose -f docker-compose.caddy.yml up -d

# 3. Visit https://your-domain (SSL certificate auto-provisioned)
```

> ⚠️ Make sure your domain points to the server IP and ports 80/443 are not in use.

## FAQ

### Q: Where is my data stored?
A: Data is stored in your browser's IndexedDB and localStorage, independent of the container. Clearing browser data will lose your content, but rebuilding the container will not.

### Q: Can I use it on mobile/tablet?
A: Yes. After deploying to a server, access `http://server-ip:3000` from any device's browser on the same network.

### Q: Does it support HTTPS?
A: Author does not include built-in HTTPS. Use a reverse proxy (Nginx, Caddy, or Traefik) in front to handle SSL certificates.

### Q: Does Docker Desktop work on Windows?
A: Yes, it supports Windows 10/11 with WSL2 or Hyper-V enabled. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) to get started.
