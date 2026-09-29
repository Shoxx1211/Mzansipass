/** Pulse Phase 2B - geographic infrastructure evidence ONLY; never a passenger route graph. */
import { greatCircleMetres, lineDistanceMetres } from './ekurhuleniInfrastructureCore.mjs';

const okPoint=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&p.lat>=-28&&p.lat<=-24&&p.lng>=26&&p.lng<=30;
const okLine=g=>g?.type==='MultiLineString'&&Array.isArray(g.coordinates)&&g.coordinates.length>0&&
  g.coordinates.every(line=>Array.isArray(line)&&line.length>=2&&line.every(p=>Array.isArray(p)&&p.length===2&&
    Number.isFinite(p[0])&&Number.isFinite(p[1])&&p[0]>=26&&p[0]<=30&&p[1]>=-28&&p[1]<=-24));
const normName=s=>String(s??'').trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const label=s=>String(s??'').trim().slice(0,160);
const round=x=>Math.round(x);

export function buildRailAndCorridorEvidence(eku,harambee){
  if(!eku||eku.internalOnly!==true||eku.sourceRightsCleared!==false||eku.passengerRoutingEnabled!==false)
    throw Error('Unsafe or missing private Phase 2A input');
  for(const key of ['railwayStations','joburgPrasaStations','railwayLines','irptnRoutes'])
    if(!Array.isArray(eku[key]))throw Error(`Missing normalized Phase 2A ${key}`);
  if(!eku.railwayStations.length||!eku.railwayLines.length||!eku.irptnRoutes.length)
    throw Error('Incomplete Phase 2A railway or corridor geography');
  const allStations=[
    ...eku.railwayStations.map(s=>({...s,municipality:'Ekurhuleni'})),
    ...eku.joburgPrasaStations.map(s=>({...s,municipality:'Johannesburg'}))
  ];
  const ids=new Set();
  for(const s of allStations){
    if(!okPoint(s.geometry)||!s.id||ids.has(s.id))throw Error(`Invalid or duplicate station id ${s?.id}`);
    ids.add(s.id);
  }
  for(const l of [...eku.railwayLines,...eku.irptnRoutes])
    if(!l.id||!okLine(l.geometry))throw Error(`Invalid line geometry ${l?.id}`);
  const lineAssociations=allStations.map(s=>{
    const near=eku.railwayLines.map(l=>({
      lineId:l.id,lineObjectId:l.gisObjectId,lineLabel:label(l.label),
      distanceMetres:round(lineDistanceMetres(s.geometry,l.geometry))
    })).sort((a,b)=>a.distanceMetres-b.distanceMetres);
    return {stationId:s.id,stationLabel:label(s.label),municipality:s.municipality,
      lat:s.geometry.lat,lng:s.geometry.lng,
      nearestLines:near.slice(0,3),
      lineCandidates250m:near.filter(x=>x.distanceMetres<=250).length,
      lineCandidates500m:near.filter(x=>x.distanceMetres<=500).length,
      evidenceStatus:'point-near-track-infrastructure-only',
      isVerifiedServiceStop:false};
  });
  const possibleCrossCityDuplicates=[];
  for(const a of eku.railwayStations)for(const b of eku.joburgPrasaStations){
    const d=greatCircleMetres(a.geometry,b.geometry),sameName=normName(a.label)&&normName(a.label)===normName(b.label);
    // Geographically overlapping municipal observations are review candidates only.
    if(d<=70||(sameName&&d<=350)){
      possibleCrossCityDuplicates.push({ekurhuleniStationId:a.id,johannesburgStationId:b.id,
        ekurhuleniLabel:label(a.label),johannesburgLabel:label(b.label),distanceMetres:round(d),
        sameNormalizedName:!!sameName,automaticMerge:false});
    }
  }
  possibleCrossCityDuplicates.sort((a,b)=>a.distanceMetres-b.distanceMetres);
  const corridorStationPairs=[];
  const corridorInventory=[];
  for(const c of eku.irptnRoutes){
    let segmentCount=0;
    for(const line of c.geometry.coordinates)segmentCount+=line.length-1;
    corridorInventory.push({corridorId:c.id,gisObjectId:c.gisObjectId,label:label(c.label),segmentCount,
      operatorAssignment:'unverified',currentService:'unverified'});
    for(const s of allStations){
      const d=lineDistanceMetres(s.geometry,c.geometry);
      if(d<=500)corridorStationPairs.push({corridorId:c.id,stationId:s.id,
        stationMunicipality:s.municipality,stationLabel:label(s.label),distanceMetres:round(d),
        connectionStatus:'spatial-only-not-interchange'});
    }
  }
  corridorStationPairs.sort((a,b)=>a.distanceMetres-b.distanceMetres);
  const serviceLabels=Array.isArray(harambee?.currentServiceNamesVisibleOnOfficialTimetablePage)?
    harambee.currentServiceNamesVisibleOnOfficialTimetablePage.map(label).filter(Boolean):[];
  const lineNear250=lineAssociations.filter(s=>s.lineCandidates250m>0).length;
  const lineNear500=lineAssociations.filter(s=>s.lineCandidates500m>0).length;
  const summary={
    ekurhuleniRailStationPoints:eku.railwayStations.length,
    johannesburgPrasaStationPoints:eku.joburgPrasaStations.length,
    combinedStationObservations:allStations.length,
    municipalRailwayLineShapes:eku.railwayLines.length,
    municipalIrptnCorridors:eku.irptnRoutes.length,
    stationObservationsWithin250mOfMappedRail:lineNear250,
    stationObservationsWithin500mOfMappedRail:lineNear500,
    possibleCrossCityStationDuplicates:possibleCrossCityDuplicates.length,
    corridorStationSpatialCandidates500m:corridorStationPairs.length,
    harambeePublishedServiceHeadings:serviceLabels.length,
    validatedHarambeeCorridorLinks:0,validatedPrasaStoppingPatterns:0,
    passengerTravelEdges:0,boardingEdges:0,transferEdges:0
  };
  return {schemaVersion:1,internalOnly:true,rightsStatus:'review-required',
    passengerRoutingEnabled:false,serviceAssignmentsVerified:false,source:'normalized Phase 2A municipal GIS',
    generatedAt:new Date().toISOString(),summary,
    serviceLabels:serviceLabels.map(name=>({name,source:harambee.officialTimetablePage,
      corridorAssignmentVerified:false,timetableParsed:false})),
    corridorInventory,lineAssociations,possibleCrossCityDuplicates,corridorStationPairs,
    warning:'Rail line proximity does not prove train service, a stopping pattern, boarding, or transfer. IRPTN line proximity does not establish Harambee service.'};
}

