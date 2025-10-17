# Quick Fix for 500 API Errors on messagingmatrix.ai

## Current Issue

You're seeing these errors on https://messagingmatrix.ai:
```
GET https://messagingmatrix.ai/api/config [HTTP/1.1 500 Internal Server Error]
Error loading settings from server: Error: Failed to load config from server: 500
```

**Root Cause**: The backend Express server (server.js) is NOT running on the Plesk server, OR the Nginx proxy is not configured.

---

## Fix Steps (Do These in Plesk)

### Step 1: Pull Latest Code from GitHub

1. Log into **Plesk**
2. Go to your domain: **messagingmatrix.ai**
3. Click **Git**
4. Click **Deploy** button
   - This pulls the latest commit (0a6e59f - BrowserRouter fix)
5. Wait for deployment to complete

---

### Step 2: Access Node.js Console

1. In Plesk, go to domain: **messagingmatrix.ai**
2. Click **Node.js** in the sidebar
3. You'll see the **Node.js Console** - this is where you run commands

---

### Step 3: Install Dependencies (if not done yet)

In the Node.js Console, run:

```bash
npm install
```

This ensures all packages are installed on the server.

---

### Step 4: Install PM2 (if not installed)

In the Node.js Console:

```bash
npm install -g pm2
```

Verify PM2 is available:

```bash
pm2 --version
```

You should see a version number like `5.3.0`.

---

### Step 5: Create .env File (if not exists)

**Via Plesk File Manager**:

1. Go to **Files** in Plesk
2. Navigate to your application directory (e.g., `/httpdocs/messagingmatrix/`)
3. Check if `.env` file exists
4. If NOT, create new file named `.env`
5. Add this content:

```env
# Server Configuration
PORT=3003
NODE_ENV=production

# JWT Configuration
JWT_SECRET=CHANGE_THIS_TO_SECURE_RANDOM_STRING
JWT_EXPIRATION=24h

# CORS Configuration
CORS_ORIGIN=https://messagingmatrix.ai

# Claude API Key
VITE_ANTHROPIC_API_KEY=sk-ant-api03-YOUR-KEY-HERE

# API URL
VITE_API_URL=https://messagingmatrix.ai
```

**IMPORTANT**: Replace `JWT_SECRET` with a secure random string.

To generate one, in Node.js Console:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output and paste it as your `JWT_SECRET`.

---

### Step 6: Build the Frontend

In Node.js Console:

```bash
npm run build
```

This creates the `dist/` folder with your compiled React app.

**Verify build succeeded**:
```bash
ls dist/
```

You should see `index.html` and `assets/` folder.

---

### Step 7: Create Required Directories

In Node.js Console:

```bash
mkdir -p src/data src/assets src/templates temp_uploads public/share logs
```

---

### Step 8: Start Backend Server with PM2

In Node.js Console:

```bash
pm2 start ecosystem.config.js --env production
```

**Check PM2 status**:

```bash
pm2 status
```

You should see:
```
┌─────┬──────────────────────┬─────────┬─────────┬──────────┐
│ id  │ name                 │ status  │ restart │ uptime   │
├─────┼──────────────────────┼─────────┼─────────┼──────────┤
│ 0   │ messagingmatrix-api  │ online  │ 0       │ 5s       │
└─────┴──────────────────────┴─────────┴─────────┴──────────┘
```

**Status should be "online"**.

**View logs to check for errors**:

```bash
pm2 logs messagingmatrix-api --lines 50
```

You should see:
```
Claude API proxy server running on http://localhost:3003
```

If you see errors, read them carefully - they'll tell you what's wrong.

---

### Step 9: Test Backend is Responding

In Node.js Console:

```bash
curl http://localhost:3003/api/config
```

**Expected Result**: JSON data returned (your config).

**If you get an error**: The backend isn't running properly. Check PM2 logs:
```bash
pm2 logs messagingmatrix-api
```

---

### Step 10: Configure Nginx Proxy (CRITICAL!)

**This routes /api requests from frontend to backend.**

1. In Plesk, go to domain: **messagingmatrix.ai**
2. Click **Apache & nginx Settings**
3. Scroll to **Additional nginx directives**
4. Add these directives:

```nginx
# API Proxy to Node.js Backend
location /api {
    proxy_pass http://127.0.0.1:3003;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    proxy_read_timeout 300;
    proxy_connect_timeout 300;
    proxy_send_timeout 300;
}

# Increase upload size limit
client_max_body_size 100M;

# SPA Routing - serve index.html for all routes
location / {
    try_files $uri $uri/ /index.html;
}
```

