# Force la correction archive/image pour le build Windows/Chrome
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "==> Branche et mise a jour git" -ForegroundColor Cyan
git fetch origin
git checkout cursor/flutter-multipatform-8e0b
git pull origin cursor/flutter-multipatform-8e0b

Write-Host "==> Verification pubspec.yaml" -ForegroundColor Cyan
$pubspec = Get-Content -Raw ".\pubspec.yaml"
if ($pubspec -notmatch "dependency_overrides:") {
  throw "dependency_overrides manquant dans pubspec.yaml — git pull a echoue ?"
}
if ($pubspec -notmatch "archive:\s*4\.7\.1") {
  throw "archive: 4.7.1 manquant dans pubspec.yaml"
}
if ($pubspec -notmatch "image:\s*4\.13\.1") {
  throw "image: 4.13.1 manquant dans pubspec.yaml"
}
Write-Host "pubspec OK (archive 4.7.1 + image 4.13.1)" -ForegroundColor Green

Write-Host "==> Nettoyage" -ForegroundColor Cyan
if (Test-Path ".\build") { Remove-Item -Recurse -Force ".\build" }
if (Test-Path ".\pubspec.lock") { Remove-Item -Force ".\pubspec.lock" }
flutter clean

# Supprime les anciennes versions cassees du cache local
$cache = Join-Path $env:LOCALAPPDATA "Pub\Cache\hosted\pub.dev"
foreach ($dir in @("image-4.11.0", "archive-4.0.9")) {
  $path = Join-Path $cache $dir
  if (Test-Path $path) {
    Write-Host "Suppression cache $dir" -ForegroundColor Yellow
    Remove-Item -Recurse -Force $path
  }
}

Write-Host "==> flutter pub get" -ForegroundColor Cyan
flutter pub get

Write-Host "==> Versions resolues" -ForegroundColor Cyan
Select-String -Path ".\pubspec.lock" -Pattern "^\s{2}(archive|image):" -Context 0,7

Write-Host ""
Write-Host "OK. Lance ensuite:" -ForegroundColor Green
Write-Host "  flutter run -d windows"
Write-Host "  flutter run -d chrome"
