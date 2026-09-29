$ErrorActionPreference = "Stop"

# ============================================================
# Pulse Transit - Gautrain Core Source Sync
#
# Downloads official Gautrain source pages for:
# - station information
# - current network/service description
# - current fare information
# - bus route downloads
# - route map
#
# No station coordinates, routes, fares or schedules are
# inferred here.
# ============================================================

$RawDir = Join-Path `
    $PSScriptRoot `
    "..\..\src\data\transit\gauteng\gautrain\raw"

$RawDir = [System.IO.Path]::GetFullPath($RawDir)

New-Item `
    -ItemType Directory `
    -Force `
    -Path $RawDir |
    Out-Null


function Download-Source {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [string]$Url,

        [Parameter(Mandatory = $true)]
        [string]$FileName
    )

    $Output = Join-Path `
        $RawDir `
        $FileName

    Write-Host ""
    Write-Host "Fetching $Name..." `
        -ForegroundColor Cyan

    if (Test-Path $Output) {
        Remove-Item `
            -Force `
            $Output
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
        --output "$Output"

    if ($LASTEXITCODE -ne 0) {
        throw "Download failed for $Name. curl exit code: $LASTEXITCODE"
    }

    if (-not (Test-Path $Output)) {
        throw "No file created for $Name"
    }

    $Size = (
        Get-Item $Output
    ).Length

    if ($Size -le 0) {
        throw "$Name produced an empty file"
    }

    Write-Host `
        "Saved $FileName ($Size bytes)" `
        -ForegroundColor Green
}


Write-Host ""
Write-Host "==============================================" `
    -ForegroundColor DarkCyan

Write-Host " Pulse Transit - Gautrain Core Source Sync" `
    -ForegroundColor White

Write-Host "==============================================" `
    -ForegroundColor DarkCyan


# ------------------------------------------------------------
# Core official pages
# ------------------------------------------------------------

Download-Source `
    -Name "Gautrain general information" `
    -Url "https://www.gautrain.co.za/commuter/generalinformation" `
    -FileName "general-information.html"

Download-Source `
    -Name "Gautrain current fares" `
    -Url "https://www.gautrain.co.za/commuter/farecalc" `
    -FileName "fares.html"

Download-Source `
    -Name "Gautrain bus route downloads" `
    -Url "https://www.gautrain.co.za/commuter/busroutedownloads" `
    -FileName "bus-route-downloads.html"

Download-Source `
    -Name "Gautrain routes page" `
    -Url "https://www.gautrain.co.za/routes" `
    -FileName "routes.html"

Download-Source `
    -Name "Gautrain interactive map" `
    -Url "https://www.gautrain.co.za/map" `
    -FileName "map.html"


# ------------------------------------------------------------
# Official Gautrain stations
# ------------------------------------------------------------

$Stations = @(
    @{
        Id = "park"
        Name = "Park"
    },
    @{
        Id = "rosebank"
        Name = "Rosebank"
    },
    @{
        Id = "sandton"
        Name = "Sandton"
    },
    @{
        Id = "marlboro"
        Name = "Marlboro"
    },
    @{
        Id = "midrand"
        Name = "Midrand"
    },
    @{
        Id = "centurion"
        Name = "Centurion"
    },
    @{
        Id = "pretoria"
        Name = "Pretoria"
    },
    @{
        Id = "hatfield"
        Name = "Hatfield"
    },
    @{
        Id = "rhodesfield"
        Name = "Rhodesfield"
    },
    @{
        Id = "or-tambo"
        Name = "OR Tambo"
    }
)


foreach ($Station in $Stations) {

    $EncodedName = [uri]::EscapeDataString(
        $Station.Name
    )

    $Url =
        "https://www.gautrain.co.za/commuter/stationinfo?stationName=$EncodedName"

    Download-Source `
        -Name "Station: $($Station.Name)" `
        -Url $Url `
        -FileName "station-$($Station.Id).html"
}


# ------------------------------------------------------------
# Summary
# ------------------------------------------------------------

Write-Host ""
Write-Host "==============================================" `
    -ForegroundColor Green

Write-Host " Gautrain core source sync complete" `
    -ForegroundColor Green

Write-Host "==============================================" `
    -ForegroundColor Green

Write-Host ""

Get-ChildItem $RawDir |
    Select-Object Name, Length |
    Format-Table -AutoSize

Write-Host ""
Write-Host "Important:" `
    -ForegroundColor Yellow

Write-Host `
    "These are raw official-source snapshots. Nothing has yet been inferred or normalized."