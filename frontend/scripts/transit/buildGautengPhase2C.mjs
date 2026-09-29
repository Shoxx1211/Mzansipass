import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {normalizeSnapshot,buildNamedGisRoutePairs,buildCrossCityRailEvidence} from './gautengPhase2CCore.mjs';
import {greatCircleMetres,lineDistanceMetres} from './ekurhuleniInfrastructureCore.mjs';
const root=path.join(process.cwd(),'src/data/transit/gauteng');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const file=(...pieces)=>path.join(root,...pieces);
const required=p=>{if(!fs.existsSync(p))throw Error(`Missing ${p}`);return read(p);};
const eku=required(file('ekurhuleni-bus','gis-normalized','infrastructure.json'));
const runtimeFile=file('unified-dev','runtime.json');
const runtime=required(runtimeFile);
if(runtime.internalOnly!==true||runtime.passengerRoutingEnabled!==false||!runtime.phase2b)
  throw Error('Phase 2B private runtime missing. Rerun its installer.');
const joburg=normalizeSnapshot(required(file('metrorail','gis-raw','joburg-prasa-railway-lines-wgs84.json')),
  {authority:'City of Johannesburg',layerId:27,type:'esriGeometryPolyline',sourceName:'joburg-prasa-track'});
if(!joburg.items.length)throw Error('No valid Johannesburg PRASA railway geometry: stop before building Phase 2C');
const groupSpecs=Array.from({length:7},(_,i)=>({number:i+1,routeLayerId:114+2*i,stopLayerId:115+2*i}));
const optionalReports=[];
const groups=[];
for(const spec of groupSpecs){
  const routeFile=file('harambee','gis-raw',`gms-route-${spec.number}-wgs84.json`);
  const stopFile=file('harambee','gis-raw',`gms-route-${spec.number}-stops-wgs84.json`);
  const hasRoute=fs.existsSync(routeFile),hasStop=fs.existsSync(stopFile);
  const routes=hasRoute?normalizeSnapshot(read(routeFile),{authority:'City of Ekurhuleni',
    layerId:spec.routeLayerId,type:'esriGeometryPolyline',sourceName:`gms-route-${spec.number}`}):null;
  const stops=hasStop?normalizeSnapshot(read(stopFile),{authority:'City of Ekurhuleni',
    layerId:spec.stopLayerId,type:'esriGeometryPoint',sourceName:`gms-route-${spec.number}-stops`}):null;
  optionalReports.push({group:spec.number,routeMetadataAvailable:hasRoute,stopMetadataAvailable:hasStop,
    routeReport:routes?.report??null,stopReport:stops?.report??null,
    sourcePairComplete:hasRoute&&hasStop});
  groups.push({...spec,routeAvailable:hasRoute,stopAvailable:hasStop,
    routes:routes?.items??[],stops:stops?.items??[]});
}
const routePairs=buildNamedGisRoutePairs(groups);
const rail=buildCrossCityRailEvidence(eku,joburg.items);
const destinationNear=(p,stationList)=>stationList.map(s=>({name:s.label,sourceId:s.id,
  distanceMetres:Math.round(greatCircleMetres(p,s.geometry))})).sort((a,b)=>a.distanceMetres-b.distanceMetres).slice(0,3);
const sampleTests=[];
if(eku.railwayStations.length){
  const p=eku.railwayStations[0].geometry;
  sampleTests.push({scenario:'Ekurhuleni published GIS railway station point',municipality:'Ekurhuleni',
    observedNearest:destinationNear(p,eku.railwayStations),passengerEdges:0});
}
if(eku.joburgPrasaStations.length){
  const p=eku.joburgPrasaStations[0].geometry;
  sampleTests.push({scenario:'Johannesburg published GIS PRASA station point',municipality:'Johannesburg',
    observedNearest:destinationNear(p,eku.joburgPrasaStations),passengerEdges:0});
}
for(const g of groups){
  if(!g.routes.length||!g.stops.length)continue;
  const route=g.routes[0],points=route.geometry.coordinates.flat();
  const p=points[0],q=points[Math.max(0,Math.floor(points.length*.75))];
  sampleTests.push({scenario:`GMS route group ${g.number}: two genuine GIS polyline points`,
    nearOriginLineMetres:Math.round(lineDistanceMetres({lat:p[1],lng:p[0]},route.geometry)),
    nearDestinationLineMetres:Math.round(lineDistanceMetres({lat:q[1],lng:q[0]},route.geometry)),
    publishedSameNumberStopLayer:true,operatorService:'unverified',passengerEdges:0});
}
const summary={joburgRailLineShapes:joburg.items.length,
  ekurhuleniRailLineShapes:eku.railwayLines.length,
  ekurhuleniStations:rail.summary.ekurhuleni,
  johannesburgStations:rail.summary.johannesburg,
  pairedGmsRouteStopLayers:routePairs.filter(g=>g.sameNamedSourceLayerPair).length,
  GmsRouteFeatures:groups.reduce((a,g)=>a+g.routes.length,0),
  GmsStopPoints:groups.reduce((a,g)=>a+g.stops.length,0),
  GmsUnpairedGroupCount:routePairs.filter(g=>!g.sameNamedSourceLayerPair).length,
  officialHarambeeOperatorRouteLinksVerified:0,verifiedPrasaStoppingPatterns:0,
  passengerEdges:0,boardingEdges:0,transferEdges:0};
