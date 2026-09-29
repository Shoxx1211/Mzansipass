import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { distanceToPolylineMetres, screenMetrobusGeometry } from './buildMetrobusEvidenceGraph.mjs';
import { diagnoseMetrobusGeometry } from './metrobusDiagnosticsCore.mjs';
import { validatePhase1GForDiagnostics, buildMetrobusDiagnostics } from './buildMetrobusDiagnostics.mjs';
let passed=0;
const test=(condition,message)=>{assert.ok(condition,message);passed++;};
const metadata={ distribution:'local-dev-only', licensingReviewRequired:true,passengerRoutingEnabled:false,
 currentOperationVerified:false,directionVerified:false,routeStopMembershipVerified:false,
 boardingVerified:false,transfersVerified:false,faresVerified:false,timetablesVerified:false };
const a={lat:-26.2,lng:28.0},b={lat:-26.2,lng:28.05};
const makeRoute=(id,code,geometry)=>({id:`metrobus:gis-route:${id}`,gisObjectId:id,routeCodeFromName:code,
 gisDescription:`GIS Route ${code}` ,indexedCodeOverlapOnly:false,geometry:{type:'MultiLineString',coordinates:geometry}});
const makeStop=(id,lng,lat)=>({id:`metrobus:gis-stop:${id}`,gisObjectId:id,
 locationDescription:'Synthetic GIS coordinate only',coordinate:{lng,lat}});
const routeA=makeRoute(1,'A',[[[28.0,-26.2],[28.0,-26.16],[28.025,-26.16]]]);
const routeB=makeRoute(2,'B',[[[28.05,-26.2],[28.05,-26.16],[28.025,-26.16]]]);
const routeFar=makeRoute(3,'C',[[[28.3,-26.3],[28.32,-26.28]]]);
const graph={metadata,summary:{routeNodes:3,stopEvidenceNodes:1,spatialSupportEdges:2,verifiedPassengerTravelEdges:0,
 verifiedTransferEdges:0,verifiedBoardingEdges:0,enabledPassengerJourneys:0},
 nodes:{routes:[routeA,routeB,routeFar],stops:[makeStop(10,28.025,-26.16)]},
 edges:{spatialSupport:[
  {kind:'spatial-support-only',routeNodeId:routeA.id,stopNodeId:'metrobus:gis-stop:10',proximityMetresApprox:0,confirmedBoarding:false,confirmedTransfer:false,traversableByPassenger:false},
  {kind:'spatial-support-only',routeNodeId:routeB.id,stopNodeId:'metrobus:gis-stop:10',proximityMetresApprox:0,confirmedBoarding:false,confirmedTransfer:false,traversableByPassenger:false}],
  passengerTravel:[],verifiedTransfers:[],verifiedBoarding:[]}};
