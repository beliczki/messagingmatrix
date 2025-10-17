# Kill processes on specific ports used by this project
Write-Host "Killing processes on project ports..." -ForegroundColor Yellow

$ports = @(3003, 5173)
$killedAny = $false

foreach ($port in $ports)
{
    Write-Host ""
    Write-Host "Checking port $port..." -ForegroundColor Cyan

    # Get process using this port
    $netstat = netstat -ano | Select-String ":$port\s" | Select-Object -First 1

    if ($netstat)
    {
        # Extract PID from netstat output
        $processId = ($netstat -split '\s+')[-1]

        if ($processId -match '^\d+$')
        {
            try
            {
                $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
                if ($process)
                {
                    Write-Host "  Found process: $($process.Name) (PID: $processId)" -ForegroundColor Yellow
                    Stop-Process -Id $processId -Force -ErrorAction Stop
                    Write-Host "  Killed process on port $port" -ForegroundColor Green
                    $killedAny = $true
                }
            }
            catch
            {
                Write-Host "  Failed to kill process on port $port" -ForegroundColor Red
            }
        }
    }
    else
    {
        Write-Host "  Port $port is free" -ForegroundColor Gray
    }
}

if ($killedAny)
{
    # Wait for ports to be fully released
    Write-Host ""
    Write-Host "Waiting for ports to be released..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
    Write-Host "Ports should now be available." -ForegroundColor Green
}
else
{
    Write-Host ""
    Write-Host "No processes were running on project ports." -ForegroundColor Cyan
}
