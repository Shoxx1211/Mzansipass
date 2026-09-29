$ErrorActionPreference = "Stop"

# ============================================================
# Pulse Transit - Gautrain Bus / Midi-bus Route Source Sync
#
# INPUT
#   src/data/transit/gauteng/gautrain/raw/
#       bus-route-downloads.html
#
# OUTPUT
#   raw/bus-routes/*.pdf
#   raw/bus-route-source-manifest.json
#
# Important:
# - discovers official PDF links directly
# - station group comes from Gautrain's official PDF URL path
# - validates every downloaded file as a PDF
# - does not infer stops, route geometry, timetable or ETA
# ============================================================

$Root = Join-Path `
    $PSScriptRoot `
    "..\..\src\data\transit\gauteng\gautrain"

$Root = [System.IO.Path]::GetFullPath($Root)

$RawDir = Join-Path `
    $Root `
    "raw"

$SourceHtml = Join-Path `
    $RawDir `
    "bus-route-downloads.html"

$PdfDir = Join-Path `
    $RawDir `
    "bus-routes"

$ManifestFile = Join-Path `
    $RawDir `
    "bus-route-source-manifest.json"


# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------

function Decode-Html {
    param(
        [string]$Value
    )

    if ($null -eq $Value) {
        return ""
    }

    return [System.Net.WebUtility]::HtmlDecode(
        $Value
    )
}


function Strip-Html {
    param(
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return ""
    }

    $Text = $Value

    $Text = [regex]::Replace(
        $Text,
        '<script\b[^>]*>[\s\S]*?</script>',
        ' ',
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )

    $Text = [regex]::Replace(
        $Text,
        '<style\b[^>]*>[\s\S]*?</style>',
        ' ',
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )

    $Text = [regex]::Replace(
        $Text,
        '<[^>]+>',
        ' '
    )

    $Text = Decode-Html $Text

    $Text = [regex]::Replace(
        $Text,
        '\s+',
        ' '
    )

    return $Text.Trim()
}


function New-Slug {
    param(
        [string]$Value
    )

    $Slug = $Value.ToLowerInvariant()

    $Slug = $Slug -replace '&', ' and '
    $Slug = $Slug -replace '[^a-z0-9]+', '-'
    $Slug = $Slug.Trim('-')

    return $Slug
}


function Test-Pdf {
    param(
        [string]$Path
    )

    if (-not (Test-Path $Path)) {
        return $false
    }

    $Info = Get-Item $Path

    if ($Info.Length -lt 1000) {
        return $false
    }

    $Stream = [System.IO.File]::OpenRead(
        $Path
    )

    try {

        $Header = New-Object byte[] 5

        $Read = $Stream.Read(
            $Header,
            0,
            5
        )

    }
    finally {

        $Stream.Dispose()

    }

    if ($Read -ne 5) {
        return $false
    }

    $Signature =
        [System.Text.Encoding]::ASCII.GetString(
            $Header
        )

    return $Signature -eq "%PDF-"
}


function Get-StationKeyFromUrl {
    param(
        [string]$Url
    )

    $DecodedUrl = [Uri]::UnescapeDataString(
        $Url
    )

    $StationMap = [ordered]@{
        "CENTURION"   = "centurion"
        "HATFIELD"    = "hatfield"
        "MARLBORO"    = "marlboro"
        "MIDRAND"     = "midrand"
        "PARK"        = "park"
        "PRETORIA"    = "pretoria"
        "RHODESFIELD" = "rhodesfield"
        "ROSEBANK"    = "rosebank"
        "SANDTON"     = "sandton"
    }

    foreach ($Entry in $StationMap.GetEnumerator()) {

        $Pattern =
            "(?i)/$([regex]::Escape($Entry.Key))/"

        if ($DecodedUrl -match $Pattern) {
            return $Entry.Value
        }
    }

    return $null
}


# ------------------------------------------------------------
# Start
# ------------------------------------------------------------

Write-Host ""
Write-Host "================================================" `
    -ForegroundColor DarkCyan

Write-Host " Pulse Transit - Gautrain Bus Route Source Sync" `
    -ForegroundColor White

