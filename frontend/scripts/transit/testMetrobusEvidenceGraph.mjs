import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildMetrobusEvidenceGraph, screenMetrobusGeometry, distanceToPolylineMetres,
  runMetrobusEvidenceGraph } from './buildMetrobusEvidenceGraph.mjs';
const FIXED = '2026-09-22T00:00:00.000Z';
const r1 = { gisObjectId:1,routeCodeFromName:'55',rawRouteIdField:60,rawIdDisagreesWithName:true,
  gisDescription:'Gandhi Square to Meredale <script>alert(1)</script>',originLabel:'Gandhi Square',destinationLabel:'Meredale',
  gisPolylineLengthKm:1.5,inventoryCodeOverlapOnly:true,publishedInventoryLabel:'Gandhi Square–Meredale',
  extentWgs84:{west:28.01,east:28.02,south:-26.22,north:-26.21},
  geometry:[[[28.01,-26.22],[28.02,-26.21]]],candidateStopCount:1,
  passengerRoutingEnabled:false,verifiedServiceDirection:false,verifiedCurrentOperation:false,verifiedStopMembership:false };
const r2 = { gisObjectId:2,routeCodeFromName:'63',rawRouteIdField:63,rawIdDisagreesWithName:false,
  gisDescription:'Second GIS shape',originLabel:null,destinationLabel:null,gisPolylineLengthKm:1.5,
  inventoryCodeOverlapOnly:false,publishedInventoryLabel:null,
  extentWgs84:{west:28.02,east:28.03,south:-26.22,north:-26.21},
  geometry:[[[28.02,-26.22],[28.03,-26.21]]],candidateStopCount:2,
  passengerRoutingEnabled:false,verifiedServiceDirection:false,verifiedCurrentOperation:false,verifiedStopMembership:false };
