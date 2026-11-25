# Demarrage production AUBM PCheck
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Test-Path ".\.next")) {
  Write-Host "Build introuvable. Lancez d'abord : .\scripts\deploy-windows.ps1" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path ".\data")) {
  New-Item -ItemType Directory -Path ".\data" | Out-Null
}

$env:PORT = if ($env:PORT) { $env:PORT } else { "3000" }
$env:HOSTNAME = "0.0.0.0"

$lanIp = $null
try {
  $lanIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -First 1 -ExpandProperty IPAddress)
} catch {}

Write-Host "=== AUBM PCheck demarre ===" -ForegroundColor Green
Write-Host "Local   : http://localhost:$env:PORT"
if ($lanIp) {
  Write-Host "Reseau  : http://${lanIp}:$env:PORT"
}
Write-Host "CTRL+C pour arreter"
Write-Host ""

npx next start -H 0.0.0.0 -p $env:PORT
