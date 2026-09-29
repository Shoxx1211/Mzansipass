$ErrorActionPreference = "Stop"

# ============================================================
# Pulse Transit - Johannesburg GIS Discovery
#
# Purpose:
# - capture current City of Johannesburg GIS landing pages
# - discover public map / ArcGIS / viewer links
# - DO NOT assume or invent an ArcGIS REST endpoint
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

$Pages = @(
    [PSCustomObject]@{
        name = "online-maps"
        url  = "https://eservices.joburg.org.za/onlinemaps"
        file = "online-maps.html"
    },

    [PSCustomObject]@{
        name = "cgis-home"
        url  = "https://eservices.joburg.org.za/sites/cgismaps/Pages/default.aspx"
        file = "cgis-home.html"
    }
)

Write-Host ""
Write-Host "================================================" -ForegroundColor DarkCyan
Write-Host " Pulse Transit - Johannesburg GIS Discovery" -ForegroundColor White
Write-Host "================================================" -ForegroundColor DarkCyan
Write-Host ""

foreach ($Page in $Pages) {

    $Destination = Join-Path $Root $Page.file

    Write-Host "[$($Page.name)]"
    Write-Host "  $($Page.url)" -ForegroundColor DarkGray

    & curl.exe `
        --fail `
        --location `
        --silent `
        --show-error `
        --retry 2 `
        --connect-timeout 20 `
        --max-time 120 `
        --user-agent "Mozilla/5.0" `
        "$($Page.url)" `
        --output "$Destination"

    if ($LASTEXITCODE -ne 0) {
        Write-Host "  FAILED" -ForegroundColor Red
        continue
    }

    $Info = Get-Item $Destination

    Write-Host `
        "  saved ($($Info.Length) bytes)" `
        -ForegroundColor Green
}

Write-Host ""
Write-Host "Scanning downloaded pages..."
Write-Host ""

$FoundLinks = New-Object System.Collections.Generic.List[string]

Get-ChildItem `
    -Path $Root `
    -Filter "*.html" |
ForEach-Object {

    $Html = Get-Content `
        $_.FullName `
        -Raw

    # --------------------------------------------------------
    # href / src links
    # --------------------------------------------------------

    $AttributeMatches = [regex]::Matches(
        $Html,
        '(?i)(?:href|src)\s*=\s*["''](?<url>[^"'']+)["'']'
    )

    foreach ($Match in $AttributeMatches) {

        $Value =
            [System.Net.WebUtility]::HtmlDecode(
                $Match.Groups["url"].Value
            )

        if (
            -not [string]::IsNullOrWhiteSpace($Value)
        ) {
            $FoundLinks.Add(
                $Value.Trim()
            )
        }
    }

    # --------------------------------------------------------
    # Plain absolute URLs embedded in scripts/config
    # --------------------------------------------------------

    $UrlMatches = [regex]::Matches(
        $Html,
        'https?://[^"''<>\s]+'
    )

    foreach ($Match in $UrlMatches) {

        $Value =
            [System.Net.WebUtility]::HtmlDecode(
                $Match.Value
            )

        if (
            -not [string]::IsNullOrWhiteSpace($Value)
        ) {
            $FoundLinks.Add(
                $Value.Trim()
            )
        }
    }
}

$UniqueLinks = @(
    $FoundLinks |
    Sort-Object -Unique
)

$AllLinksFile = Join-Path `
    $Root `
    "all-discovered-links.txt"

$InterestingLinksFile = Join-Path `
    $Root `
    "interesting-gis-links.txt"

$UniqueLinks |
    Set-Content `
        -Path $AllLinksFile `
        -Encoding UTF8

$Interesting = @(
    $UniqueLinks |
    Where-Object {
        $_ -match '(?i)arcgis|rest/services|mapserver|featureserver|map.?viewer|onlinemap|transport|brt|rea.?vaya|gis'
    }
)

$Interesting |
    Set-Content `
        -Path $InterestingLinksFile `
        -Encoding UTF8

Write-Host "Interesting GIS / map links:"
Write-Host ""

if ($Interesting.Count -eq 0) {

    Write-Host `
        "  No obvious ArcGIS/map links found directly in the HTML." `
        -ForegroundColor Yellow

}
else {

    foreach ($Link in $Interesting) {
        Write-Host "  $Link"
    }
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host " GIS discovery complete" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

Write-Host "All links:"
Write-Host $AllLinksFile -ForegroundColor Cyan

Write-Host ""
Write-Host "Interesting links:"
Write-Host $InterestingLinksFile -ForegroundColor Cyan

Write-Host ""
Write-Host `
    "Important: no GIS service URL has been assumed. This step only discovers what the current City pages expose." `
    -ForegroundColor Yellow

Write-Host ""