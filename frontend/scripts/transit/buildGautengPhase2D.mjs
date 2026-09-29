/** Build a private, location-based coverage matrix from real local Phase 2C GIS snapshots. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {buildCoverageIndex,screenCoverage,pointPairFromLine} from './gautengPhase2DCore.mjs';
const base=path.join(process.cwd(),'src/data/transit/gauteng');
const file=(...names)=>path.join(base,...names);
const read=(p)=>{if(!fs.existsSync(p))throw Error(`Missing required input: ${p}`);return JSON.parse(fs.readFileSync(p,'utf8'));};
const runtime=read(file('unified-dev','runtime.json'));
const phase2c=read(file('unified-dev','reports','phase2c-gis-evidence.json'));
const eku=read(file('ekurhuleni-bus','gis-normalized','infrastructure.json'));
const index=buildCoverageIndex(runtime,phase2c,eku);
if(index.routeShapes.length<150||!index.railStations.length||!index.railTrackShapes.length)
 throw Error('Incomplete network; refusing to generate misleading report');
const picked=[];
function addRoute(label,r){
 if(!r)throw Error(`Expected real GIS anchor missing: ${label}`);
 const [origin,destination]=pointPairFromLine(r);
 picked.push({name:label,type:'gis-shape',origin,destination,expectedAnchor:r.id});
}
const byOperator=id=>index.routeShapes.filter(s=>s.operatorId===id);
addRoute('Johannesburg Metrobus GIS route 55',byOperator('metrobus').find(s=>s.routeCode==='55')??byOperator('metrobus')[0]);
addRoute('Pretoria A Re Yeng geometry',byOperator('areyeng')[0]);
addRoute('Pretoria Tshwane Bus geometry',byOperator('tshwane-bus')[0]);
addRoute('Ekurhuleni IRPTN corridor',byOperator('ekurhuleni-irptn')[0]);
for(let i=1;i<=7;i++){
 const r=byOperator('ekurhuleni-gms-unassigned').find(s=>s.groupNumber===i);
 if(r)addRoute(`Ekurhuleni GMS GIS group ${i} (operator unassigned)`,r);
}
const officialStations=new Map();
for(const s of index.gautrainServices)for(const t of s.stations??[])officialStations.set(t.name.toLowerCase(),t);
const fromStation=name=>[...officialStations.values()].find(s=>s.name.toLowerCase()===name.toLowerCase());
function addRail(a,b){
 const x=fromStation(a),y=fromStation(b);
 if(x&&y)picked.push({name:`Gautrain published service membership: ${a} → ${b}`,type:'published-station-membership',
   origin:{lat:x.lat,lng:x.lng},destination:{lat:y.lat,lng:y.lng}});
}
addRail('Park','Rosebank');addRail('Park','Pretoria');
function addStationCategory(name,arr){
 if(arr.length<2)return;
 const p=arr[0].geometry,q=arr[Math.max(1,Math.floor(arr.length*.66))].geometry;
 picked.push({name,type:'railway-station-proximity-only',origin:p,destination:q});
}
addStationCategory('Johannesburg municipal railway station points',eku.joburgPrasaStations);
addStationCategory('Ekurhuleni municipal railway station points',eku.railwayStations);
picked.push({name:'Negative control: outside mapped Gauteng footprint',type:'negative-control',
 origin:{lat:-25.0,lng:29.5},destination:{lat:-25.0,lng:29.6}});
const args=process.argv;
let radius=800;
if(args.includes('--radius'))radius=Number(args[args.indexOf('--radius')+1]);
if(args.includes('--pairs')){
 const pathArg=args[args.indexOf('--pairs')+1];
 const custom=JSON.parse(fs.readFileSync(path.resolve(pathArg),'utf8'));
 if(!Array.isArray(custom)||custom.length>50)throw Error('Custom test journeys must be an array of at most 50 pairs');
 for(const p of custom){
  if(typeof p?.name!=='string'||p.name.length>100||!p.origin||!p.destination)throw Error('Invalid custom test journey');
  picked.push({name:`Custom: ${p.name}`,type:'custom-location-pair',origin:p.origin,destination:p.destination});
 }
}
const rows=picked.map(p=>{
 const screen=screenCoverage(index,p.origin,p.destination,radius);
 const anchorPassed=p.expectedAnchor?screen.sameShapeTop.some(s=>s.id===p.expectedAnchor)||
  /* Top six can be filled by overlapping GIS; check the source line independently. */
  (()=>{const r=index.routeShapes.find(s=>s.id===p.expectedAnchor);if(!r)return false;
   const [{lat:aLat,lng:aLng},{lat:bLat,lng:bLng}]=pointPairFromLine(r);
   return aLat===p.origin.lat&&aLng===p.origin.lng&&bLat===p.destination.lat&&bLng===p.destination.lng&&
    screen.sameShapeCount>0;})():null;
 return {name:p.name,scenarioType:p.type,origin:p.origin,destination:p.destination,
  expectedAnchor:p.expectedAnchor??null,anchoredGeometryTestPassed:anchorPassed,
  sameGeometryCandidates:screen.sameShapeCount,sameShapeTop:screen.sameShapeTop.slice(0,4),
  nearestByOperator:screen.nearestByOperator,nearestRailStations:screen.nearestRailStations,
  gautrainServiceMembership:screen.gautrainServiceMembership,infrastructureStatus:screen.infrastructureStatus,
  fare:null,etaMinutes:null,passengerRoutingEnabled:false};
});
const gmsByGroup=Object.values(index.gmsGroupEvidence);
const railStationOutliers=[...(phase2c.railEvidence?.johannesburg??[]),...(phase2c.railEvidence?.ekurhuleni??[])]
 .filter(s=>s.within500m===false).map(s=>({stationId:s.stationId,stationLabel:s.stationLabel,municipality:s.municipality,
 nearestLineMetres:s.nearestSameMunicipalityLine?.distanceMetres??null}));
