param(
    [string]$OutputRoot = ".\src\data\transit\gauteng\metrobus\gis-raw"
)

$ErrorActionPreference = "Stop"

$BaseUrl =
    "https://ags.joburg.org.za/server/rest/services/Transportation/MapServer"

$Layers = @(
    @{
        Id   = 22
        Name = "metrobus-routes"
    },
    @{
        Id   = 52
        Name = "metrobus-stops"
    }
)

$PageSize = 500

New-Item `
    -ItemType Directory `
    -Force `
    -Path $OutputRoot |
    Out-Null

$Utf8 =
    New-Object System.Text.UTF8Encoding($false)

function Write-Utf8Json {
    param(
        [Parameter(Mandatory = $true)]
        $Value,

        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $json =
        $Value |
        ConvertTo-Json -Depth 100

    $resolved =
        $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath(
            $Path
        )

    [System.IO.File]::WriteAllText(
        $resolved,
        $json,
        $Utf8
    )
}

function Get-ArcGisFeatures {
    param(
        [Parameter(Mandatory = $true)]
        [int]$LayerId
    )

    $queryUrl =
        "$BaseUrl/$LayerId/query"

    $allFeatures = @()

    $offset = 0

    while ($true) {

        Write-Host `
            "Downloading layer $LayerId from offset $offset..." `
            -ForegroundColor DarkCyan

        $body = @{
            where             = "1=1"
            outFields         = "*"
            returnGeometry    = "true"
            outSR             = "4326"
            f                 = "json"
            resultOffset      = $offset
            resultRecordCount = $PageSize
            orderByFields     = "OBJECTID ASC"
        }

        $response =
            Invoke-RestMethod `
                -Uri $queryUrl `
                -Method Post `
                -ContentType "application/x-www-form-urlencoded" `
                -Body $body `
                -TimeoutSec 120

        if ($response.error) {
            throw (
                "ArcGIS layer $LayerId query failed: " +
                $response.error.message
            )
        }

        $page =
            @($response.features)

        if ($page.Count -eq 0) {
            break
        }

        $allFeatures +=
            $page

        Write-Host `
            "  Retrieved $($page.Count) features; total $($allFeatures.Count)"

        if ($page.Count -lt $PageSize) {
            break
        }

        $offset +=
            $page.Count
    }

    return $allFeatures
}

$summary = @()

foreach ($layer in $Layers) {

    $layerId =
        [int]$layer.Id

    $name =
        [string]$layer.Name

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "SYNCING $name (Layer $layerId)" -ForegroundColor Cyan
    Write-Host "========================================"

    $metadata =
        Invoke-RestMethod `
            -Uri "$BaseUrl/$layerId`?f=pjson" `
            -TimeoutSec 120

    if ($metadata.error) {
        throw (
            "Could not read metadata for layer ${layerId}: " +
            $metadata.error.message
        )
    }

    $metadataPath =
        Join-Path `
            $OutputRoot `
            "$name-metadata.json"

    Write-Utf8Json `
        -Value $metadata `
        -Path $metadataPath

    $features =
        Get-ArcGisFeatures `
            -LayerId $layerId

    $snapshot = [ordered]@{
        source = [ordered]@{
            authority =
                "City of Johannesburg"
            service =
                "Transportation"
            layerId =
                $layerId
            layerName =
                $metadata.name
            serviceUrl =
                "$BaseUrl/$layerId"
            retrievedAt =
                (Get-Date).ToUniversalTime().ToString("o")
            requestedOutputSpatialReference =
                4326
        }

        geometryType =
            $metadata.geometryType

        spatialReference = [ordered]@{
            requestedWkid =
                4326
            note =
                "Geometry requested from ArcGIS using outSR=4326; native service CRS is preserved in metadata."
        }

        featureCount =
            $features.Count

        features =
            $features
    }

    $snapshotPath =
        Join-Path `
            $OutputRoot `
            "$name-wgs84.json"

    Write-Utf8Json `
        -Value $snapshot `
        -Path $snapshotPath

    $summary +=
        [pscustomobject]@{
            layerId =
                $layerId

            name =
                $metadata.name

            geometryType =
                $metadata.geometryType

            features =
                $features.Count

            file =
                $snapshotPath
        }

    Write-Host `
        "Saved $($features.Count) features -> $snapshotPath" `
        -ForegroundColor Green
}

$report = [ordered]@{
    generatedAt =
        (Get-Date).ToUniversalTime().ToString("o")

    authority =
        "City of Johannesburg"

    service =
        "Transportation"

    outputSpatialReference =
        4326

    layers =
        @($summary)

    evidencePolicy = [ordered]@{
        routeGeometry =
            "official-city-gis"

        stopGeometry =
            "official-city-gis"

        routeStopMembership =
            "not-published-in-current-stop-layer"

        spatialStopMatching =
            "support-only-until-separately-validated"

        passengerRoutingEnabled =
            $false
    }
}

$reportPath =
    Join-Path `
        $OutputRoot `
        "sync-report.json"

Write-Utf8Json `
    -Value $report `
    -Path $reportPath

Write-Host ""
Write-Host "Metrobus GIS sync complete." -ForegroundColor Green
Write-Host ""

$summary |
    Format-Table `
        layerId,
        name,
        geometryType,
        features,
        file `
        -AutoSize

Write-Host ""
Write-Host "Passenger routing remains DISABLED."