# Production Server Setup & Management

## The Problem

You've experienced zombie processes and port conflicts because:
1. **Windows doesn't immediately release ports** after process termination
2. **No graceful shutdown** - processes killed abruptly leave sockets open
3. **Child processes** from npm/concurrently don't always die together
4. **No process manager** - manual process management is error-prone

## Local Development Solutions

### Quick Restart (Recommended)
```bash
npm run restart
```
This will:
1. Kill all Node.js processes
2. Wait for ports to be released
3. Start fresh dev servers

### Just Kill Servers
```bash
npm run kill
```

### Manual PowerShell
```powershell
# Kill all Node processes
.\kill-servers.ps1

# Full restart
.\restart-servers.ps1
```

## Production Deployment

### Option 1: PM2 (Recommended)

PM2 is a production process manager that handles:
- Automatic restarts
- Graceful shutdowns
- Log management
- No zombie processes
- Built-in monitoring

**Install PM2:**
```bash
npm install -g pm2
```

**Start in production:**
```bash
# First time
pm2 start ecosystem.config.cjs

# View status
pm2 list

# View logs
pm2 logs

# Restart
pm2 restart all

# Stop
pm2 stop all

# Delete from PM2
pm2 delete all
```

**Auto-start on server reboot:**
```bash
pm2 startup
pm2 save
```

### Option 2: Plesk (Your Current Setup)

For Plesk hosting, use PM2 via Node.js configuration:

1. In Plesk, go to your domain → Node.js
2. Set **Application Startup File**: `server.js`
3. Install PM2 as dependency:
   ```bash
   npm install pm2 --save
   ```
4. Change startup command to:
   ```bash
   npx pm2 start server.js --name messagingmatrix --no-daemon
   ```

### Option 3: systemd (Linux servers)

Create `/etc/systemd/system/messagingmatrix.service`:
```ini
[Unit]
Description=Messaging Matrix Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/messagingmatrix
ExecStart=/usr/bin/node /var/www/messagingmatrix/server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=messagingmatrix

[Install]
WantedBy=multi-user.target
```

Commands:
```bash
sudo systemctl start messagingmatrix
sudo systemctl stop messagingmatrix
sudo systemctl restart messagingmatrix
sudo systemctl enable messagingmatrix  # Auto-start on boot
```

## Code Improvements Added

### 1. Graceful Shutdown in server.js
The server now handles shutdown signals properly:
- `SIGTERM` - Graceful shutdown signal
- `SIGINT` - Ctrl+C interruption
- Uncaught exceptions
- Unhandled promise rejections

### 2. Helper Scripts
- `kill-servers.ps1` - Kills all Node processes
- `restart-servers.ps1` - Clean restart
- npm scripts: `npm run kill`, `npm run restart`

## Best Practices

### Development
1. **Use `npm run restart`** instead of manually starting/stopping
2. **Don't Ctrl+C multiple times** - give it time to shutdown gracefully
3. **Check for zombie processes** if ports are blocked:
   ```powershell
   Get-Process | Where-Object {$_.ProcessName -eq 'node'}
   ```

### Production
1. **Always use a process manager** (PM2, systemd, etc.)
2. **Enable auto-restart** on crashes
3. **Monitor logs** regularly
4. **Set memory limits** to prevent memory leaks from crashing the server
5. **Use graceful reloads** when updating code

## Troubleshooting

### Port Already in Use
```powershell
# Find what's using the port
netstat -ano | findstr :3003

# Kill specific process
Stop-Process -Id <PID> -Force

# Or just use our script
npm run kill
```

### Zombie Processes Keep Accumulating
- Install PM2 for production
- Use `npm run restart` for development
- Ensure you're using the updated server.js with graceful shutdown

### Production Restarts Take Too Long
- Check Plesk logs for errors
- Verify environment variables are set
- Ensure all dependencies are installed
- Check file permissions

## Monitoring

### PM2 Monitoring
```bash
pm2 monit  # Real-time monitor
pm2 status # Current status
pm2 logs --lines 100  # Last 100 log lines
```

### Check if Server is Running
```bash
curl http://localhost:3003/api/config
```

## Summary

**Local Dev:** Use `npm run restart`
**Production:** Use PM2 with `ecosystem.config.cjs`
**Emergency:** Use `kill-servers.ps1`

This eliminates zombie processes and makes server management straightforward!
