# Run once from the frontend after extracting this ZIP. ASCII-only for Windows PowerShell 5.
param([switch]$SkipJohannesburg)
$ErrorActionPreference = 'Stop'
$frontend = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $frontend
function Run-Node([string]$script) {
  Write-Host "`n>> node $script" -ForegroundColor Cyan
  & node $script
  if ($LASTEXITCODE -ne 0) { throw "Failed: $script (exit $LASTEXITCODE)" }
}
Run-Node '.\scripts\transit\testEkurhuleniInfrastructure.mjs'
Write-Host "`n>> Secure municipal ArcGIS sync" -ForegroundColor Cyan
& '.\scripts\transit\syncEkurhuleniInfrastructure.ps1' -SkipJohannesburg:$SkipJohannesburg
Run-Node '.\scripts\transit\normalizeEkurhuleniInfrastructure.mjs'
Run-Node '.\scripts\transit\extendUnifiedEkurhuleni.mjs'
Run-Node '.\scripts\transit\testEkurhuleniRealData.mjs'
Write-Host "`n>> npm.cmd run build" -ForegroundColor Cyan
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Production build failed. No commuter source files were changed by Phase 2A.' }
Run-Node '.\scripts\transit\verifyEkurhuleniBuildSafety.mjs'
Write-Host "`nPASS: Phase 2A Ekurhuleni IRPTN and railway GIS added to the private unified network." -ForegroundColor Green
Write-Host 'Your passenger planner is unchanged. No fare, route direction, current service, boarding stop or transfer was invented.'
Write-Host 'Private report: src\data\transit\gauteng\unified-dev\reports\phase2a-journey-matrix.html'
