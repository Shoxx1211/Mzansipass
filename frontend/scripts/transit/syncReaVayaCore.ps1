$ErrorActionPreference = "Stop"

# ============================================================
# Pulse Transit - Rea Vaya Core Source Sync
#
# Captures current official Rea Vaya source pages without
# attempting to infer routes/stops/geometry yet.
#
# OUTPUT
#   src/data/transit/gauteng/reavaya/raw/*.html
#   src/data/transit/gauteng/reavaya/raw/source-manifest.json
# ============================================================

$Root = Join-Path `
    $PSScriptRoot `
    "..\..\src\data\transit\gauteng\reavaya"

$Root = [System.IO.Path]::GetFullPath($Root)

$RawDir = Join-Path `
    $Root `
    "raw"

$ManifestFile = Join-Path `
    $RawDir `
    "source-manifest.json"


Write-Host ""
Write-Host "================================================" `
    -ForegroundColor DarkCyan

Write-Host " Pulse Transit - Rea Vaya Core Source Sync" `
    -ForegroundColor White

Write-Host "================================================" `
    -ForegroundColor DarkCyan

Write-Host ""


New-Item `
    -ItemType Directory `
    -Force `
    -Path $RawDir |
    Out-Null


# ------------------------------------------------------------
# Official sources
# ------------------------------------------------------------

$Sources = @(
    [PSCustomObject]@{
        id = "operating-routes"
        title = "Rea Vaya Operating Routes"
        url = "https://reavaya.org.za/rea-vaya-operating-routes/"
        file = "operating-routes.html"
        purpose = "route families, published frequencies and schedules"
    },

    [PSCustomObject]@{
        id = "fares"
        title = "Rea Vaya Fares"
        url = "https://reavaya.org.za/fares/"
        file = "fares.html"
        purpose = "current fare bands, off-peak fares, card and penalty rules"
    },

    [PSCustomObject]@{
        id = "phase-1a"
        title = "Rea Vaya Phase 1A"
        url = "https://reavaya.org.za/phase-1a/"
        file = "phase-1a.html"
        purpose = "Phase 1A network description"
    },

    [PSCustomObject]@{
        id = "phase-1b"
        title = "Rea Vaya Phase 1B"
        url = "https://reavaya.org.za/phase-1b/"
        file = "phase-1b.html"
        purpose = "Phase 1B network description"
    },

    [PSCustomObject]@{
        id = "phase-1c"
        title = "Rea Vaya Phase 1C"
        url = "https://reavaya.org.za/phase-1c/"
        file = "phase-1c.html"
        purpose = "Phase 1C corridor and infrastructure description"
    },

    [PSCustomObject]@{
        id = "construction"
        title = "Rea Vaya Construction and Phases"
        url = "https://reavaya.org.za/construction/"
        file = "construction.html"
        purpose = "official network phase context"
    },

    [PSCustomObject]@{
        id = "faq"
        title = "Rea Vaya Frequently Asked Questions"
        url = "https://reavaya.org.za/frequently-asked-questions/"
        file = "faq.html"
        purpose = "transfer and passenger-use rules"
    }
)


# ------------------------------------------------------------
# HTML validation
# ------------------------------------------------------------

function Test-HtmlSnapshot {
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

    $Content = Get-Content `
        $Path `
        -Raw

    if (
        $Content -notmatch '(?i)<html|<!doctype'
    ) {
        return $false
    }

    return $true
}


# ------------------------------------------------------------
# Download
# ------------------------------------------------------------

$ManifestSources =
    New-Object System.Collections.Generic.List[object]

$SuccessCount = 0
$FailureCount = 0


foreach ($Source in $Sources) {

    $Destination = Join-Path `
        $RawDir `
        $Source.file

    $TempFile =
        "$Destination.download"


    Write-Host `
        "[$($Source.id)] $($Source.title)" `
        -ForegroundColor White

    Write-Host `
        "  $($Source.url)" `
        -ForegroundColor DarkGray


    if (Test-Path $TempFile) {
        Remove-Item `
            -Force `
            $TempFile
    }


    & curl.exe `
        --fail `
        --location `
        --silent `
        --show-error `
        --retry 2 `
        --connect-timeout 20 `
        --max-time 120 `
        --user-agent "Mozilla/5.0" `
        "$($Source.url)" `
        --output "$TempFile"


    $CurlExit =
        $LASTEXITCODE


    if (
        $CurlExit -ne 0 -or
        -not (
            Test-HtmlSnapshot `
                $TempFile
        )
    ) {

        $FailureCount += 1

        Write-Host `
            "  FAILED" `
            -ForegroundColor Red


        if (Test-Path $TempFile) {
            Remove-Item `
                -Force `
                $TempFile
        }


        $ManifestSources.Add(
            [PSCustomObject]@{
                id = $Source.id
                title = $Source.title
                url = $Source.url
                sourceFile = "raw/$($Source.file)"
                purpose = $Source.purpose
                downloaded = $false
                htmlValidated = $false
                bytes = 0
            }
        )

        continue
    }


    Move-Item `
        -Force `
        $TempFile `
        $Destination


    $Info =
        Get-Item `
            $Destination


    $SuccessCount += 1


    Write-Host `
        "  saved ($($Info.Length) bytes)" `
        -ForegroundColor Green


    $ManifestSources.Add(
        [PSCustomObject]@{
            id = $Source.id
            title = $Source.title
            url = $Source.url
            sourceFile = "raw/$($Source.file)"
            purpose = $Source.purpose
            downloaded = $true
            htmlValidated = $true
            bytes = $Info.Length
        }
    )
}


# ------------------------------------------------------------
# Manifest
# ------------------------------------------------------------

$Manifest = [ordered]@{
    schemaVersion = 1

    operatorId = "reavaya"

    authority = "Rea Vaya / City of Johannesburg"

    retrievedAt =
        (Get-Date).ToUniversalTime().ToString("o")

    sourceCount =
        $Sources.Count

    validatedSourceCount =
        $SuccessCount

    failedSourceCount =
        $FailureCount

    sources =
        $ManifestSources

    notes = @(
        "These are raw official web snapshots.",
        "No route topology, stop coordinates or timetable values are inferred by this sync.",
        "Current fares must be normalized from the fare page effective for the relevant operating year.",
        "Phase descriptions and current operating status must be kept separate because older phase pages may contain historic planning language."
    )
}


$Manifest |
    ConvertTo-Json `
        -Depth 8 |
    Set-Content `
        -Path $ManifestFile `
        -Encoding UTF8


# ------------------------------------------------------------
# Finish
# ------------------------------------------------------------

Write-Host ""
Write-Host "================================================" `
    -ForegroundColor Green

Write-Host " Rea Vaya source sync complete" `
    -ForegroundColor Green

Write-Host "================================================" `
    -ForegroundColor Green

Write-Host ""

Write-Host `
    "Sources attempted : $($Sources.Count)"

Write-Host `
    "Validated        : $SuccessCount"

Write-Host `
    "Failed           : $FailureCount"

Write-Host ""

Write-Host "Manifest:"
Write-Host `
    $ManifestFile `
    -ForegroundColor Cyan

Write-Host ""

Write-Host `
    "Important: only official source snapshots were captured. No stops, geometry or ETA were inferred." `
    -ForegroundColor Yellow

Write-Host ""