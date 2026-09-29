/** Offline ONLY: append geographic infrastructure to the gitignored unified-dev runtime. */
import fs from 'node:fs';
import path from 'node:path';
const base=path.join(process.cwd(),'src/data/transit/gauteng');
const normalizedPath=path.join(base,'ekurhuleni-bus/gis-normalized/infrastructure.json');
const unifiedDir=path.join(base,'unified-dev');
const runtimePath=path.join(unifiedDir,'runtime.json');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
if(!fs.existsSync(runtimePath))throw new Error('Build the existing unified Gauteng runtime first.');
if(!fs.existsSync(normalizedPath))throw new Error('Normalize Ekurhuleni GIS before extending the runtime.');
const runtime=read(runtimePath),eku=read(normalizedPath);
if(runtime.internalOnly!==true||runtime.passengerRoutingEnabled!==false||
 eku.internalOnly!==true||eku.sourceRightsCleared!==false||eku.passengerRoutingEnabled!==false)
 throw new Error('Refusing to merge public or passenger-routing runtime with unreviewed GIS.');
const unmodifiedRoutes=(runtime.geometryRoutes??[]).filter(r=>r.operatorId!=='ekurhuleni-irptn');
if(!Array.isArray(runtime.geometryRoutes)||unmodifiedRoutes.length<150)
 throw new Error('Unified base network is missing or unexpectedly incomplete');
const corridors=(eku.irptnRoutes??[]).map(r=>({
 id:`ekurhuleni-irptn:${r.gisObjectId}`,operatorId:'ekurhuleni-irptn',
 code:`GIS-${r.gisObjectId}`,name:r.label,gisObjectId:r.gisObjectId,
 source:'City of Ekurhuleni GIS Transportation Map v1 layer 2; IRPTN corridor',
 geometry:r.geometry,operatingStatus:'unverified',operation:'unverified',
 passengerRoutingEnabled:false,licenseStatus:'review-required',
 operatorAssignmentVerified:false,stopMembershipVerified:false,directionVerified:false,
}));
const sourceStats={...runtime.sourceStats,
 ekurhuleniIRPTN:{gisCorridorShapes:corridors.length,verifiedHarambeeCorridorAssignments:0,passengerEdges:0},
 harambee:{websitePublishedServiceLabels:3,gisRoutesVerified:0,geometryAssignmentsToHarambee:0,passengerEdges:0},
 metrorail:{gisRailStationPoints:(eku.railwayStations??[]).length+(eku.joburgPrasaStations??[]).length,
   municipalRailwayLineShapes:(eku.railwayLines??[]).length,currentPRASAServiceMembershipVerified:0,
   currentSchedulesVerified:false,passengerEdges:0},
 ekurhuleniBus:{municipalTariffDocumentListed2026_27:true,completeCurrentFareTableParsed:false,
   verifiedMunicipalBusGeometry:0,passengerEdges:0}};
const extension={...runtime,sourceStats,
 geometryRoutes:[...unmodifiedRoutes,...corridors],
 railwayInfrastructure:{sourceRightsCleared:false,passengerRoutingEnabled:false,
   stationPoints:[...(eku.railwayStations??[]),...(eku.joburgPrasaStations??[])],
   railwayLines:eku.railwayLines??[],operatingRoutesVerified:0},
 phase2a:{generatedAt:new Date().toISOString(),
  note:'Private geographic coverage only. IRPTN GIS not linked to Harambee service, railway track not linked to PRASA operating services.',
  sourceRefs:{harambee:'https://www.harambeebrt.co.za/timetable/',
    ekurhuleni:'https://gis.ekurhuleni.gov.za/arcgis/rest/services/Ekurhuleni/Ekurhuleni_Transportation_Map_v1/MapServer',
    prasaHistoric:'https://www.prasa.com/Press%20Release/PRASA%20ADDS%20FIVE%20MORE%20LINES_03042024_Final.pdf'},
  verifiedPassengerEdgesAdded:0}};
fs.mkdirSync(path.join(unifiedDir,'reports'),{recursive:true});
const backup=path.join(unifiedDir,'reports','runtime-before-phase2a.json');
if(!fs.existsSync(backup))fs.copyFileSync(runtimePath,backup);
const temporary=runtimePath+'.phase2a.tmp';fs.writeFileSync(temporary,JSON.stringify(extension));fs.renameSync(temporary,runtimePath);
const qa={generatedAt:extension.phase2a.generatedAt,totalMappedRouteShapes:extension.geometryRoutes.length,
 existingOperatorShapes:unmodifiedRoutes.length,ekurhuleniIrptnCorridors:corridors.length,
 municipalRailStationPoints:eku.railwayStations?.length??0,
 joburgPrasaStationPoints:eku.joburgPrasaStations?.length??0,
 municipalRailLineShapes:eku.railwayLines?.length??0,
 verifiedHarambeeRouteGeometry:0,verifiedMunicipalBusRouteGeometry:0,
 currentPRASARailServicePathsVerified:0,verifiedPassengerEdges:0,passengerRoutingEnabled:false,
 note:'No commuter UI or public planner has changed.'};
fs.writeFileSync(path.join(unifiedDir,'reports','phase2a-qa.json'),JSON.stringify(qa,null,2)+'\n');
console.log('Unified Gauteng Phase 2A expanded:',JSON.stringify(qa));
