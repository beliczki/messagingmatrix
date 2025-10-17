# Restart development servers cleanly
Write-Host "=== Restarting Development Servers ===" -ForegroundColor Cyan

# Step 1: Kill processes on our ports
Write-Host ""
Write-Host "[1/2] Stopping servers and freeing ports..." -ForegroundColor Yellow
pm2 stop all 2>$null
pm2 delete all 2>$null
& "$PSScriptRoot\kill-servers.ps1"

# Step 2: Start servers
Write-Host ""
Write-Host "[2/2] Starting servers..." -ForegroundColor Green
Write-Host "  Both servers will use PM2 (with auto-restart on crash)" -ForegroundColor Cyan
Write-Host ""

# Check if PM2 is installed
$pm2Installed = Get-Command pm2 -ErrorAction SilentlyContinue
if (-not $pm2Installed)
{
    Write-Host "Installing PM2..." -ForegroundColor Yellow
    npm install -g pm2
}

# Start both servers with PM2
pm2 start ecosystem.config.cjs

Write-Host ""
Write-Host "Both servers started with PM2!" -ForegroundColor Green
Write-Host ""

# Wait a moment for servers to start
Start-Sleep -Seconds 2

# Show status
pm2 list

Write-Host ""
Write-Host "Services:" -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:3003" -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""

Write-Host "Useful commands:" -ForegroundColor Yellow
Write-Host "  pm2 logs                          - View all logs (live)" -ForegroundColor Gray
Write-Host "  pm2 logs messagingmatrix-frontend - View frontend logs only" -ForegroundColor Gray
Write-Host "  pm2 logs messagingmatrix-server   - View backend logs only" -ForegroundColor Gray
Write-Host "  pm2 restart all                   - Restart both servers" -ForegroundColor Gray
Write-Host "  pm2 stop all                      - Stop both servers" -ForegroundColor Gray
Write-Host "  npm run kill                      - Kill all servers" -ForegroundColor Gray
Write-Host ""
Write-Host "IMPORTANT: Both servers will AUTO-RESTART if they crash!" -ForegroundColor Yellow
Write-Host "  Frontend: Max 15 restarts per cycle" -ForegroundColor Yellow
Write-Host "  Backend:  Max 10 restarts per cycle" -ForegroundColor Yellow
Write-Host "  Check logs with: pm2 logs" -ForegroundColor Yellow
Write-Host ""