5. Click **OK** to apply
6. Wait for nginx to reload (automatic)

---

### Step 11: Set Document Root to dist/ (if not done)

**IMPORTANT**: Plesk must serve files from the `dist/` folder.

1. In Plesk, go to domain: **messagingmatrix.ai**
2. Click **Hosting Settings**
3. Find **Document root**
4. Change it to: `/httpdocs/messagingmatrix/dist` (adjust path as needed)
5. Save

---

### Step 12: Test the Application

1. Visit **https://messagingmatrix.ai**
2. Open browser **DevTools** (F12)
3. Go to **Console** tab
4. You should see the app load without errors
5. Check **Network** tab - API calls to `/api/config` should return **200 OK**, not 500

---

## Troubleshooting

### If PM2 Shows "stopped" or "errored"

```bash
pm2 logs messagingmatrix-api --lines 100
```

Read the error. Common issues:
- **Port 3003 already in use**: Kill the process or use a different port
- **Missing .env variables**: Create .env file as shown above
- **Syntax error in server.js**: Check the code

**Restart PM2**:
```bash
pm2 restart messagingmatrix-api
```

**Or delete and restart**:
```bash
pm2 delete messagingmatrix-api
pm2 start ecosystem.config.js --env production
```

---

### If API Still Returns 500

1. **Check PM2 is running**:
   ```bash
   pm2 status
   ```

2. **Test backend directly**:
   ```bash
   curl http://localhost:3003/api/config
   ```

   If this fails, backend isn't working. Check logs.

3. **Check nginx proxy**:
   - Verify you added the `location /api` block in Plesk
   - Check for syntax errors
   - Apply and reload nginx

4. **Check .env file exists and has correct values**

5. **Check config.json exists** in the application root

---

### If Application Loads But Says "Cannot Connect"

Check CORS settings in `server.js`. Should include:
```javascript
origin: [
  'http://localhost:5173',
  'https://messagingmatrix.ai',
  'http://messagingmatrix.ai'
],
```

Restart PM2 after any changes to server.js:
```bash
pm2 restart messagingmatrix-api
```

---

## Quick Commands Reference

**PM2 Status**: `pm2 status`

**PM2 Logs**: `pm2 logs messagingmatrix-api`

**Restart Backend**: `pm2 restart messagingmatrix-api`

**Test Backend**: `curl http://localhost:3003/api/config`

**Stop PM2**: `pm2 stop messagingmatrix-api`

**Start PM2**: `pm2 start ecosystem.config.js --env production`

---

## Expected Result After Fix

- Visit https://messagingmatrix.ai
- Application loads without errors
- Login screen appears
- No 500 errors in browser console
- API calls in Network tab show **200 OK**

---

**Once everything works, configure PM2 auto-restart**:

```bash
pm2 startup
# Follow the command it outputs
pm2 save
```

This ensures backend restarts automatically after server reboots.

---

## Lessons Learned from This Fix

### The Zombie Process Problem
The most challenging issue was a Node.js process running on port 3003 that couldn't be killed through normal Plesk controls:
- **Disable/Enable Node.js**: Didn't stop the process
- **Restart App button**: Only queued a restart "after first request"
- **SSH terminal**: Had missing library errors (`libtinfo.so.6`)
- **pm2 list**: Not available in problematic terminal

**Final solution**: Changed PORT to 3004 as a workaround instead of fighting the zombie process.

### Key Takeaways
1. **Always verify process status** before and after restart attempts
2. **Test SSH terminal access** before you need it in an emergency
3. **Document backup ports** for quick recovery
4. **Use PM2 exclusively** for process management - don't mix with manual node commands
5. **Test "Restart App" behavior** - in Plesk it means "restart on next request", not immediate

### What Worked Well
- **service-account.json minification**: Once properly formatted, worked perfectly
- **Google Sheets API integration**: Robust after initial setup
- **Plesk Git integration**: Made code deployment simple
- **Port change workaround**: Quick recovery when processes couldn't be killed

### Prevention Checklist
For future deployments, ensure:
- [ ] SSH terminal is tested and functional
- [ ] PM2 is properly installed and accessible
- [ ] Process management tools (netstat, lsof, kill) are available
- [ ] Backup ports are documented (e.g., 3003, 3004, 3005)
- [ ] All config files are validated before upload
- [ ] Deployment checklist is followed step-by-step
