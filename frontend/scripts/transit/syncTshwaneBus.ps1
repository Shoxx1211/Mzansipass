$ErrorActionPreference = "Stop"

# ============================================================
# Pulse Transit - Tshwane Bus Services GIS Sync
#
# Official City of Tshwane GIS:
#   Stops  = Layer 9213
#   Routes = Layer 1
#
# Uses Windows curl.exe because Node's TLS stack rejected
# the Tshwane GIS certificate chain.
# Certificate verification remains enabled.
# ============================================================

$OutputDir = Join-Path `
    $PSScriptRoot `
    "..\..\src\data\transit\gauteng\tshwane-bus"

$OutputDir = [System.IO.Path]::GetFullPath($OutputDir)

New-Item `
    -ItemType Directory `
    -Force `
    -Path $OutputDir |
    Out-Null


$BaseUrl = `
    "https://e-gis003.tshwane.gov.za/server/rest/services/Viewer/IdentifyServicesCombined/MapServer"


$StopsUrl = `
    "$BaseUrl/9213/query?where=1%3D1&outFields=%2A&returnGeometry=true&outSR=4326&f=geojson"

$RoutesUrl = `
    "$BaseUrl/1/query?where=1%3D1&outFields=%2A&returnGeometry=true&outSR=4326&f=geojson"


$StopsFile = Join-Path $OutputDir "stops.geojson"
$RoutesFile = Join-Path $OutputDir "routes.geojson"


function Download-GeoJson {
    param (
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [string]$Url,

        [Parameter(Mandatory = $true)]
        [string]$OutputFile
    )

    Write-Host ""
    Write-Host "Fetching $Name..." -ForegroundColor Cyan

    if (Test-Path $OutputFile) {
        Remove-Item $OutputFile -Force
    }

    & curl.exe `
        --fail `
        --location `
        --silent `
        --show-error `
        --retry 3 `
        --connect-timeout 20 `
        --max-time 180 `
        "$Url" `
        --output "$OutputFile"

    if ($LASTEXITCODE -ne 0) {
        throw "curl.exe failed while downloading $Name. Exit code: $LASTEXITCODE"
    }

    if (-not (Test-Path $OutputFile)) {
        throw "$Name finished downloading but no output file was created."
    }

    $Raw = Get-Content `
        -Path $OutputFile `
        -Raw `
        -Encoding UTF8

    if ([string]::IsNullOrWhiteSpace($Raw)) {
        Remove-Item $OutputFile -Force
        throw "$Name returned an empty response."
    }

    try {
        $GeoJson = $Raw | ConvertFrom-Json
    }
    catch {
        Remove-Item $OutputFile -Force
        throw "$Name did not return valid JSON."
    }

    if ($GeoJson.type -ne "FeatureCollection") {
        Remove-Item $OutputFile -Force
        throw "$Name did not return a GeoJSON FeatureCollection."
    }

    if ($null -eq $GeoJson.features) {
        Remove-Item $OutputFile -Force
        throw "$Name contains no features property."
    }

    $Count = @($GeoJson.features).Count

    Write-Host "Saved $Count $Name features" -ForegroundColor Green
    Write-Host "-> $OutputFile" -ForegroundColor DarkGray

    return $Count
}


try {

    Write-Host ""
    Write-Host "==========================================" -ForegroundColor DarkCyan
    Write-Host " Pulse Transit - Tshwane Bus GIS Sync" -ForegroundColor White
    Write-Host "==========================================" -ForegroundColor DarkCyan


    $StopCount = Download-GeoJson `
        -Name "stops" `
        -Url $StopsUrl `
        -OutputFile $StopsFile


    $RouteCount = Download-GeoJson `
        -Name "routes" `
        -Url $RoutesUrl `
        -OutputFile $RoutesFile


    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host " Tshwane Bus sync complete" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green

    Write-Host "Stops       : $StopCount"
    Write-Host "Route shapes: $RouteCount"

    Write-Host ""
    Write-Host "Files created:" -ForegroundColor Cyan
    Write-Host "  $StopsFile"
    Write-Host "  $RoutesFile"
    Write-Host ""
}
catch {

    Write-Host ""
    Write-Host "Tshwane Bus sync failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red

    exit 1
}