# Publie AUBM PCheck pour Windows x64 (dossier autonome, DLL natives incluses)
$ErrorActionPreference = "Stop"

$out = Join-Path $PSScriptRoot "publish"
if (Test-Path $out) {
    Remove-Item $out -Recurse -Force
}

Write-Host "Publication en cours vers $out ..." -ForegroundColor Cyan

dotnet publish "$PSScriptRoot\AubmPCheck\AubmPCheck.csproj" `
    -c Release `
    -r win-x64 `
    --self-contained true `
    -p:PublishSingleFile=false `
    -o $out

if ($LASTEXITCODE -ne 0) {
    throw "dotnet publish a échoué."
}

Write-Host ""
Write-Host "OK. Lancez :" -ForegroundColor Green
Write-Host "  $out\AubmPCheck.exe"
Write-Host ""
Write-Host "Important : copiez TOUT le dossier publish (pas seulement l'exe)." -ForegroundColor Yellow
