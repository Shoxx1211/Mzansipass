$ErrorActionPreference = "Stop"

# ============================================================
# Pulse Transit - A Re Yeng GIS Sync
# Uses Windows curl.exe rather than Node fetch because the
# Tshwane GIS server certificate chain is rejected by Node TLS.
# Certificate verification remains ENABLED.
# ============================================================

$OutputDir = Join-Path `
    $PSScriptRoot `
    "..\..\src\data\transit\gauteng\areyeng"

$OutputDir = [System.IO.Path]::GetFullPath($OutputDir)

New-Item `
    -ItemType Directory `
    -Force `
    -Path $OutputDir `
    | Out-Null


$BaseUrl = `
    "https://e-gis003.tshwane.gov.za/server/rest/services/Viewer/IdentifyServicesCombined/MapServer"


$StopsUrl = `
    "$BaseUrl/483/query?where=1%3D1&outFields=%2A&returnGeometry=true&outSR=4326&f=geojson"

$RoutesUrl = `
    "$BaseUrl/484/query?where=1%3D1&outFields=%2A&returnGeometry=true&outSR=4326&f=geojson"


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
        --max-time 120 `
        "$Url" `
        --output "$OutputFile"

    if ($LASTEXITCODE -ne 0) {
        throw "curl.exe failed while downloading $Name. Exit code: $LASTEXITCODE"
    }

    if (-not (Test-Path $OutputFile)) {
        throw "$Name download completed but no output file was created."
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

        throw `
            "$Name did not return a GeoJSON FeatureCollection. Returned type: $($GeoJson.type)"
    }

    if ($null -eq $GeoJson.features) {
        Remove-Item $OutputFile -Force
        throw "$Name response does not contain a features collection."
    }

    $Count = @($GeoJson.features).Count

    Write-Host `
        "Saved $Count $Name features" `
        -ForegroundColor Green

    Write-Host `
        "→ $OutputFile" `
        -ForegroundColor DarkGray

    return $Count
}


try {

    Write-Host ""
    Write-Host "==========================================" `
        -ForegroundColor DarkCyan

    Write-Host " Pulse Transit - A Re Yeng GIS Sync" `
        -ForegroundColor White

    Write-Host "==========================================" `
        -ForegroundColor DarkCyan


    $StopCount = Download-GeoJson `
        -Name "stops" `
        -Url $StopsUrl `
        -OutputFile $StopsFile


    $RouteCount = Download-GeoJson `
        -Name "routes" `
        -Url $RoutesUrl `
        -OutputFile $RoutesFile


    Write-Host ""
    Write-Host "==========================================" `
        -ForegroundColor Green

    Write-Host " A Re Yeng sync complete" `
        -ForegroundColor Green

    Write-Host "==========================================" `
        -ForegroundColor Green

    Write-Host "Stops / stations : $StopCount"
    Write-Host "Route features   : $RouteCount"

    Write-Host ""
    Write-Host "Files created:" -ForegroundColor Cyan
    Write-Host "  $StopsFile"
    Write-Host "  $RoutesFile"

    Write-Host ""
}
catch {

    Write-Host ""
    Write-Host "A Re Yeng sync failed:" `
        -ForegroundColor Red

    Write-Host $_.Exception.Message `
        -ForegroundColor Red

    exit 1
}
