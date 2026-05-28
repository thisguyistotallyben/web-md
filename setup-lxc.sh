#!/bin/bash

# Generic LXC Local Setup Script (Run as root inside the LXC)
# This script installs Node.js, Nginx, and sets up the Next.js service.

SOURCE_DIR=$1
APP_NAME=$2

if [ -z "$APP_NAME" ]; then
  APP_NAME="nextjs-app"
fi

if [[ $EUID -ne 0 ]]; then
   echo "❌ This script must be run as root"
   exit 1
fi

echo "🚀 Starting LXC Setup for '$APP_NAME'..."

# 1. Update and install dependencies
echo "📥 Updating packages and installing dependencies..."
apt-get update -y && apt-get install -y curl nginx rsync

# 2. Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo "🟢 Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# 3. Prepare deployment directory
DEPLOY_DIR="/var/www/$APP_NAME"
echo "📂 Preparing $DEPLOY_DIR..."
mkdir -p "$DEPLOY_DIR"

# 4. If a source directory is provided (like from /tmp), copy the files over
if [ -n "$SOURCE_DIR" ] && [ -d "$SOURCE_DIR" ]; then
    echo "🚚 Copying build files from $SOURCE_DIR to $DEPLOY_DIR..."
    cp -r "$SOURCE_DIR/." "$DEPLOY_DIR/"
    # Clean up the staging area
    rm -rf "$SOURCE_DIR"
fi

# 5. Create Systemd Service
echo "📄 Creating systemd service..."
cat << SERVICE > "/etc/systemd/system/$APP_NAME.service"
[Unit]
Description=Next.js App - $APP_NAME
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$DEPLOY_DIR
ExecStart=/usr/bin/node server.js
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
SERVICE

# 6. Configure Nginx
echo "🌐 Configuring Nginx reverse proxy..."
cat << 'NGINX' > "/etc/nginx/sites-available/$APP_NAME"
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX

# Enable the site and remove default
ln -sf "/etc/nginx/sites-available/$APP_NAME" "/etc/nginx/sites-enabled/"
rm -f /etc/nginx/sites-enabled/default

# 7. Apply changes
echo "🔄 Reloading services..."
systemctl daemon-reload
systemctl enable "$APP_NAME"
systemctl restart "$APP_NAME"
nginx -t && systemctl restart nginx

echo "✅ Deployment complete!"
