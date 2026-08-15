#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# BotForge — Quick Update & Redeploy Script
# ═══════════════════════════════════════════════════════════════

set -e

echo "🔄 Pulling latest code..."
git pull origin main || git pull

echo "📦 Updating dependencies..."
(cd bot-engine && npm install)
(cd whatsapp-engine && npm install)

echo "🚀 Reloading PM2 processes..."
pm2 reload ecosystem.config.cjs || pm2 restart ecosystem.config.cjs

echo "✅ Update deployed successfully!"
pm2 status
