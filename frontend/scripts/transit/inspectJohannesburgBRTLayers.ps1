$ErrorActionPreference = "Stop"

# ============================================================
# Pulse Transit - Johannesburg BRT Layer Inspector
#
# Purpose:
# - inspect exact City of Johannesburg Rea Vaya/BRT layers
# - obtain geometry type
# - obtain field schema
# - obtain feature count
# - obtain spatial reference
# - obtain query capabilities
#
# NO feature coordinates/geometry are downloaded in this step.
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


$Transportation =
    "https://ags.joburg.org.za/server/rest/services/Transportation/MapServer"

$TransportationMaster =
    "https://ags.joburg.org.za/server/rest/services/TransportationMaster/MapServer"


$Targets = @(

    # --------------------------------------------------------
    # Main Transportation service
    # --------------------------------------------------------

    [PSCustomObject]@{
        service = "Transportation"
        id      = 5
        expectedName = "BRT Routes"
        baseUrl = $Transportation
    },

    [PSCustomObject]@{
        service = "Transportation"
        id      = 6
        expectedName = "BRT Stations"
        baseUrl = $Transportation
    },

    [PSCustomObject]@{
        service = "Transportation"
        id      = 7
        expectedName = "BRT Stops"
        baseUrl = $Transportation
    },

    [PSCustomObject]@{
        service = "Transportation"
        id      = 140
        expectedName = "BRT Feeder Routes"
        baseUrl = $Transportation
    },

    [PSCustomObject]@{
        service = "Transportation"
        id      = 54
        expectedName = "BRT Trunk Routes"
        baseUrl = $Transportation
    },


    # --------------------------------------------------------
    # TransportationMaster
    # --------------------------------------------------------

    [PSCustomObject]@{
        service = "TransportationMaster"
        id      = 0
        expectedName = "BRT Stations Phase 1C 11Stations"
        baseUrl = $TransportationMaster
    },

    [PSCustomObject]@{
        service = "TransportationMaster"
        id      = 1
        expectedName = "BRT C1 Dobsonville To Ellis Park"
        baseUrl = $TransportationMaster
    },

    [PSCustomObject]@{
        service = "TransportationMaster"
        id      = 2
        expectedName = "BRT F11 Yeoville To Metro Centre"
        baseUrl = $TransportationMaster
    },

    [PSCustomObject]@{
        service = "TransportationMaster"
        id      = 3
        expectedName = "BRT T2 Thokoza To Braamfontein"
        baseUrl = $TransportationMaster
    },

    [PSCustomObject]@{
        service = "TransportationMaster"
        id      = 4
        expectedName = "BRT T3 Thokoza To Metro Centre"
        baseUrl = $TransportationMaster
    },

    [PSCustomObject]@{
        service = "TransportationMaster"
        id      = 5
        expectedName = "BRT T1 Thokoza To Ellis Park"
        baseUrl = $TransportationMaster
    }
)


