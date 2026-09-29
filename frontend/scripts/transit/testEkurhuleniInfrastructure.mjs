import assert from 'node:assert/strict';
import {normalizeEkurhuleniSnapshot,screenInfrastructure,lineDistanceMetres} from './ekurhuleniInfrastructureCore.mjs';
import {screenUnifiedCoverage} from '../../src/services/unifiedCoverageCore.mjs';
const shape=(id,kind,features,authority='City of Ekurhuleni')=>({
 source:{authority,layerId:id,url:'https://example.invalid/gis',retrievedAt:'2026-09-23T08:00:00Z'},
 geometryType:kind,spatialReference:{wkid:4326},objectIdField:'OBJECTID',
 featureCount:features.length,features});
const routeFeature={attributes:{OBJECTID:4,NAME:'Infrastructure corridor 4'},
 geometry:{paths:[[[28.2,-26.1],[28.201,-26.101],[28.203,-26.103]]]}};
const stationFeature={attributes:{OBJECTID:5,NAME:'Synthetic rail station'},geometry:{x:28.2001,y:-26.1001}};
const irptn=normalizeEkurhuleniSnapshot(shape(2,'esriGeometryPolyline',[routeFeature]),'irptn');
const stations=normalizeEkurhuleniSnapshot(shape(13,'esriGeometryPoint',[stationFeature]),'stations');
const lines=normalizeEkurhuleniSnapshot(shape(14,'esriGeometryPolyline',[routeFeature]),'railLines');
const jStations=normalizeEkurhuleniSnapshot(shape(26,'esriGeometryPoint',[stationFeature],'City of Johannesburg'),'joburgStations');
assert.equal(irptn.rows.length,1);assert.equal(stations.rows.length,1);assert.equal(lines.rows.length,1);assert.equal(jStations.rows.length,1);
assert.equal(irptn.rows[0].passengerRoutingEnabled,false);
assert.equal(irptn.rows[0].evidenceStatus,'municipal-irptn-corridor-unassigned-to-operator');
assert.equal(lineDistanceMetres({lat:-26.1,lng:28.2},irptn.rows[0].geometry),0);
const invalid=normalizeEkurhuleniSnapshot(shape(13,'esriGeometryPoint',[
 {attributes:{OBJECTID:6,NAME:'Bad US feature'},geometry:{x:-98,y:31}},
 {attributes:{OBJECTID:7,NAME:'Bad projected feature'},geometry:{x:3110000,y:-3000000}}]),'stations');
assert.equal(invalid.report.invalid,2);assert.equal(invalid.rows.length,0);
assert.throws(()=>normalizeEkurhuleniSnapshot({...shape(2,'esriGeometryPolyline',[routeFeature]),spatialReference:{wkid:3857}},'irptn'),/mismatch/);
assert.throws(()=>normalizeEkurhuleniSnapshot(shape(2,'esriGeometryPolyline',[routeFeature]),'railLines'),/mismatch/);
const doc={irptnRoutes:irptn.rows,railwayStations:stations.rows,railwayLines:lines.rows,joburgPrasaStations:[]};
const result=screenInfrastructure(doc,{lat:-26.1,lng:28.2},{lat:-26.103,lng:28.203});
assert.equal(result.totalIrptnGeometryMatches,1);assert.equal(result.verifiedPassengerEdges,0);
assert.equal(result.verifiedTransferEdges,0);assert.equal(result.passengerRoutingEnabled,false);
assert.equal(result.originNearbyRailwayStations.length,1);
assert.throws(()=>screenInfrastructure(doc,{lat:31,lng:-99},{lat:-26.103,lng:28.203}),/Gauteng/);
const unified={internalOnly:true,passengerRoutingEnabled:false,
 geometryRoutes:[{id:'eku:4',operatorId:'ekurhuleni-irptn',code:'GIS-4',name:'Corridor 4',geometry:irptn.rows[0].geometry}],
 railServices:[],sourceStats:{}};
const publicRule=screenUnifiedCoverage(unified,{lat:-26.1,lng:28.2},{lat:-26.103,lng:28.203});
assert.equal(publicRule.shapeMatches[0].selectable,false);
assert.equal(publicRule.shapeMatches[0].fare,null);
assert.equal(publicRule.shapeMatches[0].etaMinutes,null);
assert.equal(publicRule.verifiedPassengerEdges,0);
console.log('PASS: Phase 2A synthetic GIS normalization, WGS84 validation, invalid region rejection, integrity, private unified screening, zero passenger edges.');
