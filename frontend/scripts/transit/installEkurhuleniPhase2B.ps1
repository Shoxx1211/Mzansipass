# Pulse Phase 2B. All printable strings ASCII for Windows PowerShell 5.1.
$ErrorActionPreference = 'Stop'
$frontend = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $frontend
function Run-Node([string]$file) {
  Write-Host "`n>> node $file" -ForegroundColor Cyan
  & node $file
  if ($LASTEXITCODE -ne 0) { throw "Failed: $file" }
}
Run-Node '.\scripts\transit\testEkurhuleniPhase2B.mjs'
Run-Node '.\scripts\transit\buildEkurhuleniPhase2B.mjs'
Run-Node '.\scripts\transit\testEkurhuleniPhase2BReal.mjs'
Write-Host "`n>> npm.cmd run build" -ForegroundColor Cyan
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Pulse build failed.' }
Run-Node '.\scripts\transit\verifyEkurhuleniBuildSafety.mjs'
Write-Host "`nPASS: Phase 2B private station-to-track and corridor coverage compiled." -ForegroundColor Green
Write-Host 'No commuter UI changed; no passenger trips fabricated.'
Write-Host 'Report: src\data\transit\gauteng\unified-dev\reports\phase2b-location-matrix.html'