export function screenRailCorridorEvidence(eku,index,origin,destination,radiusMetres=800){
  if(index?.internalOnly!==true||index?.passengerRoutingEnabled!==false||!okPoint(origin)||!okPoint(destination)||
     !Number.isFinite(radiusMetres)||radiusMetres<100||radiusMetres>1500)throw Error('Invalid private index or point/radius');
  const stationNearby=p=>index.lineAssociations.map(s=>({
    stationId:s.stationId,label:s.stationLabel,municipality:s.municipality,
    distanceMetres:round(greatCircleMetres(p,{lat:s.lat,lng:s.lng})),
    mappedRailLinesWithin250m:s.lineCandidates250m
  })).filter(x=>x.distanceMetres<=radiusMetres).sort((a,b)=>a.distanceMetres-b.distanceMetres).slice(0,10);
  const corridors=[];
  for(const c of eku.irptnRoutes){
    const a=lineDistanceMetres(origin,c.geometry),b=lineDistanceMetres(destination,c.geometry);
    if(a<=radiusMetres&&b<=radiusMetres)corridors.push({corridorId:c.id,corridorLabel:c.label,
      originDistanceMetres:round(a),destinationDistanceMetres:round(b),harambeeRouteVerified:false,selectable:false});
  }
  return {originNearbyRailStationObservations:stationNearby(origin),destinationNearbyRailStationObservations:stationNearby(destination),
    sharedIrptnGeometry:corridors,railRideVerified:false,passengerRoutingEnabled:false,
    verifiedPassengerEdges:0,fare:null,etaMinutes:null};
}
