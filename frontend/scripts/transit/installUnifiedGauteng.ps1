# One-pass offline integration into the frontend supplied in September 2026.
# Run from any directory; no external downloads, API keys or extra PowerShell modules.
$ErrorActionPreference = 'Stop'
$frontend = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $frontend
function Invoke-PulseNode([string]$Script, [string[]]$Extra = @()) {
    Write-Host "`n>> node $Script $($Extra -join ' ')" -ForegroundColor Cyan
    & node $Script @Extra
    if ($LASTEXITCODE -ne 0) { throw "Unified infrastructure failed at $Script (exit $LASTEXITCODE)." }
}
Invoke-PulseNode '.\scripts\transit\buildUnifiedGautengRuntime.mjs'
Invoke-PulseNode '.\scripts\transit\testUnifiedGauteng.mjs'
Invoke-PulseNode '.\scripts\transit\installUnifiedGauteng.mjs' @('--dry-run')
Invoke-PulseNode '.\scripts\transit\installUnifiedGauteng.mjs'
Write-Host "`n>> npm.cmd run build" -ForegroundColor Cyan
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Production build failed. See compiler output. The original App.tsx is backed up in src\app.' }
Invoke-PulseNode '.\scripts\transit\verifyUnifiedBuildSafety.mjs'
Write-Host "`nPASS - Unified Gauteng infrastructure integrated." -ForegroundColor Green
Write-Host 'Commuter UI is unchanged; use your existing Vite dev server.'
Write-Host 'Developer diagnostics: append ?networkLab=1 to the displayed localhost URL.'
Write-Host 'Offline network test report: src\data\transit\gauteng\unified-dev\reports\journey-matrix.html'
