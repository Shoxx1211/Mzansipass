import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const cwd=process.cwd(),base=path.join(cwd,'src/data/transit/gauteng/unified-dev');
const ignored=fs.readFileSync(path.join(base,'.gitignore'),'utf8');
assert.ok(ignored.includes('/phase2d-evidence.json'),'Private output ignore rule missing');
const find=(dir)=>fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?find(path.join(dir,e.name)):[path.join(dir,e.name)]):[];
const dist=find(path.join(cwd,'dist')).filter(p=>/\.(?:js|html|css)$/.test(p));
assert.ok(dist.length>0,'No built assets: run npm build first');
const privateFiles=['phase2d-evidence.json','phase2d-location-matrix.json'];
for(const f of dist){const s=fs.readFileSync(f,'utf8');for(const name of privateFiles)assert.ok(!s.includes(name),`Private filename exposed in compiled build: ${f}`);}
// Explicitly not a complete content-leak or legal audit.
console.log(`PASS: ${dist.length} production assets screened; Phase 2D private files ignored and not referenced.`);
console.log('NOTE: A targeted technical check is not commercial reuse permission.');
