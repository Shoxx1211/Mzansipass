$ErrorActionPreference = 'Stop'
if (-not (Test-Path '.\package.json')) { throw 'Run from your Pulse frontend folder.' }
function Run-PhaseStep([string]$description,[string]$command) {
  Write-Host ('>> ' + $description) -ForegroundColor Cyan
  & cmd.exe /d /s /c $command
  if ($LASTEXITCODE -ne 0) { throw ('FAILED: ' + $description) }
}
Run-PhaseStep 'Synthetic tests' 'node scripts\transit\testGautengPhase2D.mjs'
Run-PhaseStep 'Build Phase 2D private coverage' 'node scripts\transit\buildGautengPhase2D.mjs'
Run-PhaseStep 'Actual-snapshot tests' 'node scripts\transit\testGautengPhase2DReal.mjs'
Run-PhaseStep 'Production build' 'npm.cmd run build'
Run-PhaseStep 'Private-data build check' 'node scripts\transit\verifyGautengPhase2DBuildSafety.mjs'
Write-Host 'PASS: Phase 2D multi-network infrastructure coverage compiled.' -ForegroundColor Green
Write-Host 'Offline matrix: src\data\transit\gauteng\unified-dev\reports\phase2d-location-matrix.html'
Write-Host 'No changes to the commuter screen or passenger route eligibility.'
