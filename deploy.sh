#!/bin/bash

# Generic LXC Deployment Script for Next.js Projects
# Usage: npm run deploy -- user@ip [--update]
# Or: bash deploy.sh user@ip [--update]

TARGET=$1
MODE=$2

if [ -z "$TARGET" ]; then
  echo "❌ Error: No target specified. Usage: npm run deploy -- user@ip [--update]"
  exit 1
fi

# Dynamically get app name from package.json
APP_NAME=$(node -p "require('./package.json').name" 2>/dev/null || echo "nextjs-app")

FAST_UPDATE=false
if [ "$MODE" == "--update" ] || [ "$3" == "--update" ]; then
  FAST_UPDATE=true
fi

echo "🚀 Starting deployment of '$APP_NAME' to $TARGET (Mode: ${MODE:-Full Setup})..."

# 1. Build the project locally
echo "📦 Building project..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed. Aborting deployment."
  exit 1
fi

# 2. Prepare standalone artifacts
echo "📂 Preparing standalone artifacts..."
# Next.js standalone needs these folders to be copied manually
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

# Copy config or env files if they exist (ignoring sensitive .env.local if you don't want it, but usually standard deployment scripts allow copying custom .env or configs if present locally)
[ -f .env ] && cp .env .next/standalone/
[ -f .env.production ] && cp .env.production .next/standalone/

# Include the setup script in the bundle
cp setup-lxc.sh .next/standalone/

# 3. Transfer files
echo "📤 Transferring bundle to $TARGET..."
TEMP_DIR="/tmp/$APP_NAME-deploy"
ssh $TARGET "mkdir -p $TEMP_DIR"

# Use tar pipe to bypass banner issues and handle all files including hidden ones
tar -cz -C .next/standalone . | ssh $TARGET "tar -xz -C $TEMP_DIR"

# 4. Finalize deployment as root
DEPLOY_DIR="/var/www/$APP_NAME"
if [ "$FAST_UPDATE" = true ]; then
  echo "⚡ Performing fast update..."
  ssh -t $TARGET "sudo mkdir -p $DEPLOY_DIR && sudo cp -r $TEMP_DIR/. $DEPLOY_DIR/ && sudo systemctl restart $APP_NAME && sudo rm -rf $TEMP_DIR"
else
  echo "⚙️  Finalizing full deployment (running remote setup script)..."
  # Run the setup script which now handles the move from /tmp
  ssh -t $TARGET "sudo bash $TEMP_DIR/setup-lxc.sh $TEMP_DIR $APP_NAME"
fi

echo "🎉 $APP_NAME is now live at http://${TARGET#*@}"
