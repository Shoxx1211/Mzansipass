/** Pure Phase 2A normalizer. Municipal GIS is infrastructure evidence, not live trips. */
const SOUTH_AFRICA = (p) => Array.isArray(p) && p.length >= 2 &&
  Number.isFinite(p[0]) && Number.isFinite(p[1]) &&
  p[0] >= 16 && p[0] <= 33 && p[1] >= -35 && p[1] <= -22;
const GAUTENG = (p) => SOUTH_AFRICA(p) && p[0] >= 26 && p[0] <= 30 && p[1] >= -28 && p[1] <= -24;
const configs = {
  irptn: {layerId:2,geometryType:'esriGeometryPolyline',authority:'City of Ekurhuleni'},
  stations: {layerId:13,geometryType:'esriGeometryPoint',authority:'City of Ekurhuleni'},
  railLines: {layerId:14,geometryType:'esriGeometryPolyline',authority:'City of Ekurhuleni'},
  joburgStations: {layerId:26,geometryType:'esriGeometryPoint',authority:'City of Johannesburg'},
};
const text = (v) => typeof v === 'string' ? v.trim().slice(0,180) : '';
function attributes(f) { return f?.attributes && typeof f.attributes === 'object' ? f.attributes : {}; }
function field(a,name) { const key=Object.keys(a).find(k=>k.toLowerCase()===name.toLowerCase());return key ? a[key] : null; }
function nameOf(a,kind,id) {
  const fields=kind==='irptn' ? ['ROUTE_NAME','ROUTE','NAME','DESCRIPTION'] :
    kind==='railLines' ? ['LINE_NAME','LINE','NAME','DESCRIPTION'] :
    ['STATION_NAME','STATION','STAT_NAME','NAME','STN_NAME'];
  for(const key of fields) { const v=text(field(a,key)); if(v)return v; }
  return `Unlabelled GIS ${kind} ${id}`;
}
function oidOf(a,snapshot) {
  const value = field(a,snapshot.objectIdField ?? 'OBJECTID') ?? field(a,'OBJECTID') ?? field(a,'FID');
  return Number.isSafeInteger(Number(value)) && Number(value)>0 ? Number(value):null;
}
function validLineGeometry(g){
  if (!g||!Array.isArray(g.paths))return null;
  const paths=[];
  for(const line of g.paths) {
    if (!Array.isArray(line)||line.length<2||!line.every(GAUTENG))return null;
    paths.push(line.map(([x,y])=>[x,y]));
  }
  return paths.length ? {type:'MultiLineString',coordinates:paths}:null;
}
function validPoint(g) { const xy=[g?.x,g?.y];return GAUTENG(xy)? {lat:g.y,lng:g.x}:null; }
export function normalizeEkurhuleniSnapshot(snapshot,kind) {
  const c=configs[kind]; if(!c)throw new Error(`Unknown kind ${kind}`);
  if(!snapshot||snapshot.source?.authority!==c.authority||snapshot.source?.layerId!==c.layerId||snapshot.geometryType!==c.geometryType||
     snapshot.spatialReference?.wkid!==4326||!Array.isArray(snapshot.features)||snapshot.featureCount!==snapshot.features.length) {
    throw new Error(`Source provenance, WGS84 or feature-count mismatch in ${kind}`);
  }
  const rows=[],issues=[],seen=new Set();
  for (let i=0;i<snapshot.features.length;i++){
    const f=snapshot.features[i],a=attributes(f),oid=oidOf(a,snapshot);
    if(oid===null||seen.has(oid)) { issues.push({index:i,reason:'missing-or-duplicate-objectid'});continue; }
    seen.add(oid);
    const geometry=c.geometryType==='esriGeometryPoint' ? validPoint(f.geometry) : validLineGeometry(f.geometry);
    if(!geometry){issues.push({objectId:oid,reason:'invalid-or-non-gauteng-coordinate'});continue;}
    const label=nameOf(a,kind,oid);
    rows.push({id:`${kind}:${oid}`,gisObjectId:oid,label,geometry,
      source:{authority:c.authority,layerId:c.layerId,sourceUrl:snapshot.source.url,
        retrievedAt:snapshot.source.retrievedAt,rightsStatus:'review-required'},
      evidenceStatus:kind==='irptn'?'municipal-irptn-corridor-unassigned-to-operator':
        kind==='railLines'?'municipal-railway-infrastructure-not-validated-service':
        'municipal-station-point-unassigned-to-current-service',
      currentOperationVerified:false,passengerRoutingEnabled:false});
  }
  rows.sort((a,b)=>a.gisObjectId-b.gisObjectId);
  return {kind,rows,report:{sourceCount:snapshot.featureCount,normalized:rows.length,invalid:issues.length,
    invalidSamples:issues.slice(0,20),missingLabels:rows.filter(r=>r.label.startsWith('Unlabelled GIS ')).length,
    currentOperatingServicesVerified:0,verifiedPassengerEdges:0,rightsStatus:'review-required'}};
}
const R=6371000,rad=x=>x*Math.PI/180;
export const greatCircleMetres=(a,b)=>{
  const dlat=rad(b.lat-a.lat),dlon=rad(b.lng-a.lng);
  const q=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlon/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(q)));
};
function segmentDistance(p,a,b){
  const scale=R*Math.cos(rad(p.lat)),px=rad(p.lng)*scale,py=rad(p.lat)*R;
  const ax=rad(a[0])*scale,ay=rad(a[1])*R,bx=rad(b[0])*scale,by=rad(b[1])*R;
  const dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy;
  const t=den ? Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/den)):0;
  return Math.hypot(px-(ax+t*dx),py-(ay+t*dy));
}
export function lineDistanceMetres(p,geometry){
  let closest=Infinity;
  for(const line of geometry?.coordinates??[])for(let j=1;j<line.length;j++)closest=Math.min(closest,segmentDistance(p,line[j-1],line[j]));
  return closest;
}
export function screenInfrastructure(normalized,origin,destination,radiusMetres=800){
  const point=p=>p&&GAUTENG([p.lng,p.lat]);
  if(!point(origin)||!point(destination)||!Number.isFinite(radiusMetres)||radiusMetres<100||radiusMetres>1500)
    throw new Error('Expected two Gauteng GPS coordinates and screening radius 100-1500 m');
  const irptnGeometryMatches=[];
  for(const r of normalized.irptnRoutes??[]){
    const from=lineDistanceMetres(origin,r.geometry),to=lineDistanceMetres(destination,r.geometry);
    if(from<=radiusMetres&&to<=radiusMetres)
      irptnGeometryMatches.push({gisObjectId:r.gisObjectId,label:r.label,originDistanceMetres:Math.round(from),destinationDistanceMetres:Math.round(to),status:'GIS geometry only'});
  }
  const stationNear=(p)=>[...(normalized.railwayStations??[]),...(normalized.joburgPrasaStations??[])]
    .map(s=>({gisObjectId:s.gisObjectId,label:s.label,source:s.source.authority,
      distanceMetres:Math.round(greatCircleMetres(p,s.geometry))}))
    .filter(s=>s.distanceMetres<=radiusMetres).sort((a,b)=>a.distanceMetres-b.distanceMetres).slice(0,5);
  irptnGeometryMatches.sort((a,b)=>a.originDistanceMetres+a.destinationDistanceMetres-b.originDistanceMetres-b.destinationDistanceMetres);
  return {irptnGeometryMatches:irptnGeometryMatches.slice(0,15),totalIrptnGeometryMatches:irptnGeometryMatches.length,
    originNearbyRailwayStations:stationNear(origin),destinationNearbyRailwayStations:stationNear(destination),
    verifiedPassengerEdges:0,verifiedTransferEdges:0,verifiedBoardingEdges:0,passengerRoutingEnabled:false,
    note:'Separate spatial proximity observations. Not a train ride, Harambee bus, municipal bus route, or transfer.'};
}
