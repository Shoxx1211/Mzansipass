import assert from 'node:assert/strict';
import {buildCoverageIndex,screenCoverage,pointPairFromLine,geometryDistance,haversineMetres,validateEvidence} from './gautengPhase2DCore.mjs';
let tests=0;const check=(value,expected)=>{assert.deepEqual(value,expected);tests++};
const line={type:'MultiLineString',coordinates:[[[28.0,-26.2],[28.01,-26.2],[28.02,-26.2]]]};
const point=(lat,lng)=>({lat,lng});
const route={id:'metro:1',operatorId:'metrobus',code:'55',name:'Fixture',source:'Synthetic',geometry:line,passengerRoutingEnabled:false};
const station=(id,lat,lng)=>({id,label:id,geometry:point(lat,lng)});
const base={internalOnly:true,passengerRoutingEnabled:false,geometryRoutes:[route],railServices:[{name:'Rail membership only',membershipVerified:true,
 stations:[{id:'park',name:'Park',lat:-26.2,lng:28.0},{id:'rosebank',name:'Rosebank',lat:-26.2,lng:28.02}]}]};
const phase={internalOnly:true,sourceRightsCleared:false,passengerRoutingEnabled:false,joburgRailLines:[{id:'line1',geometry:line}],
 gmsGroups:[{number:1,routes:[{id:'gms:1',gisObjectId:1,label:'Unknown GIS route',geometry:line}],
 stops:[station('stop:1',-26.2,28.005)]}]};
const eku={internalOnly:true,sourceRightsCleared:false,passengerRoutingEnabled:false,railwayStations:[station('eku:1',-26.2,28.002)],
 joburgPrasaStations:[station('jhb:1',-26.2,28.019)],railwayLines:[{id:'track1',geometry:line}]};
validateEvidence(base,phase,eku);tests++;
const index=buildCoverageIndex(base,phase,eku);
check(index.routeShapes.length,2);check(index.railStations.length,2);check(index.railTrackShapes.length,2);
check(index.routeShapes[1].operatorId,'ekurhuleni-gms-unassigned');check(index.routeShapes[1].operatorAssignmentVerified,false);
check(index.passengerEdges,0);check(index.boardingEdges,0);check(index.transferEdges,0);
const a=point(-26.2,28.001),b=point(-26.2,28.018);
check(Math.round(geometryDistance(a,line)),0);check(pointPairFromLine(route).length,2);
const result=screenCoverage(index,a,b,800);
check(result.sameShapeCount,2);check(result.nearestByOperator.metrobus.origin.metres,0);
check(result.nearestByOperator['ekurhuleni-gms-unassigned'].destination.metres,0);
check(result.nearestRailStations.origin.length,2);check(result.gautrainServiceMembership.length,1);
check(result.passengerRoutingEnabled,false);check(result.estimatedFare,null);check(result.estimatedMinutes,null);
const negative=screenCoverage(index,point(-24.5,29.5),point(-24.6,29.6));
check(negative.sameShapeCount,0);check(negative.infrastructureStatus,'no-common-geometry');
assert.throws(()=>screenCoverage({...index,sourceRightsCleared:true},a,b),/Invalid private/);tests++;
assert.throws(()=>screenCoverage(index,a,b,2000),/Invalid private/);tests++;
assert.throws(()=>buildCoverageIndex({...base,passengerRoutingEnabled:true},phase,eku),/Missing Phase/);tests++;
assert.throws(()=>buildCoverageIndex(base,{...phase,sourceRightsCleared:true},eku),/Missing Phase/);tests++;
assert.throws(()=>buildCoverageIndex(base,phase,{...eku,internalOnly:false}),/Missing Phase/);tests++;
assert.throws(()=>buildCoverageIndex({...base,geometryRoutes:[route,route]},phase,eku),/duplicate/);tests++;
check(index.routeShapes.every(s=>s.passengerRoutingEnabled===false),true);
check(result.sameShapeTop.every(s=>s.selectable===false),true);
check(haversineMetres(point(-26.2,28),point(-26.2,28)),0);
console.log(`PASS: ${tests} synthetic Phase 2D assertions: unified geometry, evidence boundaries, GMS unassigned, published Gautrain membership and zero passenger edges.`);
