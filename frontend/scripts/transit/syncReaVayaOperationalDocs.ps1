$ErrorActionPreference = "Stop"

# ============================================================
# Pulse Transit - Rea Vaya Operational Document Sync
#
# Captures:
# - official Phase 1C(a) operating announcement
# - official 2026 Phase 1B service specification
#
# No route/station data is inferred here.
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
    "operational-document-manifest.json"


New-Item `
    -ItemType Directory `
    -Force `
    -Path $RawDir |
    Out-Null


function Test-Pdf {
    param(
        [string]$Path
    )

    if (-not (Test-Path $Path)) {
        return $false
    }

    $Info = Get-Item $Path

    if ($Info.Length -lt 10000) {
        return $false
    }

    $Stream = [System.IO.File]::OpenRead(
        $Path
    )

    try {

        $Header =
            New-Object byte[] 5

        $Read =
            $Stream.Read(
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


$Documents = @(
    [PSCustomObject]@{
        id =
            "phase-1c-a-operating-announcement"

        title =
            "Rea Vaya Phase 1C(a) Services Start Operating"

        url =
            "https://joburg.org.za/media_/Documents/2025-Media-Statements/Rea-Vaya-Phase1ca-services-start-operating-on-1-december-2025.pdf"

        file =
            "phase-1c-a-operating-2025-12-01.pdf"

        purpose =
            "current operational evidence for Phase 1C(a)"
    },

    [PSCustomObject]@{
        id =
            "phase-1b-2026-service-specification"

        title =
            "Rea Vaya Phase 1B Service Specification 2026"

        url =
            "https://joburg.org.za/work_/Documents/2026-Tenders/Reavaya1B%28b%29-TOR-Final-19-March-2026-Signed-25-March-2026.pdf"

        file =
            "phase-1b-service-specification-2026.pdf"

        purpose =
            "official route descriptions, distances, services, fares, timetables and stop information"
    }
)


Write-Host ""
Write-Host "================================================" `
    -ForegroundColor DarkCyan

Write-Host " Pulse Transit - Rea Vaya Operational Docs Sync" `
    -ForegroundColor White

Write-Host "================================================" `
    -ForegroundColor DarkCyan

Write-Host ""


$ManifestDocs =
    New-Object System.Collections.Generic.List[object]

$SuccessCount = 0
$FailureCount = 0


foreach ($Document in $Documents) {

    $Destination =
        Join-Path `
            $RawDir `
            $Document.file

    $Temp =
        "$Destination.download"


    Write-Host `
        "[$($Document.id)]" `
        -ForegroundColor White

    Write-Host `
        "  $($Document.title)"

    Write-Host `
        "  $($Document.url)" `
        -ForegroundColor DarkGray


    if (Test-Path $Temp) {
        Remove-Item `
            -Force `
            $Temp
    }


    # Reuse an already validated copy
    if (
        Test-Pdf `
            $Destination
    ) {

        $Info =
            Get-Item `
                $Destination

        $SuccessCount += 1

        Write-Host `
            "  existing PDF valid ($($Info.Length) bytes)" `
            -ForegroundColor DarkGreen


        $ManifestDocs.Add(
            [PSCustomObject]@{
                id =
                    $Document.id

                title =
                    $Document.title

                sourceUrl =
                    $Document.url

                sourceFile =
                    "raw/$($Document.file)"

                purpose =
                    $Document.purpose

                downloaded =
                    $true

                pdfValidated =
                    $true

                bytes =
                    $Info.Length
            }
        )

        continue
    }


    if (Test-Path $Destination) {
        Remove-Item `
            -Force `
            $Destination
    }


    & curl.exe `
        --fail `
        --location `
        --silent `
        --show-error `
        --retry 2 `
        --connect-timeout 20 `
        --max-time 300 `
        --user-agent "Mozilla/5.0" `
        "$($Document.url)" `
        --output "$Temp"


    if (
        $LASTEXITCODE -ne 0 -or
        -not (Test-Pdf $Temp)
    ) {

        $FailureCount += 1

        Write-Host `
            "  FAILED" `
            -ForegroundColor Red


        if (Test-Path $Temp) {
            Remove-Item `
                -Force `
                $Temp
        }


        $ManifestDocs.Add(
            [PSCustomObject]@{
                id =
                    $Document.id

                title =
                    $Document.title

                sourceUrl =
                    $Document.url

                sourceFile =
                    "raw/$($Document.file)"

                purpose =
                    $Document.purpose

                downloaded =
                    $false

                pdfValidated =
                    $false

                bytes =
                    0
            }
        )

        continue
    }


    Move-Item `
        -Force `
        $Temp `
        $Destination


    $Info =
        Get-Item `
            $Destination


    $SuccessCount += 1


    Write-Host `
        "  saved ($($Info.Length) bytes)" `
        -ForegroundColor Green


    $ManifestDocs.Add(
        [PSCustomObject]@{
            id =
                $Document.id

            title =
                $Document.title

            sourceUrl =
                $Document.url

            sourceFile =
                "raw/$($Document.file)"

            purpose =
                $Document.purpose

            downloaded =
                $true

            pdfValidated =
                $true

            bytes =
                $Info.Length
        }
    )
}


$Manifest = [ordered]@{

    schemaVersion =
        1

    operatorId =
        "reavaya"

    authority =
        "City of Johannesburg"

    retrievedAt =
        (Get-Date).ToUniversalTime().ToString("o")

    documentCount =
        $Documents.Count

    validatedDocumentCount =
        $SuccessCount

    failedDocumentCount =
        $FailureCount

    documents =
        $ManifestDocs

    notes = @(
        "Phase 1C(a) operating evidence is kept separate from older construction/planning pages.",
        "The Phase 1B service specification is preserved as an official operational source.",
        "No route geometry, stop coordinates, timetable or ETA is inferred during this sync."
    )
}


$Manifest |
    ConvertTo-Json `
        -Depth 8 |
    Set-Content `
        -Path $ManifestFile `
        -Encoding UTF8


Write-Host ""
Write-Host "================================================" `
    -ForegroundColor Green

Write-Host " Rea Vaya operational document sync complete" `
    -ForegroundColor Green

Write-Host "================================================" `
    -ForegroundColor Green

Write-Host ""

Write-Host `
    "Documents attempted : $($Documents.Count)"

Write-Host `
    "Validated           : $SuccessCount"

Write-Host `
    "Failed              : $FailureCount"

Write-Host ""

Write-Host "Manifest:"
Write-Host `
    $ManifestFile `
    -ForegroundColor Cyan

Write-Host ""

Write-Host `
    "Important: documents captured only; no stops, route geometry or timetable data were inferred." `
    -ForegroundColor Yellow

Write-Host ""