const fixture = {
  metadata: { passengerRoutingEnabled:false,licensingReviewRequired:true,currentOperationVerified:false,
    routeDirectionVerified:false,publishedOrderedStopsVerified:false,boardingVerified:false,
    transfersVerified:false,faresVerified:false,timetablesVerified:false },
  summary: {gisRouteGeometries:2,gisStopPoints:3,inventoryCodeMatches:1,
    nameVersusRawIdDisagreements:1,candidateSpatialPairs:3,stopsNearAnyShape:2,
    stopsNearMultipleShapes:1,screeningThresholdMetres:75,
    verifiedBoardingEdges:0,verifiedTransferEdges:0,selectablePassengerJourneys:0 },
  routes:[r1,r2],
  stops:[
    {gisObjectId:10,lng:28.015,lat:-26.215,locationDescription:'At Main Street',candidateRouteCount:2,
      verifiedBoarding:false,verifiedRouteMembership:false,PHOTONAME:'PRIVATE_PHOTO_PATH'},
    {gisObjectId:11,lng:28.025,lat:-26.215,locationDescription:'At Market Street',candidateRouteCount:1,
      verifiedBoarding:false,verifiedRouteMembership:false},
    {gisObjectId:12,lng:28.04,lat:-26.24,locationDescription:'Another place',candidateRouteCount:0,
      verifiedBoarding:false,verifiedRouteMembership:false},
  ],
  candidates:[
    {routeGisObjectId:1,stopGisObjectId:10,proximityMetresApprox:2.2,evidence:'spatial-support-only',confirmedBoarding:false,confirmedTransfer:false},
    {routeGisObjectId:2,stopGisObjectId:10,proximityMetresApprox:23,evidence:'spatial-support-only',confirmedBoarding:false,confirmedTransfer:false},
    {routeGisObjectId:2,stopGisObjectId:11,proximityMetresApprox:2.1,evidence:'spatial-support-only',confirmedBoarding:false,confirmedTransfer:false},
  ],
};
const clone=()=>structuredClone(fixture);
let n=0;
const pass=(c,msg)=>{assert.ok(c,msg);n++};
const graph=buildMetrobusEvidenceGraph(clone(),FIXED);
pass(graph.summary.routeNodes===2&&graph.summary.stopEvidenceNodes===3,'route/stop nodes');
pass(graph.summary.spatialSupportEdges===3,'all support edges retained');
pass(graph.summary.indexedCodeOverlaps===1&&graph.summary.rawIdDisagreements===1,'partial code overlap / raw GIS disagreement counted separately');
pass(graph.nodes.routes[0].routeCodeFromName==='55'&&graph.nodes.routes[0].rawRouteIdField===60,'GIS NAME route code and raw GIS ROUTE_ID stay separate');
pass(graph.edges.spatialSupport.every(e=>!e.traversableByPassenger&&!e.confirmedRouteMembership&&!e.confirmedTransfer),'all proximity edges are non-traversable');
pass(graph.edges.passengerTravel.length===0&&graph.edges.verifiedTransfers.length===0&&graph.edges.verifiedBoarding.length===0,'zero passenger/transfer/boarding edges');
pass(graph.metadata.passengerRoutingEnabled===false&&graph.metadata.licensingReviewRequired===true,'public reuse and journey restrictions preserved');
pass(graph.nodes.stops.find(s=>s.gisObjectId===10).candidateRouteCount===2,'multiple nearby shapes are not a transfer');
pass(!JSON.stringify(graph).includes('PRIVATE_PHOTO_PATH'),'source photo path excluded');
pass(graph.nodes.routes.every(r=>r.operatingStatus==='unverified'&&r.stopMembershipStatus==='unverified'),'unverified route states');
const a={lng:28.015,lat:-26.215},b={lng:28.018,lat:-26.212};
const midpoint=distanceToPolylineMetres(a,graph.nodes.routes[0].geometry.coordinates);
pass(midpoint.distanceMetresApprox<2,'segment-projection finds middle of line, not just endpoints');
const near=screenMetrobusGeometry(graph,a,b,100);
pass(near.commonGeometryCandidates.length===1&&near.commonGeometryCandidates[0].routeCode==='55','possible same-polyline geometry match');
pass(near.commonGeometryCandidates[0].passengerJourneyAvailable===false&&near.verifiedPassengerJourneys.length===0,'no actual passenger journey asserted');
pass(near.originOnlyGeometryCandidates.length===0,'origin-only candidates do not include the matched line');
const separate=screenMetrobusGeometry(graph,a,{lng:28.025,lat:-26.215},100);
pass(separate.commonGeometryCandidates.length===0,'separate lines do not become a same-shape match');
pass(separate.originOnlyGeometryCandidates.some(r=>r.routeCode==='55')&&separate.destinationOnlyGeometryCandidates.some(r=>r.routeCode==='63'),'per-end geometry support shown independently');
pass(separate.noTransfersInferred&&separate.verifiedPassengerJourneys.length===0,'shared stop / spatial proximity does not invent transfer');
const far=screenMetrobusGeometry(graph,{lat:-26.4,lng:28.2},{lat:-26.5,lng:28.3},250);
pass(far.commonGeometryCandidates.length===0,'far-away origin/destination have no false spatial hit');
assert.throws(()=>screenMetrobusGeometry(graph,a,b,2000),/between 100 and 1500/);n++;
assert.throws(()=>screenMetrobusGeometry(graph,{lng:34,lat:-26.2},b,800),/valid WGS84/);n++;
const unsafe=structuredClone(graph);unsafe.edges.passengerTravel.push({kind:'invented'});
assert.throws(()=>screenMetrobusGeometry(unsafe,a,b),/restricted, zero-passenger-edge/);n++;
{
 const f=clone();f.metadata.routeDirectionVerified=true;
 assert.throws(()=>buildMetrobusEvidenceGraph(f),/unverified statuses/);n++;
}
{
 const f=clone();f.routes[0].verifiedStopMembership=true;
 assert.throws(()=>buildMetrobusEvidenceGraph(f),/unsupported verification/);n++;
}
{
 const f=clone();f.stops[1].gisObjectId=10;
 assert.throws(()=>buildMetrobusEvidenceGraph(f),/Duplicate\/invalid GIS stop/);n++;
}
{
 const f=clone();f.candidates[0].confirmedTransfer=true;
 assert.throws(()=>buildMetrobusEvidenceGraph(f),/improperly asserts/);n++;
}
{
 const f=clone();f.candidates.push({...f.candidates[0]});f.summary.candidateSpatialPairs=4;
 assert.throws(()=>buildMetrobusEvidenceGraph(f),/Duplicate spatial support edge/);n++;
}
{
 const f=clone();f.routes[0].geometry[0][0]=[-118.2,34.2];
 assert.throws(()=>buildMetrobusEvidenceGraph(f),/out-of-bounds coordinates/);n++;
}
{
 const f=clone();f.candidates[0].stopGisObjectId=999;
 assert.throws(()=>buildMetrobusEvidenceGraph(f),/unknown GIS node/);n++;
}
{
 const f=clone();f.summary.candidateSpatialPairs=5;
 assert.throws(()=>buildMetrobusEvidenceGraph(f),/node\/edge counts/);n++;
}
const temp=await mkdtemp(path.join(os.tmpdir(),'pulse-metrobus-1g-'));
try {
 const input=path.join(temp,'.local-dev/metrobus/metrobus-dev-index.json');
 const out=path.join(temp,'.local-dev/metrobus/phase1g');
 const tpl=fileURLToPath(new URL('./metrobusJourneySandbox.template.html',import.meta.url));
 await mkdir(path.dirname(input),{recursive:true});await writeFile(input,JSON.stringify(fixture));
 const result=await runMetrobusEvidenceGraph({inputPath:input,outputRoot:out,templatePath:tpl});
 pass(result.qa.errors.length===0&&result.qa.policies.passengerRoutingEnabled===false,'end-to-end QA succeeded');
 const saved=JSON.parse(await readFile(path.join(out,'metrobus-evidence-graph.json'),'utf8'));
 pass(saved.summary.spatialSupportEdges===3&&saved.edges.passengerTravel.length===0,'saved graph contains support-only edges');
 const html=await readFile(path.join(out,'metrobus-journey-sandbox.html'),'utf8');
 pass(!html.includes('__PULSE_METROBUS_EVIDENCE_GRAPH__')&&!html.includes('__PULSE_METROBUS_SCREEN_CORE__'),'both template placeholders replaced');
 pass(html.includes('function screenMetrobusGeometry('),'same tested screening core embedded in local HTML');
 pass(html.includes('\\u003cscript\\u003e')&&!html.includes('<script>alert(1)</script>'),'script-breaking GIS description is safely escaped');
 pass(!html.includes('PRIVATE_PHOTO_PATH'),'private GIS EXIF and photo paths not embedded');
 const js=html.split('<script>')[1]?.split('</script>')[0];
 assert.ok(js);new vm.Script(js);n++;
 const ignore=await readFile(path.join(temp,'.local-dev/.gitignore'),'utf8');
 pass(ignore.includes('!.gitignore'),'generated source data ignored locally');
 const qa=JSON.parse(await readFile(path.join(out,'reports/qa.json'),'utf8'));
 pass(qa.summary.verifiedPassengerTravelEdges===0&&qa.policies.publicBuildFilesTouched===false,'QA confirms public planner untouched');
} finally { await rm(temp,{recursive:true,force:true}); }
console.log(`\nPASS: ${n} synthetic and end-to-end Metrobus Phase 1G assertions`);
console.log('PASS: graph integrity, polyline segment distance, separate endpoint screening, no inferred transfers, JS parse, HTML injection resistance, local-only output, zero passenger edges');
