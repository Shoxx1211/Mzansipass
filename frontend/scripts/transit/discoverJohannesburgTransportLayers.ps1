$ErrorActionPreference = "Stop"

# ============================================================
# Pulse Transit - Johannesburg Transport Layer Discovery
#
# Queries the official City of Johannesburg ArcGIS REST
# services and prints transport-related layer IDs/names.
#
# NO layer IDs are assumed.
# NO data are downloaded yet.
# ============================================================

$Root = Join-Path `
    $PSScriptRoot `
    "..\..\src\data\transit\gauteng\reavaya\raw\gis-discovery"

$Root = [System.IO.Path]::GetFullPath($Root)

New-Item `
    -ItemType Directory `
    -Force `
    -Path $Root |
    Out-Null


$Services = @(
    [PSCustomObject]@{
        name = "Transportation"
        url  = "https://ags.joburg.org.za/server/rest/services/Transportation/MapServer"
    },

    [PSCustomObject]@{
        name = "TransportationMaster"
        url  = "https://ags.joburg.org.za/server/rest/services/TransportationMaster/MapServer"
    }
)


function Get-ArcGisJson {

    param(
        [string]$Url
    )

    $TempFile =
        Join-Path `
            $env:TEMP `
            ("pulse-arcgis-" + [guid]::NewGuid().ToString() + ".json")


    try {

        & curl.exe `
            --fail `
            --location `
            --silent `
            --show-error `
            --retry 2 `
            --connect-timeout 20 `
            --max-time 120 `
            --user-agent "Mozilla/5.0" `
            "${Url}?f=pjson" `
            --output "$TempFile"


        if ($LASTEXITCODE -ne 0) {
            throw "curl failed for $Url"
        }


        if (-not (Test-Path $TempFile)) {
            throw "No response file created for $Url"
        }


        $Raw =
            Get-Content `
                $TempFile `
                -Raw


        if ([string]::IsNullOrWhiteSpace($Raw)) {
            throw "Empty ArcGIS response from $Url"
        }


        try {

            $Json =
                $Raw |
                ConvertFrom-Json

        }
        catch {

            throw "Response from $Url is not valid JSON."
        }


        if ($Json.error) {

            $Message =
                $Json.error.message

            throw "ArcGIS error from $Url : $Message"
        }


        return $Json

    }
    finally {

        if (Test-Path $TempFile) {

            Remove-Item `
                -Force `
                $TempFile
        }
    }
}


Write-Host ""
Write-Host "================================================" `
    -ForegroundColor DarkCyan

Write-Host " Pulse Transit - Johannesburg Transport Layers" `
    -ForegroundColor White

Write-Host "================================================" `
    -ForegroundColor DarkCyan

Write-Host ""


$AllResults =
    New-Object System.Collections.Generic.List[object]


foreach ($Service in $Services) {

    Write-Host ""
    Write-Host "------------------------------------------------" `
        -ForegroundColor DarkCyan

    Write-Host `
        "SERVICE: $($Service.name)" `
        -ForegroundColor Cyan

    Write-Host `
        $Service.url `
        -ForegroundColor DarkGray

    Write-Host "------------------------------------------------" `
        -ForegroundColor DarkCyan


    try {

        $Json =
            Get-ArcGisJson `
                $Service.url

    }
    catch {

        Write-Host ""
        Write-Host `
            "FAILED: $($_.Exception.Message)" `
            -ForegroundColor Red

        continue
    }


    $SnapshotFile =
        Join-Path `
            $Root `
            "$($Service.name.ToLowerInvariant())-mapserver.json"


    $Json |
        ConvertTo-Json `
            -Depth 30 |
        Set-Content `
            -Path $SnapshotFile `
            -Encoding UTF8


    Write-Host ""
    Write-Host `
        "Current ArcGIS version: $($Json.currentVersion)"

    Write-Host `
        "Map name: $($Json.mapName)"

    Write-Host ""


    # --------------------------------------------------------
    # Collect layers
    # --------------------------------------------------------

    $Layers = @(
        $Json.layers
    )


    if ($Layers.Count -eq 0) {

        Write-Host `
            "No layers returned." `
            -ForegroundColor Yellow

        continue
    }


    Write-Host `
        "Layers found: $($Layers.Count)" `
        -ForegroundColor White

    Write-Host ""


    foreach ($Layer in $Layers) {

        $Record =
            [PSCustomObject]@{

                service =
                    $Service.name

                id =
                    $Layer.id

                name =
                    $Layer.name

                parentLayerId =
                    $Layer.parentLayerId

                subLayerIds =
                    $Layer.subLayerIds

                serviceUrl =
                    $Service.url

                layerUrl =
                    "$($Service.url)/$($Layer.id)"
            }


        $AllResults.Add(
            $Record
        )
    }


    # --------------------------------------------------------
    # Print transport/BRT/Rea Vaya related matches
    # --------------------------------------------------------

    $Interesting =
        @(
            $Layers |
            Where-Object {

                $_.name -match
                '(?i)rea.?vaya|brt|bus|station|stop|transport|metrobus|putco|taxi'
            }
        )


    Write-Host `
        "Potentially relevant layers:" `
        -ForegroundColor Yellow

    Write-Host ""


    if ($Interesting.Count -eq 0) {

        Write-Host `
            "  None matched transport keywords." `
            -ForegroundColor DarkYellow

    }
    else {

        $Interesting |
            Select-Object `
                id,
                name,
                parentLayerId,
                subLayerIds |
            Format-Table `
                -AutoSize
    }


    Write-Host ""
    Write-Host `
        "Full layer list:" `
        -ForegroundColor DarkGray

    Write-Host ""


    $Layers |
        Select-Object `
            id,
            name,
            parentLayerId |
        Format-Table `
            -AutoSize
}


# ------------------------------------------------------------
# Save combined discovery result
# ------------------------------------------------------------

$CombinedFile =
    Join-Path `
        $Root `
        "transport-layer-discovery.json"


$AllResults |
    ConvertTo-Json `
        -Depth 20 |
    Set-Content `
        -Path $CombinedFile `
        -Encoding UTF8


# ------------------------------------------------------------
# Interesting combined summary
# ------------------------------------------------------------

$Matches =
    @(
        $AllResults |
        Where-Object {

            $_.name -match
            '(?i)rea.?vaya|brt|bus|station|stop|transport|metrobus|putco|taxi'
        }
    )


Write-Host ""
Write-Host "================================================" `
    -ForegroundColor Green

Write-Host " Johannesburg transport discovery complete" `
    -ForegroundColor Green

Write-Host "================================================" `
    -ForegroundColor Green

Write-Host ""

Write-Host `
    "Layers discovered: $($AllResults.Count)"

Write-Host `
    "Keyword matches   : $($Matches.Count)"

Write-Host ""


if ($Matches.Count -gt 0) {

    Write-Host `
        "COMBINED TRANSPORT MATCHES:" `
        -ForegroundColor Cyan

    Write-Host ""


    $Matches |
        Select-Object `
            service,
            id,
            name,
            parentLayerId |
        Format-Table `
            -AutoSize
}


Write-Host ""
Write-Host "Saved:"
Write-Host `
    $CombinedFile `
    -ForegroundColor Cyan

Write-Host ""

Write-Host `
    "Important: layer IDs have only been discovered. No GIS features have been downloaded or interpreted yet." `
    -ForegroundColor Yellow

Write-Host ""
