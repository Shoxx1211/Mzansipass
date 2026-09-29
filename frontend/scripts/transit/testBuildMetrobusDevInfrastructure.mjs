import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMetrobusDevInfrastructure, runMetrobusDevInfrastructure } from './buildMetrobusDevInfrastructure.mjs';

const templatePath = fileURLToPath(new URL('./metrobusDevViewer.template.html', import.meta.url));
const r1 = { gisObjectId:1, gisName:'ROUTE 55',routeCodeFromName:'55',rawRouteIdField:60,routeIdDisagreesWithName:true,
  gisDescription:'GANDHI SQUARE TO MEREDALE', originLabel:'Gandhi Square',destinationLabel:'Meredale',
  gisPolylineLengthKm:7.8,segmentCount:1,extentWgs84:{west:28.01,east:28.02,south:-26.22,north:-26.21},
  geometry:{type:'MultiLineString',coordinates:[[[28.01,-26.22],[28.02,-26.21]]]},passengerRoutingEnabled:false};
const r2 = { gisObjectId:2,gisName:'ROUTE 63',routeCodeFromName:'63',rawRouteIdField:63,routeIdDisagreesWithName:false,
  gisDescription:'<script>alert(1)</script>',gisPolylineLengthKm:2,segmentCount:1,
  extentWgs84:{west:28.02,east:28.03,south:-26.22,north:-26.21},
  geometry:{type:'MultiLineString',coordinates:[[[28.02,-26.22],[28.03,-26.21]]]},passengerRoutingEnabled:false};
