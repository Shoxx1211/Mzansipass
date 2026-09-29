/** Phase 2C: City GIS infrastructure research, NOT a passenger travel graph. */
import {lineDistanceMetres} from './ekurhuleniInfrastructureCore.mjs';

const POINT = p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&p[0]>=26&&p[0]<=30&&p[1]>=-28&&p[1]<=-24;
const string = x=>String(x??'').trim().slice(0,180);
const norm=s=>string(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function get(a,k){return Object.entries(a??{}).find(([key])=>key.toLowerCase()===k.toLowerCase())?.[1]??null;}
export function normalizeSnapshot(snapshot,{authority,layerId,type,sourceName}){
  if(snapshot?.source?.authority!==authority||snapshot.source.layerId!==layerId||snapshot.geometryType!==type||
     snapshot.spatialReference?.wkid!==4326||!Array.isArray(snapshot.features)||snapshot.features.length!==snapshot.featureCount)
    throw Error(`Invalid source snapshot or spatial reference: ${sourceName}`);
  const items=[],rejected=[],seen=new Set();
  for(const [ix,f] of snapshot.features.entries()){
    const a=f?.attributes??{};
    const oid=Number(get(a,snapshot.objectIdField??'OBJECTID'));
    if(!Number.isSafeInteger(oid)||oid<0||seen.has(oid)){rejected.push({index:ix,reason:'bad-or-duplicate-objectid'});continue;}
    seen.add(oid);
    let geometry=null;
    if(type==='esriGeometryPoint'){
      const xy=[f?.geometry?.x,f?.geometry?.y];
      if(POINT(xy))geometry={lat:xy[1],lng:xy[0]};
    }else{
      const paths=f?.geometry?.paths;
      if(Array.isArray(paths)&&paths.length&&paths.every(p=>Array.isArray(p)&&p.length>=2&&p.every(POINT)))
        geometry={type:'MultiLineString',coordinates:paths.map(part=>part.map(([lng,lat])=>[lng,lat]))};
    }
    if(!geometry){rejected.push({index:ix,objectId:oid,reason:'invalid-Gauteng-WGS84-geometry'});continue;}
    let label='';
    for(const k of ['STATION_NAME','STATION','NAME','ROUTE','DESCRIPTION','LINE_NAME','LINE','TAG']){
      const v=get(a,k);
      if(typeof v==='string'&&v.trim()){label=string(v);break;}
    }
    items.push({id:`${sourceName}:${oid}`,gisObjectId:oid,label,geometry,source:{authority,layerId,url:snapshot.source.url,
      retrievedAt:snapshot.source.retrievedAt,rightsStatus:'review-required'},
      liveServiceVerified:false,passengerRoutingEnabled:false});
  }
  items.sort((a,b)=>a.gisObjectId-b.gisObjectId);
  return {items,report:{sourceFeatures:snapshot.featureCount,validFeatures:items.length,rejectedFeatures:rejected.length,
    rejectedSamples:rejected.slice(0,12),rightsStatus:'review-required'}};
}

// GIS publisher paired these numbered layers. It does NOT guarantee current operator service,
// travel direction, point order, fare, timetable, or even that every point is a boarding stop today.
export function buildNamedGisRoutePairs(groups){
  if(!Array.isArray(groups))throw Error('Route/stop group list expected');
  const seen=new Set();
  return groups.map(g=>{
    const n=Number(g.number);
    if(!Number.isInteger(n)||n<1||n>7||seen.has(n))throw Error('Invalid/duplicate route group number');
    seen.add(n);
    const lines=g.routes??[],stops=g.stops??[];
    return {group:`GMS Route ${n}`,publisher:'City of Ekurhuleni',
      routeLayerId:g.routeLayerId,stopLayerId:g.stopLayerId,
      routeGeometryFeatures:lines.length,stopPointFeatures:stops.length,
      routeGisFeatureIds:lines.map(r=>r.id),stopGisFeatureIds:stops.map(s=>s.id),
      sameNamedSourceLayerPair:!!(g.routeAvailable&&g.stopAvailable),
      operatorAssignment:'unverified-not-equated-to-Harambee',
      liveOperation:'unverified',stopOrder:'unverified',travelDirection:'unverified',
      gisLayerPairEvidenceOnly:true,passengerRoutingEnabled:false};
  });
}

export function buildCrossCityRailEvidence(eku,joburgLines){
  if(eku?.internalOnly!==true||eku?.passengerRoutingEnabled!==false||!Array.isArray(eku.railwayLines)||
     !Array.isArray(eku.railwayStations)||!Array.isArray(eku.joburgPrasaStations)||!joburgLines?.length)
    throw Error('Missing/unsafe rail inputs');
  function screen(stations,lines,municipality){
    return stations.map(s=>{
      const closest=lines.map(l=>({lineId:l.id,distanceMetres:Math.round(lineDistanceMetres(s.geometry,l.geometry))})).sort((a,b)=>a.distanceMetres-b.distanceMetres)[0];
      if(!closest||!Number.isFinite(closest.distanceMetres))throw Error('Invalid rail/station geometry');
      return {stationId:s.id,stationLabel:string(s.label),municipality,
        nearestSameMunicipalityLine:closest,
        within250m:closest.distanceMetres<=250,within500m:closest.distanceMetres<=500,
        status:'station-near-track-not-train-service',passengerRoutingEnabled:false};
    });
  }
  const e=screen(eku.railwayStations,eku.railwayLines,'Ekurhuleni');
  const j=screen(eku.joburgPrasaStations,joburgLines,'Johannesburg');
  const summarize=(arr)=>({stations:arr.length,within250m:arr.filter(s=>s.within250m).length,within500m:arr.filter(s=>s.within500m).length,
    over500m:arr.filter(s=>!s.within500m).length});
  return {ekurhuleni:e,johannesburg:j,summary:{ekurhuleni:summarize(e),johannesburg:summarize(j),
      totalStationObservations:e.length+j.length,joburgRailLineShapes:joburgLines.length,
      verifiedPassengerEdges:0,verifiedStoppingPatterns:0},
    note:'Only compare station points with mapped tracks from their own municipality; do not mistake the Phase 2B cross-municipal gap for missing stations.'};
}
