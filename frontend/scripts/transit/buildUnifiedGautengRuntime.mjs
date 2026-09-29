/**
 * Pulse unified Gauteng infrastructure compiler. Offline. No network, keys or npm modules.
 * Converts existing, locally acquired operator data into PRIVATE development data.
 * This never turns City GIS proximity into boarding/transfer/passenger eligibility.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const base = path.join(root, 'src/data/transit/gauteng');
const output = path.join(base, 'unified-dev');
const required = (relative) => {
  const full = path.join(base, relative);
  if (!fs.existsSync(full)) throw new Error(`Missing operator snapshot: ${relative}`);
  const data = JSON.parse(fs.readFileSync(full, 'utf8'));
  return data;
};
const coord = (p) => Array.isArray(p) && p.length >= 2 &&
  [p[0],p[1]].every(Number.isFinite) && p[0] >= 16 && p[0] <= 33 && p[1] >= -35 && p[1] <= -22;
const geometry = (geo) => {
  if (!geo || !['LineString','MultiLineString'].includes(geo.type)) return null;
  const lines = geo.type === 'LineString' ? [geo.coordinates] : geo.coordinates;
  if (!Array.isArray(lines)) return null;
  const clean = lines.filter((line) => Array.isArray(line) && line.length >= 2 && line.every(coord))
    .map((line) => line.map(([lng,lat])=>[lng,lat]));
  return clean.length ? { type:'MultiLineString',coordinates:clean } : null;
};

const metro = required('metrobus/metrobus-planner-runtime.json');
if (metro.sourceRightsCleared !== false || metro.currentOperationVerified !== false || metro.passengerRoutingEnabled !== false) {
  throw new Error('Metrobus rights/status guard failed; this offline compiler is for uncleared development evidence only.');
}
const areyeng = required('areyeng/normalized-routes.json');
const tshwane = required('tshwane-bus/normalized-routes.json');
const rail = required('gautrain/rail-lines.json');
const stations = required('gautrain/stations.json');
const feeder = required('gautrain/bus-routes.json');
const putco = required('putco/soshanguve/normalized-network.json');
const reavaya = required('reavaya/reavaya-runtime.json');

const mapped = [];
const issues = [];
const put = (r) => {
  if (!r.geometry) {issues.push(`${r.operatorId}:${r.code} missing geometry`);return;}
  mapped.push({...r, operation:'unverified', passengerRoutingEnabled:false, licenseStatus:'review-required'});
};
for (const r of metro.routes ?? []) {
  put({id:`metrobus:${r.gisObjectId}`,operatorId:'metrobus',code:r.routeCode,name:r.description || `Metrobus ${r.routeCode}`,
    gisObjectId:r.gisObjectId,internalRouteId:r.rawRouteIdField??null,
    originLabel:r.originLabel || '',destinationLabel:r.destinationLabel || '',
    inventoryOverlap:!!r.indexedExcerptOverlap,source:'City of Johannesburg GIS layer 22',geometry:geometry(r.geometry)});
}
for(const r of areyeng) {
  put({id:r.id,operatorId:'areyeng',code:r.code,name:r.name,
    source:'City of Tshwane ArcGIS A Re Yeng routes',geometry:geometry(r.geometry)});
}
for(const r of tshwane) for(const v of r.geometryVariants ?? []) {
  put({id:v.id,operatorId:'tshwane-bus',code:r.routeId,name:r.name,
    routeApprovedInSnapshot:r.approved===true,variantStatus:v.status || null,
    source:'City of Tshwane bus GIS route layer',geometry:geometry(v.geometry)});
}
const stationMap = new Map((stations.stations ?? []).map(s=>[s.id,s]));
const railServices = (rail.services??[]).map(s=>({
  id:s.id,name:s.name,
  // Official *membership*, NOT a validated ordered stopping pattern or timetable.
  stations:(s.stations??[]).map(m=> {
    const st=stationMap.get(m.stationId);
    return st && Number.isFinite(st.location?.lat) && Number.isFinite(st.location?.lng) ?
      {id:st.id,name:st.name,lat:st.location.lat,lng:st.location.lng} : null;
  }).filter(Boolean),
  source:'Official Gautrain general-information service membership',
  membershipVerified:s.verification?.serviceMembership==='official',
  stoppingOrderVerified:false,directionVerified:false,operatingTodayVerified:false,
}));
const sourceStats={
  reavaya:{canonicalRoutes:reavaya.routes?.length ?? 0,metadataOnlyRoutes:reavaya.metadataOnlyRoutes?.length ?? 0,engine:'existing-reavaya-applicability-engine'},
  metrobus:{gisShapes:metro.routes?.length ?? 0,geometryOnly:true,reuseRights:'not-cleared'},
  areyeng:{gisShapes:areyeng.length,stopCandidates:'spatial-proximity-only'},
  tshwaneBus:{logicalRoutes:tshwane.length,geometryVariants:tshwane.reduce((s,r)=>s+(r.geometryVariants?.length??0),0),terminals:'official route-ID references; roadside stops unknown'},
  gautrain:{stations:stations.stations?.length ?? 0,railServices:railServices.length,feederMaps:feeder.routes?.length ?? 0,feederGeometries:0},
  putco:{geographicZonePolygons:0,officialZones:putco.zones?.physical?.length??0,publishedFareProducts:putco.fares?.products?.length??0,geocodable:false},
  metrorail:{geocodable:false,reason:'No normalized operating geometry in supplied snapshot'},
  harambee:{geocodable:false,reason:'No normalized operating geometry in supplied snapshot'},
  ekurhuleniBus:{geocodable:false,reason:'No normalized operating geometry in supplied snapshot'},
  taxi:{geocodable:false,reason:'No verified route geometry in supplied snapshot'},
};
if (mapped.length < 150 || !railServices.length || !sourceStats.metrobus.gisShapes || !sourceStats.areyeng.gisShapes)
  throw new Error('Unexpectedly incomplete snapshots. Refusing to write development runtime.');
if (issues.length)throw new Error(`Invalid GIS geometry: ${issues.slice(0,10).join('; ')}`);
const runtime={schemaVersion:1,generatedAt:new Date().toISOString(),internalOnly:true,passengerRoutingEnabled:false,
  note:'Offline evidence coverage only. Neither route proximity nor published service membership proves a usable passenger journey.',
  license:'City GIS reuse review required. Do not ship this generated file or post it to a public server.',
  sourceStats,geometryRoutes:mapped,railServices};
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'.gitignore'),'# Never commit generated City GIS geometry. Developer-only license review.\n/runtime.json\n/reports/\n');
fs.writeFileSync(path.join(output,'runtime.json'),JSON.stringify(runtime));
const sha=crypto.createHash('sha256').update(fs.readFileSync(path.join(output,'runtime.json'))).digest('hex');
const report={generatedAt:runtime.generatedAt,internalOnly:true,geometryRoutes:mapped.length,
  geometryByOperator:Object.fromEntries([...new Set(mapped.map(r=>r.operatorId))].map(id=>[id,mapped.filter(r=>r.operatorId===id).length])),
  gautrainStationCount:stations.stations?.length ?? 0,gautrainRailMembershipServices:railServices.length,
  actualOperatingRoutesVerified:0,passengerEdgesCreated:0,sourceStats,qaErrors:issues,sha256:sha};
fs.mkdirSync(path.join(output,'reports'),{recursive:true});
fs.writeFileSync(path.join(output,'reports/build-qa.json'),JSON.stringify(report,null,2)+'\n');
console.log('UNIFIED GAUTENG INFRASTRUCTURE (INTERNAL):',JSON.stringify({geometryRoutes:report.geometryRoutes,geometryByOperator:report.geometryByOperator,gautrainStations:report.gautrainStationCount,gautrainRailServices:report.gautrainRailMembershipServices,passengerEdges:0,qaErrors:issues.length}));
console.log('Wrote private runtime:',path.join(output,'runtime.json'));