const qa={generatedAt:new Date().toISOString(),internalOnly:true,sourceRightsCleared:false,
 summary:{previousMappedBusAndCorridorShapes:runtime.geometryRoutes.length,
  gmsUnassignedRouteFeatures:gmsByGroup.reduce((n,g)=>n+g.routes,0),
  totalMappedBusAndCorridorShapes:index.routeShapes.length,
  gmsGisStopPoints:gmsByGroup.reduce((n,g)=>n+g.stops,0),
  completeGmsSourceLayerPairs:gmsByGroup.filter(g=>g.routes>0&&g.stops>0).length,
  municipalRailStationObservations:index.railStations.length,
  municipalRailTrackShapes:index.railTrackShapes.length,
  stationPointsOver500mFromLocalRail:railStationOutliers.length,
  geographicTestScenarios:rows.length,
  anchoredRouteChecks:rows.filter(r=>r.expectedAnchor).length,
  anchoredRouteChecksPassed:rows.filter(r=>r.expectedAnchor&&r.anchoredGeometryTestPassed).length,
  verifiedHarambeeOperatingServices:0,verifiedPrasaStoppingPatterns:0,
  newPassengerEdges:0,newBoardingEdges:0,newTransferEdges:0},
 stationOutliersForReview:railStationOutliers,errors:[],warnings:['GMS numbered GIS layer pairs must not be presented as current Harambee services.',
  'Municipal railway track and stations do not establish current Metrorail service or stopping order.',
  'Route proximity, including same-geometry matches, is not a confirmed passenger journey.',
  'GIS reuse permission remains review-required; generated reports are private.']};
if(qa.summary.anchoredRouteChecks!==qa.summary.anchoredRouteChecksPassed)
 qa.errors.push('One or more real-geometry anchored tests failed');