Write-Host "================================================" `
    -ForegroundColor DarkCyan

Write-Host ""


if (-not (Test-Path $SourceHtml)) {
    throw "Missing source HTML: $SourceHtml"
}


$Html = Get-Content `
    $SourceHtml `
    -Raw


if ([string]::IsNullOrWhiteSpace($Html)) {
    throw "bus-route-downloads.html is empty"
}


New-Item `
    -ItemType Directory `
    -Force `
    -Path $PdfDir |
    Out-Null


# ------------------------------------------------------------
# Extract every anchor independently
#
# We deliberately DO NOT depend on heading markup.
# ------------------------------------------------------------

$AnchorPattern =
    '(?is)<a\b[^>]*href\s*=\s*["''](?<href>[^"'']+)["''][^>]*>(?<body>.*?)</a>'


$AnchorMatches = [regex]::Matches(
    $Html,
    $AnchorPattern,
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
)


Write-Host `
    "HTML anchors found: $($AnchorMatches.Count)" `
    -ForegroundColor DarkGray

Write-Host ""


$Routes =
    New-Object System.Collections.Generic.List[object]


foreach ($Match in $AnchorMatches) {

    $Href = Decode-Html `
        $Match.Groups["href"].Value

    $Title = Strip-Html `
        $Match.Groups["body"].Value


    if (
        [string]::IsNullOrWhiteSpace($Href)
    ) {
        continue
    }


    # --------------------------------------------------------
    # Must be a PDF
    # --------------------------------------------------------

    if (
        $Href -notmatch '(?i)\.pdf(?:[?#].*)?$'
    ) {
        continue
    }


    # --------------------------------------------------------
    # We only want official Gautrain bus-route map storage,
    # not unrelated PDFs elsewhere in the navigation.
    # --------------------------------------------------------

    if (
        $Href -notmatch '(?i)busroutes'
    ) {
        continue
    }


    # --------------------------------------------------------
    # Resolve relative URL if Gautrain changes implementation
    # --------------------------------------------------------

    if (
        $Href -match '^https?://'
    ) {

        $Url = $Href

    }
    else {

        $BaseUri = [Uri]::new(
            "https://www.gautrain.co.za/commuter/busroutedownloads"
        )

        $Url = [Uri]::new(
            $BaseUri,
            $Href
        ).AbsoluteUri

    }


    # --------------------------------------------------------
    # Determine station from official source URL path
    # --------------------------------------------------------

    $StationKey =
        Get-StationKeyFromUrl `
            $Url


    if (-not $StationKey) {

        Write-Host `
            "Skipping PDF with unknown station folder:" `
            -ForegroundColor Yellow

        Write-Host `
            "  $Url" `
            -ForegroundColor DarkYellow

        continue
    }


    # --------------------------------------------------------
    # Anchor may contain only an image in some markup.
    #
    # If title is empty / Acrobat, derive a human-readable
    # source title from the official PDF filename.
    # --------------------------------------------------------

    if (
        [string]::IsNullOrWhiteSpace($Title) -or
        $Title -match '^(?i)acrobat$'
    ) {

        try {

            $Uri =
                [Uri]$Url

            $BaseName =
                [System.IO.Path]::GetFileNameWithoutExtension(
                    $Uri.AbsolutePath
                )

            $Title =
                [Uri]::UnescapeDataString(
                    $BaseName
                )

            $Title =
                $Title -replace '[-_]+', ' '

            $Title =
                [regex]::Replace(
                    $Title,
                    '\s+',
                    ' '
                ).Trim()

        }
        catch {

            $Title =
                "$StationKey route map"

        }
    }


    # --------------------------------------------------------
    # Vehicle type
    #
    # Only label it midi-bus if official text / filename says
    # midi-bus / midibus.
    # --------------------------------------------------------

    $VehicleTypeHint = $null

    $CombinedClassificationText =
        "$Title $Url"


    if (
        $CombinedClassificationText -match
        '(?i)\bmidi[\s_-]?bus\b|\bmidibus\b'
    ) {
        $VehicleTypeHint =
            "midibus"
    }


    # --------------------------------------------------------
    # File name
    # --------------------------------------------------------

    $Slug =
        New-Slug `
            "$StationKey-$Title"


    if (
        [string]::IsNullOrWhiteSpace($Slug)
    ) {
        $Slug =
            "$StationKey-route"
    }


    $FileName =
        "$Slug.pdf"


    # --------------------------------------------------------
    # Record
    # --------------------------------------------------------

    $Routes.Add(
        [PSCustomObject]@{

            stationId =
                "gautrain-station-$StationKey"

            stationKey =
                $StationKey

            sourceTitle =
                $Title

            sourceUrl =
                $Url

            sourceFile =
                "raw/bus-routes/$FileName"

            stationAssignmentMethod =
                "official-source-url-folder"

            vehicleTypeHint =
                $VehicleTypeHint

            sourceAuthority =
                "Gautrain"

            relationship =
                "official-route-map-download"

            downloaded =
                $false

            pdfValidated =
                $false

            bytes =
                0
        }
    )
}


