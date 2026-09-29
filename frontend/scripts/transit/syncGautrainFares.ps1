$ErrorActionPreference = "Stop"

# ============================================================
# Pulse Transit - Gautrain Current Fare PDF Sync
#
# Reads the official fares.html snapshot and selects the
# exact href whose URL contains:
#
#   Fares+Effective+01+September+2026.pdf
#
# No broad cross-element anchor matching is used.
# ============================================================

$Root = Join-Path `
    $PSScriptRoot `
    "..\..\src\data\transit\gauteng\gautrain"

$Root = [System.IO.Path]::GetFullPath($Root)

$RawDir = Join-Path $Root "raw"

$FarePage = Join-Path `
    $RawDir `
    "fares.html"

$Output = Join-Path `
    $RawDir `
    "fares-effective-2026-09-01.pdf"

$TempOutput = Join-Path `
    $RawDir `
    "fares-effective-2026-09-01.download"


Write-Host ""
Write-Host "==============================================" `
    -ForegroundColor DarkCyan

Write-Host " Pulse Transit - Gautrain Fare PDF Sync" `
    -ForegroundColor White

Write-Host "==============================================" `
    -ForegroundColor DarkCyan

Write-Host ""


# ------------------------------------------------------------
# Validate source HTML
# ------------------------------------------------------------

if (-not (Test-Path $FarePage)) {
    throw "Missing official fares snapshot: $FarePage"
}

$Html = Get-Content `
    $FarePage `
    -Raw

if ([string]::IsNullOrWhiteSpace($Html)) {
    throw "fares.html is empty"
}


# ------------------------------------------------------------
# Extract every href independently
# ------------------------------------------------------------

$HrefMatches = [regex]::Matches(
    $Html,
    'href\s*=\s*["''](?<href>[^"'']+)["'']',
    [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
)

$Links = @(
    $HrefMatches |
    ForEach-Object {
        [System.Net.WebUtility]::HtmlDecode(
            $_.Groups["href"].Value
        ).Trim()
    } |
    Where-Object {
        -not [string]::IsNullOrWhiteSpace($_)
    } |
    Sort-Object -Unique
)


# ------------------------------------------------------------
# Select the exact September 2026 fare document
# ------------------------------------------------------------

$FareUrl = $Links |
    Where-Object {
        $_ -match 'Fares(?:\+|%20)Effective(?:\+|%20)01(?:\+|%20)September(?:\+|%20)2026\.pdf'
    } |
    Select-Object -First 1


if (-not $FareUrl) {

    Write-Host `
        "Exact September 2026 fare PDF not found." `
        -ForegroundColor Red

    Write-Host ""
    Write-Host "Fare-related links found:" `
        -ForegroundColor Yellow

    $Links |
        Where-Object {
            $_ -match 'fare|pdf|bombela|september'
        } |
        ForEach-Object {
            Write-Host "  $_"
        }

    throw "Current Gautrain fare PDF URL could not be resolved."
}


# ------------------------------------------------------------
# Convert relative URL if Gautrain changes its implementation
# ------------------------------------------------------------

if ($FareUrl -notmatch '^https?://') {

    $BaseUri = [Uri]::new(
        "https://www.gautrain.co.za/commuter/farecalc"
    )

    $FareUri = [Uri]::new(
        $BaseUri,
        $FareUrl
    )

    $FareUrl = $FareUri.AbsoluteUri
}


Write-Host "Official fare document:"
Write-Host $FareUrl `
    -ForegroundColor Cyan

Write-Host ""


# ------------------------------------------------------------
# Remove stale/failed files
# ------------------------------------------------------------

if (Test-Path $TempOutput) {
    Remove-Item `
        -Force `
        $TempOutput
}

if (Test-Path $Output) {
    Remove-Item `
        -Force `
        $Output
}


# ------------------------------------------------------------
# Download exact official URL
# ------------------------------------------------------------

Write-Host "Downloading current Gautrain fare PDF..."

& curl.exe `
    --fail `
    --location `
    --silent `
    --show-error `
    --retry 2 `
    --connect-timeout 20 `
    --max-time 180 `
    --user-agent "Mozilla/5.0" `
    "$FareUrl" `
    --output "$TempOutput"

if ($LASTEXITCODE -ne 0) {

    if (Test-Path $TempOutput) {
        Remove-Item `
            -Force `
            $TempOutput
    }

    Write-Host ""
    Write-Host `
        "The URL was found correctly, but the remote document could not be downloaded." `
        -ForegroundColor Yellow

    Write-Host ""
    Write-Host "URL:"
    Write-Host $FareUrl

    throw "Official Gautrain fare document download failed. curl exit code: $LASTEXITCODE"
}


# ------------------------------------------------------------
# Basic file validation
# ------------------------------------------------------------

if (-not (Test-Path $TempOutput)) {
    throw "No file was created."
}

$Item = Get-Item $TempOutput

if ($Item.Length -lt 10000) {

    Remove-Item `
        -Force `
        $TempOutput

    throw "Downloaded document is suspiciously small: $($Item.Length) bytes"
}


# ------------------------------------------------------------
# Validate PDF signature
# ------------------------------------------------------------

$Stream = [System.IO.File]::OpenRead(
    $TempOutput
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

    Remove-Item `
        -Force `
        $TempOutput

    throw "Could not read PDF header."
}


$Signature = [System.Text.Encoding]::ASCII.GetString(
    $Header
)

if ($Signature -ne "%PDF-") {

    Write-Host ""
    Write-Host `
        "Downloaded content is not a PDF." `
        -ForegroundColor Red

    Write-Host `
        "Signature: $Signature" `
        -ForegroundColor Yellow

    Remove-Item `
        -Force `
        $TempOutput

    throw "Official URL returned non-PDF content."
}


# ------------------------------------------------------------
# Promote validated file
# ------------------------------------------------------------

Move-Item `
    -Force `
    $TempOutput `
    $Output

$FinalItem = Get-Item $Output


Write-Host ""
Write-Host "==============================================" `
    -ForegroundColor Green

Write-Host " Gautrain fare PDF sync complete" `
    -ForegroundColor Green

Write-Host "==============================================" `
    -ForegroundColor Green

Write-Host ""

Write-Host "Validated PDF:"
Write-Host $Output `
    -ForegroundColor Cyan

Write-Host ""

Write-Host "Size: $($FinalItem.Length) bytes"

Write-Host ""

Write-Host "PDF signature: %PDF-" `
    -ForegroundColor Green

Write-Host ""

Write-Host "Important:" `
    -ForegroundColor Yellow

Write-Host `
    "The source document has only been downloaded and validated. Fare values have not yet been parsed."