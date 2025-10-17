# Server Management Guide

## The Problem (SOLVED)

You were experiencing:
- Servers not restarting properly
- Zombie processes accumulating
- Port conflicts (EADDRINUSE errors)
- Having to create new servers on different ports
- Kill scripts that were too aggressive (killed ALL Node processes)

## The Solution

### What Changed

1. **Port-Specific Killing** (`kill-servers.ps1`)
   - Now kills only processes on ports 3003 and 5173
   - No longer kills ALL Node.js processes
   - Shows clear status for each port

2. **PM2 Process Management**
   - Proper process lifecycle management
   - Graceful restarts with no zombies
   - Auto-recovery from crashes
   - Log management
   - Works on both Windows and Linux

3. **Better Error Handling** (`server.js`)
   - Detects port conflicts immediately
   - Shows helpful error messages
   - Fails fast instead of hanging

4. **Consistent Development/Production**
   - Same PM2 setup for both environments
   - No more confusion between different restart methods

---

## Usage

### Quick Commands

```bash
# Restart everything cleanly (RECOMMENDED)
npm run restart

# Kill processes by port only
npm run kill

# Using PM2 directly
npm run pm2:start      # Start with PM2
npm run pm2:restart    # Restart processes
npm run pm2:stop       # Stop processes
npm run pm2:logs       # View logs
npm run pm2:status     # Show status
npm run pm2:delete     # Remove from PM2
```

### Development Workflow

**Starting servers:**
```bash
npm run restart
```
This will:
1. Stop any PM2 processes
2. Kill processes on ports 3003 and 5173
3. Start backend and frontend with PM2
4. Show process status

**Checking status:**
```bash
npm run pm2:status
# or
pm2 list
```

**Viewing logs:**
```bash
npm run pm2:logs
# or
pm2 logs
```

**If you get "port already in use":**
```bash
npm run kill
# Wait 3 seconds
npm run pm2:start
```

### Production Deployment

**On production server:**

```bash
# Install PM2 globally (one time)
npm install -g pm2

# Start in production mode
pm2 start ecosystem.config.cjs --env production

# Save PM2 configuration
pm2 save

# Setup auto-start on server reboot (Linux)
pm2 startup

# View status
pm2 list

# View logs
pm2 logs

# Restart gracefully
pm2 restart all

# Deploy updates
git pull
pm2 restart all
```

**PM2 will automatically:**
- Restart on crashes
- Keep logs
- Handle graceful shutdowns
- Prevent zombie processes
- Free up ports properly

---

## Why This Fixes Zombie Processes

### Before:
- Ctrl+C doesn't send proper SIGTERM on Windows
- Processes crash without cleanup
- Ports stay bound
- Manual `taskkill` is too aggressive

### After:
- PM2 sends proper shutdown signals (SIGTERM)
- Server has graceful shutdown handlers (lines 678-695 in server.js)
- 5-second timeout for cleanup
- Force kill if graceful fails
- Ports released properly

---

## Troubleshooting

### Still getting port conflicts?

```bash
# Check what's using the ports
netstat -ano | findstr ":3003"
netstat -ano | findstr ":5173"

# Kill them manually
npm run kill

# Or kill specific PID
taskkill /PID <pid> /F
```

### PM2 not installed?

```bash
npm install -g pm2
```

The restart script will auto-install if needed.

### Logs not showing?

```bash
# Make sure logs directory exists
mkdir logs

# Check PM2 logs
pm2 logs

# Or check files directly
type logs\error.log
type logs\out.log
```

### Process keeps crashing?

```bash
# View error logs
pm2 logs messagingmatrix-server --err

# Check for port conflicts
npm run kill

# Check environment variables
# Make sure .env exists with VITE_ANTHROPIC_API_KEY
```

---

## Technical Details

### Graceful Shutdown Process

1. PM2 sends SIGTERM signal
2. Server's `gracefulShutdown()` function is called (server.js:679)
3. Server stops accepting new connections
4. Existing connections finish (up to 10s timeout)
5. Server closes cleanly
6. Port is released
7. If timeout expires, force kill

### PM2 Benefits

- **Process tracking**: No lost PIDs
- **Auto-restart**: Crashes don't leave zombies
- **Log rotation**: Prevents disk fill
- **Cluster mode**: Scale if needed
- **Zero-downtime**: Reload code without dropping connections
- **Monitoring**: CPU, memory, uptime tracking

### Port Management

Kill script uses `netstat -ano` to find PIDs by port:
- More precise than killing all Node processes
- Won't affect other projects
- Clear feedback about what was killed

---

## Best Practices

1. **Always use `npm run restart`** instead of manual starts
2. **Use `npm run pm2:logs`** to debug issues
3. **Check `pm2 list`** to see process health
4. **For production, use `pm2 save`** to persist configuration
5. **Never use `taskkill /im node.exe /f`** - it's too aggressive

---

## Summary

You now have a professional-grade server management system that:
- ✓ Restarts cleanly without zombies
- ✓ Manages ports properly
- ✓ Works consistently in dev and production
- ✓ Handles crashes gracefully
- ✓ Provides clear error messages
- ✓ Tracks processes properly

**No more zombie processes. No more port conflicts. No more headaches.**
