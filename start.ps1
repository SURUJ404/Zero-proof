Write-Host "=== Zero-Proof Quick Start ===" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
$dockerOk = $false
try {
    $info = docker info 2>&1
    if ($LASTEXITCODE -eq 0) { $dockerOk = $true }
} catch {}

if (-not $dockerOk) {
    Write-Host "[!] Docker Desktop is not running." -ForegroundColor Yellow
    Write-Host "    Please start Docker Desktop, wait for it to be ready, then re-run this script." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "    Alternatively, build locally without Docker:" -ForegroundColor Cyan
    Write-Host "        zp build examples\hello-world\methods\guest --local" -ForegroundColor White
    exit 1
}

Write-Host "[1/3] Starting microservices..." -ForegroundColor Green
zp server start
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Failed to start services." -ForegroundColor Red
    exit 1
}

Write-Host "[2/3] Waiting for services to be ready..." -ForegroundColor Green
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:8080/api/health" -UseBasicParsing -TimeoutSec 2
        if ($resp.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Start-Sleep -Seconds 2
}
if (-not $ready) {
    Write-Host "[!] Services did not become healthy within 60s. Check 'zp server logs'." -ForegroundColor Red
    exit 1
}

Write-Host "[3/3] Building hello-world guest..." -ForegroundColor Green
zp build examples\hello-world\methods\guest
if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Build failed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  Prove execution: zp prove ./data/elfs/<guest>.elf --input '[17,23]'" -ForegroundColor White
Write-Host "  Verify receipt:  zp verify <receipt> <image_id>" -ForegroundColor White
Write-Host "  Stop services:   zp server stop" -ForegroundColor White
