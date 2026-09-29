/** Dev GIS must never be present in the public production bundle. */
import fs from 'node:fs';
import path from 'node:path';
const cwd=process.cwd();
const root=path.join(cwd,'src/data/transit/gauteng/unified-dev');
const runtime=path.join(root,'runtime.json');
if(!fs.existsSync(path.join(root,'.gitignore'))||!fs.readFileSync(path.join(root,'.gitignore'),'utf8').includes('/runtime.json'))
 throw new Error('Generated GIS runtime is not gitignored. Stop before committing or deploying.');
if(!fs.existsSync(runtime))throw new Error('Private runtime missing: build infrastructure first.');
const service=fs.readFileSync(path.join(cwd,'src/services/unifiedCoverage.ts'),'utf8');
if(/import\s*\(\s*['"`][^'"`]*runtime\.json/.test(service)||/from\s*['"`][^'"`]*unified-dev/.test(service))
 throw new Error('Private City GIS runtime imported by source; unsafe to ship.');
const dist=process.env.PULSE_DIST_DIR?path.resolve(process.env.PULSE_DIST_DIR):path.join(cwd,'dist');
if(!fs.existsSync(dist))throw new Error('dist/ not found. Run npm.cmd run build first.');
const unique='GANDHI SQUARE TO MEREDALE via SOUTHGATE';
const files=[];
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,item.name);if(item.isDirectory())walk(full);else if(item.isFile())files.push(full);}}
walk(dist);
for(const file of files){const content=fs.readFileSync(file);
 if(content.includes(Buffer.from(unique)))throw new Error('STOP: Metrobus private GIS description leaked into dist asset '+file);
}
console.log(`PASS: generated GIS stays gitignored, never imported from source; scanned ${files.length} dist asset(s), known private City GIS route text absent.`);
console.log('NOTE: This is a targeted safety check, not a legal clearance or proof all private metadata is excluded.');
