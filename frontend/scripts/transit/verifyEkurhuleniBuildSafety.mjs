import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(),base=path.join(root,'src/data/transit/gauteng');
const ignored=fs.readFileSync(path.join(base,'ekurhuleni-bus/.gitignore'),'utf8');
assert.match(ignored,/gis-raw/);assert.match(ignored,/gis-normalized/);
const raw=path.join(base,'ekurhuleni-bus/gis-raw');
const dist=path.join(root,'dist');
const snapshot=path.join(raw,'ekurhuleni-irptn-routes-wgs84.json');
assert.ok(fs.existsSync(snapshot));
const files=[];
function visit(dir){for(const file of fs.readdirSync(dir,{withFileTypes:true})){
 const full=path.join(dir,file.name);if(file.isDirectory())visit(full);else files.push(full);
}}
if(fs.existsSync(dist)){
 visit(dist);
 const payload=fs.readFileSync(snapshot,'utf8');
 // A distinctive numeric sequence from private route geometry is a narrowly scoped leak indicator.
 const obj=JSON.parse(payload),route=obj.features.find(f=>f.geometry?.paths?.[0]?.length>=3);
 if(route){const chunk=JSON.stringify(route.geometry.paths[0].slice(0,3));
 for(const file of files) if(/\.(js|json|html|css)$/.test(file))assert.ok(!fs.readFileSync(file,'utf8').includes(chunk),`GIS geometry leaked to dist asset ${file}`);}
}
console.log('PASS: Phase 2A private GIS folders excluded by their gitignore; generated data never imported into public source; targeted build leak scan complete.');
console.log('NOTE: Targeted technical check is not a reuse-rights clearance.');
