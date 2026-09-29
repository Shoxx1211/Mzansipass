import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {screenInfrastructure} from './ekurhuleniInfrastructureCore.mjs';
import {screenUnifiedCoverage} from '../../src/services/unifiedCoverageCore.mjs';
const base=path.join(process.cwd(),'src/data/transit/gauteng');
const normalized=JSON.parse(fs.readFileSync(path.join(base,'ekurhuleni-bus/gis-normalized/infrastructure.json'),'utf8'));
const runtime=JSON.parse(fs.readFileSync(path.join(base,'unified-dev/runtime.json'),'utf8'));
assert.equal(runtime.internalOnly,true);assert.equal(runtime.passengerRoutingEnabled,false);
assert.equal(normalized.passengerRoutingEnabled,false);
const irptn=(normalized.irptnRoutes??[]);
const station=(normalized.railwayStations??[])[0];
assert.equal(runtime.geometryRoutes.filter(r=>r.operatorId==='ekurhuleni-irptn').length,irptn.length);
assert.equal(runtime.railwayInfrastructure.stationPoints.length,
  normalized.railwayStations.length+normalized.joburgPrasaStations.length);
const results=[];
const route=irptn.find(r=>r.geometry.coordinates.some(line=>line.length>=2));
if(route) {
 const line=route.geometry.coordinates.find(line=>line.length>=2),
  start=line[Math.floor(line.length*.2)],finish=line[Math.floor(line.length*.8)];
 const from={lng:start[0],lat:start[1]},to={lng:finish[0],lat:finish[1]};
 const e=screenInfrastructure(normalized,from,to);
 const u=screenUnifiedCoverage(runtime,from,to);
 assert.ok(e.totalIrptnGeometryMatches>0,'Known GIS positive must match');
 assert.ok(u.shapeMatches.some(s=>s.operatorId==='ekurhuleni-irptn'),'Unified coverage must detect IRPTN');
 assert.equal(u.passengerRoutingEnabled,false);
 results.push({scenario:'Known City GIS IRPTN corridor points',origin:from,destination:to,
    irptnMatches:e.totalIrptnGeometryMatches,nearbyStationAtOrigin:e.originNearbyRailwayStations.length,
    nearbyStationAtDestination:e.destinationNearbyRailwayStations.length,passengerJourneysVerified:0});
}
if(station){
 const point=station.geometry;
 const r=screenInfrastructure(normalized,point,point);
 assert.ok(r.originNearbyRailwayStations.length>=1);
 results.push({scenario:'Known municipal railway station point (same point control)',
   origin:point,destination:point,nearbyStations:r.originNearbyRailwayStations.length,passengerJourneysVerified:0});
}
assert.ok(irptn.length||normalized.railwayStations.length||normalized.railwayLines.length,
 'All three official GIS layers were empty: review data before continuing');
const html=(value)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const qa={generatedAt:new Date().toISOString(),sourceCounts:{irptn:normalized.irptnRoutes.length,
 railStations:normalized.railwayStations.length,railLines:normalized.railwayLines.length,
 additionalJoburgPrasaStations:normalized.joburgPrasaStations.length},scenarios:results,
 verifiedPassengerEdges:0,verifiedCurrentMetrorailServices:0,verifiedHarambeeRouteGeometry:0};
const dir=path.join(base,'unified-dev/reports');fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'phase2a-journey-matrix.json'),JSON.stringify(qa,null,2)+'\n');
const cards=results.map(x=>`<article><h2>${html(x.scenario)}</h2><p>${html(JSON.stringify(x))}</p><span>Geographic evidence only</span></article>`).join('');
fs.writeFileSync(path.join(dir,'phase2a-journey-matrix.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pulse | Phase 2A network QA</title><style>body{font-family:Inter,Segoe UI,Arial,sans-serif;color:#e8eefc;background:radial-gradient(ellipse at 20% 10%,#233b71,#080f23 63%);max-width:1000px;margin:auto;padding:42px 22px}h1{font-size:clamp(2rem,5vw,3.5rem);letter-spacing:-.04em}header p{color:#9ab0d4}main{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}article{background:linear-gradient(135deg,#1c2945b8,#111b35bc);padding:22px;border:1px solid #3b5582;border-radius:23px;overflow-wrap:anywhere}h2{font-size:1.15rem}article p{color:#b4c7e8;font-size:.87rem;line-height:1.8}article span{color:#eec785}.stats{display:flex;flex-wrap:wrap;gap:13px;margin:26px 0}.stats b{padding:18px 22px;border:1px solid #416a92;border-radius:18px;background:#162c4f}small{color:#a4b8d9}</style><header><small>DEVELOPER-ONLY EVIDENCE TEST</small><h1>Gauteng network infrastructure</h1><p>City GIS shapes and station points. No live schedules, known boarding instructions or passenger transfers.</p><div class="stats"><b>IRPTN ${qa.sourceCounts.irptn}</b><b>Rail stations ${qa.sourceCounts.railStations}</b><b>Railway lines ${qa.sourceCounts.railLines}</b></div></header><main>${cards||'<article><h2>No geometry positives available</h2><p>Review normalization QA and the source layers.</p></article>'}</main><p><small>All geometry data stays local. Rights review outstanding.</small></p></html>`);
console.log('PASS: Real normalized source-to-unified integration tested:',JSON.stringify(qa.sourceCounts),'scenario controls:',results.length,'passenger edges: 0');
console.log('Offline QA:',path.join(dir,'phase2a-journey-matrix.html'));
