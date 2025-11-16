# Deployment Guide for messagingmatrix.ai (Plesk Edition)

This guide provides step-by-step instructions for deploying your Messaging Matrix full-stack application to **messagingmatrix.ai** using **Plesk cPanel** with Node.js support and GitHub integration.

**Target Environment:** Plesk cPanel with Node.js Extension, GitHub integration, and PM2 process manager

---

## 📋 Prerequisites

### Plesk Requirements
- **Plesk Obsidian** (or later) with Node.js Extension installed
- **GitHub App** installed in Plesk
- **Node.js Console** access in Plesk
- **Domain**: messagingmatrix.ai added to Plesk
- **SSL Certificate**: Available through Plesk (Let's Encrypt)

### Development Requirements
- Git repository on GitHub with your code
- Claude API Key (from Anthropic) - for AI features
- Local development environment for testing before deployment

### Server Requirements
- Node.js 18+ supported by Plesk Node.js Extension
- PM2 installed (will be installed via npm)
- Minimum 1GB RAM recommended
- Storage for assets and data files

---

## 🏗️ Architecture Overview

### Application Components

**Frontend (React + Vite)**
- Static build output in `dist/` folder
- Served by Plesk/Apache

**Backend (Express Server - server.js)**
- Runs on port 3003 (configurable)
- Managed by PM2 process manager
- Handles:
  - Authentication (JWT-based)
  - File uploads (assets)
  - Share management
  - Template management
  - Asset metadata extraction
  - Comment system
  - Public preview system

**Data Storage**
- JSON files in `src/data/` (matrix, users, config)
- Asset files in `src/assets/` (images, videos)
- Share data in `public/share/` directories
- Temporary uploads in `temp_uploads/`

---

## Part 1: Plesk Initial Setup

### Step 1: Add Domain to Plesk

1. **Log into Plesk** at your server's Plesk URL
2. **Add Domain**:
   - Click "Add Domain"
   - Enter: `messagingmatrix.ai`
   - Select document root: `/httpdocs` (default)
   - Enable SSL certificate (Let's Encrypt)
   - Enable "Redirect from HTTP to HTTPS"

### Step 2: Install Required Plesk Extensions

1. **Go to Extensions** in Plesk
2. **Install these extensions**:
   - **Node.js** (by Plesk) - Required
   - **Git** (by Plesk) - Recommended
   - **PM2** - Will install via npm

3. **Verify Node.js Extension**:
   - Go to domain > "Node.js"
   - Check that Node.js is available
   - Select Node.js version: **18.x or higher**

### Step 3: Configure GitHub Integration

1. **In Plesk, go to Extensions > Git**
2. **Install GitHub App**:
   - Follow instructions to connect Plesk to GitHub
   - Authorize Plesk to access your GitHub account
   - This enables automatic deployments

3. **Connect Repository**:
   - In your domain, click "Git"
   - Click "Add Repository"
   - Select your GitHub repository
   - Branch: `main` (or your production branch)
   - Deployment path: `/httpdocs` or `/messagingmatrix` (recommended subfolder)
   - Enable "Deploy after each push"

---

## Part 2: Repository and Code Preparation

### Step 1: Prepare Your Repository

Ensure these files are in your GitHub repository root:

**Required Files**:
- `server.js` - Express backend server
- `package.json` - Dependencies
- `.env.example` - Environment variable template
- `ecosystem.config.js` - PM2 configuration (we'll create this)

**Important**: Add `.env` to `.gitignore` (never commit secrets!)

### Step 2: Create PM2 Configuration

Create `ecosystem.config.js` in your repository root:

```javascript
module.exports = {
  apps: [{
    name: 'messagingmatrix-api',
    script: './server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3003
    },
    error_file: './logs/pm2-err.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    merge_logs: true
  }]
};
```

### Step 3: Update server.js for Production

Ensure your `server.js` has these production-ready settings:

```javascript
// At the top of server.js
const PORT = process.env.PORT || 3003;

// Update CORS for production
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://messagingmatrix.ai',
    'http://messagingmatrix.ai'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Update share URL generation (around line 91)
const shareUrl = process.env.NODE_ENV === 'production'
  ? `https://messagingmatrix.ai/share/${shareId}`
  : `http://localhost:5173/share/${shareId}`;
```

### Step 4: Create .env.example Template

Create `.env.example` in your repository:

```env
# Server Configuration
PORT=3003
NODE_ENV=production

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRATION=24h

# CORS Configuration
CORS_ORIGIN=https://messagingmatrix.ai

# Claude API Key (optional - for AI features)
VITE_ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

# App Configuration
VITE_API_URL=https://messagingmatrix.ai
```

**Commit and push** these changes to GitHub.

---

## Part 3: Deploy to Plesk via GitHub

### Step 1: Initial Deployment

1. **In Plesk Git interface**, click "Deploy"
   - This pulls code from GitHub to your server
   - Wait for deployment to complete

2. **Verify deployment**:
   - Go to Files in Plesk
   - Navigate to deployment directory
   - Verify files are present (server.js, package.json, etc.)

### Step 2: Access Node.js Console

1. **In Plesk, go to your domain**
2. **Click "Node.js"**
3. **You'll see Node.js Console** - this is where you'll run npm commands

### Step 3: Install Dependencies via Node.js Console

In the Node.js Console, run:

```bash
npm install
```

This installs all dependencies from `package.json`, including Express, CORS, Multer, etc.

### Step 4: Install PM2 Globally

In the Node.js Console:

```bash
npm install -g pm2
```

**Verify PM2 is installed**:

```bash
pm2 --version
```

You should see a version number (e.g., 5.3.0).

---

## Part 4: Environment Configuration

### Step 1: Create .env File via Plesk File Manager

1. **Go to Files** in Plesk
2. **Navigate to your application directory**
3. **Create new file**: `.env`
4. **Edit .env file** with these contents:

```env
# Server Configuration
PORT=3003
NODE_ENV=production

# JWT Configuration (CHANGE THIS!)
JWT_SECRET=REPLACE_WITH_SECURE_RANDOM_STRING_64_CHARS_MIN
JWT_EXPIRATION=24h

# CORS Configuration
CORS_ORIGIN=https://messagingmatrix.ai

# Claude API Key (add your real key)
VITE_ANTHROPIC_API_KEY=sk-ant-api03-YOUR-ACTUAL-KEY-HERE

# API URL
VITE_API_URL=https://messagingmatrix.ai
```

### Step 2: Generate Secure JWT Secret

You need a secure random string for JWT_SECRET. Generate one using Node.js Console:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Copy the output** and paste it as the value for `JWT_SECRET` in your `.env` file.

### Step 3: Set File Permissions

In Node.js Console:

```bash
chmod 600 .env
chmod 755 .
```

This secures your environment file.

---

## Part 5: Create Required Directories and Data Files

### Step 1: Create Directories

In Node.js Console:

```bash
mkdir -p src/data
mkdir -p src/assets
mkdir -p src/templates
mkdir -p temp_uploads
mkdir -p public/share
mkdir -p logs
```

### Step 2: Initialize Data Files

Create initial data files with default content:

```bash
echo '{"lookAndFeel":{"logo":"https://s3.eu-central-1.amazonaws.com/pomscloud-storage/assets/43/hu-HU/background/EBH_Logo_screen_white.svg","headerColor":"#2870ed","logoStyle":"height: 25px; margin-top: -6px;","buttonColor":"#ff6130","buttonStyle":"border: 1px solid white;","secondaryColor1":"#eb4c79","secondaryColor2":"#02a3a4","secondaryColor3":"#711c7a"},"lastUpdated":"2025-01-15T00:00:00.000Z"}' > config.json

echo '{"users":[{"id":"1","email":"admin@example.com","password":"REPLACE_WITH_BCRYPT_HASH","role":"admin","name":"Admin User"}]}' > src/data/users.json

echo '{"rows":[]}' > src/data/matrix.json
```

**Note**: Generate a secure password hash using bcrypt. NEVER commit actual passwords to documentation or version control.

### Step 3: Set Permissions

```bash
chmod 755 src/data src/assets src/templates temp_uploads public/share logs
chmod 644 src/data/*.json config.json
```

---

## Part 6: Build Frontend

### Step 1: Build React Application

In Node.js Console:

```bash
npm run build
```

This creates the `dist/` folder with your static frontend files.

**Verify build succeeded**:

```bash
ls -la dist/
```

You should see `index.html` and an `assets/` folder.

### Step 2: Configure Document Root

Your Plesk domain document root should point to either:
- **Option A**: The `dist/` folder directly
- **Option B**: The root folder (and configure rewrite rules)

**Recommended: Option A**

1. In Plesk, go to domain > **Hosting Settings**
2. Change **Document root** to: `/httpdocs/dist` (or `/messagingmatrix/dist`)
3. Save changes

---

## Part 7: Start Backend Server with PM2

### Step 1: Start PM2 Managed Server

In Node.js Console:

```bash
pm2 start ecosystem.config.js --env production
```

### Step 2: Verify Server is Running

Check PM2 status:

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

### Step 3: View Server Logs

Check if server started correctly:

```bash
pm2 logs messagingmatrix-api --lines 50
```

You should see:

```
Claude API proxy server running on http://localhost:3003
Make sure VITE_ANTHROPIC_API_KEY is set in your .env file
```

**If you see errors**, read them carefully - they'll tell you what's wrong.

### Step 4: Test Backend API

Test if the API responds:

```bash
curl http://localhost:3003/api/config
```

Should return JSON data (your config).

### Step 5: Configure PM2 Auto-Restart on Reboot

Make PM2 start automatically when server reboots:

```bash
pm2 startup
```

Follow the command it outputs (usually something like `sudo env PATH=...`), then:

```bash
pm2 save
```

This ensures your backend stays running even after server restarts.

---

## Part 8: Configure Plesk Proxy Rules

The frontend needs to communicate with the backend API. We'll set up a reverse proxy.

### Step 1: Access Apache & nginx Settings

1. In Plesk, go to domain > **Apache & nginx Settings**
2. Scroll to **Additional nginx directives**

### Step 2: Add Proxy Configuration

Add these directives in the **nginx** section:

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

    # Increase timeouts for file uploads
    proxy_read_timeout 300;
    proxy_connect_timeout 300;
    proxy_send_timeout 300;
}

# Serve assets from src/assets
location /share-assets {
    alias /var/www/vhosts/messagingmatrix.ai/httpdocs/src/assets;
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# SPA Routing - serve index.html for all routes
location / {
    try_files $uri $uri/ /index.html;
}
```

**Note**: Adjust the path `/var/www/vhosts/messagingmatrix.ai/httpdocs/` to match your actual Plesk document root. You can find this in Plesk > Files or Hosting Settings.

### Step 3: Increase Upload Limits

In the same **Apache & nginx Settings**, add to **Additional nginx directives**:

```nginx
# Increase upload size limit for asset uploads
client_max_body_size 100M;
```

### Step 4: Apply Configuration

Click **OK** to apply the changes. Nginx will reload automatically.

---

## Part 9: SSL Certificate Setup

### Step 1: Enable Let's Encrypt Certificate

1. In Plesk, go to domain > **SSL/TLS Certificates**
2. Click **Install** next to "Let's Encrypt"
3. Select:
   - [x] messagingmatrix.ai
   - [x] www.messagingmatrix.ai
4. Enter email for expiration notifications
5. Click **Get it free**

Wait for certificate to be issued (usually 1-2 minutes).

### Step 2: Enable HTTPS Redirect

1. Go to domain > **Hosting Settings**
2. Check **Permanent SEO-safe 301 redirect from HTTP to HTTPS**
3. Save

### Step 3: Verify HTTPS

Visit `https://messagingmatrix.ai` - you should see:
- Padlock icon in browser
- Valid SSL certificate
- HTTP redirects to HTTPS

---

## Part 10: Testing Your Deployment

### Step 1: Basic Functionality Tests

**Test 1: Application Loads**
- Visit `https://messagingmatrix.ai`
- Login screen should appear
- No console errors in browser DevTools (F12)

**Test 2: Authentication**
- Log in with: `beliczki.robert@gmail.com` / `temporary123`
- Should successfully log in
- Verify you stay logged in after page refresh

**Test 3: API Communication**
- Open browser DevTools > Network tab
- Perform any action (e.g., load matrix data)
- Check that `/api/*` requests go to your domain (not localhost)
- Should see 200 OK responses

**Test 4: Asset Upload**
- Go to Assets Library
- Try uploading an image
- Should preview metadata
- Should successfully confirm upload
- File should appear in Assets Library

**Test 5: Share System**
- Select some assets
- Click "Share"
- Create a share link
- Copy the URL
- Open in incognito window
- Should load preview without login

**Test 6: Comments on Shares**
- In the public share view
- Add a reference point on an image
- Add a comment
- Should save successfully
- Refresh page - comment should persist

### Step 2: Check PM2 Status

Regularly monitor your backend:

```bash
pm2 status
pm2 logs messagingmatrix-api --lines 100
```

### Step 3: Monitor Error Logs

In Node.js Console:

```bash
tail -f logs/pm2-err.log
```

Or view all logs:

```bash
pm2 logs
```

---

## Part 11: Debugging Common Issues

### Issue: PM2 Process Not Running

**Check Status**:
```bash
pm2 status
```

**If status is "stopped" or "errored"**:
```bash
pm2 logs messagingmatrix-api --lines 100
```

Read the error message. Common causes:
- Port 3003 already in use
- Missing dependencies
- Syntax error in server.js
- Missing .env variables

**Restart PM2**:
```bash
pm2 restart messagingmatrix-api
```

**Delete and restart**:
```bash
pm2 delete messagingmatrix-api
pm2 start ecosystem.config.js --env production
```

### Issue: API Calls Return 502 Bad Gateway

**Cause**: Backend server isn't running or proxy misconfigured.

**Fix**:
1. Check PM2 status: `pm2 status`
2. Check server logs: `pm2 logs`
3. Test backend directly: `curl http://localhost:3003/api/config`
4. Verify nginx proxy configuration in Plesk
5. Restart PM2: `pm2 restart messagingmatrix-api`

### Issue: API Calls Return 404 Not Found

**Cause**: Nginx proxy rules not working.

**Fix**:
1. Verify nginx directives in Plesk > Apache & nginx Settings
2. Ensure `location /api` block is present
3. Check for syntax errors
4. Apply and restart nginx

### Issue: Upload Fails with "413 Request Entity Too Large"

**Cause**: Upload size limit too small.

**Fix**:
1. In Plesk > Apache & nginx Settings
2. Add: `client_max_body_size 100M;`
3. Also check PHP settings if applicable
4. Apply changes

### Issue: Application Loads But Shows "API Error"

**Cause**: Frontend can't reach backend API.

**Fix**:
1. Open browser DevTools > Console
2. Look for error messages
3. Check Network tab - are API calls failing?
4. Verify API URL in frontend (should be your domain, not localhost)
5. Check CORS settings in server.js

### Issue: "Cannot read properties of undefined" Errors

**Cause**: Build issue or missing files.

**Fix**:
1. Rebuild frontend: `npm run build`
2. Verify dist/ folder has all files
3. Clear browser cache (Ctrl+Shift+R)
4. Check that dist/ is the document root

### Issue: Changes Not Appearing After Git Push

**Cause**: Need to rebuild and restart.

**Fix**:
1. Pull latest code (Plesk Git > Deploy)
2. Install any new dependencies: `npm install`
3. Rebuild frontend: `npm run build`
4. Restart backend: `pm2 restart messagingmatrix-api`

### Issue: PM2 Not Starting on Server Reboot

**Cause**: PM2 startup not configured.

**Fix**:
```bash
pm2 startup
# Follow the command it outputs
pm2 save
```

### Debugging Checklist

When something doesn't work:

1. **Check PM2 Status**:
   ```bash
   pm2 status
   pm2 logs messagingmatrix-api --lines 100
   ```

2. **Check Backend is Responding**:
   ```bash
   curl http://localhost:3003/api/config
   ```

3. **Check File Permissions**:
   ```bash
   ls -la src/data/
   ls -la src/assets/
   ```

4. **Check Browser Console**:
   - Open DevTools (F12)
   - Look for red errors
   - Check Network tab for failed requests

5. **Check Nginx Error Log** (in Plesk):
   - Go to Logs
   - Check error_log

6. **Restart Everything**:
   ```bash
   pm2 restart messagingmatrix-api
   ```
   Then reload nginx via Plesk.

---

## Part 12: Maintenance and Updates

### Making Code Changes

**Workflow**:
1. Make changes locally
2. Test locally: `npm run dev` and `npm run server`
3. Commit and push to GitHub
4. In Plesk Git, click "Deploy" (pulls latest code)
5. In Node.js Console:
   ```bash
   npm install  # If dependencies changed
   npm run build  # Rebuild frontend
   pm2 restart messagingmatrix-api  # Restart backend
   ```

### Monitoring PM2

**View status**:
```bash
pm2 status
```

**View logs** (real-time):
```bash
pm2 logs messagingmatrix-api
```

**View logs** (last 100 lines):
```bash
pm2 logs messagingmatrix-api --lines 100 --nostream
```

**Clear logs**:
```bash
pm2 flush
```

### Updating Dependencies

**Check for updates**:
```bash
npm outdated
```

**Update packages**:
```bash
npm update
```

**Check for security vulnerabilities**:
```bash
npm audit
npm audit fix
```

After updates:
```bash
npm run build
pm2 restart messagingmatrix-api
```

### Backup Strategy

**Code Backup**:
- GitHub repository (already backed up)
- Tag releases: `git tag v1.0.0 && git push --tags`

**Data Backup** (via Plesk File Manager or Node.js Console):
```bash
# Create backup directory
mkdir -p backups/$(date +%Y%m%d)

# Backup data files
cp -r src/data backups/$(date +%Y%m%d)/
cp -r src/assets backups/$(date +%Y%m%d)/
cp -r public/share backups/$(date +%Y%m%d)/
cp config.json backups/$(date +%Y%m%d)/

# Create archive
tar -czf backups/backup-$(date +%Y%m%d).tar.gz backups/$(date +%Y%m%d)/
```

**Automated Backups** (optional):
- Set up cron job in Plesk
- Schedule daily backups
- Keep last 7 days

---

## Part 13: PM2 Management Reference

### Essential PM2 Commands

**Start application**:
```bash
pm2 start ecosystem.config.js --env production
```

**Stop application**:
```bash
pm2 stop messagingmatrix-api
```

**Restart application**:
```bash
pm2 restart messagingmatrix-api
```

**Delete application from PM2**:
```bash
pm2 delete messagingmatrix-api
```

**View status**:
```bash
pm2 status
pm2 list
```

**View logs**:
```bash
pm2 logs messagingmatrix-api
pm2 logs messagingmatrix-api --lines 200
pm2 logs --nostream  # Don't follow, just show and exit
```

**Clear logs**:
```bash
pm2 flush
```

**Monitor resources**:
```bash
pm2 monit
```

**Get detailed info**:
```bash
pm2 info messagingmatrix-api
pm2 show messagingmatrix-api
```

**Save PM2 process list** (for auto-restart on reboot):
```bash
pm2 save
```

**Reload PM2 after server reboot**:
```bash
pm2 resurrect
```

### PM2 Startup Configuration

**Generate startup script**:
```bash
pm2 startup
```

This outputs a command like:
```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u deploy --hp /home/deploy
```

Run that command, then:
```bash
pm2 save
```

Now PM2 will auto-start your application on server reboot.

---

## 🎉 Deployment Complete!

Your Messaging Matrix application is now live at:

**🌐 https://messagingmatrix.ai**

### Quick Reference

**Login**: Use the admin credentials you created during setup

**PM2 Status**: `pm2 status`

**PM2 Logs**: `pm2 logs messagingmatrix-api`

**Restart Backend**: `pm2 restart messagingmatrix-api`

**Rebuild Frontend**: `npm run build`

**Update Code**: Plesk Git > Deploy, then rebuild + restart

### Need Help?

1. **Check PM2 logs**: `pm2 logs`
2. **Check browser console**: F12 > Console
3. **Check Plesk logs**: Logs section in Plesk
4. **Test backend directly**: `curl http://localhost:3003/api/config`

---

## 📚 Useful Resources

- **PM2 Documentation**: https://pm2.keymetrics.io/docs/
- **Plesk Documentation**: https://docs.plesk.com/
- **Express Documentation**: https://expressjs.com/
- **Vite Documentation**: https://vitejs.dev/
- **Claude API**: https://docs.anthropic.com/

---

## Part 14: Deployment Lessons Learned

### Critical Issues Encountered in Production

#### Issue 1: Zombie Node.js Process on Port 3003
**Problem**: After deployment, a Node.js process remained running on port 3003 even after disabling/enabling Node.js in Plesk. The "Restart App" function in Plesk didn't actually kill the process.

**Root Cause**: The process was running outside of Plesk's control, possibly from a previous manual PM2 start or npm command.

**Attempted Solutions** (that didn't work):
- Disable/Enable Node.js in Plesk
- Click "Restart App" button
- SSH terminal access (had library errors: `libtinfo.so.6` missing)
- No pm2 available to list and kill processes

**Final Solution**: Changed PORT from 3003 to 3004 in production .env file to work around the zombie process.

**Lesson**: Always ensure you have:
- Working SSH terminal access for emergencies
- Process management tools (PM2) properly configured
- A way to list and kill processes (netstat, lsof, kill commands)
- Document all running processes and their management method

**Prevention**:
- Use PM2 exclusively for process management
- Never manually start Node.js processes in production
- Always use `pm2 stop` before changing configurations
- Keep a process checklist: what's running, how it was started, how to stop it

#### Issue 2: service-account.json JSON Parsing Error
**Problem**: Server failed to start with error: "Bad control character in string literal in JSON at position 175"

**Root Cause**: The service-account.json file had improperly formatted newlines in the `private_key` field - actual newline characters instead of `\n` escape sequences.

**Solution**: Recreated file as minified JSON with proper escape sequences:
- Use `\n` instead of actual newlines in the private_key field
- Remove all extra whitespace
- Ensure valid JSON format (use JSON validator)

**Lesson**:
- Always validate JSON files before deployment
- Service account keys should be minified (no pretty-printing)
- Use online JSON validators before uploading
- Test file parsing in development first

#### Issue 3: Google Sheets API 404 Errors
**Problem**: Production site showed 404 errors for `/api/sheets/*` endpoints while config endpoint worked.

**Root Cause**: The production server was running an old version of server.js that didn't have the Google Sheets API proxy endpoints yet.

**Solution**:
1. Pulled latest code from GitHub
2. Installed `jose` dependency for JWT signing
3. Uploaded properly formatted service-account.json
4. Restarted server (eventually on new port due to zombie process)

**Lesson**:
- Always verify which commit/version is running in production
- Check that all dependencies are installed (`npm install`)
- Test API endpoints immediately after deployment
- Keep deployment checklist with version verification step

#### Issue 4: Plesk "Lazy Loading" Confusion
**Problem**: User clicked "Restart App" in Plesk, but nothing seemed to happen. Logs showed: "Application will be restarted after the first request"

**Root Cause**: This is Plesk's default behavior - it doesn't restart immediately, but on the next HTTP request to trigger the application.

**Solution**: After clicking "Restart App", make a request to the application URL to trigger the actual restart.

**Lesson**:
- Understand your hosting platform's restart behavior
- For Plesk: "Restart after first request" is normal
- Always test with a real HTTP request after restart
- PM2 process management is more predictable than Plesk's Node.js interface

### Best Practices Learned

#### 1. Port Management
- **Document all ports in use**: Create a ports.txt file listing what runs on which port
- **Use environment variables**: Never hardcode ports
- **Have backup ports ready**: If port conflicts occur, quickly switch to alternate
- **Test port availability**: Use `netstat -tuln | grep PORT` before starting services

#### 2. Process Management
- **Use PM2 exclusively**: Don't mix PM2 with manual node commands
- **Save PM2 list**: Always run `pm2 save` after changes
- **Set up auto-restart**: Configure `pm2 startup` immediately
- **Monitor PM2 status**: Regularly check `pm2 status` and `pm2 logs`
- **Document all processes**: Keep a list of what PM2 is managing

#### 3. Deployment Checklist
Create and follow this checklist for every deployment:

```markdown
## Pre-Deployment
- [ ] Test locally with production environment variables
- [ ] Verify all dependencies in package.json
- [ ] Commit and push all changes to GitHub
- [ ] Document current production version/commit hash
- [ ] Backup production data and config files

## Deployment Steps
- [ ] Pull latest code via Plesk Git or manual git pull
- [ ] Run `npm install` to update dependencies
- [ ] Verify .env file has all required variables
- [ ] Upload any new config files (service-account.json, etc.)
- [ ] Run `npm run build` to create production frontend
- [ ] Check PM2 status: `pm2 status`
- [ ] Restart backend: `pm2 restart messagingmatrix-api`
- [ ] Verify PM2 logs for errors: `pm2 logs --lines 50`

## Post-Deployment Verification
- [ ] Test frontend loads: Visit https://messagingmatrix.ai
- [ ] Check browser console for errors (F12)
- [ ] Test API endpoints in Network tab (200 OK responses)
- [ ] Test login functionality
- [ ] Test key features (upload, share, comments)
- [ ] Monitor PM2 logs for 5 minutes: `pm2 logs`
- [ ] Document deployed version/commit hash
```

#### 4. File Format Validation
- **JSON files**: Always use JSON validators before deployment
- **Service accounts**: Keep keys minified, validate escape sequences
- **.env files**: Use tools to check for syntax errors
- **Test parsing**: Write a quick script to test file loading before deployment

#### 5. Emergency Access
Always ensure you have:
- **Working SSH access** with functioning terminal
- **Alternative access methods** (FTP, Plesk File Manager)
- **Process kill capabilities** (htop, kill, pm2 commands)
- **Backup ports** documented and ready to use
- **Emergency contacts** for hosting support

#### 6. Monitoring Setup
- **Set up logging**: Ensure PM2 logs are being written
- **Monitor disk space**: Logs can fill up disk quickly
- **Regular log rotation**: Configure logrotate or PM2 log rotation
- **Error alerting**: Set up notifications for PM2 process failures
- **Uptime monitoring**: Use external service to ping your site

### Quick Recovery Procedures

#### If Backend Won't Start
```bash
# 1. Check what's on the port
netstat -tuln | grep 3003

# 2. Find the process
lsof -i :3003

# 3. Kill it if necessary
kill -9 <PID>

# 4. Or use alternate port
# Edit .env: PORT=3004

# 5. Start fresh with PM2
pm2 delete messagingmatrix-api
pm2 start ecosystem.config.js --env production
pm2 save
```

#### If JSON Parsing Fails
```bash
# 1. Validate JSON file
cat service-account.json | python -m json.tool

# 2. If invalid, recreate from backup
# 3. Ensure no actual newlines in private_key
# 4. Use \n escape sequences only
```

#### If Wrong Code Version is Running
```bash
# 1. Check current commit
git log -1 --oneline

# 2. Pull latest
git pull origin main

# 3. Reinstall dependencies
npm install

# 4. Rebuild
npm run build

# 5. Restart backend
pm2 restart messagingmatrix-api
```

### Documentation Requirements

Keep these documents updated:
1. **CURRENT_VERSION.md**: Track deployed versions and commit hashes
2. **PORTS.md**: List all ports in use and what runs on them
3. **PROCESSES.md**: Document all background processes and how they're managed
4. **ENV_VARIABLES.md**: List all required environment variables (not values!)
5. **DEPLOYMENT_LOG.md**: Record each deployment with date, version, issues encountered

### Testing Strategy

Before deploying to production:
1. **Local Production Mode**: Run `NODE_ENV=production npm run build && npm run server`
2. **Test with Production Config**: Use production .env values locally (with test API keys)
3. **Verify All Endpoints**: Use Postman/curl to test every API endpoint
4. **Check File Parsing**: Ensure all config files load correctly
5. **Monitor Resource Usage**: Check memory/CPU usage under load
6. **Test Error Scenarios**: Kill processes, simulate failures, verify recovery

### What We Got Right

Despite the challenges, several things worked perfectly:
- **Google Sheets Integration**: Once the service account was properly formatted, it worked flawlessly
- **PM2 Process Management**: When used correctly, provided stable process management
- **React Build Process**: `npm run build` consistently created working production bundles
- **Nginx Proxy Setup**: Reverse proxy configuration worked perfectly on first try
- **SSL/HTTPS**: Let's Encrypt certificate setup was smooth and automatic

### Final Recommendations

1. **Never skip testing in production-like environment first**
2. **Always have multiple ways to access your server**
3. **Document everything as you deploy**
4. **Keep a troubleshooting journal**
5. **Test your backup and recovery procedures before you need them**
6. **Use version control for configuration files (without sensitive data)**
7. **Set up monitoring and alerting from day one**
8. **Have a rollback plan ready**

---

**🚀 Happy deploying!**
