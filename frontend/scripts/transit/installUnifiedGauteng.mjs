/** Atomic, guarded integration into the exact App.tsx structure in the user snapshot.
 * Creates a full backup and aborts without editing if source no longer matches.
 */
import fs from 'node:fs';
import path from 'node:path';
const p=path.join(process.cwd(),'src/app/App.tsx');
const original=fs.readFileSync(p,'utf8');
if(original.includes('UnifiedCoverageEngine')){console.log('Unified infrastructure already installed; no changes.');process.exit(0);}
let s=original;
function once(label,pattern,replacement){
  const m=[...s.matchAll(new RegExp(pattern.source,pattern.flags.includes('g')?pattern.flags:pattern.flags+'g'))];
  if(m.length!==1)throw new Error(`App changed: ${label} expected exactly once but found ${m.length}. No files modified.`);
  s=s.replace(pattern,replacement);
}
once('old Metrobus import',/^import \{ MetrobusEvidenceEngine, type MetrobusEvidenceResult \} from "\.\.\/services\/metrobusEvidenceEngine";\r?\nimport \{ MetrobusEvidencePanel \} from "\.\.\/features\/planner\/MetrobusEvidencePanel";/m,
 `import { UnifiedCoverageEngine, type UnifiedCoverageReport } from "../services/unifiedCoverage";\nimport { UnifiedCoveragePanel } from "../features/planner/UnifiedCoveragePanel";`);
once('App debug flag',/const TRIP_GPS_STALE_MS = 20_000;/,
 `const TRIP_GPS_STALE_MS = 20_000;\n// Hidden developer testing only: the commuter never sees GIS diagnostics.\nconst SHOW_NETWORK_LAB = import.meta.env.DEV && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("networkLab") === "1";`);
once('old Metrobus state',/const \[metrobusEvidence, setMetrobusEvidence\] =\s*useState<MetrobusEvidenceResult \| null>\(null\);/,
 `const [unifiedCoverage, setUnifiedCoverage] = useState<UnifiedCoverageReport | null>(null);`);
once('old Metrobus screening',/\/\/ Private Metrobus City GIS screening; excluded from public builds\.[\s\S]*?setMetrobusEvidence\(null\);\s*}\s*\n\s*const baseRecommendations =/,
 `// Unified private coverage audit uses exactly the GPS origin and the selected destination.\n        if (SHOW_NETWORK_LAB && destinationLocation) {\n          try {\n            const report = await UnifiedCoverageEngine.screen(origin, destinationLocation, 800);\n            if (!cancelled) setUnifiedCoverage(report);\n          } catch (coverageError) {\n            console.warn("Private network coverage unavailable:", coverageError);\n            if (!cancelled) setUnifiedCoverage(null);\n          }\n        } else if (!cancelled) {\n          setUnifiedCoverage(null);\n        }\n\n        const baseRecommendations =`);
once('old Metrobus panel',/\{import\.meta\.env\.DEV && \(\s*<MetrobusEvidencePanel\s+result=\{metrobusEvidence\}\s+destinationLabel=\{resolvedDestination\?\.name \?\? destination\}\s*\/>\s*\)\}/,
 `{SHOW_NETWORK_LAB && <UnifiedCoveragePanel report={unifiedCoverage} />}`);
once('always-visible developer test lab',/<DevJourneyTestLab\s+onRun=\{handleDevelopmentJourneyTest\}\s*\/>/,
 `{SHOW_NETWORK_LAB && <DevJourneyTestLab onRun={handleDevelopmentJourneyTest} />}`);
if(process.argv.includes('--dry-run')) {console.log('PASS: all 6 guarded App integration anchors matched. No files changed (--dry-run).');process.exit(0);}
const backup=p+'.pre-unified-infrastructure.bak';
if(!fs.existsSync(backup))fs.writeFileSync(backup,original);
const tmp=p+'.tmp-unified';
fs.writeFileSync(tmp,s);
fs.renameSync(tmp,p);
console.log('PASS: unified private coverage wired into existing GPS -> destination planner.');
console.log('Backed up:',backup);
console.log('Developer view: use existing dev URL with ?networkLab=1; commuter experience unchanged.');