function Invoke-ArcGisJson {

    param(
        [string]$Url,
        [hashtable]$Parameters
    )

    $TempFile =
        Join-Path `
            $env:TEMP `
            ("pulse-jhb-gis-" + [guid]::NewGuid().ToString() + ".json")


    try {

        $Arguments = @(
            "--fail",
            "--location",
            "--silent",
            "--show-error",
            "--retry", "2",
            "--connect-timeout", "20",
            "--max-time", "120",
            "--user-agent", "Mozilla/5.0",
            "--get"
        )


        foreach ($Key in $Parameters.Keys) {

            $Arguments += @(
                "--data-urlencode",
                "$Key=$($Parameters[$Key])"
            )
        }


        $Arguments += @(
            $Url,
            "--output",
            $TempFile
        )


        & curl.exe @Arguments


        if ($LASTEXITCODE -ne 0) {

            throw `
                "curl failed for $Url"
        }


        if (-not (Test-Path $TempFile)) {

            throw `
                "No response file created for $Url"
        }


        $Raw =
            Get-Content `
                $TempFile `
                -Raw


        if ([string]::IsNullOrWhiteSpace($Raw)) {

            throw `
                "Empty response from $Url"
        }


        try {

            $Json =
                $Raw |
                ConvertFrom-Json
        }
        catch {

            throw `
                "Response from $Url is not valid JSON."
        }


        if ($Json.error) {

            $Message =
                $Json.error.message

            $Details =
                if ($Json.error.details) {
                    $Json.error.details -join "; "
                }
                else {
                    ""
                }


            throw `
                "ArcGIS error: $Message $Details"
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

Write-Host " Pulse Transit - Johannesburg BRT Inspector" `
    -ForegroundColor White

Write-Host "================================================" `
    -ForegroundColor DarkCyan

Write-Host ""


$Results =
    New-Object System.Collections.Generic.List[object]


foreach ($Target in $Targets) {

    Write-Host "------------------------------------------------" `
        -ForegroundColor DarkCyan

    Write-Host `
        "$($Target.service) / Layer $($Target.id)" `
        -ForegroundColor Cyan

    Write-Host `
        "Expected: $($Target.expectedName)" `
        -ForegroundColor DarkGray


    $LayerUrl =
        "$($Target.baseUrl)/$($Target.id)"


    try {

        # ----------------------------------------------------
        # Layer metadata
        # ----------------------------------------------------

        $Metadata =
            Invoke-ArcGisJson `
                -Url $LayerUrl `
                -Parameters @{
                    f = "pjson"
                }


        $NameMatches =
            $Metadata.name -eq
            $Target.expectedName


        # ----------------------------------------------------
        # Save complete metadata snapshot
        # ----------------------------------------------------

        $SafeService =
            $Target.service.ToLowerInvariant()

        $MetadataFile =
            Join-Path `
                $Root `
                "$SafeService-layer-$($Target.id)-metadata.json"


        $Metadata |
            ConvertTo-Json `
                -Depth 40 |
            Set-Content `
                -Path $MetadataFile `
                -Encoding UTF8


        # ----------------------------------------------------
        # Query feature count only
        #
        # No geometry or feature records downloaded.
        # ----------------------------------------------------

        $FeatureCount =
            $null

        $CountQuerySucceeded =
            $false


        $Capabilities =
            [string]$Metadata.capabilities


        $CanQuery =
            $Capabilities -match
            "(?i)query"


        if ($CanQuery) {

            try {

                $CountResponse =
                    Invoke-ArcGisJson `
                        -Url "$LayerUrl/query" `
                        -Parameters @{
                            where =
                                "1=1"

                            returnCountOnly =
                                "true"

                            f =
                                "json"
                        }


                if (
                    $null -ne
                    $CountResponse.count
                ) {

                    $FeatureCount =
                        [int]$CountResponse.count

                    $CountQuerySucceeded =
                        $true
                }

            }
            catch {

                Write-Host `
                    "  Count query failed: $($_.Exception.Message)" `
                    -ForegroundColor Yellow
            }
        }


        # ----------------------------------------------------
        # Field schema
        # ----------------------------------------------------

        $Fields =
            @(
                $Metadata.fields |
                ForEach-Object {

                    [PSCustomObject]@{
                        name =
                            $_.name

                        alias =
                            $_.alias

                        type =
                            $_.type

                        length =
                            $_.length
                    }
                }
            )


        $InterestingFields =
            @(
                $Fields |
                Where-Object {

                    $_.name -match
                        "(?i)name|route|station|stop|phase|brt|code|id|from|to|origin|destination|direction|status|type"
                }
            )


        # ----------------------------------------------------
        # Spatial reference
        # ----------------------------------------------------

        $SpatialReference =
            $null


        if ($Metadata.extent.spatialReference.latestWkid) {

            $SpatialReference =
                $Metadata.extent.spatialReference.latestWkid

        }
        elseif ($Metadata.extent.spatialReference.wkid) {

            $SpatialReference =
                $Metadata.extent.spatialReference.wkid
        }


        # ----------------------------------------------------
        # Record
        # ----------------------------------------------------

        $Result =
            [PSCustomObject]@{

                service =
                    $Target.service

                id =
                    $Target.id

                expectedName =
                    $Target.expectedName

                actualName =
                    $Metadata.name

                nameMatches =
                    $NameMatches

                type =
                    $Metadata.type

                geometryType =
                    $Metadata.geometryType

                displayField =
                    $Metadata.displayField

                objectIdField =
                    $Metadata.objectIdField

                capabilities =
                    $Metadata.capabilities

                canQuery =
                    $CanQuery

                countQuerySucceeded =
                    $CountQuerySucceeded

                featureCount =
                    $FeatureCount

                fieldCount =
                    $Fields.Count

                fields =
                    $Fields

                interestingFields =
                    $InterestingFields

                spatialReference =
                    $SpatialReference

                maxRecordCount =
                    $Metadata.maxRecordCount

                description =
                    $Metadata.description

                copyrightText =
                    $Metadata.copyrightText

                minScale =
                    $Metadata.minScale

                maxScale =
                    $Metadata.maxScale

                layerUrl =
                    $LayerUrl
            }


        $Results.Add(
            $Result
        )


        # ----------------------------------------------------
        # Console summary
        # ----------------------------------------------------

        Write-Host ""

        Write-Host `
            "  Actual name     : $($Metadata.name)"

        Write-Host `
            "  Name matches    : $NameMatches"

        Write-Host `
            "  Type            : $($Metadata.type)"

        Write-Host `
            "  Geometry        : $($Metadata.geometryType)"

        Write-Host `
            "  Spatial ref     : $SpatialReference"

        Write-Host `
            "  Query capable   : $CanQuery"

        Write-Host `
            "  Feature count   : $FeatureCount"

        Write-Host `
            "  Fields          : $($Fields.Count)"

        Write-Host `
            "  Max records     : $($Metadata.maxRecordCount)"


        if ($InterestingFields.Count -gt 0) {

            Write-Host ""
            Write-Host `
                "  Potentially useful fields:" `
                -ForegroundColor Yellow


            $InterestingFields |
                Select-Object `
                    name,
                    alias,
                    type |
                Format-Table `
                    -AutoSize
        }


        Write-Host ""

    }
    catch {

        Write-Host ""

        Write-Host `
            "FAILED: $($_.Exception.Message)" `
            -ForegroundColor Red

        Write-Host ""


        $Results.Add(
            [PSCustomObject]@{

                service =
                    $Target.service

                id =
                    $Target.id

                expectedName =
                    $Target.expectedName

                failed =
                    $true

                error =
                    $_.Exception.Message
            }
        )
    }
}


# ============================================================
# Save combined report
# ============================================================

$OutputFile =
    Join-Path `
        $Root `
        "brt-layer-inspection.json"


$Results |
    ConvertTo-Json `
        -Depth 40 |
    Set-Content `
        -Path $OutputFile `
        -Encoding UTF8


# ============================================================
# Final summary
# ============================================================

$Successful =
    @(
        $Results |
        Where-Object {
            -not $_.failed
        }
    )


$Failed =
    @(
        $Results |
        Where-Object {
            $_.failed
        }
    )


Write-Host ""
Write-Host "================================================" `
    -ForegroundColor Green

Write-Host " Johannesburg BRT inspection complete" `
    -ForegroundColor Green

Write-Host "================================================" `
    -ForegroundColor Green

Write-Host ""

Write-Host `
    "Layers attempted : $($Targets.Count)"

Write-Host `
    "Successful       : $($Successful.Count)"

Write-Host `
    "Failed           : $($Failed.Count)"

Write-Host ""


if ($Successful.Count -gt 0) {

    Write-Host `
        "SUMMARY:" `
        -ForegroundColor Cyan

    Write-Host ""


    $Successful |
        Select-Object `
            service,
            id,
            actualName,
            geometryType,
            featureCount,
            fieldCount,
            canQuery |
        Format-Table `
            -AutoSize
}


Write-Host ""
Write-Host "Saved:"
Write-Host `
    $OutputFile `
    -ForegroundColor Cyan

Write-Host ""

Write-Host `
    "Important: metadata and feature counts only. No route/station geometry has been imported into Pulse yet." `
    -ForegroundColor Yellow

Write-Host ""