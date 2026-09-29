$ErrorActionPreference = "Stop"

# ============================================================
# Pulse Transit - Johannesburg Rea Vaya / BRT GIS Sync
#
# Official source:
# City of Johannesburg ArcGIS Server
#
# Downloads raw GIS features as GeoJSON in EPSG:4326.
#
# IMPORTANT:
# - feature count != route count
# - geometry direction is not assumed
# - duplicate/overlapping segments are preserved
# - no topology is inferred here
# - no station-to-route relationship is inferred here
# ============================================================

$Root = Join-Path `
    $PSScriptRoot `
    "..\..\src\data\transit\gauteng\reavaya"

$Root = [System.IO.Path]::GetFullPath($Root)

$RawDir =
    Join-Path `
        $Root `
        "raw\gis"

New-Item `
    -ItemType Directory `
    -Force `
    -Path $RawDir |
    Out-Null


$Transportation =
    "https://ags.joburg.org.za/server/rest/services/Transportation/MapServer"

$TransportationMaster =
    "https://ags.joburg.org.za/server/rest/services/TransportationMaster/MapServer"


$Layers = @(

    # ========================================================
    # General City Transportation service
    # ========================================================

    [PSCustomObject]@{
        key = "brt-routes"
        service = "Transportation"
        id = 5
        expectedName = "BRT Routes"
        expectedCount = 99
        baseUrl = $Transportation
    },

    [PSCustomObject]@{
        key = "brt-stations"
        service = "Transportation"
        id = 6
        expectedName = "BRT Stations"
        expectedCount = 58
        baseUrl = $Transportation
    },

    [PSCustomObject]@{
        key = "brt-stops"
        service = "Transportation"
        id = 7
        expectedName = "BRT Stops"
        expectedCount = 0
        baseUrl = $Transportation
    },

    [PSCustomObject]@{
        key = "brt-feeder-routes"
        service = "Transportation"
        id = 140
        expectedName = "BRT Feeder Routes"
        expectedCount = 12
        baseUrl = $Transportation
    },

    [PSCustomObject]@{
        key = "brt-trunk-routes"
        service = "Transportation"
        id = 54
        expectedName = "BRT Trunk Routes"
        expectedCount = 3
        baseUrl = $Transportation
    },


    # ========================================================
    # TransportationMaster
    # ========================================================

    [PSCustomObject]@{
        key = "phase1c-stations"
        service = "TransportationMaster"
        id = 0
        expectedName = "BRT Stations Phase 1C 11Stations"
        expectedCount = 14
        baseUrl = $TransportationMaster
    },

    [PSCustomObject]@{
        key = "route-c1"
        service = "TransportationMaster"
        id = 1
        expectedName = "BRT C1 Dobsonville To Ellis Park"
        expectedCount = 6
        baseUrl = $TransportationMaster
    },

    [PSCustomObject]@{
        key = "route-f11"
        service = "TransportationMaster"
        id = 2
        expectedName = "BRT F11 Yeoville To Metro Centre"
        expectedCount = 3
        baseUrl = $TransportationMaster
    },

    [PSCustomObject]@{
        key = "route-t2"
        service = "TransportationMaster"
        id = 3
        expectedName = "BRT T2 Thokoza To Braamfontein"
        expectedCount = 17
        baseUrl = $TransportationMaster
    },

    [PSCustomObject]@{
        key = "route-t3"
        service = "TransportationMaster"
        id = 4
        expectedName = "BRT T3 Thokoza To Metro Centre"
        expectedCount = 4
        baseUrl = $TransportationMaster
    },

    [PSCustomObject]@{
        key = "route-t1"
        service = "TransportationMaster"
        id = 5
        expectedName = "BRT T1 Thokoza To Ellis Park"
        expectedCount = 22
        baseUrl = $TransportationMaster
    }
)


function Invoke-ArcGisGeoJson {

    param(
        [string]$LayerUrl,
        [string]$Destination
    )

    $TempFile =
        "$Destination.download"


    if (Test-Path $TempFile) {

        Remove-Item `
            -Force `
            $TempFile
    }


    $Arguments = @(

        "--fail",
        "--location",
        "--silent",
        "--show-error",
        "--retry", "2",
        "--connect-timeout", "20",
        "--max-time", "180",
        "--user-agent", "Mozilla/5.0",

        "--get",

        "--data-urlencode", "where=1=1",
        "--data-urlencode", "outFields=*",
        "--data-urlencode", "returnGeometry=true",

        # ----------------------------------------------------
        # Force WGS84 for Pulse / Mapbox
        # ----------------------------------------------------

        "--data-urlencode", "outSR=4326",

        "--data-urlencode", "f=geojson",

        "$LayerUrl/query",

        "--output",
        "$TempFile"
    )


    & curl.exe @Arguments


    if ($LASTEXITCODE -ne 0) {

        if (Test-Path $TempFile) {
            Remove-Item -Force $TempFile
        }

        throw "curl failed for $LayerUrl"
    }


    if (-not (Test-Path $TempFile)) {

        throw "No GeoJSON response created for $LayerUrl"
    }


    $Raw =
        Get-Content `
            $TempFile `
            -Raw


    if ([string]::IsNullOrWhiteSpace($Raw)) {

        Remove-Item `
            -Force `
            $TempFile

        throw "Empty GeoJSON response from $LayerUrl"
    }


    try {

        $GeoJson =
            $Raw |
                ConvertFrom-Json
    }
    catch {

        Remove-Item `
            -Force `
            $TempFile

        throw "Invalid JSON response from $LayerUrl"
    }


    if ($GeoJson.error) {

        $Message =
            $GeoJson.error.message

        Remove-Item `
            -Force `
            $TempFile

        throw "ArcGIS error from $LayerUrl : $Message"
    }


    if ($GeoJson.type -ne "FeatureCollection") {

        Remove-Item `
            -Force `
            $TempFile

        throw `
            "Expected GeoJSON FeatureCollection from $LayerUrl, received type '$($GeoJson.type)'"
    }


    Move-Item `
        -Force `
        $TempFile `
        $Destination


    return $GeoJson
}


function Get-PropertySummary {

    param(
        $Features
    )

    $Names =
        New-Object `
            System.Collections.Generic.HashSet[string]


    foreach ($Feature in $Features) {

        if ($null -eq $Feature.properties) {
            continue
        }


        foreach (
            $Property in
            $Feature.properties.PSObject.Properties
        ) {

            [void]$Names.Add(
                $Property.Name
            )
        }
    }


    return @(
        $Names |
            Sort-Object
    )
}


