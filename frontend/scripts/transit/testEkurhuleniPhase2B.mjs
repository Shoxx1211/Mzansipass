import assert from 'node:assert/strict';
import {buildRailAndCorridorEvidence,screenRailCorridorEvidence} from './ekurhuleniRailEvidenceCore.mjs';
const point=(id,label,lng,lat)=>({id,label,gisObjectId:Number(id.slice(1)),geometry:{lng,lat}});
const line=(id,label,coords)=>({id,label,gisObjectId:Number(id.slice(1)),geometry:{type:'MultiLineString',coordinates:[coords]}});
const fixtures={internalOnly:true,sourceRightsCleared:false,passengerRoutingEnabled:false,
  railwayStations:[point('e1','Alpha',28,-26.1),point('e2','Beta',28.1,-26.2)],
  joburgPrasaStations:[point('j1','Alpha',28.0002,-26.1001)],
  railwayLines:[line('l1','Rail segment A',[[27.99,-26.1],[28.02,-26.1]]),line('l2','Rail segment B',[[28.09,-26.2],[28.11,-26.2]])],
  irptnRoutes:[line('c1','IRPTN physical corridor',[[28,-26.1],[28.1,-26.2]])]};
const published={officialTimetablePage:'https://www.harambeebrt.co.za/timetable/',
  currentServiceNamesVisibleOnOfficialTimetablePage:['Airport','Isando','Bartlett']};
const index=buildRailAndCorridorEvidence(fixtures,published),s=index.summary;
assert.equal(s.combinedStationObservations,3);
assert.equal(s.municipalRailwayLineShapes,2);
assert.equal(s.stationObservationsWithin250mOfMappedRail,3);
assert.equal(s.possibleCrossCityStationDuplicates,1);
assert.equal(index.possibleCrossCityDuplicates[0].automaticMerge,false);
assert.equal(s.municipalIrptnCorridors,1);
assert.equal(s.harambeePublishedServiceHeadings,3);
assert.equal(s.validatedHarambeeCorridorLinks,0);
assert.equal(s.validatedPrasaStoppingPatterns,0);
assert.equal(s.passengerTravelEdges,0);
assert.equal(s.boardingEdges,0);
assert.equal(s.transferEdges,0);
assert.equal(index.lineAssociations[0].isVerifiedServiceStop,false);
assert.equal(index.corridorStationPairs[0].connectionStatus,'spatial-only-not-interchange');
const result=screenRailCorridorEvidence(fixtures,index,{lat:-26.1,lng:28},{lat:-26.2,lng:28.1},800);
assert.equal(result.sharedIrptnGeometry.length,1);
assert.equal(result.verifiedPassengerEdges,0);
assert.equal(result.sharedIrptnGeometry[0].selectable,false);
assert.equal(result.fare,null);
assert.equal(result.etaMinutes,null);
assert.throws(()=>buildRailAndCorridorEvidence({...fixtures,internalOnly:false},published));
assert.throws(()=>buildRailAndCorridorEvidence({...fixtures,passengerRoutingEnabled:true},published));
assert.throws(()=>screenRailCorridorEvidence(fixtures,index,{lat:0,lng:0},{lat:-26,lng:28},800));
console.log('PASS: 22 Phase 2B synthetic integrity and safety assertions.');
console.log('PASS: station-to-line proximity, duplicate review, corridor proximity, source separation and zero passenger edges.');
