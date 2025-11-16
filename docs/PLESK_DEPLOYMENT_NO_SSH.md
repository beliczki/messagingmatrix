# Plesk Deployment Guide (NO SSH / NO PM2)

## ⚠️ IMPORTANT - SERVER CONSTRAINTS

**Your Plesk hosting environment:**
- ❌ NO SSH access
- ❌ NO PM2 support
- ✅ Plesk Node.js Extension only
- ✅ GitHub integration for deployment
- ✅ Node.js Console (web-based terminal)

**DO NOT attempt to use:**
- PM2 commands (`pm2 start`, `pm2 restart`, etc.)
- SSH-based deployment
- Direct server access

---

## 📋 Correct Deployment Process

### Step 1: Prepare Local Changes

1. **Commit and push to GitHub**:
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```

2. **Verify push succeeded** on GitHub

### Step 2: Deploy via Plesk

1. **Login to Plesk** at your hosting provider
2. **Go to your domain** (messagingmatrix.ai)
3. **Click "Git"** in the left sidebar
4. **Click "Deploy"** button
   - This pulls latest code from GitHub
   - Wait for deployment to complete
   - Check for any deployment errors

### Step 3: Install Dependencies (if needed)

**Only if `package.json` changed:**

1. **Go to "Node.js"** in Plesk
2. **Open Node.js Console** (web terminal)
3. **Run**:
   ```bash
   npm install
   ```
4. **Wait for completion** (may take 1-2 minutes)

### Step 4: Build Frontend

**Every deployment:**

1. **In Node.js Console**, run:
   ```bash
   npm run build
   ```
2. **This creates/updates `dist/` folder** with static files
3. **Wait for build to complete** (usually 10-30 seconds)

### Step 5: Restart Node.js Application

1. **In Plesk Node.js panel**:
   - Click **"Restart App"** button
   - OR toggle **"NPM Install"** off and on

2. **Alternative - if console available**:
   ```bash
   # Stop existing process (if any)
   pkill -f "node server.js"

   # Start server
   npm run server
   ```

### Step 6: Verify Deployment

1. **Check application loads**:
   - Visit: https://messagingmatrix.ai
   - Should show the updated frontend

2. **Check API is responding**:
   - Visit: https://messagingmatrix.ai/api/config
   - Should return JSON config

3. **Check Node.js Console for errors**:
   - Look for startup messages
   - Check for port conflicts
   - Verify no errors in output

---

## 🔧 Environment Configuration

### Update `.env` File (via Plesk File Manager)

1. **Go to "Files"** in Plesk
2. **Navigate to application directory**
3. **Edit `.env` file**
4. **Required settings**:
   ```env
   # Server Configuration
   PORT=3007
   NODE_ENV=production

   # Your other settings...
   ```

---

## 🚨 Common Issues & Solutions

### Issue: "Port already in use"

**Solution:**
1. In Node.js Console:
   ```bash
   pkill -f "node server.js"
   ```
2. Wait 5 seconds
3. Restart via Plesk "Restart App" button

### Issue: "Changes not visible after deploy"

**Solution:**
1. Clear browser cache (Ctrl+Shift+R)
2. Check if `npm run build` completed successfully
3. Verify `dist/` folder was updated (check file timestamps in File Manager)

### Issue: "API not responding"

**Solution:**
1. Check Node.js Console for errors
2. Verify `.env` file has correct PORT setting
3. Restart Node.js application via Plesk

### Issue: "Database errors"

**Solution:**
1. Verify `db/` folder exists and has write permissions
2. Check `service-account.json` is present and has correct permissions
3. Restart application

---

## 📝 Deployment Checklist

- [ ] Push changes to GitHub (main branch)
- [ ] Deploy via Plesk Git interface
- [ ] Run `npm install` (if package.json changed)
- [ ] Run `npm run build`
- [ ] Restart Node.js app via Plesk
- [ ] Test frontend: https://messagingmatrix.ai
- [ ] Test API: https://messagingmatrix.ai/api/config
- [ ] Check for errors in Node.js Console

---

## ⏱️ Typical Deployment Time

- **Git Deploy**: 30 seconds
- **npm install** (if needed): 1-2 minutes
- **npm run build**: 10-30 seconds
- **Restart**: 5-10 seconds
- **Total**: ~2-3 minutes (or ~30 seconds if no npm install needed)

---

## 🎯 Quick Reference

### Full Deployment (everything changed)
```bash
# 1. Via Plesk Git: Click "Deploy"
# 2. In Node.js Console:
npm install
npm run build
# 3. In Plesk: Click "Restart App"
```

### Code-Only Changes (no dependencies)
```bash
# 1. Via Plesk Git: Click "Deploy"
# 2. In Node.js Console:
npm run build
# 3. In Plesk: Click "Restart App"
```

### Backend-Only Changes (no frontend build needed)
```bash
# 1. Via Plesk Git: Click "Deploy"
# 2. In Plesk: Click "Restart App"
```

---

## 🔐 Security Notes

- Never commit `.env` file to Git (it's in `.gitignore`)
- Keep `service-account.json` private (it's in `.gitignore`)
- Use Plesk File Manager to manage sensitive files
- Set proper file permissions via Plesk

---

**Last Updated**: November 2025
**Environment**: Plesk Node.js Extension (No SSH/PM2)