const clone=()=>structuredClone(graph);
test(validatePhase1GForDiagnostics(graph),'valid local graph');
const result=screenMetrobusGeometry(graph,a,b,300);
test(result.commonGeometryCandidates.length===0,'no invented common shape');
test(result.originOnlyGeometryCandidates.some(x=>x.routeCode==='A'),'origin A geometry');
test(result.destinationOnlyGeometryCandidates.some(x=>x.routeCode==='B'),'destination B geometry');
const diag=diagnoseMetrobusGeometry(graph,result,a,b,distanceToPolylineMetres,5);
test(diag.reasonCode==='different-shapes-near-endpoints','separate GIS proximity classification');
test(diag.nearestToOrigin[0].routeCode==='A','nearest origin found');
test(diag.nearestToDestination[0].routeCode==='B','nearest destination found');
test(diag.lowestJointProximityShapes.length===3,'joint diagnostic includes all shapes');
test(diag.coProximityWitnesses.length===1,'one same GIS point witness');
test(diag.coProximityWitnesses[0].stopGisObjectId===10,'original stop ID preserved');
test(diag.coProximityWitnesses[0].transferVerified===false&&diag.coProximityWitnesses[0].traversableByPassenger===false,'co-proximity is NOT a transfer');
test(diag.passengerRoutingEnabled===false&&diag.verifiedPassengerJourneys.length===0,'no passenger journeys');
const matched=screenMetrobusGeometry(graph,a,{lat:-26.17,lng:28.0},300);
const matchedDiag=diagnoseMetrobusGeometry(graph,matched,a,{lat:-26.17,lng:28.0},distanceToPolylineMetres,5);
test(matchedDiag.reasonCode==='same-shape-proximity-detected','known positive same geometry');
test(matchedDiag.coProximityWitnesses.length===0,'no transfer-style witnesses when common geometry exists');
const farA={lat:-26.4,lng:28.6},farB={lat:-26.42,lng:28.62};
const noNear=screenMetrobusGeometry(graph,farA,farB,300);
const noNearDiag=diagnoseMetrobusGeometry(graph,noNear,farA,farB,distanceToPolylineMetres,5);
test(noNearDiag.reasonCode==='no-shapes-near-either-endpoint','no proximity at either end');
test(noNearDiag.nearestToOrigin.length===3&&noNearDiag.nearestToDestination.length===3,'nearest route diagnostics remain available even with no hits');
const oneSide=screenMetrobusGeometry(graph,a,farB,300);
test(diagnoseMetrobusGeometry(graph,oneSide,a,farB,distanceToPolylineMetres,5).reasonCode==='no-shapes-near-destination','separate B-missing diagnosis');
const otherSide=screenMetrobusGeometry(graph,farA,b,300);
test(diagnoseMetrobusGeometry(graph,otherSide,farA,b,distanceToPolylineMetres,5).reasonCode==='no-shapes-near-origin','separate A-missing diagnosis');
{
 const bad=clone();bad.edges.passengerTravel.push({kind:'invented'});
 assert.throws(()=>validatePhase1GForDiagnostics(bad),/zero passenger/);passed++;
 assert.throws(()=>diagnoseMetrobusGeometry(bad,result,a,b,distanceToPolylineMetres),/validated/);passed++;
}
{
 const bad=clone();bad.metadata.licensingReviewRequired=false;
 assert.throws(()=>validatePhase1GForDiagnostics(bad),/Unsafe/);passed++;
}
{
 const bad=clone();bad.edges.spatialSupport[0].traversableByPassenger=true;
 assert.throws(()=>diagnoseMetrobusGeometry(bad,result,a,b,distanceToPolylineMetres),/Unexpected passenger-claim/);passed++;
}
{
 const bad=clone();bad.nodes.routes.pop();
 assert.throws(()=>validatePhase1GForDiagnostics(bad),/summary mismatch/);passed++;
}
assert.throws(()=>diagnoseMetrobusGeometry(graph,result,a,b,distanceToPolylineMetres,20),/validated/);passed++;
const temp=await mkdtemp(path.join(os.tmpdir(),'pulse-metrobus-1h-'));
const oldCwd=process.cwd();
try{
 process.chdir(temp);
 const graphPath=path.join(temp,'.local-dev/metrobus/phase1g/metrobus-evidence-graph.json');
 const outputRoot=path.join(temp,'.local-dev/metrobus/phase1h');
 await mkdir(path.dirname(graphPath),{recursive:true});
 const snapshot=clone();snapshot.nodes.routes[0].gisDescription='Route </script><script>alert(1)</script>';
 await writeFile(graphPath,JSON.stringify(snapshot));
 const outcome=await buildMetrobusDiagnostics({graphPath,outputRoot});
 test(outcome.qa.publicFilesModified===false&&outcome.qa.graphReadOnly===true,'local-only report');
 const html=await readFile(path.join(outputRoot,'metrobus-diagnostics.html'),'utf8');
 test(html.includes('nearest-geometry')||html.includes('nearest shape diagnostics'),'new HTML UI included');
 test(html.includes('function diagnoseMetrobusGeometry('),'tested engine embedded');
 test(!html.includes('__PULSE_METROBUS_'),'all placeholders replaced');
 test(!html.includes('</script><script>alert(1)</script>'),'HTML script escape prevents breakouts');
 const js=html.split('<script>')[1]?.split('</script>')[0];
 assert.ok(js);new vm.Script(js);passed++;
 const qa=JSON.parse(await readFile(path.join(outputRoot,'reports/qa.json'),'utf8'));
 test(qa.graphSummary.spatialSupportEdges===2&&qa.passengerRoutingEnabled===false,'saved QA retains zero verified edges');
 test((await readFile(graphPath,'utf8'))===JSON.stringify(snapshot),'source graph never modified');
 assert.throws(()=>validatePhase1GForDiagnostics({...snapshot,metadata:{...metadata,currentOperationVerified:true}}),/Unsafe/);passed++;
} finally {process.chdir(oldCwd);await rm(temp,{recursive:true,force:true});}
console.log(`PASS: ${passed} synthetic and end-to-end Phase 1H assertions`);
console.log('PASS: geometry diagnostics, no-hit reasons, shared-stop co-proximity NOT transfer, HTML parse/escape, local-only QA, zero passenger edges');
