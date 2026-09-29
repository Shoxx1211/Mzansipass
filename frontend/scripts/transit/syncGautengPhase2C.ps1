# Phase 2C. Secure, read-only municipal GIS download. ASCII-only for Windows PowerShell 5.1.
param([switch]$SkipGms)
$ErrorActionPreference='Stop'
$frontend = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $frontend
$utf8=New-Object System.Text.UTF8Encoding($false)
$joburg='https://ags.joburg.org.za/server/rest/services/Transportation/MapServer'
$gms='https://gis.ekurhuleni.gov.za/arcgis/rest/services/GMS/GMS/MapServer'
$root='src/data/transit/gauteng'
$specs=New-Object 'System.Collections.Generic.List[object]'
$specs.Add(@{name='joburg-prasa-railway-lines';authority='City of Johannesburg';url="$joburg/27";layerId=27;geometry='esriGeometryPolyline';required=$true;dest="$root/metrorail/gis-raw";expect='(?i)PRASA.*(railway|rail)|railway.*line'})
if(-not $SkipGms){
  for($n=1;$n -le 7;$n++){
    $routeId=112+2*$n
    $stopId=$routeId+1
    $specs.Add(@{name="gms-route-$n";authority='City of Ekurhuleni';url="$gms/$routeId";layerId=$routeId;geometry='esriGeometryPolyline';required=$false;dest="$root/harambee/gis-raw";expect=('(?i)^Route[_ ]?' + $n + '(?:_| |$)')})
    $specs.Add(@{name="gms-route-$n-stops";authority='City of Ekurhuleni';url="$gms/$stopId";layerId=$stopId;geometry='esriGeometryPoint';required=$false;dest="$root/harambee/gis-raw";expect=('(?i)^Route[_ ]?' + $n + '.*Stops')})
  }
}
function Post-ArcGis([string]$url,[hashtable]$body){
  $reply=Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType 'application/x-www-form-urlencoded' -TimeoutSec 120
  if($null -ne $reply.error){throw "ArcGIS: $($reply.error.message)"}
  return $reply
}
function Save-Json([string]$filename,$value){
  $text=ConvertTo-Json -InputObject $value -Depth 90 -Compress
  $full=$ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($filename)
  $tmp="$full.tmp"
  [System.IO.File]::WriteAllText($tmp,$text,$utf8)
  Move-Item -LiteralPath $tmp -Destination $full -Force
}
$report=New-Object 'System.Collections.Generic.List[object]'
foreach($spec in $specs){
  $name=$spec.name
  Write-Host "`nInspecting $name" -ForegroundColor Cyan
  try{
    $meta=Invoke-RestMethod -Uri "$($spec.url)?f=pjson" -TimeoutSec 90
    if($null -ne $meta.error){throw "ArcGIS metadata: $($meta.error.message)"}
    if($meta.name -notmatch $spec.expect){throw "Unexpected layer name: $($meta.name)"}
    if($meta.geometryType -ne $spec.geometry){throw "Unexpected geometry: $($meta.geometryType)"}
    $oids=@($meta.fields|Where-Object {$_.type -eq 'esriFieldTypeOID'}|Select-Object -ExpandProperty name)
    if($oids.Count -ne 1){throw 'Missing or ambiguous Object ID field'}
    $query="$($spec.url)/query"
    $count=Post-ArcGis $query @{where='1=1';returnCountOnly='true';f='json'}
    $idDoc=Post-ArcGis $query @{where='1=1';returnIdsOnly='true';f='json'}
    $ids=@($idDoc.objectIds|Sort-Object -Unique)
    if($ids.Count -ne [int]$count.count){throw "Feature ID/count mismatch $($ids.Count) vs $($count.count)"}
    $features=New-Object 'System.Collections.Generic.List[object]'
    for($offset=0;$offset -lt $ids.Count;$offset+=200){
      $end=[Math]::Min($offset+199,$ids.Count-1)
      $batch=@($ids[$offset..$end])
      $out=Post-ArcGis $query @{objectIds=($batch -join ',');outFields='*';returnGeometry='true';outSR='4326';f='json'}
      $rows=@($out.features|Where-Object {$null -ne $_})
      if($out.exceededTransferLimit -eq $true -or $rows.Count -ne $batch.Count){throw "Incomplete feature batch at $offset"}
      foreach($row in $rows){$features.Add($row)}
      Write-Host "  $($features.Count) / $($ids.Count) features"
    }
    New-Item -ItemType Directory -Path $spec.dest -Force|Out-Null
    $snapshot=[ordered]@{
      source=[ordered]@{authority=$spec.authority;url=$spec.url;layerId=$spec.layerId;layerName=$meta.name;
        retrievedAt=(Get-Date).ToUniversalTime().ToString('o');copyright=$meta.copyrightText;rightsStatus='review-required';operatingStatus='unverified'};
      geometryType=$meta.geometryType;spatialReference=[ordered]@{wkid=4326;requestedFromArcGIS=$true};
      objectIdField=$oids[0];featureCount=$features.Count;features=@($features.ToArray())
    }
    $file=Join-Path $spec.dest "$name-wgs84.json"
    Save-Json $file $snapshot
    $report.Add([pscustomobject]@{name=$name;status='downloaded';layerName=$meta.name;count=$features.Count;required=$spec.required;file=$file})
    Write-Host "Saved $($features.Count) $name features" -ForegroundColor Green
  }catch{
    if($spec.required){throw "Required $name download failed: $($_.Exception.Message)"}
    Write-Warning "Optional $name skipped: $($_.Exception.Message)"
    $report.Add([pscustomobject]@{name=$name;status='unavailable';count=0;reason=$_.Exception.Message;required=$false})
  }
}
New-Item -ItemType Directory -Path "$root/unified-dev/reports" -Force|Out-Null
Save-Json "$root/unified-dev/reports/phase2c-sync.json" ([ordered]@{
  generatedAt=(Get-Date).ToUniversalTime().ToString('o');
  note='GIS only. GMS route-number layer pairing does NOT establish current Harambee operating patterns.';
  passengerRoutingEnabled=$false;layers=@($report.ToArray())
})
Write-Host "`nPHASE 2C SECURE GIS SYNC COMPLETE" -ForegroundColor Green
$report | Format-Table name,status,count -AutoSize
