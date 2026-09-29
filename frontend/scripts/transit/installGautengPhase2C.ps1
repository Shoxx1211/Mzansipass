# Phase 2C: Joburg PRASA rail tracks + Ekurhuleni GMS numbered bus GIS pairs.
# ASCII-only for Windows PowerShell 5.1 compatibility.
param([switch]$SkipGms)
$ErrorActionPreference='Stop'
$frontend=Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $frontend
function Run-Node([string]$script){
  Write-Host "`n>> node $script" -ForegroundColor Cyan
  & node $script
  if($LASTEXITCODE -ne 0){throw "Failed: $script (exit $LASTEXITCODE)"}
}
Run-Node '.\scripts\transit\testGautengPhase2C.mjs'
Write-Host "`n>> Secure City GIS sync" -ForegroundColor Cyan
& '.\scripts\transit\syncGautengPhase2C.ps1' -SkipGms:$SkipGms
Run-Node '.\scripts\transit\buildGautengPhase2C.mjs'
Run-Node '.\scripts\transit\testGautengPhase2CReal.mjs'
Write-Host "`n>> npm.cmd run build" -ForegroundColor Cyan
& npm.cmd run build
if($LASTEXITCODE -ne 0){throw 'Pulse TypeScript/Vite build failed.'}
Run-Node '.\scripts\transit\verifyGautengPhase2CBuildSafety.mjs'
Write-Host "`nPASS: Phase 2C private municipal GIS coverage added." -ForegroundColor Green
Write-Host 'Commuter UI unchanged; no unverified passenger journeys added.'
Write-Host 'Report: src\data\transit\gauteng\unified-dev\reports\phase2c-location-matrix.html'
