import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {buildRailAndCorridorEvidence} from './ekurhuleniRailEvidenceCore.mjs';
const root=path.join(process.cwd(),'src/data/transit/gauteng');
const phaseA=path.join(root,'ekurhuleni-bus/gis-normalized/infrastructure.json');
const official=path.join(root,'harambee/source-catalog.json');
const runtimeFile=path.join(root,'unified-dev/runtime.json');
const read=p=>{if(!fs.existsSync(p))throw Error(`Missing ${p}`);return JSON.parse(fs.readFileSync(p,'utf8'));};
const eku=read(phaseA),harambee=read(official),runtime=read(runtimeFile);
if(runtime.internalOnly!==true||runtime.passengerRoutingEnabled!==false||!runtime.phase2a)
  throw Error('Phase 2A unified private runtime is missing; rerun extendUnifiedEkurhuleni.mjs');
const index=buildRailAndCorridorEvidence(eku,harambee);
const dir=path.join(root,'unified-dev/reports');fs.mkdirSync(dir,{recursive:true});
const filename=path.join(dir,'phase2b-rail-corridor-evidence.json');
const content=JSON.stringify(index);fs.writeFileSync(filename,content);
const sha=crypto.createHash('sha256').update(content).digest('hex');
const summary={...index.summary,sourceRightsCleared:false,passengerRoutingEnabled:false,
  datasetSha256:sha,municipalRailPointsUnverifiedAsPRASAStops:true,
  irptnCorridorsUnverifiedAsHarambeeRoutes:true};
fs.writeFileSync(path.join(dir,'phase2b-qa.json'),JSON.stringify({generatedAt:index.generatedAt,
  summary,errors:[],warnings:['Track proximity is NOT rail service','IRPTN GIS lines are NOT confirmed Harambee operating routes',
    'Cross-city station duplicates have NOT been automatically merged','Reuse permission not confirmed']},null,2)+'\n');
// Append *summary only* to the existing ignored runtime. Preserve existing Phase 2A geometry.
runtime.phase2b={generatedAt:index.generatedAt,internalOnly:true,reviewFile:'reports/phase2b-rail-corridor-evidence.json',
  evidenceIndexSha256:sha,summary,verifiedPassengerEdges:0};
const tmp=runtimeFile+'.phase2b.tmp';fs.writeFileSync(tmp,JSON.stringify(runtime));fs.renameSync(tmp,runtimeFile);
console.log('PHASE 2B PRIVATE RAIL + CORRIDOR INDEX:',JSON.stringify(index.summary));
console.log('Detailed review:',filename);
console.log('PASSENGER ROUTING DISABLED; no operating services inferred.');
