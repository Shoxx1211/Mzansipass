import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {screenRailCorridorEvidence} from './ekurhuleniRailEvidenceCore.mjs';
const root=path.join(process.cwd(),'src/data/transit/gauteng');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const eku=read('ekurhuleni-bus/gis-normalized/infrastructure.json');
const index=read('unified-dev/reports/phase2b-rail-corridor-evidence.json');
const runtime=read('unified-dev/runtime.json');
assert.equal(index.internalOnly,true);assert.equal(index.passengerRoutingEnabled,false);
assert.ok(index.summary.combinedStationObservations>100);
assert.ok(index.summary.municipalRailwayLineShapes>100);
assert.ok(index.summary.municipalIrptnCorridors>0);
assert.equal(index.summary.passengerTravelEdges,0);
assert.equal(runtime.phase2b.summary.combinedStationObservations,index.summary.combinedStationObservations);
const cases=[];
const test=(name,a,b,check)=>{const r=screenRailCorridorEvidence(eku,index,a,b,800);assert.ok(check(r),`Case failed: ${name}`);
  assert.equal(r.verifiedPassengerEdges,0);assert.equal(r.passengerRoutingEnabled,false);
  cases.push({name,origin:a,destination:b,nearbyRailAtOrigin:r.originNearbyRailStationObservations.length,
    nearbyRailAtDestination:r.destinationNearbyRailStationObservations.length,sharedIrptnGeometry:r.sharedIrptnGeometry.length,pass:true});};
const sampleStation=eku.railwayStations[0].geometry;
test('Actual Ekurhuleni GIS station point to same GIS station',sampleStation,sampleStation,r=>r.originNearbyRailStationObservations.length>0);
const lastStation=eku.railwayStations.at(-1).geometry;
test('Two distinct Ekurhuleni GIS railway station locations',sampleStation,lastStation,
  r=>r.originNearbyRailStationObservations.length>0&&r.destinationNearbyRailStationObservations.length>0);
const sampleJoburg=eku.joburgPrasaStations[0]?.geometry;
if(sampleJoburg){
  test('Actual Johannesburg PRASA GIS station observation',sampleJoburg,sampleJoburg,r=>r.originNearbyRailStationObservations.length>0);
  const lastJoburg=eku.joburgPrasaStations.at(-1)?.geometry;
  if(lastJoburg)test('Two distinct Johannesburg PRASA GIS station locations',sampleJoburg,lastJoburg,
    r=>r.originNearbyRailStationObservations.length>0&&r.destinationNearbyRailStationObservations.length>0);
}
const longest=eku.irptnRoutes.map(r=>({...r,line:[...r.geometry.coordinates].sort((a,b)=>b.length-a.length)[0]}))
  .sort((a,b)=>b.line.length-a.line.length)[0];
assert.ok(longest.line.length>=2);
const pt=p=>({lat:p[1],lng:p[0]});
test('Two real points on one mapped IRPTN corridor',pt(longest.line[0]),pt(longest.line.at(-1)),
  r=>r.sharedIrptnGeometry.some(x=>x.corridorId===longest.id));
test('Repeated GPS coordinate never authorizes passenger travel',sampleStation,sampleStation,
  r=>r.passengerRoutingEnabled===false&&r.verifiedPassengerEdges===0);
test('Gauteng coordinate outside these mapped networks has no local match',
  {lat:-24.1,lng:29.8},{lat:-24.1,lng:29.8},
  r=>r.originNearbyRailStationObservations.length===0&&r.destinationNearbyRailStationObservations.length===0&&r.sharedIrptnGeometry.length===0);
assert.throws(()=>screenRailCorridorEvidence(eku,index,{lat:0,lng:0},sampleStation));
const esc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const report={generatedAt:new Date().toISOString(),internalOnly:true,
  result:'pass',summary:index.summary,cases,warnings:index.warning};
const dir=path.join(root,'unified-dev/reports');fs.writeFileSync(path.join(dir,'phase2b-location-matrix.json'),JSON.stringify(report,null,2)+'\n');
const cards=cases.map(c=>`<article><strong>PASS</strong><h3>${esc(c.name)}</h3><p>A: ${c.origin.lat.toFixed(6)}, ${c.origin.lng.toFixed(6)}<br>B: ${c.destination.lat.toFixed(6)}, ${c.destination.lng.toFixed(6)}</p><p>Rail station observations A/B: ${c.nearbyRailAtOrigin}/${c.nearbyRailAtDestination}<br>IRPTN shapes near both: ${c.sharedIrptnGeometry}</p></article>`).join('');
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pulse / Ekurhuleni Evidence</title><style>body{background:#0c152a;color:#f5f8ff;font-family:system-ui;margin:0;padding:32px;max-width:1050px;margin:auto}header{background:linear-gradient(135deg,#142b51,#29244d);border:1px solid #4e6388;border-radius:24px;padding:30px}h1{font-size:38px;letter-spacing:-.04em}p{color:#aec2de;line-height:1.6}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:22px 0}.tile,article{background:#17233b;border:1px solid #344764;border-radius:16px;padding:20px}b{font-size:30px}small{color:#a7c0da}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:14px}strong{color:#83f0cb}.notice{background:#3f3426;border:1px solid #8f7035;padding:15px;border-radius:12px;color:#ffdfaf;margin-bottom:22px}</style></head><body><header><small>PULSE TRANSIT / PRIVATE INFRASTRUCTURE QA</small><h1>Ekurhuleni and railway evidence</h1><p>Local GIS geometry tests. Not a timetable, passenger rail itinerary, boarding instruction or approved public data feed.</p></header><div class="grid"><div class="tile"><b>${index.summary.combinedStationObservations}</b><p>Railway station observations</p></div><div class="tile"><b>${index.summary.municipalRailwayLineShapes}</b><p>Mapped railway line shapes</p></div><div class="tile"><b>${index.summary.municipalIrptnCorridors}</b><p>IRPTN corridor shapes</p></div><div class="tile"><b>${cases.length}/${cases.length}</b><p>Geographic tests passed</p></div></div><div class="notice">${esc(index.warning)} Reuse rights remain under review.</div><section>${cards}</section></body></html>`;
fs.writeFileSync(path.join(dir,'phase2b-location-matrix.html'),html);
console.log(`PASS: ${cases.length} real-snapshot location checks; rail station-to-track candidates evaluated.`);
console.log('Phase 2B QA:',JSON.stringify(index.summary));
console.log('Report:',path.join(dir,'phase2b-location-matrix.html'));
