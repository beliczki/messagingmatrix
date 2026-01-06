# Deployment Guide: New Instance on Hetzner VPS

Deploy a new Messaging Matrix instance on the Hetzner VPS.

## Current Setup

| Instance | Domain | Path | Port | PM2 Name |
|----------|--------|------|------|----------|
| Erste | erste.messagingmatrix.ai | /var/www/messagingmatrix | 3003 | mm-server-erste |
| Telekom | telekom.messagingmatrix.ai | /var/www/messagingmatrix-telekom | 3004 | mm-server-telekom |
| Proficio | proficio.messagingmatrix.ai | /var/www/messagingmatrix-proficio | 3005 | mm-server-proficio |

---

## 1. Create New Instance Directory

```bash
ssh root@46.224.60.159

# Create new app directory (replace <instance> with your instance name)
sudo mkdir -p /var/www/messagingmatrix-<instance>
sudo chown $USER:$USER /var/www/messagingmatrix-<instance>

# Clone repo
cd /var/www/messagingmatrix-<instance>
git clone https://github.com/beliczki/messagingmatrix.git .

# Checkout the main branch
git checkout main

# Install dependencies
npm install

# Copy the service account file
# (copy service-account.json from another instance or download from Google Cloud)
```

---

## 2. Environment Configuration

```bash
nano /var/www/messagingmatrix-<instance>/.env
```

```env
# Server Configuration - USE UNIQUE PORT PER INSTANCE
PORT=3005
NODE_ENV=production

# JWT Configuration (generate unique secret for each instance)
JWT_SECRET=your_unique_jwt_secret_here_64chars
JWT_EXPIRATION=24h

# CORS Configuration - MUST MATCH YOUR DOMAIN EXACTLY
CORS_ORIGIN=https://yourinstance.messagingmatrix.ai

# Google Service Account (for Google Sheets)
GOOGLE_SERVICE_ACCOUNT_FILE=./service-account.json

# Anthropic API Key (for AI features)
VITE_ANTHROPIC_API_KEY=sk-ant-api03-...

# SupaBase (if using)
VITE_SUPABASE_PW=your_supabase_password

# API URL (leave empty - code auto-detects dev vs production)
VITE_API_URL=
```

**Important:** The `CORS_ORIGIN` must exactly match the domain (no trailing slash).

---

## 3. Build Frontend

```bash
cd /var/www/messagingmatrix-telekom
npm run build
```

---

## 4. Configure PM2

```bash
nano /var/www/messagingmatrix-<instance>/ecosystem.config.cjs
```

```javascript
module.exports = {
  apps: [
    {
      name: 'mm-server-<instance>',
      script: './server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      // IMPORTANT: Set NODE_ENV=production here, not just in env_production
      env: {
        NODE_ENV: 'production',
        PORT: 3005
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      kill_timeout: 5000,
      min_uptime: '10s',
      max_restarts: 10
    }
    // DO NOT include frontend dev server for production!
    // The frontend is served statically from dist/ folder
  ]
};
```

**Critical Notes:**
- `NODE_ENV: 'production'` MUST be in the `env` section (not just `env_production`)
- Do NOT include the frontend Vite dev server - production serves static files from `dist/`
- Do NOT use Windows-specific settings (`interpreter: 'cmd'`, `interpreter_args: '/c'`)

Create logs directory and start:

```bash
mkdir -p /var/www/messagingmatrix-<instance>/logs
cd /var/www/messagingmatrix-<instance>
pm2 start ecosystem.config.cjs
pm2 save
```

Verify all instances are running:

```bash
pm2 list
```

---

## 5. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/messagingmatrix-<instance>
```

```nginx
server {
    listen 80;
    server_name <instance>.messagingmatrix.ai;

    location / {
        proxy_pass http://localhost:<PORT>;
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
        alias /var/www/messagingmatrix-<instance>/dist/assets;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/messagingmatrix-<instance> /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6. SSL Certificate

```bash
sudo certbot --nginx -d <instance>.messagingmatrix.ai
```

---

## 7. Google Service Account

The app uses a Google Service Account for Sheets API access. Copy the `service-account.json` from an existing instance or create a new one:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. IAM & Admin → Service Accounts
3. Use existing service account or create new
4. Download JSON key file
5. Copy to `/var/www/messagingmatrix-<instance>/service-account.json`

Make sure the service account has access to the Google Sheets you want to use.

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

| Instance | Domain | Port | Path | PM2 Name |
|----------|--------|------|------|----------|
| Erste | erste.messagingmatrix.ai | 3003 | /var/www/messagingmatrix | mm-server-erste |
| Telekom | telekom.messagingmatrix.ai | 3004 | /var/www/messagingmatrix-telekom | mm-server-telekom |
| Proficio | proficio.messagingmatrix.ai | 3005 | /var/www/messagingmatrix-proficio | mm-server-proficio |

**Server IP:** 46.224.60.159

---

## Troubleshooting

### "Cannot GET /" error
- Frontend not built: Run `npm run build`
- Server in development mode: Check `pm2 logs` shows `Environment: production`
- If showing `development`, ensure `NODE_ENV: 'production'` is in the `env` section of ecosystem.config.cjs

### CORS errors
- Check `CORS_ORIGIN` in `.env` matches your domain exactly (no trailing slash)
- Verify server.js allows the origin in the CORS configuration
- Restart server after changing: `pm2 restart mm-server-<instance>`

### PM2 "Interpreter cmd not found"
- Remove Windows-specific settings from ecosystem.config.cjs:
  - Delete `interpreter: 'cmd'`
  - Delete `interpreter_args: '/c'`

### Login fails with 500 error
- Check server logs: `pm2 logs mm-server-<instance> --lines 50`
- Usually CORS or database issue
