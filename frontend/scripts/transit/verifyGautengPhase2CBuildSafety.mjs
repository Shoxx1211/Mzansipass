import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd();
for(const [d,terms] of [
  ['src/data/transit/gauteng/harambee',['/gis-raw/']],
  ['src/data/transit/gauteng/metrorail',['/gis-raw/']],
  ['src/data/transit/gauteng/unified-dev',['/runtime.json','/reports/']]]){
  const x=fs.readFileSync(path.join(root,d,'.gitignore'),'utf8');
  for(const term of terms)assert(x.includes(term),`Missing ignore ${d}/${term}`);
}
const sources=['src/app/App.tsx','src/services/unifiedCoverage.ts'].map(p=>path.join(root,p));
for(const p of sources)if(fs.existsSync(p)){
  const source=fs.readFileSync(p,'utf8');
  assert(!/from\s*['"][^'"]*(?:gis-raw|phase2c-gis-evidence)/.test(source),`${p} imports private GIS`);
}
const dist=path.join(root,'dist');assert(fs.existsSync(dist),'Missing dist; run npm.cmd run build');
const unique='station-near-track-not-train-service';
const queue=[dist];let checked=0;
while(queue.length){const dir=queue.pop();for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
  const p=path.join(dir,ent.name);if(ent.isDirectory())queue.push(p);else if(ent.isFile()){
    checked++;const buf=fs.readFileSync(p);
    assert(!buf.includes(Buffer.from(unique)),`Phase 2C private index leaked into ${p}`);
  }
}}
console.log(`PASS: Private GIS snapshot directories ignored, Phase 2C index absent from ${checked} build file(s).`);
console.log('Targeted technical checks do not establish GIS commercial reuse permission.');
