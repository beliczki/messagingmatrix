# Deployment Guide: Second Instance on Hetzner VPS

Add a second Messaging Matrix instance for `telekom.messagingmatrix.ai` alongside existing `erste.messagingmatrix.ai`.

## Current Setup

| Instance | Domain | Path | Port | PM2 Name |
|----------|--------|------|------|----------|
| Erste | erste.messagingmatrix.ai | /var/www/messagingmatrix | 3003 | messagingmatrix |
| **Telekom** | telekom.messagingmatrix.ai | /var/www/messagingmatrix-telekom | **3004** | messagingmatrix-telekom |

---

## 1. Create Telekom Instance Directory

```bash
ssh root@46.224.60.159

# Create new app directory
sudo mkdir -p /var/www/messagingmatrix-telekom
sudo chown $USER:$USER /var/www/messagingmatrix-telekom

# Clone repo
cd /var/www/messagingmatrix-telekom
git clone https://github.com/beliczki/messagingmatrix.git .

# Checkout the correct branch
git checkout workflow-update

# Install dependencies
npm install
```

---

## 2. Environment Configuration

```bash
nano /var/www/messagingmatrix-telekom/.env
```

```env
# Server - USE DIFFERENT PORT
PORT=3004
NODE_ENV=production

# Google OAuth (create NEW OAuth client for Telekom)
GOOGLE_CLIENT_ID=your_telekom_google_client_id
GOOGLE_CLIENT_SECRET=your_telekom_google_client_secret
GOOGLE_REDIRECT_URI=https://telekom.messagingmatrix.ai/auth/google/callback

# Session Secret (DIFFERENT from Erste instance)
SESSION_SECRET=your_unique_telekom_session_secret_here

# Google Sheets (Telekom's spreadsheet)
SPREADSHEET_ID=telekom_spreadsheet_id

# IMAP Email (Telekom's email if needed)
IMAP_HOST=your_imap_host
IMAP_PORT=993
IMAP_USER=telekom_email
IMAP_PASSWORD=telekom_password
```

---

## 3. Build Frontend

```bash
cd /var/www/messagingmatrix-telekom
npm run build
```

---

## 4. Configure PM2 for Telekom Instance

```bash
nano /var/www/messagingmatrix-telekom/ecosystem.config.cjs
```

```javascript
module.exports = {
  apps: [
    {
      name: 'messagingmatrix-telekom',
      script: 'server.js',
      cwd: '/var/www/messagingmatrix-telekom',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3004
      }
    }
  ]
};
```

Start the Telekom instance:

```bash
cd /var/www/messagingmatrix-telekom
pm2 start ecosystem.config.cjs
pm2 save
```

Verify both instances are running:

```bash
pm2 status
# Should show:
# messagingmatrix         (port 3003) - erste
# messagingmatrix-telekom (port 3004) - telekom
```

---

## 5. Configure Nginx for Telekom

```bash
sudo nano /etc/nginx/sites-available/messagingmatrix-telekom
```

```nginx
server {
    listen 80;
    server_name telekom.messagingmatrix.ai;

    location / {
        proxy_pass http://localhost:3004;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    location /assets {
        alias /var/www/messagingmatrix-telekom/dist/assets;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/messagingmatrix-telekom /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6. SSL Certificate for Telekom

```bash
sudo certbot --nginx -d telekom.messagingmatrix.ai
```

---

## 7. Google OAuth for Telekom

Create a **separate** OAuth client in Google Cloud Console:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
3. Application type: Web application
4. Name: `Messaging Matrix Telekom`
5. Authorized JavaScript origins:
   - `https://telekom.messagingmatrix.ai`
6. Authorized redirect URIs:
   - `https://telekom.messagingmatrix.ai/auth/google/callback`
7. Copy Client ID and Secret to `.env`

---

## 8. Database Separation

Each instance has its **own SQLite database** automatically:

| Instance | Database Path |
|----------|---------------|
| Erste | `/var/www/messagingmatrix/db/messaging-matrix.db` |
| Telekom | `/var/www/messagingmatrix-telekom/db/messaging-matrix.db` |

No additional configuration needed - databases are isolated by directory.

---

## Maintenance Commands

### Telekom Instance

```bash
# Logs
pm2 logs messagingmatrix-telekom

# Restart
pm2 restart messagingmatrix-telekom

# Update
cd /var/www/messagingmatrix-telekom
git pull origin workflow-update
npm install
npm run build
pm2 restart messagingmatrix-telekom
```

### Both Instances

```bash
# Status
pm2 status

# Restart all
pm2 restart all

# Monitor
pm2 monit
```

---

## Quick Deploy Script for Telekom

Save as `/var/www/messagingmatrix-telekom/deploy.sh`:

```bash
#!/bin/bash
cd /var/www/messagingmatrix-telekom
git pull origin workflow-update
npm install
npm run build
pm2 restart messagingmatrix-telekom
echo "Telekom deployment complete!"
```

```bash
chmod +x /var/www/messagingmatrix-telekom/deploy.sh
```

---

## Server Overview

| Instance | Domain | Port | Path | PM2 Name | Database |
|----------|--------|------|------|----------|----------|
| Erste | erste.messagingmatrix.ai | 3003 | /var/www/messagingmatrix | messagingmatrix | db/messaging-matrix.db |
| Telekom | telekom.messagingmatrix.ai | 3004 | /var/www/messagingmatrix-telekom | messagingmatrix-telekom | db/messaging-matrix.db |

**Server IP:** 46.224.60.159
