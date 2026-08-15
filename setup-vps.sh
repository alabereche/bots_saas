#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# BotForge — Complete One-Click VPS Setup Script (Ubuntu / Debian)
# Optimized for 4GB RAM + 20GB SSD (Tencent Cloud / Any Cloud)
# ═══════════════════════════════════════════════════════════════

set -e

echo "=========================================================="
echo "  🚀 Starting BotForge VPS Automated Setup..."
echo "=========================================================="

# 1. Update system packages
echo "[1/7] Updating system packages..."
sudo apt-get update -y
sudo apt-get install -y curl wget git build-essential ufw

# 2. Setup 4GB Swap Space (Crucial for 4GB RAM + Chromium puppeteer stability)
echo "[2/7] Checking and setting up 4GB Swap memory..."
if ! grep -q '/swapfile' /etc/fstab; then
    echo "Creating 4GB swapfile..."
    sudo fallocate -l 4G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=4096
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    sudo sysctl vm.swappiness=10
    echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
    echo "✅ 4GB Swap enabled successfully!"
else
    echo "Swap already configured."
fi

# 3. Install Node.js 20 LTS & PM2
echo "[3/7] Installing Node.js 20 LTS & PM2..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

sudo npm install -g pm2
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"
echo "PM2 version: $(pm2 -v)"

# 4. Install Chromium Dependencies for WhatsApp Engine (Puppeteer)
echo "[4/7] Installing Chromium & Puppeteer required system libraries..."
sudo apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1-0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils

# 5. Setup environment and install dependencies
echo "[5/7] Setting up environment and dependencies..."
mkdir -p logs

if [ ! -f .env ] && [ -f .env.example ]; then
    cp .env.example .env
    echo "✅ Created .env from .env.example"
fi

if [ ! -f bot-engine/.env ] && [ -f .env.example ]; then
    cp .env.example bot-engine/.env
fi

if [ ! -f whatsapp-engine/.env ] && [ -f .env.example ]; then
    cp .env.example whatsapp-engine/.env
fi

npm install --production || true
(cd bot-engine && npm install)
(cd whatsapp-engine && npm install)

# 6. Configure Firewall
echo "[6/7] Configuring firewall..."
sudo ufw allow 22/tcp || true
sudo ufw allow 3001/tcp || true
sudo ufw allow 3002/tcp || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true
echo "y" | sudo ufw enable || true

# 7. Start Engines with PM2
echo "[7/7] Starting bot engines via PM2..."
pm2 delete all || true
pm2 start ecosystem.config.cjs
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME || true

echo ""
echo "=========================================================="
echo "  🎉 BotForge Engines successfully deployed on your VPS!"
echo "=========================================================="
echo "  • Telegram Engine: Port 3002 (Running with Firestore)"
echo "  • WhatsApp Engine: Port 3001 (Running with Puppeteer)"
echo ""
echo "  Commands to manage:"
echo "    pm2 status        -> View status of engines"
echo "    pm2 logs          -> View real-time logs"
echo "    pm2 restart all   -> Restart all engines"
echo "=========================================================="