function Get-CandidateValues {

    param(
        $Features
    )

    $Candidates = @(

        "Name",
        "NAME",
        "name",

        "Route",
        "ROUTE",
        "route",

        "Route_ID",
        "ROUTE_ID",

        "PHASE",
        "Phase",
        "phase",

        "TYPE",
        "Type",
        "type",

        "CODE",
        "Code",
        "code",

        "PHOTONAME",
        "PhotoName",

        "ID"
    )


    $Results =
        New-Object `
            System.Collections.Generic.List[object]


    foreach ($Candidate in $Candidates) {

        $Values =
            @(
                $Features |
                ForEach-Object {

                    if (
                        $_.properties -and
                        $_.properties.PSObject.Properties.Name `
                            -contains $Candidate
                    ) {

                        $_.properties.$Candidate
                    }
                } |
                Where-Object {

                    $null -ne $_ -and
                    "$_".Trim().Length -gt 0

                } |
                ForEach-Object {
                    "$_".Trim()
                } |
                Sort-Object -Unique
            )


        if ($Values.Count -gt 0) {

            $Results.Add(
                [PSCustomObject]@{

                    field =
                        $Candidate

                    uniqueCount =
                        $Values.Count

                    values =
                        @(
                            $Values |
                                Select-Object `
                                    -First 30
                        )
                }
            )
        }
    }


    return $Results
}


Write-Host ""
Write-Host "================================================" `
    -ForegroundColor DarkCyan

Write-Host " Pulse Transit - Johannesburg BRT GIS Sync" `
    -ForegroundColor White

Write-Host "================================================" `
    -ForegroundColor DarkCyan

Write-Host ""


$ManifestLayers =
    New-Object `
        System.Collections.Generic.List[object]


$SuccessCount = 0
$FailureCount = 0
$WarningCount = 0


foreach ($Layer in $Layers) {

    Write-Host "------------------------------------------------" `
        -ForegroundColor DarkCyan

    Write-Host `
        "$($Layer.service) / $($Layer.expectedName)" `
        -ForegroundColor Cyan

    Write-Host `
        "Layer ID: $($Layer.id)" `
        -ForegroundColor DarkGray


    $LayerUrl =
        "$($Layer.baseUrl)/$($Layer.id)"


    $Destination =
        Join-Path `
            $RawDir `
            "$($Layer.key).geojson"


    try {

        $GeoJson =
            Invoke-ArcGisGeoJson `
                -LayerUrl $LayerUrl `
                -Destination $Destination


        $Features =
            @(
                $GeoJson.features
            )


        $ActualCount =
            $Features.Count


        $CountMatches =
            $ActualCount -eq
            $Layer.expectedCount


        if (-not $CountMatches) {

            $WarningCount += 1

            Write-Host `
                "  WARNING: feature count changed from discovery value $($Layer.expectedCount) to $ActualCount." `
                -ForegroundColor Yellow
        }


        # ----------------------------------------------------
        # Geometry-type inventory
        # ----------------------------------------------------

        $GeometryTypes =
            @(
                $Features |
                Where-Object {
                    $null -ne $_.geometry
                } |
                ForEach-Object {
                    $_.geometry.type
                } |
                Sort-Object -Unique
            )


        # ----------------------------------------------------
        # Property schema
        # ----------------------------------------------------

        $PropertyFields =
            @(
                Get-PropertySummary `
                    -Features $Features
            )


        $CandidateValues =
            @(
                Get-CandidateValues `
                    -Features $Features
            )


        # ----------------------------------------------------
        # Coordinate sanity
        # ----------------------------------------------------

        $NullGeometryCount =
            @(
                $Features |
                Where-Object {
                    $null -eq $_.geometry
                }
            ).Count


        # ----------------------------------------------------
        # File info
        # ----------------------------------------------------

        $Info =
            Get-Item `
                $Destination


        $ManifestLayers.Add(

            [PSCustomObject]@{

                key =
                    $Layer.key

                service =
                    $Layer.service

                layerId =
                    $Layer.id

                layerName =
                    $Layer.expectedName

                sourceUrl =
                    $LayerUrl

                sourceAuthority =
                    "City of Johannesburg"

                format =
                    "GeoJSON"

                requestedSpatialReference =
                    "EPSG:4326"

                featureCountAtDiscovery =
                    $Layer.expectedCount

                featureCountAtSync =
                    $ActualCount

                featureCountMatchesDiscovery =
                    $CountMatches

                geometryTypes =
                    $GeometryTypes

                nullGeometryCount =
                    $NullGeometryCount

                propertyFields =
                    $PropertyFields

                candidateValues =
                    $CandidateValues

                sourceFile =
                    "raw/gis/$($Layer.key).geojson"

                bytes =
                    $Info.Length
            }
        )


        $SuccessCount += 1


        Write-Host `
            "  saved       : $($Info.Length) bytes" `
            -ForegroundColor Green

        Write-Host `
            "  features    : $ActualCount"

        Write-Host `
            "  geometries  : $($GeometryTypes -join ', ')"

        Write-Host `
            "  null geom   : $NullGeometryCount"

        Write-Host `
            "  properties  : $($PropertyFields.Count)"


        if ($CandidateValues.Count -gt 0) {

            Write-Host ""
            Write-Host `
                "  Candidate attribute values:" `
                -ForegroundColor Yellow


            foreach ($Entry in $CandidateValues) {

                Write-Host `
                    "    $($Entry.field) [$($Entry.uniqueCount)]:" `
                    -ForegroundColor DarkYellow

                Write-Host `
                    "      $($Entry.values -join ' | ')"
            }
        }


        Write-Host ""

    }
    catch {

        $FailureCount += 1


        Write-Host `
            "  FAILED: $($_.Exception.Message)" `
            -ForegroundColor Red

        Write-Host ""


        $ManifestLayers.Add(

            [PSCustomObject]@{

                key =
                    $Layer.key

                service =
                    $Layer.service

                layerId =
                    $Layer.id

                layerName =
                    $Layer.expectedName

                sourceUrl =
                    $LayerUrl

                failed =
                    $true

                error =
                    $_.Exception.Message
            }
        )
    }
}


# ============================================================
# Manifest
# ============================================================

$ManifestFile =
    Join-Path `
        $RawDir `
        "gis-source-manifest.json"


$Manifest =
    [ordered]@{

        schemaVersion =
            1

        operatorId =
            "reavaya"

        authority =
            "City of Johannesburg"

        retrievedAt =
            (Get-Date).ToUniversalTime().ToString("o")

        requestedSpatialReference =
            "EPSG:4326"

        layerCount =
            $Layers.Count

        successfulLayerCount =
            $SuccessCount

        failedLayerCount =
            $FailureCount

        warningCount =
            $WarningCount

        layers =
            $ManifestLayers

        rules = @(

            "Feature counts are not treated as route counts.",

            "Multipart and segmented route geometries are preserved.",

            "Geometry direction is not assumed to represent service direction.",

            "BRT Stops layer is retained even if it currently contains zero features.",

            "Phase 1C layer name is not used to infer an expected station count.",

            "No station-to-route topology is inferred during raw GIS sync.",

            "No timetable, fare or live-arrival information is derived from GIS geometry."
        )
    }


$Manifest |
    ConvertTo-Json `
        -Depth 50 |
    Set-Content `
        -Path $ManifestFile `
        -Encoding UTF8


Write-Host ""
Write-Host "================================================" `
    -ForegroundColor Green

Write-Host " Johannesburg BRT GIS sync complete" `
    -ForegroundColor Green

Write-Host "================================================" `
    -ForegroundColor Green

Write-Host ""

Write-Host `
    "Layers attempted : $($Layers.Count)"

Write-Host `
    "Successful       : $SuccessCount"

Write-Host `
    "Failed           : $FailureCount"

Write-Host `
    "Warnings         : $WarningCount"

Write-Host ""

Write-Host `
    "Raw GIS directory:" `
    -ForegroundColor White

Write-Host `
    $RawDir `
    -ForegroundColor Cyan

Write-Host ""

Write-Host `
    "Manifest:" `
    -ForegroundColor White

Write-Host `
    $ManifestFile `
    -ForegroundColor Cyan

Write-Host ""

Write-Host `
    "Important: official GIS features captured only. No route topology, direction, stop sequence, timetable or ETA was inferred." `
    -ForegroundColor Yellow

Write-Host ""