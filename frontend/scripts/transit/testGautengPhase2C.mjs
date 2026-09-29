import assert from 'node:assert/strict';
import {normalizeSnapshot,buildNamedGisRoutePairs,buildCrossCityRailEvidence} from './gautengPhase2CCore.mjs';
const src=(authority,layerId,geometryType,features,objectIdField='OBJECTID')=>({
  source:{authority,layerId,url:'https://official.example/gis',retrievedAt:'2026-09-23T08:00:00Z'},
  geometryType,spatialReference:{wkid:4326},objectIdField,featureCount:features.length,features});
const P=(oid,name,x,y)=>({attributes:{OBJECTID:oid,NAME:name},geometry:{x,y}});
const L=(oid,name,x,y)=>({attributes:{OBJECTID:oid,NAME:name},geometry:{paths:[[[x,y],[x+.01,y+.005]]]}});
let n=0;const test=(name,fn)=>{fn();n++;};
const job=src('City of Johannesburg',27,'esriGeometryPolyline',[L(1,'PRASA Rail track',28.05,-26.2)]);
const gRoute=src('City of Ekurhuleni',114,'esriGeometryPolyline',[L(1,'ROUTE 1',28.05,-26.2)]);
const gStop=src('City of Ekurhuleni',115,'esriGeometryPoint',[P(1,'Stop 1',28.05,-26.2)]);
const args=(authority,layerId,type,sourceName)=>({authority,layerId,type,sourceName});
const rail=normalizeSnapshot(job,args('City of Johannesburg',27,'esriGeometryPolyline','joburg-prasa-track'));
const route=normalizeSnapshot(gRoute,args('City of Ekurhuleni',114,'esriGeometryPolyline','gms-route-1'));
const stop=normalizeSnapshot(gStop,args('City of Ekurhuleni',115,'esriGeometryPoint','gms-route-1-stops'));
test('1 correct PRASA GIS normalization',()=>assert.equal(rail.items.length,1));
test('2 GIS layer attribution preserved',()=>assert.equal(rail.items[0].source.layerId,27));
test('3 current train service unverified',()=>assert.equal(rail.items[0].liveServiceVerified,false));
test('4 route source normalizes',()=>assert.equal(route.items.length,1));
test('5 stop source normalizes',()=>assert.equal(stop.items.length,1));
test('6 geometry converted WGS84',()=>assert.equal(route.items[0].geometry.type,'MultiLineString'));
test('7 latitude longitude converted',()=>assert.deepEqual(stop.items[0].geometry,{lat:-26.2,lng:28.05}));
test('8 wrong source rejected',()=>assert.throws(()=>normalizeSnapshot({...job,source:{...job.source,authority:'USA'}},args('City of Johannesburg',27,'esriGeometryPolyline','joburg-prasa-track'))));
test('9 wrong layer rejected',()=>assert.throws(()=>normalizeSnapshot(job,args('City of Johannesburg',26,'esriGeometryPolyline','joburg-prasa-track'))));
test('10 wrong CRS rejected',()=>assert.throws(()=>normalizeSnapshot({...job,spatialReference:{wkid:3857}},args('City of Johannesburg',27,'esriGeometryPolyline','joburg-prasa-track'))));
test('11 wrong feature count rejected',()=>assert.throws(()=>normalizeSnapshot({...job,featureCount:2},args('City of Johannesburg',27,'esriGeometryPolyline','joburg-prasa-track'))));
const bad=src('City of Ekurhuleni',115,'esriGeometryPoint',[P(1,'US',-118,34)]);
test('12 reject other-continent coordinates',()=>assert.equal(normalizeSnapshot(bad,args('City of Ekurhuleni',115,'esriGeometryPoint','gms-route-1-stops')).report.rejectedFeatures,1));
const dupe=src('City of Ekurhuleni',115,'esriGeometryPoint',[P(1,'A',28,-26),P(1,'B',28.1,-26.1)]);
test('13 reject duplicate object ids',()=>assert.equal(normalizeSnapshot(dupe,args('City of Ekurhuleni',115,'esriGeometryPoint','gms-route-1-stops')).report.rejectedFeatures,1));
const pairs=buildNamedGisRoutePairs([{number:1,routeLayerId:114,stopLayerId:115,
  routeAvailable:true,stopAvailable:true,routes:route.items,stops:stop.items},
  {number:2,routeLayerId:116,stopLayerId:117,routeAvailable:true,stopAvailable:false,routes:route.items,stops:[]}]);
test('14 pair route layer, stop layer',()=>assert.equal(pairs[0].sameNamedSourceLayerPair,true));
test('15 missing stop layer explicit',()=>assert.equal(pairs[1].sameNamedSourceLayerPair,false));
test('16 no inferred Harambee match',()=>assert.equal(pairs[0].operatorAssignment,'unverified-not-equated-to-Harambee'));
test('17 no stop order guessed',()=>assert.equal(pairs[0].stopOrder,'unverified'));
test('18 zero routing',()=>assert.equal(pairs[0].passengerRoutingEnabled,false));
test('19 reject duplicate group number',()=>assert.throws(()=>buildNamedGisRoutePairs([{number:1},{number:1}])));
test('20 reject unsupported group number',()=>assert.throws(()=>buildNamedGisRoutePairs([{number:10}])));
const eku={internalOnly:true,passengerRoutingEnabled:false,
 railwayLines:[{id:'eku-track:1',geometry:{type:'MultiLineString',coordinates:[[[28.05,-26.2],[28.06,-26.195]]]}}],
 railwayStations:[{id:'eku-station:1',label:'Eku Station',geometry:{lat:-26.2,lng:28.05}}],
 joburgPrasaStations:[{id:'joburg:1',label:'Joburg Station',geometry:{lat:-26.2,lng:28.05}}]};
const bridge=buildCrossCityRailEvidence(eku,rail.items);
test('21 own municipal Eku match',()=>assert.equal(bridge.summary.ekurhuleni.within250m,1));
test('22 own municipal Joburg match',()=>assert.equal(bridge.summary.johannesburg.within250m,1));
test('23 two station observations',()=>assert.equal(bridge.summary.totalStationObservations,2));
test('24 PRASA timetable not guessed',()=>assert.equal(bridge.summary.verifiedStoppingPatterns,0));
test('25 no travel edges',()=>assert.equal(bridge.summary.verifiedPassengerEdges,0));
test('26 invalid or unsafe Phase2A rejected',()=>assert.throws(()=>buildCrossCityRailEvidence({...eku,passengerRoutingEnabled:true},rail.items)));
test('27 no Joburg tracks rejected',()=>assert.throws(()=>buildCrossCityRailEvidence(eku,[])));
test('28 no automatic station merge',()=>assert.equal(bridge.ekurhuleni[0].stationId,'eku-station:1'));
test('29 track is infrastructure only',()=>assert.equal(bridge.johannesburg[0].status,'station-near-track-not-train-service'));
test('30 GMS route code not converted to operator',()=>assert.notEqual(pairs[0].operatorAssignment,'verified'));
console.log(`PASS: ${n} Phase 2C synthetic rail and GIS-route integrity assertions`);
console.log('PASS: regional track matching, named GIS layer pairs, incomplete optional sources, no fabricated operator trips');
