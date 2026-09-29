import fs from 'node:fs';
import path from 'node:path';
import { normalizeEkurhuleniSnapshot } from './ekurhuleniInfrastructureCore.mjs';
const root=process.cwd();
const opt=(key,otherwise)=>{const index=process.argv.indexOf(key);return index<0?otherwise:process.argv[index+1]};
const inDir=path.resolve(root,opt('--input-dir','src/data/transit/gauteng/ekurhuleni-bus/gis-raw'));
const outDir=path.resolve(root,opt('--output-dir','src/data/transit/gauteng/ekurhuleni-bus/gis-normalized'));
const specs=[['ekurhuleni-irptn-routes','irptn','irptnRoutes',true],
 ['ekurhuleni-railway-stations','stations','railwayStations',true],
 ['ekurhuleni-railway-lines','railLines','railwayLines',true],
 ['joburg-prasa-stations','joburgStations','joburgPrasaStations',false]];
const result={schemaVersion:1,internalOnly:true,sourceRightsCleared:false,passengerRoutingEnabled:false,
 serviceAssignmentsVerified:false,currentOperationVerified:false,boardingVerified:false,directionVerified:false,
 railwayLineServiceMembershipVerified:false,irptnCorridorOperatorMembershipVerified:false,
 railStationPublishedStoppingPatternVerified:false,
 generatedAt:new Date().toISOString(),irptnRoutes:[],railwayStations:[],railwayLines:[],joburgPrasaStations:[]};
const report={generatedAt:result.generatedAt,layers:{},errors:[],warnings:[],passengerEdges:0};
for(const [file,kind,key,required] of specs){
 const source=path.join(inDir,`${file}-wgs84.json`);
 if(!fs.existsSync(source)) {
   if(required)throw new Error(`Missing required GIS snapshot ${source}. Run syncEkurhuleniInfrastructure.ps1 first.`);
   report.warnings.push(`Optional source missing: ${file}`);continue;
 }
 const snapshot=JSON.parse(fs.readFileSync(source,'utf8'));
 const {rows,report:layerReport}=normalizeEkurhuleniSnapshot(snapshot,kind);
 result[key]=rows;report.layers[key]=layerReport;
 if(layerReport.invalid)report.warnings.push(`${key}: ${layerReport.invalid} malformed features rejected`);
}
if(!Object.hasOwn(report.layers,'irptnRoutes')||!Object.hasOwn(report.layers,'railwayStations')||!Object.hasOwn(report.layers,'railwayLines'))
 throw new Error('Required Ekurhuleni layers not parsed');
report.summary={irptnCorridors:result.irptnRoutes.length,municipalRailwayStations:result.railwayStations.length,
 railwayLineShapes:result.railwayLines.length,additionalJohannesburgPrasaStationPoints:result.joburgPrasaStations.length,
 verifiedOperatingRoutes:0,verifiedPassengerEdges:0};
fs.mkdirSync(outDir,{recursive:true});fs.mkdirSync(path.join(outDir,'reports'),{recursive:true});
fs.writeFileSync(path.join(outDir,'infrastructure.json'),JSON.stringify(result));
fs.writeFileSync(path.join(outDir,'reports','qa.json'),JSON.stringify(report,null,2)+'\n');
console.log('Phase 2A Ekurhuleni / railway infrastructure normalized:',JSON.stringify(report.summary));
console.log('Current Harambee service geometry: UNLINKED | Current Metrorail schedules: UNVERIFIED | Passenger routing: DISABLED');