const output={schemaVersion:1,internalOnly:true,sourceRightsCleared:false,
  operatingServicesVerified:false,passengerRoutingEnabled:false,
  generatedAt:new Date().toISOString(),summary,
  metadata:{joburgRail:joburg.report,optionalLayers:optionalReports},
  railEvidence:rail,routeLayerPairs:routePairs,
  // Deliberately retain the geometry and route/stop point arrays ONLY in private ignored files.
  joburgRailLines:joburg.items,
  gmsGroups:groups.map(g=>({...g,operator:'unverified',currentOperation:'unverified'})),
  scenarios:sampleTests,
  note:'This is municipal GIS infrastructure, NOT live PRASA trains or Harambee passenger routes.'};
const dir=file('unified-dev','reports');fs.mkdirSync(dir,{recursive:true});
const outFile=path.join(dir,'phase2c-gis-evidence.json');
const data=JSON.stringify(output);fs.writeFileSync(outFile,data);
const hash=crypto.createHash('sha256').update(data).digest('hex');
const qa={generatedAt:output.generatedAt,summary,sourceSha256:hash,passengerRoutingEnabled:false,
  warnings:['Municipal railway lines do not establish operating train services',
    'GIS GMS Route N/Route N Stops layers are paired by the GIS publisher but NOT mapped to current Harambee operator services',
    'Municipal source redistribution and commercial rights still require review',
    ...(summary.GmsUnpairedGroupCount?['Some optional GMS GIS pairs unavailable or incomplete']:[])],errors:[]};
fs.writeFileSync(path.join(dir,'phase2c-qa.json'),JSON.stringify(qa,null,2)+'\n');
fs.writeFileSync(path.join(dir,'phase2c-location-matrix.json'),JSON.stringify({
  scenarios:sampleTests,zeroPassengerEdges:true,notes:'Only internal geospatial checks; no inferred trip start.'},null,2)+'\n');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cells=(k,v)=>`<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`;
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pulse Phase 2C - internal rail and route GIS QA</title><style>
body{background:#090f23;color:#e8edff;font-family:Inter,system-ui,sans-serif;max-width:1000px;margin:auto;padding:30px}h1{font-size:2rem;letter-spacing:-.03em}h2{margin-top:34px}section{background:#141c36;border:1px solid #37466c;border-radius:18px;padding:22px;margin:18px 0}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:12px;border-bottom:1px solid #33415d}th{color:#aab9e3}.note{color:#f5d586}p{line-height:1.55}.badge{background:#263c60;padding:7px 12px;border-radius:20px;font-size:.8rem}
</style></head><body><p class="badge">DEVELOPER-ONLY GIS • NO PASSENGER TRIPS</p><h1>Phase 2C: municipal rail and numbered bus GIS</h1><p>Gauteng infrastructure coverage. These are not verified PRASA or Harambee operating services.</p><section><h2>Infrastructure counts</h2><table>${Object.entries(summary).map(([k,v])=>cells(k,typeof v==='object'?JSON.stringify(v):v)).join('')}</table></section><section><h2>GIS Route N / Route N Stops layers</h2><table><tr><th>Group</th><th>Route features</th><th>Stop points</th><th>Pair complete</th></tr>${routePairs.map(r=>`<tr><td>${esc(r.group)}</td><td>${r.routeGeometryFeatures}</td><td>${r.stopPointFeatures}</td><td>${r.sameNamedSourceLayerPair?'Yes, GIS only':'Missing source'}</td></tr>`).join('')}</table></section><section><h2>Actual-data scenarios</h2>${sampleTests.map(t=>`<p><b>${esc(t.scenario)}</b>: ${esc(JSON.stringify(t).slice(0,500))}</p>`).join('')}</section><p class="note">Neither near-track station matches nor Route N source-layer associations prove current operations, verified stop order, direction, fare, or legal permission to publish the underlying geometry.</p></body></html>`;
fs.writeFileSync(path.join(dir,'phase2c-location-matrix.html'),html);
runtime.phase2c={generatedAt:output.generatedAt,internalOnly:true,reviewFile:'reports/phase2c-gis-evidence.json',
  evidenceIndexSha256:hash,summary,verifiedPassengerEdges:0};
const tmp=runtimeFile+'.phase2c.tmp';fs.writeFileSync(tmp,JSON.stringify(runtime));fs.renameSync(tmp,runtimeFile);
console.log('PHASE 2C INTERNAL GIS:',JSON.stringify(summary));
console.log('Private QA:',path.join(dir,'phase2c-qa.json'));
console.log('Private coverage report:',path.join(dir,'phase2c-location-matrix.html'));
console.log('No commuter UI changes. No passenger edges.');