# ------------------------------------------------------------
# De-duplicate using the official URL
# ------------------------------------------------------------

$Routes = @(
    $Routes |
    Group-Object sourceUrl |
    ForEach-Object {
        $_.Group |
        Select-Object -First 1
    }
)


Write-Host `
    "Official bus-route PDF links extracted: $($Routes.Count)" `
    -ForegroundColor Cyan

Write-Host ""


if ($Routes.Count -eq 0) {

    Write-Host `
        "Diagnostics:" `
        -ForegroundColor Yellow

    Write-Host `
        "PDF-like hrefs present in source:" `
        -ForegroundColor Yellow

    $AnchorMatches |
        ForEach-Object {

            Decode-Html `
                $_.Groups["href"].Value

        } |
        Where-Object {

            $_ -match '(?i)\.pdf'

        } |
        Select-Object -First 20 |
        ForEach-Object {

            Write-Host "  $_"

        }


    throw `
        "No Gautrain bus-route PDF links were extracted."
}


# ------------------------------------------------------------
# Current official page has 45 maps.
#
# This is QA information only, NOT a hard requirement.
# ------------------------------------------------------------

$CurrentReferenceCount = 45


if (
    $Routes.Count -ne
    $CurrentReferenceCount
) {

    Write-Host `
        "NOTE: current reference count is $CurrentReferenceCount, but this saved source contains $($Routes.Count)." `
        -ForegroundColor Yellow

    Write-Host `
        "The saved official source remains the source of record for this sync." `
        -ForegroundColor Yellow

    Write-Host ""
}


# ------------------------------------------------------------
# Download PDFs
# ------------------------------------------------------------

$SuccessCount = 0
$FailureCount = 0


foreach ($Route in $Routes) {

    $Destination =
        Join-Path `
            $Root `
            $Route.sourceFile


    $TempFile =
        "$Destination.download"


    Write-Host `
        "[$($Route.stationKey)] $($Route.sourceTitle)" `
        -ForegroundColor White


    if (
        Test-Path $TempFile
    ) {
        Remove-Item `
            -Force `
            $TempFile
    }


    # --------------------------------------------------------
    # Reuse valid existing PDF
    # --------------------------------------------------------

    if (
        Test-Pdf `
            $Destination
    ) {

        $Info =
            Get-Item `
                $Destination

        $Route.downloaded =
            $true

        $Route.pdfValidated =
            $true

        $Route.bytes =
            $Info.Length

        $SuccessCount += 1


        Write-Host `
            "  existing PDF valid ($($Info.Length) bytes)" `
            -ForegroundColor DarkGreen

        continue
    }


    if (
        Test-Path $Destination
    ) {
        Remove-Item `
            -Force `
            $Destination
    }


    # --------------------------------------------------------
    # Download
    # --------------------------------------------------------

    & curl.exe `
        --fail `
        --location `
        --silent `
        --show-error `
        --retry 2 `
        --connect-timeout 20 `
        --max-time 180 `
        --user-agent "Mozilla/5.0" `
        "$($Route.sourceUrl)" `
        --output "$TempFile"


    if (
        $LASTEXITCODE -ne 0
    ) {

        $FailureCount += 1


        Write-Host `
            "  DOWNLOAD FAILED" `
            -ForegroundColor Red


        if (
            Test-Path $TempFile
        ) {
            Remove-Item `
                -Force `
                $TempFile
        }

        continue
    }


    # --------------------------------------------------------
    # Validate downloaded PDF
    # --------------------------------------------------------

    if (
        -not (
            Test-Pdf `
                $TempFile
        )
    ) {

        $FailureCount += 1


        Write-Host `
            "  INVALID PDF" `
            -ForegroundColor Red


        if (
            Test-Path $TempFile
        ) {
            Remove-Item `
                -Force `
                $TempFile
        }

        continue
    }


    Move-Item `
        -Force `
        $TempFile `
        $Destination


    $Info =
        Get-Item `
            $Destination


    $Route.downloaded =
        $true

    $Route.pdfValidated =
        $true

    $Route.bytes =
        $Info.Length


    $SuccessCount += 1


    Write-Host `
        "  saved ($($Info.Length) bytes)" `
        -ForegroundColor Green
}


# ------------------------------------------------------------
# Station summary
# ------------------------------------------------------------

$StationSummary = @(
    $Routes |
    Group-Object stationKey |
    Sort-Object Name |
    ForEach-Object {

        $Group =
            $_.Group


        [PSCustomObject]@{

            stationKey =
                $_.Name

            stationId =
                "gautrain-station-$($_.Name)"

            publishedRouteMapCount =
                $Group.Count

            validatedPdfCount =
                @(
                    $Group |
                    Where-Object {
                        $_.pdfValidated
                    }
                ).Count

            explicitMidibusTitleCount =
                @(
                    $Group |
                    Where-Object {
                        $_.vehicleTypeHint -eq
                        "midibus"
                    }
                ).Count
        }
    }
)


# ------------------------------------------------------------
# Manifest
# ------------------------------------------------------------

$Manifest = [ordered]@{

    schemaVersion =
        1

    operatorId =
        "gautrain"

    sourceAuthority =
        "Gautrain"

    sourcePage =
        "https://www.gautrain.co.za/commuter/busroutedownloads"

    sourceSnapshot =
        "raw/bus-route-downloads.html"

    generatedAt =
        (Get-Date).ToUniversalTime().ToString("o")

    publishedRouteMapCount =
        $Routes.Count

    validatedPdfCount =
        $SuccessCount

    failedPdfCount =
        $FailureCount

    stationGroupCount =
        $StationSummary.Count

    stationSummary =
        $StationSummary

    routes =
        $Routes

    notes =
        @(
            "Route URLs come from the official Gautrain Bus Route Downloads page.",
            "Station grouping is taken from the station folder contained in Gautrain's official bus-route PDF URL.",
            "vehicleTypeHint is set to midibus only where the official title or filename explicitly indicates midi-bus or midibus.",
            "A PDF route map is not yet treated as verified route geometry or a complete ordered stop sequence.",
            "No timetable, stop coordinates, live bus position or ETA is inferred."
        )
}


$Manifest |
    ConvertTo-Json `
        -Depth 10 |
    Set-Content `
        -Path $ManifestFile `
        -Encoding UTF8


# ------------------------------------------------------------
# Finish
# ------------------------------------------------------------

Write-Host ""
Write-Host "================================================" `
    -ForegroundColor Green

Write-Host " Gautrain bus-route source sync complete" `
    -ForegroundColor Green

Write-Host "================================================" `
    -ForegroundColor Green

Write-Host ""


Write-Host `
    "Route maps discovered : $($Routes.Count)"

Write-Host `
    "Validated PDFs        : $SuccessCount"

Write-Host `
    "Failed PDFs           : $FailureCount"

Write-Host `
    "Station groups        : $($StationSummary.Count)"

Write-Host ""


$StationSummary |
    Format-Table `
        stationKey,
        publishedRouteMapCount,
        validatedPdfCount,
        explicitMidibusTitleCount `
        -AutoSize


Write-Host ""

Write-Host `
    "Manifest:"

Write-Host `
    $ManifestFile `
    -ForegroundColor Cyan

Write-Host ""

Write-Host `
    "Important: route-map PDFs were captured, but stops, route geometry, schedules and ETAs were not inferred." `
    -ForegroundColor Yellow

Write-Host ""