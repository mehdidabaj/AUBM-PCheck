# Deploiement production AUBM PCheck sur Windows
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "=== AUBM PCheck — Deploiement Windows ===" -ForegroundColor Cyan

# Verifier Node.js
try {
  $nodeVersion = node -v
  Write-Host "Node.js detecte : $nodeVersion" -ForegroundColor Green
} catch {
  Write-Host "Node.js introuvable. Installez Node.js 20+ depuis https://nodejs.org" -ForegroundColor Red
  exit 1
}

Write-Host "`n1/3 Installation des dependances..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install a echoue" }

Write-Host "`n2/3 Build production..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build a echoue" }

if (-not (Test-Path ".\data")) {
  New-Item -ItemType Directory -Path ".\data" | Out-Null
}

Write-Host "`n3/3 Pret." -ForegroundColor Green
Write-Host ""
Write-Host "Pour demarrer l'application :" -ForegroundColor Cyan
Write-Host "  .\scripts\start-windows.ps1"
Write-Host "  ou double-clic sur start.bat"
Write-Host ""
Write-Host "Puis ouvrir : http://localhost:3000"