const fixture={
  routes:{metadata:{passengerRoutingEnabled:false},routes:[r1,r2]},
  stops:{metadata:{routeMembership:'unknown',passengerBoardingValidated:false},stops:[
    {gisObjectId:10,coordinate:{lng:28.015,lat:-26.215},locationDescription:'At Main St',passengerBoardingValidated:false,PHOTONAME:'SECRET_TEST_PHOTO_PATH'},
    {gisObjectId:11,coordinate:{lng:28.025,lat:-26.215},locationDescription:'At Market St',passengerBoardingValidated:false},
    {gisObjectId:12,coordinate:{lng:28.04,lat:-26.24},locationDescription:'Unscreened',passengerBoardingValidated:false},
  ]},
  candidates:{evidence:'spatial-support-only',thresholdMetres:75,notSuitableFor:['transfer edges'],candidates:[
    {routeGisObjectId:1,stopGisObjectId:10,proximityMetresApprox:4.2,evidence:'spatial-support-only',isPublishedStopMembership:false,isPassengerTransfer:false},
    {routeGisObjectId:2,stopGisObjectId:10,proximityMetresApprox:37,evidence:'spatial-support-only',isPublishedStopMembership:false,isPassengerTransfer:false},
    {routeGisObjectId:2,stopGisObjectId:11,proximityMetresApprox:0,evidence:'spatial-support-only',isPublishedStopMembership:false,isPassengerTransfer:false},
  ]},
  gisQa:{errors:[],policy:{passengerRoutingEnabled:false},routes:{gisFeatures:2},stops:{gisFeatures:3,validCoordinates:3},
    spatialSupport:{candidatePairs:3,stopsNearAtLeastOneGISRouteFeature:2,stopsNearMultipleGISRouteFeatures:1}},
  crosswalk:{metadata:{passengerRoutingEnabled:false,directionVerified:false,routeStopMembershipVerified:false,currentServiceVerified:false},
    summary:{gisFeatureCount:2,exactCodeOverlaps:1,gisNameVersusRawRouteIdDisagreements:1},gisRoutes:[
      {gisObjectId:1,routeCodeFromName:'55',rawRouteIdField:60,indexedInventory:{routeLabel:'Gandhi Square to Meredale'},
        passengerRoutingEnabled:false,routeStopMembershipVerified:false,currentServiceVerified:false,travelDirectionVerified:false},
      {gisObjectId:2,routeCodeFromName:'63',rawRouteIdField:63,indexedInventory:null,
        passengerRoutingEnabled:false,routeStopMembershipVerified:false,currentServiceVerified:false,travelDirectionVerified:false},
    ]},crosswalkQa:{errors:[]},
};
const clone=()=>structuredClone(fixture);
let n=0;
const ok=(condition,description)=>{assert.ok(condition,description);n++};
const {output,qa}=buildMetrobusDevInfrastructure(clone(),'2026-09-22T00:00:00.000Z');
ok(output.routes.length===2,'two GIS route geometries');
ok(output.stops.length===3,'three GIS stop coordinates');
ok(output.summary.candidateSpatialPairs===3,'three spatial-only candidate pairs');
ok(output.summary.stopsNearAnyShape===2,'two stops near GIS geometry');
ok(output.summary.stopsNearMultipleShapes===1,'one stop near multiple GIS shapes');
ok(output.summary.inventoryCodeMatches===1,'one partial indexed code overlap');
ok(output.summary.nameVersusRawIdDisagreements===1,'raw ROUTE_ID preserved and disagreement counted');
ok(output.routes[0].routeCodeFromName==='55'&&output.routes[0].rawRouteIdField===60,'published code not overwritten by raw GIS ID');
ok(output.routes[0].candidateStopCount===1 && output.routes[1].candidateStopCount===2,'per-route candidate counts');
ok(output.stops.find(s=>s.gisObjectId===10).candidateRouteCount===2,'candidate association count not transfer');
ok(output.summary.verifiedTransferEdges===0&&output.summary.verifiedBoardingEdges===0&&output.summary.selectablePassengerJourneys===0,'zero passenger graph edges');
ok(output.metadata.passengerRoutingEnabled===false&&output.metadata.licensingReviewRequired===true,'licensed-use and routing restrictions kept');
ok(qa.errors.length===0,'synthetic QA clean');
ok(!JSON.stringify(output).includes('SECRET_TEST_PHOTO_PATH'),'source photo paths not leaked');
{
 const f=clone();f.candidates.candidates[0].isPassengerTransfer=true;
 assert.throws(()=>buildMetrobusDevInfrastructure(f),/Invalid spatial-only candidate/);n++;
}
{
 const f=clone();f.candidates.candidates[0].isPublishedStopMembership=true;
 assert.throws(()=>buildMetrobusDevInfrastructure(f),/Invalid spatial-only candidate/);n++;
}
{
 const f=clone();f.candidates.candidates[0].stopGisObjectId=99;
 assert.throws(()=>buildMetrobusDevInfrastructure(f),/unknown GIS route or stop/);n++;
}
{
 const f=clone();f.candidates.candidates.push({...f.candidates.candidates[0]});f.gisQa.spatialSupport.candidatePairs=4;
 assert.throws(()=>buildMetrobusDevInfrastructure(f),/Duplicate spatial-support pair/);n++;
}
{
 const f=clone();f.gisQa.policy.passengerRoutingEnabled=true;
 assert.throws(()=>buildMetrobusDevInfrastructure(f),/disabled/);n++;
}
{
 const f=clone();f.routes.routes[0].geometry.coordinates[0][0]=[-118.25,34.2];
 assert.throws(()=>buildMetrobusDevInfrastructure(f),/invalid Gauteng WGS84/);n++;
}
{
 const f=clone();f.crosswalk.metadata.currentServiceVerified=true;
 assert.throws(()=>buildMetrobusDevInfrastructure(f),/unsupported service/);n++;
}
const temp=await mkdtemp(path.join(os.tmpdir(),'pulse-metrobus-1f-'));
try{
 const dataRoot=path.join(temp,'data'),out=path.join(temp,'.local-dev/metrobus');
 const names={routes:'gis-normalized/routes.json',stops:'gis-normalized/stops.json',candidates:'gis-normalized/spatial-stop-route-candidates.json',
  gisQa:'gis-normalized/reports/qa.json',crosswalk:'route-crosswalk/metrobus-route-crosswalk.json',crosswalkQa:'route-crosswalk/reports/qa.json'};
 for(const [key,rel] of Object.entries(names)){
   const file=path.join(dataRoot,rel);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,JSON.stringify(fixture[key]));
 }
 const built=await runMetrobusDevInfrastructure({dataRoot,outputRoot:out,templatePath});
 ok(built.qa.errors.length===0,'end-to-end QA clean');
 const viewer=await readFile(path.join(out,'metrobus-dev-viewer.html'),'utf8');
 ok(viewer.includes('City GIS geometry')&&!viewer.includes('__PULSE_METROBUS_DEV_DATA__'),'complete local viewer generated');
 ok(!viewer.includes('<script>alert(1)</script>')&&viewer.includes('\\u003cscript\\u003e'),'embedded source HTML escaped');
 ok(!viewer.includes('SECRET_TEST_PHOTO_PATH'),'no source photo filename in output viewer');
 const saved=JSON.parse(await readFile(path.join(out,'metrobus-dev-index.json'),'utf8'));
 ok(saved.summary.verifiedBoardingEdges===0&&saved.summary.verifiedTransferEdges===0,'saved data never claims verified passenger edges');
 const ignore=await readFile(path.join(temp,'.local-dev/.gitignore'),'utf8');
 ok(ignore.includes('*.')===false&&ignore.includes('!.gitignore'),'generated files ignored within local directory');
}finally{await rm(temp,{recursive:true,force:true})}
console.log(`\nPASS: ${n} synthetic and end-to-end Metrobus Phase 1F assertions`);
console.log('PASS: geometry, crosswalk reconciliation, spatial-only index, local offline viewer, HTML escaping, source photo privacy, zero passenger routing, rights review');
