/** Phase 2D: private, evidence-only Gauteng network coverage. Not a passenger router. */
const R=6371000, rad=x=>x*Math.PI/180;
const isPoint=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&p.lat>=-35&&p.lat<=-22&&p.lng>=16&&p.lng<=33;
export function haversineMetres(a,b){
 if(!isPoint(a)||!isPoint(b))throw Error('Invalid South African WGS84 point');
 const dp=rad(b.lat-a.lat),dl=rad(b.lng-a.lng),q=Math.sin(dp/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dl/2)**2;
 return 2*R*Math.asin(Math.min(1,Math.sqrt(q)));
}
function segmentDistance(p,a,b){
 const sc=R*Math.cos(rad(p.lat)),px=rad(p.lng)*sc,py=rad(p.lat)*R;
 const ax=rad(a[0])*sc,ay=rad(a[1])*R,bx=rad(b[0])*sc,by=rad(b[1])*R;
 const dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy;
 const t=den?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/den)):0;
 return Math.hypot(px-ax-t*dx,py-ay-t*dy);
}
export function geometryDistance(p,g){
 if(!isPoint(p)||g?.type!=='MultiLineString'||!Array.isArray(g.coordinates))throw Error('Invalid geometry query');
 let d=Infinity;
 for(const line of g.coordinates)for(let k=1;k<line.length;k++){
  const a=line[k-1],b=line[k];
  if(![a?.[0],a?.[1],b?.[0],b?.[1]].every(Number.isFinite))throw Error('Invalid geometry coordinate');
  d=Math.min(d,segmentDistance(p,a,b));
 }
 return d;
}
export function validateEvidence(runtime,phase2c,eku){
 if(runtime?.internalOnly!==true||runtime?.passengerRoutingEnabled!==false||
    phase2c?.internalOnly!==true||phase2c?.sourceRightsCleared!==false||phase2c?.passengerRoutingEnabled!==false||
    eku?.internalOnly!==true||eku?.sourceRightsCleared!==false||eku?.passengerRoutingEnabled!==false||
    !Array.isArray(runtime.geometryRoutes)||!Array.isArray(runtime.railServices)||
    !Array.isArray(phase2c.gmsGroups)||!Array.isArray(phase2c.joburgRailLines)||
    !Array.isArray(eku.railwayStations)||!Array.isArray(eku.joburgPrasaStations)||!Array.isArray(eku.railwayLines))
    throw Error('Missing Phase 2C inputs or private rights/passenger guards');
}
export function buildCoverageIndex(runtime,phase2c,eku){
 validateEvidence(runtime,phase2c,eku);
 const ids=new Set();
 const routeShapes=[];
 for(const r of runtime.geometryRoutes){
  if(r.passengerRoutingEnabled!==false||!r.geometry||ids.has(r.id))throw Error('Invalid or duplicate existing route evidence');
  ids.add(r.id);
  routeShapes.push({id:r.id,operatorId:r.operatorId,routeCode:String(r.code??''),label:String(r.name??''),geometry:r.geometry,
   source:String(r.source??''),evidence:'municipal-or-operator-map-only',operation:'unverified',boardingVerified:false,
   directionVerified:false,operatorAssignmentVerified:r.operatorId!=='ekurhuleni-irptn',passengerRoutingEnabled:false});
 }
 const gmsCount={};
 for(const group of phase2c.gmsGroups){
  const n=group.number;
  gmsCount[n]={routes:group.routes.length,stops:group.stops.length};
  for(const r of group.routes){
   const id=`ekurhuleni-gms:${n}:${r.gisObjectId}`;
   if(ids.has(id)||!r.geometry)throw Error(`Duplicate or missing GMS geometry: ${id}`);
   ids.add(id);
   routeShapes.push({id,operatorId:'ekurhuleni-gms-unassigned',groupNumber:n,routeCode:`GIS group ${n}`,label:r.label||`Municipal GMS GIS group ${n}`,
    geometry:r.geometry,source:`City of Ekurhuleni GIS paired route/stop layers for group ${n}`,
    evidence:'municipal-gis-layer-pair-not-confirmed-passenger-route',operation:'unverified',boardingVerified:false,
    directionVerified:false,operatorAssignmentVerified:false,passengerRoutingEnabled:false});
  }
 }
 const railStations=[...eku.railwayStations.map(s=>({...s,municipality:'Ekurhuleni'})),
  ...eku.joburgPrasaStations.map(s=>({...s,municipality:'Johannesburg'}))];
 const railTrackShapes=[...eku.railwayLines,...phase2c.joburgRailLines];
 return {schemaVersion:1,internalOnly:true,sourceRightsCleared:false,passengerRoutingEnabled:false,
  passengerEdges:0,boardingEdges:0,transferEdges:0,source:'Existing private Phase 2C snapshots',
  routeShapes,railStations,railTrackShapes,gautrainServices:runtime.railServices,
  gmsGroupEvidence:gmsCount,notes:['GMS GIS group is not verified as current Harambee service.',
   'A nearby station or track does not prove operating train service, stop order or direction.',
   'Route proximity is not a passenger journey. Public GIS reuse rights require review.']};
}
export function screenCoverage(index,origin,destination,radius=800){
 if(index?.internalOnly!==true||index?.passengerRoutingEnabled!==false||index?.sourceRightsCleared!==false||
  !isPoint(origin)||!isPoint(destination)||!Number.isFinite(radius)||radius<100||radius>1500)
  throw Error('Invalid private coverage request');
 const perOperator={};
 const sameShape=[];
 for(const r of index.routeShapes){
  const a=geometryDistance(origin,r.geometry),b=geometryDistance(destination,r.geometry);
  if(!Number.isFinite(a)||!Number.isFinite(b))continue;
  const item={id:r.id,operatorId:r.operatorId,routeCode:r.routeCode,groupNumber:r.groupNumber??null,
   originMetres:Math.round(a),destinationMetres:Math.round(b),operatorAssignmentVerified:r.operatorAssignmentVerified,
   operatingStatus:'unverified',boardingStatus:'unverified',directionStatus:'unverified',selectable:false};
  if(!perOperator[r.operatorId])perOperator[r.operatorId]={origin:null,destination:null};
  const o=perOperator[r.operatorId];
  if(!o.origin||a<o.origin.metres)o.origin={id:r.id,metres:Math.round(a),code:r.routeCode};
  if(!o.destination||b<o.destination.metres)o.destination={id:r.id,metres:Math.round(b),code:r.routeCode};
  if(a<=radius&&b<=radius)sameShape.push(item);
 }
 sameShape.sort((a,b)=>a.originMetres+a.destinationMetres-b.originMetres-b.destinationMetres);
 const nearestStations=p=>index.railStations.map(s=>({id:s.id,name:s.label,municipality:s.municipality,
  metres:Math.round(haversineMetres(p,s.geometry)),serviceVerified:false}))
  .sort((a,b)=>a.metres-b.metres).slice(0,3);
 const originStations=nearestStations(origin),destinationStations=nearestStations(destination);
 const gautrainMembership=[];
 for(const s of index.gautrainServices){
  if(s.membershipVerified!==true)continue;
  const nearest=(p)=>s.stations.map(t=>({stationId:t.id,name:t.name,metres:Math.round(haversineMetres(p,{lat:t.lat,lng:t.lng}))}))
   .sort((a,b)=>a.metres-b.metres)[0];
  const a=nearest(origin),b=nearest(destination);
  if(a&&b&&a.stationId!==b.stationId&&a.metres<=radius&&b.metres<=radius)
   gautrainMembership.push({serviceName:s.name,originStation:a,destinationStation:b,
    stoppingOrderVerified:false,operationVerified:false,selectable:false});
 }
 return {radiusMetres:radius,origin,destination,sameShapeCount:sameShape.length,sameShapeTop:sameShape.slice(0,6),
  nearestByOperator:perOperator,nearestRailStations:{origin:originStations,destination:destinationStations},
  gautrainServiceMembership:gautrainMembership,
  infrastructureStatus:sameShape.length||gautrainMembership.length?'geographic-evidence-found':
    (originStations[0]?.metres<=radius&&destinationStations[0]?.metres<=radius?'stations-near-both-ends':'no-common-geometry'),
  passengerRoutingEnabled:false,verifiedPassengerEdges:0,estimatedFare:null,estimatedMinutes:null};
}
export function pointPairFromLine(route){
 const lines=route.geometry?.coordinates??[];
 const line=lines.reduce((a,b)=>b.length>a.length?b:a,[]);
 if(line.length<2)throw Error(`Insufficient geometry in ${route.id}`);
 const a=line[Math.floor((line.length-1)*.2)],b=line[Math.max(1,Math.floor((line.length-1)*.8))];
 return [{lat:a[1],lng:a[0]},{lat:b[1],lng:b[0]}];
}