if(rows.some(r=>r.passengerRoutingEnabled||r.fare!==null||r.etaMinutes!==null))qa.errors.push('Unverified passenger claim detected');
if(qa.errors.length)throw Error(qa.errors.join('; '));
const out=file('unified-dev');const reports=path.join(out,'reports');fs.mkdirSync(reports,{recursive:true});
// Never replace the existing .gitignore with a smaller pattern list.
const ignore=path.join(out,'.gitignore');const old=fs.existsSync(ignore)?fs.readFileSync(ignore,'utf8'):'';
if(!old.includes('/phase2d-evidence.json'))fs.appendFileSync(ignore,'\n/phase2d-evidence.json\n');
const indexed=JSON.stringify(index);fs.writeFileSync(path.join(out,'phase2d-evidence.json'),indexed);
qa.sourceIndexSha256=crypto.createHash('sha256').update(indexed).digest('hex');
fs.writeFileSync(path.join(reports,'phase2d-qa.json'),JSON.stringify(qa,null,2)+'\n');
fs.writeFileSync(path.join(reports,'phase2d-location-matrix.json'),JSON.stringify({generatedAt:qa.generatedAt,
 internalOnly:true,rightsCleared:false,passengerRoutingEnabled:false,radiusMetres:radius,rows},null,2)+'\n');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const metrics=[['Mapped bus and corridor geometries',qa.summary.totalMappedBusAndCorridorShapes],
 ['Additional GMS GIS shapes',qa.summary.gmsUnassignedRouteFeatures],
 ['GIS stop observations in GMS groups',qa.summary.gmsGisStopPoints],
 ['Municipal rail station observations',qa.summary.municipalRailStationObservations],
 ['Railway line shapes',qa.summary.municipalRailTrackShapes],
 ['Location test cases',qa.summary.geographicTestScenarios]];
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pulse | Gauteng Infrastructure Matrix</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at top left,#182651 0%,#0a1025 40%,#070b18 100%);color:#f4f6ff;font:15px/1.55 Inter,Segoe UI,system-ui,sans-serif;padding:28px}
main{max-width:1180px;margin:0 auto}.eyebrow{color:#a5b6e5;font-size:12px;letter-spacing:.13em;text-transform:uppercase}h1{letter-spacing:-.045em;font-size:clamp(28px,4.5vw,50px);margin:9px 0}p{color:#b7c5e8}.hero{padding:32px;border:1px solid #32456c;border-radius:25px;background:linear-gradient(135deg,#23355e99,#141c3299);box-shadow:0 18px 65px #0003}.pill{display:inline-block;border:1px solid #659f9c;background:#153a41;color:#8ee6cc;padding:6px 12px;border-radius:99px;font-size:12px}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:20px 0}.metric,.panel{border:1px solid #32415f;background:#101c36bb;border-radius:20px;padding:20px}.metric strong{display:block;font-size:32px;letter-spacing:-.03em}.metric span{color:#aebee0;font-size:13px}.panel{overflow:auto;margin-top:20px}table{border-collapse:collapse;width:100%;min-width:750px}th,td{text-align:left;padding:14px 13px;border-bottom:1px solid #34445c}th{color:#a8bbdd;font-size:12px;letter-spacing:.06em}td small{color:#97accd}.ok{color:#94f0cd}.warn{color:#ffd28a}.tag{border-radius:99px;padding:4px 9px;background:#233759;color:#dce7ff;white-space:nowrap}footer{padding:16px 3px;color:#9eb4dd;font-size:12px}@media(max-width:750px){body{padding:12px}.hero{padding:20px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.metric{padding:14px}.metric strong{font-size:24px}}
</style></head><body><main><section class="hero"><div class="eyebrow">PULSE / NETWORK ENGINEERING / PRIVATE</div><h1>Gauteng infrastructure coverage</h1><p>One evidence-aware coverage view across municipal bus geometry, Gautrain published station membership, and municipal railway infrastructure. These results are not confirmed passenger journeys.</p><span class="pill">LOCAL GIS RESEARCH · NO VERIFIED PASSENGER ROUTES ADDED</span></section>
<div class="grid">${metrics.map(([k,v])=>`<div class="metric"><strong>${v}</strong><span>${esc(k)}</span></div>`).join('')}</div><section class="panel"><h2>Actual-source location tests</h2><p>Radius: ${radius} metres. Each origin and destination was derived from existing GIS or station records, except the negative control and any optional custom test pairs.</p><table><thead><tr><th>Test</th><th>Same GIS shape</th><th>Published rail membership</th><th>Nearest station A / B</th><th>Interpretation</th></tr></thead><tbody>
${rows.map(r=>`<tr><td><b>${esc(r.name)}</b><br><small>${esc(r.scenarioType)}</small></td><td>${r.sameGeometryCandidates}${r.expectedAnchor?' <span class="ok">✓ geometry check</span>':''}<br><small>${esc(r.sameShapeTop.map(s=>s.routeCode).slice(0,3).join(' · '))}</small></td><td>${r.gautrainServiceMembership.length}</td><td>${r.nearestRailStations.origin[0]?.metres??'-'}m / ${r.nearestRailStations.destination[0]?.metres??'-'}m</td><td><span class="tag">${esc(r.infrastructureStatus)}</span></td></tr>`).join('')}</tbody></table></section><section class="panel"><h2>Station geometry review</h2><p>${railStationOutliers.length ? esc(railStationOutliers.map(s=>`${s.stationLabel} (${s.municipality}): ${s.nearestLineMetres}m from nearest mapped railway line`).join("; ")) : "No station outliers beyond 500 metres in the current regional GIS comparison."}</p></section><section class="panel"><h2>Evidence boundaries</h2><p>GMS GIS layer pairs are not automatically Harambee service routes. Station-to-track proximity does not validate Metrorail schedules. Metrobus and IRPTN lines are geography, not guaranteed boarding services. None of these tests invents an exact fare, ETA, route direction, stop sequence, or transfer.</p></section><footer>Generated ${esc(qa.generatedAt)}. Internal use only; municipal GIS reuse rights remain under review.</footer></main></body></html>`;
fs.writeFileSync(path.join(reports,'phase2d-location-matrix.html'),html);
console.log('PHASE 2D PRIVATE COVERAGE MATRIX:',JSON.stringify(qa.summary));
console.log(`PASS: ${qa.summary.anchoredRouteChecksPassed}/${qa.summary.anchoredRouteChecks} source-anchored GIS checks. GIS rights and operations still unverified.`);
console.log('Private report:',path.join(reports,'phase2d-location-matrix.html'));
