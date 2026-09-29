import fs from 'node:fs';
import path from 'node:path';

const appPath = path.join(process.cwd(),'src','app','App.tsx');
if (!fs.existsSync(appPath)) throw new Error(`App.tsx not found: ${appPath}`);
let s = fs.readFileSync(appPath,'utf8');
const backup = `${appPath}.phase1i.bak`;
if (!fs.existsSync(backup)) fs.copyFileSync(appPath, backup);

const importAnchor = 'import { RecommendationEngine } from "../services/recommendationEngine";';
if (!s.includes('MetrobusEvidenceEngine')) {
  if (!s.includes(importAnchor)) throw new Error('Import anchor not found. No changes made.');
  s = s.replace(importAnchor, `${importAnchor}\nimport { MetrobusEvidenceEngine, type MetrobusEvidenceResult } from "../services/metrobusEvidenceEngine";\nimport { MetrobusEvidencePanel } from "../features/planner/MetrobusEvidencePanel";`);
}

const stateAnchor = `  const [recommendations, setRecommendations] = useState<\n    RecommendationType[]\n  >([]);`;
if (!s.includes('metrobusEvidence, setMetrobusEvidence')) {
  if (!s.includes(stateAnchor)) throw new Error('State anchor not found. Restore backup if needed.');
  s = s.replace(stateAnchor, `${stateAnchor}\n\n  const [metrobusEvidence, setMetrobusEvidence] =\n    useState<MetrobusEvidenceResult | null>(null);`);
}

const recAnchor = `        const baseRecommendations = RecommendationEngine.getRecommendations(\n          origin,\n          {\n            destination,\n            destinationLocation,`;
if (!s.includes('MetrobusEvidenceEngine.screenJourney')) {
  const idx = s.indexOf(recAnchor);
  if (idx < 0) throw new Error('Recommendation anchor not found. Restore backup if needed.');
  const insertionPoint = s.lastIndexOf('\n', idx);
  const code = `
        // Private Metrobus City GIS screening; excluded from public builds.
        if (import.meta.env.DEV && destinationLocation) {
          try {
            const evidence = await MetrobusEvidenceEngine.screenJourney(
              origin, destinationLocation, 800,
            );
            if (!cancelled) setMetrobusEvidence(evidence);
          } catch (metrobusError) {
            console.warn("Developer Metrobus screening unavailable:", metrobusError);
            if (!cancelled) setMetrobusEvidence(null);
          }
        } else if (!cancelled) {
          setMetrobusEvidence(null);
        }
`;
  s = s.slice(0,insertionPoint) + code + s.slice(insertionPoint);
}

const panelAnchor = `                        <div className="max-w-4xl lg:col-span-2">\n                          <TransportRecommendation`;
if (!s.includes('<MetrobusEvidencePanel')) {
  if (!s.includes(panelAnchor)) throw new Error('Transport panel anchor not found. Restore backup if needed.');
  s = s.replace(panelAnchor, `                        <div className="max-w-4xl lg:col-span-2">\n                          {import.meta.env.DEV && (\n                            <MetrobusEvidencePanel\n                              result={metrobusEvidence}\n                              destinationLabel={resolvedDestination?.name ?? destination}\n                            />\n                          )}\n\n                          <TransportRecommendation`);
}

fs.writeFileSync(appPath,s);
console.log('Metrobus Phase 1I planner integration installed.');
console.log(`Backup: ${backup}`);
console.log('Passenger selection remains disabled; this adds a developer evidence panel only.');
