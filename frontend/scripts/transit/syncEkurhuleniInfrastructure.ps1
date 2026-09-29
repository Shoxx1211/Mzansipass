# Pulse Phase 2A. Secure, read-only downloads from municipal ArcGIS.
# No disabled certificate checks. No public browser integration.
param([switch]$SkipJohannesburg)
$ErrorActionPreference = 'Stop'
$frontend = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $frontend
$base = 'https://gis.ekurhuleni.gov.za/arcgis/rest/services/Ekurhuleni/Ekurhuleni_Transportation_Map_v1/MapServer'
$joburg = 'https://ags.joburg.org.za/server/rest/services/Transportation/MapServer'
$root = Join-Path $frontend 'src/data/transit/gauteng/ekurhuleni-bus/gis-raw'
New-Item -ItemType Directory -Path $root -Force | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding($false)
$layers = @(
  @{ name='ekurhuleni-irptn-routes'; url="$base/2"; id=2; geometry='esriGeometryPolyline'; required=$true; authority='City of Ekurhuleni' },
  @{ name='ekurhuleni-railway-stations'; url="$base/13"; id=13; geometry='esriGeometryPoint'; required=$true; authority='City of Ekurhuleni' },
  @{ name='ekurhuleni-railway-lines'; url="$base/14"; id=14; geometry='esriGeometryPolyline'; required=$true; authority='City of Ekurhuleni' }
)
if (-not $SkipJohannesburg) {
  $layers += @{ name='joburg-prasa-stations'; url="$joburg/26"; id=26; geometry='esriGeometryPoint'; required=$false; authority='City of Johannesburg' }
}
function Query([string]$url, [hashtable]$fields) {
  $r = Invoke-RestMethod -Uri $url -Method Post -Body $fields -ContentType 'application/x-www-form-urlencoded' -TimeoutSec 120
  if ($r.error) { throw "ArcGIS query error: $($r.error.message)" }
  return $r
}
function Write-Json([string]$file, $value) {
  $temp = "$file.tmp"
  $json = ConvertTo-Json -InputObject $value -Depth 75 -Compress
  [System.IO.File]::WriteAllText($temp, $json, $utf8)
  Move-Item -LiteralPath $temp -Destination $file -Force
}
$summary = @()
foreach ($l in $layers) {
  Write-Host "`nFetching $($l.name)..." -ForegroundColor Cyan
  try {
    $metadata = Invoke-RestMethod -Uri "$($l.url)?f=pjson" -TimeoutSec 75
    if ($metadata.error) { throw $metadata.error.message }
    if ($metadata.geometryType -ne $l.geometry) { throw "Unexpected geometry type: $($metadata.geometryType)" }
    $oid = @($metadata.fields | Where-Object { $_.type -eq 'esriFieldTypeOID' } | Select-Object -First 1 -ExpandProperty name)
    if ($oid.Count -ne 1) { throw 'Object ID field missing or ambiguous' }
    $queryUrl = "$($l.url)/query"
    $count = Query $queryUrl @{where='1=1';returnCountOnly='true';f='json'}
    $idResponse = Query $queryUrl @{where='1=1';returnIdsOnly='true';f='json'}
    $ids = @($idResponse.objectIds | Sort-Object -Unique)
    if ($ids.Count -ne [int]$count.count) { throw "Count/ID mismatch: $($count.count) versus $($ids.Count)" }
    $features = New-Object 'System.Collections.Generic.List[object]'
    for ($offset=0; $offset -lt $ids.Count; $offset += 200) {
      $end = [Math]::Min($offset+199,$ids.Count-1)
      $chunk = @($ids[$offset..$end])
      $reply = Query $queryUrl @{objectIds=($chunk -join ',');outFields='*';returnGeometry='true';outSR='4326';f='json'}
      $batch = @($reply.features | Where-Object { $null -ne $_ })
      if ($batch.Count -ne $chunk.Count -or $reply.exceededTransferLimit -eq $true) {
        throw "Incomplete batch $offset : expected $($chunk.Count), got $($batch.Count)"
      }
      foreach ($feature in $batch) { $features.Add($feature) }
      Write-Host "  $($features.Count) / $($ids.Count) features"
    }
    $file = Join-Path $root "$($l.name)-wgs84.json"
    $snapshot = [ordered]@{
      source=[ordered]@{authority=$l.authority; url=$l.url; layerId=$l.id; retrievedAt=(Get-Date).ToUniversalTime().ToString('o'); copyright=$metadata.copyrightText; rightsStatus='review-required'; operationalStatus='unverified'}
      geometryType=$metadata.geometryType; spatialReference=[ordered]@{wkid=4326;requestedFromArcGIS=$true}
      objectIdField=$oid[0]; fields=@($metadata.fields); featureCount=$features.Count; features=@($features.ToArray())
    }
    if ($features.Count -ne $ids.Count) { throw 'Incomplete download: nothing saved' }
    Write-Json $file $snapshot
    $summary += [pscustomobject]@{name=$l.name;status='downloaded';featureCount=$features.Count;file=$file;required=$l.required}
    Write-Host "Saved $($features.Count) features." -ForegroundColor Green
  } catch {
    if ($l.required) { throw "Required layer $($l.name) failed: $($_.Exception.Message)" }
    $summary += [pscustomobject]@{name=$l.name;status='unavailable';featureCount=0;reason=$_.Exception.Message;required=$false}
    Write-Warning "Optional Johannesburg PRASA layer skipped: $($_.Exception.Message)"
  }
}
Write-Json (Join-Path $root 'sync-report.json') ([ordered]@{
  generatedAt=(Get-Date).ToUniversalTime().ToString('o');
  note='IRPTN corridor does NOT prove current Harambee service. Railway lines do NOT prove operating PRASA services.';
  passengerRoutingEnabled=$false; layers=@($summary)
})
Write-Host '`nPHASE 2A GIS SYNC COMPLETE. Passenger routing unchanged.' -ForegroundColor Green
$summary | Format-Table name,status,featureCount -AutoSize
