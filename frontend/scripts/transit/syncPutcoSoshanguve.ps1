$ErrorActionPreference = "Stop"

# ============================================================
# Pulse Transit - PUTCO Soshanguve Source Sync
#
# Downloads official PUTCO source documents.
# No data is inferred in this script.
# ============================================================

$OutputDir = Join-Path `
    $PSScriptRoot `
    "..\..\src\data\transit\gauteng\putco\raw"

$OutputDir = [System.IO.Path]::GetFullPath($OutputDir)

New-Item `
    -ItemType Directory `
    -Force `
    -Path $OutputDir |
    Out-Null


$Sources = @(
    @{
        Name = "Soshanguve zone guide"
        Url = "https://putco.co.za/wp-content/uploads/2026/02/SOSH.pdf"
        File = "soshanguve-zone-guide-2026-02.pdf"
    },

    @{
        Name = "Soshanguve / Ekangala 2026 fare notice"
        Url = "https://putco.co.za/wp-content/uploads/2026/05/2026-Final-Soshanguve-Ekangala-Passenger-Notice-Fare-Increase.docx-2-1.pdf"
        File = "soshanguve-ekangala-fares-2026-06.pdf"
    },

    @{
        Name = "Soshanguve correct SmartTap codes"
        Url = "https://putco.co.za/passenger-notice-soshanguve-correct-codes/"
        File = "soshanguve-correct-codes.html"
    },

    @{
        Name = "Soshanguve transfer-point notice"
        Url = "https://putco.co.za/passenger-notice-soshanguve-emergency-tickets/"
        File = "soshanguve-transfer-points.html"
    }
)


function Download-PutcoSource {
    param (
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [string]$Url,

        [Parameter(Mandatory = $true)]
        [string]$FileName
    )

    $OutputFile = Join-Path `
        $OutputDir `
        $FileName

    Write-Host ""
    Write-Host "Fetching $Name..." -ForegroundColor Cyan

    if (Test-Path $OutputFile) {
        Remove-Item `
            -Force `
            $OutputFile
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
        --output "$OutputFile"

    if ($LASTEXITCODE -ne 0) {
        throw "Download failed for $Name. curl exit code: $LASTEXITCODE"
    }

    if (-not (Test-Path $OutputFile)) {
        throw "No file was created for $Name."
    }

    $Size = (Get-Item $OutputFile).Length

    if ($Size -le 0) {
        Remove-Item $OutputFile -Force
        throw "$Name produced an empty file."
    }

    Write-Host `
        "Saved $Name" `
        -ForegroundColor Green

    Write-Host `
        "  $FileName ($Size bytes)" `
        -ForegroundColor DarkGray
}


try {

    Write-Host ""
    Write-Host "==============================================" `
        -ForegroundColor DarkCyan

    Write-Host " Pulse Transit - PUTCO Soshanguve Source Sync" `
        -ForegroundColor White

    Write-Host "==============================================" `
        -ForegroundColor DarkCyan


    foreach ($Source in $Sources) {
        Download-PutcoSource `
            -Name $Source.Name `
            -Url $Source.Url `
            -FileName $Source.File
    }


    Write-Host ""
    Write-Host "==============================================" `
        -ForegroundColor Green

    Write-Host " PUTCO Soshanguve source sync complete" `
        -ForegroundColor Green

    Write-Host "==============================================" `
        -ForegroundColor Green

    Write-Host ""
    Write-Host "Files:" -ForegroundColor Cyan

    Get-ChildItem $OutputDir |
        Select-Object Name, Length |
        Format-Table -AutoSize
}
catch {

    Write-Host ""
    Write-Host "PUTCO source sync failed:" `
        -ForegroundColor Red

    Write-Host $_.Exception.Message `
        -ForegroundColor Red

    exit 1
}