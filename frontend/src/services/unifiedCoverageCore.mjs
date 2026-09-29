/** Pure, browser-safe point-to-polyline and published rail service membership screening.
 * Independent of Mapbox driving distance. Results are NOT passenger journeys.
 */
const R=6371000;
const rad=(x)=>x*Math.PI/180;
export const greatCircleMetres=(a,b)=>{
  const dlat=rad(b.lat-a.lat),dlon=rad(b.lng-a.lng);
  const q=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlon/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(q)));
};
export const segmentDistanceMetres=(p,a,b)=>{
  const ref=rad(p.lat),scale=Math.cos(ref)*R;
  const px=rad(p.lng)*scale, py=rad(p.lat)*R;
  const ax=rad(a[0])*scale,ay=rad(a[1])*R;
  const bx=rad(b[0])*scale,by=rad(b[1])*R;
  const dx=bx-ax,dy=by-ay;
  const t=dx*dx+dy*dy>0?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy))):0;
  return Math.hypot(px-(ax+t*dx),py-(ay+t*dy));
};
export const geometryDistanceMetres=(point,route)=>{
 let min=Infinity;
 for(const line of route.geometry?.coordinates??[])for(let i=1;i<line.length;i++){
   const d=segmentDistanceMetres(point,line[i-1],line[i]);if(d<min)min=d;
 }
 return min;
};
const valid=(p)=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&
 p.lat>=-35&&p.lat<=-22&&p.lng>=16&&p.lng<=33;
export function screenUnifiedCoverage(runtime,origin,destination,options={}){
 if(!runtime?.internalOnly||runtime?.passengerRoutingEnabled!==false)throw new Error('Unsafe runtime: internal-only evidence required');
 if(!valid(origin)||!valid(destination))throw new Error('Expected WGS84 South African coordinates');
 const radius=options.radiusMetres??800;
 if(!Number.isFinite(radius)||radius<50||radius>1500)throw new Error('Development screen radius must be 50–1500 m');
 const shapeMatches=[];
 const closestByOperator={};
 for(const route of runtime.geometryRoutes??[]){
   const a=geometryDistanceMetres(origin,route),b=geometryDistanceMetres(destination,route);
   if(!Number.isFinite(a)||!Number.isFinite(b))continue;
   const item={operatorId:route.operatorId,routeCode:route.code,routeName:route.name,routeId:route.id,
     originDistanceMetres:Math.round(a),destinationDistanceMetres:Math.round(b),
     geographicEvidence:'both-near-same-gis-shape',directionVerified:false,boardingVerified:false,operatingTodayVerified:false,
     fare:null,etaMinutes:null,selectable:false};
   const nearest=closestByOperator[route.operatorId];
   if(!nearest || a+b<nearest.originDistanceMetres+nearest.destinationDistanceMetres) closestByOperator[route.operatorId]=item;
   if(a<=radius&&b<=radius)shapeMatches.push(item);
 }
 shapeMatches.sort((a,b)=>a.originDistanceMetres+a.destinationDistanceMetres-b.originDistanceMetres-b.destinationDistanceMetres);
 const railMatches=[];
 for(const service of runtime.railServices??[]){
  if(service.membershipVerified!==true)continue;
  const origins=(service.stations??[]).map(s=>({station:s,d:greatCircleMetres(origin,{lat:s.lat,lng:s.lng})})).sort((a,b)=>a.d-b.d);
  const destinations=(service.stations??[]).map(s=>({station:s,d:greatCircleMetres(destination,{lat:s.lat,lng:s.lng})})).sort((a,b)=>a.d-b.d);
  if(!origins.length||!destinations.length)continue;
  const a=origins[0],b=destinations[0];
  // A same-station match is not a train trip; unknown stopping pattern prevents a guaranteed journey.
  if(a.station.id!==b.station.id&&a.d<=radius&&b.d<=radius){
    railMatches.push({operatorId:'gautrain',serviceId:service.id,serviceName:service.name,
      originStation:a.station.name,destinationStation:b.station.name,
      originDistanceMetres:Math.round(a.d),destinationDistanceMetres:Math.round(b.d),
      geographicEvidence:'same-official-service-station-membership',stoppingOrderVerified:false,
      operatingTodayVerified:false,fare:null,etaMinutes:null,selectable:false});
  }
 }
 railMatches.sort((a,b)=>a.originDistanceMetres+a.destinationDistanceMetres-b.originDistanceMetres-b.destinationDistanceMetres);
 return {radiusMetres:radius,shapeMatches:shapeMatches.slice(0,24),totalShapeMatches:shapeMatches.length,railMatches,
   closestByOperator,operatorInventory:runtime.sourceStats,
   passengerRoutingEnabled:false,verifiedPassengerEdges:0};
}
