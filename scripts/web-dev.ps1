# CBC Learn — start dev server (PowerShell)
# Usage:  .\scripts\web-dev.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "`n=== CBC Learn dev server ===" -ForegroundColor Green

# Stop stale Node processes locking .next (optional — comment out if you run other Node apps)
Get-Process -Name node -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Stopping node process $($_.Id)..."
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 1

node scripts/clean-web-next.mjs
node scripts/check-env.mjs

Write-Host "`nStarting Next.js... (open http://localhost:3000)`n" -ForegroundColor Cyan
npm run web:dev
