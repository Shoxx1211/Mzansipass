/** Real-snapshot deterministic test matrix. Offline, no arbitrary geocoding assumptions. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {screenUnifiedCoverage,segmentDistanceMetres} from '../../src/services/unifiedCoverageCore.mjs';

const root=process.cwd();
const base=path.join(root,'src/data/transit/gauteng/unified-dev');
const file=path.join(base,'runtime.json');
if(!fs.existsSync(file)) throw new Error('Build runtime first: node scripts/transit/buildUnifiedGautengRuntime.mjs');
const runtime=JSON.parse(fs.readFileSync(file,'utf8'));
const cases=[];
const test=(name,A,B,expect)=>{
 const result=screenUnifiedCoverage(runtime,A,B,{radiusMetres:800});
 const found=result.shapeMatches.map(r=>`${r.operatorId}:${r.routeCode}`);
 const rail=result.railMatches.map(r=>r.serviceId);
 const passed=expect(result);
 cases.push({name,origin:A,destination:B,radiusMetres:800,
  foundGeometries:found.slice(0,8),totalGeometries:result.totalShapeMatches,railMembership:rail,passed});
 assert.ok(passed,`FAILED ${name}; shapes=${found.join(',')} rail=${rail.join(',')}`);
 assert.equal(result.verifiedPassengerEdges,0);
 assert.equal(result.passengerRoutingEnabled,false);
 assert.ok(result.shapeMatches.every(s=>s.selectable===false&&s.fare===null&&s.etaMinutes===null));
 assert.ok(result.railMatches.every(s=>s.selectable===false&&s.fare===null&&s.etaMinutes===null));
};
const route=(operator,code)=>runtime.geometryRoutes.find(r=>r.operatorId===operator&&r.code===code);
const endpoints=(r)=>{
 const line=[...r.geometry.coordinates].sort((a,b)=>b.length-a.length)[0];
 assert.ok(line.length>5,`Route too short for test: ${r.id}`);
 const a=line[Math.floor(line.length*.2)],b=line[Math.floor(line.length*.8)];
 return [{lat:a[1],lng:a[0]},{lat:b[1],lng:b[0]}];
};
assert.equal(runtime.internalOnly,true);
assert.equal(runtime.passengerRoutingEnabled,false);
assert.equal(runtime.geometryRoutes.length,199);
assert.equal(runtime.geometryRoutes.filter(r=>r.operatorId==='metrobus').length,110);
assert.equal(runtime.geometryRoutes.filter(r=>r.operatorId==='areyeng').length,10);
assert.equal(runtime.geometryRoutes.filter(r=>r.operatorId==='tshwane-bus').length,79);
assert.equal(runtime.sourceStats.gautrain.stations,10);
assert.equal(runtime.sourceStats.gautrain.feederMaps,45);
assert.equal(runtime.sourceStats.putco.geographicZonePolygons,0);
assert.ok(runtime.railServices.every(s=>s.membershipVerified===true&&s.stoppingOrderVerified===false));
assert.ok(segmentDistanceMetres({lat:-26,lng:28},[28,-26],[28.1,-26])<.001);
const m=route('metrobus','55');assert.ok(m,'City GIS Metrobus 55 required');
test('Johannesburg Metrobus 55 — two real GIS points',...endpoints(m),r=>r.shapeMatches.some(x=>x.operatorId==='metrobus'&&x.routeCode==='55'));
const a=runtime.geometryRoutes.find(r=>r.operatorId==='areyeng');
test('Pretoria A Re Yeng — two real GIS points',...endpoints(a),r=>r.shapeMatches.some(x=>x.routeId===a.id));
const t=runtime.geometryRoutes.filter(r=>r.operatorId==='tshwane-bus').sort((a,b)=>b.geometry.coordinates.flat().length-a.geometry.coordinates.flat().length)[0];
test('Pretoria Tshwane Bus — two real GIS points',...endpoints(t),r=>r.shapeMatches.some(x=>x.routeId===t.id));
const s=(name)=>runtime.railServices.flatMap(v=>v.stations).find(st=>st.name===name);
const park=s('Park'),rosebank=s('Rosebank'),pretoria=s('Pretoria');
assert.ok(park&&rosebank&&pretoria,'Gautrain station membership fixtures missing');
test('Gautrain Park → Rosebank — published corridor membership',
 {lat:park.lat,lng:park.lng},{lat:rosebank.lat,lng:rosebank.lng},
 r=>r.railMatches.some(v=>v.originStation==='Park'&&v.destinationStation==='Rosebank'));
test('Gautrain Park → Pretoria — published corridor membership',
 {lat:park.lat,lng:park.lng},{lat:pretoria.lat,lng:pretoria.lng},
 r=>r.railMatches.some(v=>v.originStation==='Park'&&v.destinationStation==='Pretoria'));
test('Outside mapped Gauteng → outside mapped Gauteng',
 {lat:-29.8587,lng:31.0218},{lat:-33.9249,lng:18.4241},
 r=>r.totalShapeMatches===0&&r.railMatches.length===0);
// Shared geometry is NOT a transferable path or proof that passenger service operates.
const noLicense={...runtime,internalOnly:false};
assert.throws(()=>screenUnifiedCoverage(noLicense,{lat:-26,lng:28},{lat:-26,lng:28}));
assert.throws(()=>screenUnifiedCoverage(runtime,{lat:0,lng:0},{lat:-26,lng:28}));
const report={generatedAt:new Date().toISOString(),source:'User-supplied local GIS snapshots, not a live service check',
 routeShapes:runtime.geometryRoutes.length,stationCount:runtime.sourceStats.gautrain.stations,
 testedJourneys:cases.length,allPassed:true,
 unsupportedOperators:['Metrorail','Harambee','Ekurhuleni Bus','Taxi'],
 provisionalOperators:['Metrobus','A Re Yeng','Tshwane Bus','Gautrain rail membership'],
 alreadyIntegratedSeparately:['Rea Vaya'],
 noGPSGeometry:['PUTCO Soshanguve','Gautrain feeder buses'],
 caution:'Tests use real coordinates FROM the GIS geometry or official station pages. They prove search mechanics only, not that buses operate or any transfer/boarding location is usable.',
 cases};
fs.mkdirSync(path.join(base,'reports'),{recursive:true});
fs.writeFileSync(path.join(base,'reports/journey-matrix.json'),JSON.stringify(report,null,2)+'\n');
const esc=(x)=>String(x).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pulse · Gauteng infrastructure test matrix</title><style>
:root{font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;color:#ecf5ff;background:#0c1424}*{box-sizing:border-box}body{max-width:1100px;margin:auto;padding:28px 18px 70px}header{background:linear-gradient(120deg,#152747,#182444 65%,#28365f);padding:30px;border:1px solid #456082;border-radius:24px;box-shadow:0 12px 55px #0004}h1{letter-spacing:-.04em;font-size:clamp(26px,5vw,42px);margin:12px 0 8px}.eyebrow{color:#69dbff;letter-spacing:.2em;font-weight:900;font-size:11px}.muted{color:#a6bed6;line-height:1.6}.pill{background:#123e39;color:#7bf8d5;border:1px solid #2d7767;display:inline-block;padding:7px 12px;border-radius:99px;font-size:12px;font-weight:800}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:20px 0}.tile,.card{border:1px solid #2d4360;background:#142137;border-radius:18px;padding:18px}.num{font-size:32px;font-weight:900;letter-spacing:-.04em;color:white}.label{color:#a5c0d9;font-size:12px;margin-top:4px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}.card h3{font-size:16px;margin:0 0 12px;color:#f4faff}.ok{color:#6dffcf;font-size:12px;font-weight:900}.small{font-size:13px;color:#b7cce1;line-height:1.7}.warn{padding:14px 18px;background:#3e3121;border:1px solid #9b7334;color:#ffdb9b;border-radius:14px;margin:24px 0}code{color:#e0e9ff;overflow-wrap:anywhere}a{color:#66d9fa}@media(max-width:650px){body{padding:12px}.cards{grid-template-columns:1fr}}
</style></head><body><header><div class="eyebrow">PULSE TRANSIT / PRIVATE ENGINEERING</div><h1>Gauteng network coverage</h1><div class="muted">Real coordinates taken from the uploaded GIS and published Gautrain station data. These are reproducible engine tests, not proof that a passenger journey operates.</div><p><span class="pill">${cases.length}/${cases.length} TEST CASES PASSED</span></p></header><div class="grid"><div class="tile"><div class="num">${runtime.geometryRoutes.length}</div><div class="label">GIS route shapes</div></div><div class="tile"><div class="num">${runtime.sourceStats.gautrain.stations}</div><div class="label">Gautrain stations</div></div><div class="tile"><div class="num">${runtime.sourceStats.gautrain.feederMaps}</div><div class="label">Feeder maps (no stop geometry)</div></div><div class="tile"><div class="num">0</div><div class="label">Verified passenger edges created</div></div></div><div class="warn">Internal developer review only. Route proximity cannot confirm a bus, direction, boarding point, transfer, journey time or fare. City GIS public reuse permission remains unresolved.</div><section class="cards">${cases.map(c=>`<div class="card"><span class="ok">PASS</span><h3>${esc(c.name)}</h3><div class="small">Origin: <code>${c.origin.lat.toFixed(6)}, ${c.origin.lng.toFixed(6)}</code><br>Destination: <code>${c.destination.lat.toFixed(6)}, ${c.destination.lng.toFixed(6)}</code><br>GIS shapes near both: ${c.totalGeometries}<br>Shared Gautrain service membership: ${c.railMembership.length}<br>Matched codes: ${esc(c.foundGeometries.slice(0,5).join(', ')||'none')}</div></div>`).join('')}</section><p class="muted">Generated ${esc(report.generatedAt)} from the local uploaded snapshot. Rea Vaya is already integrated separately in the production planner. PUTCO lacks usable geometry; Metrorail, Harambee and Ekurhuleni bus need further normalized sources.</p></body></html>`;
fs.writeFileSync(path.join(base,'reports/journey-matrix.html'),html);
console.log(`PASS: ${cases.length} deterministic journey scenarios on supplied network snapshots; no passenger edges, no invented fare or ETA.`);
for(const c of cases)console.log(`  PASS ${c.name} | geometry matches ${c.totalGeometries} | rail membership ${c.railMembership.length}`);
console.log('Saved:',path.join(base,'reports/journey-matrix.json'));
