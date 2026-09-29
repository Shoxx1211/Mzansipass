import type { UnifiedCoverageReport } from '../../services/unifiedCoverage';

interface Props { report:UnifiedCoverageReport|null }
const label:Record<string,string> = {metrobus:'Metrobus',areyeng:'A Re Yeng','tshwane-bus':'Tshwane Bus'};
const metres=(n:number)=>n>=1000?`${(n/1000).toFixed(1)} km`:`${Math.round(n)} m`;
/** Opt-in private network audit. The normal passenger journey search has no extra controls. */
export const UnifiedCoveragePanel=({report}:Props)=>{
 if(!import.meta.env.DEV||!report)return null;
 const grouped=Object.entries(label).map(([operatorId,name])=>({operatorId,name,
   matches:report.shapeMatches.filter(r=>r.operatorId===operatorId)}));
 const total=report.totalShapeMatches+report.railMatches.length+(report.reaVaya.status==='unsupported'?0:1);
 return <details className="mb-5 overflow-hidden rounded-3xl border border-sky-400/20 bg-slate-950/65 text-slate-100 shadow-xl backdrop-blur-xl">
  <summary className="cursor-pointer select-none px-5 py-4 text-sm font-semibold text-cyan-200">
   Network coverage · developer lab <span className="ml-2 rounded-full bg-sky-400/10 px-2 py-1 text-xs text-sky-200">{total} evidence matches</span>
  </summary>
  <div className="space-y-4 border-t border-white/10 px-5 py-4 text-xs leading-5 text-slate-300">
   <p className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-amber-100">Geographic screening and published rail service membership only. Not verified operating journeys. No fares, boarding directions, transfer instructions or trip starts are inferred.</p>
   <div className="grid gap-3 sm:grid-cols-2">
    <section className="rounded-xl border border-white/10 bg-white/[0.035] p-3"><h4 className="font-bold text-white">Rea Vaya</h4>
     <p className="mt-1">{report.reaVaya.status==='unsupported'?'No supported graph connection at these points':`${report.reaVaya.status} · ${report.reaVaya.routes.join(' → ')}`}</p>
     {report.reaVaya.publishedTransfers.length>0&&<p>Published shared-stop labels: {report.reaVaya.publishedTransfers.join(', ')}</p>}
    </section>
    <section className="rounded-xl border border-white/10 bg-white/[0.035] p-3"><h4 className="font-bold text-white">Gautrain rail</h4>
      {report.railMatches.length?report.railMatches.map(r=><p key={r.serviceId} className="mt-1">{r.originStation} ↔ {r.destinationStation} · same published service ({r.serviceName}); stops and direction unconfirmed</p>):<p className="mt-1">No two distinct stations within {report.radiusMetres} m on the same published service.</p>}
    </section>
   </div>
   {grouped.map(group=><section key={group.operatorId} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
    <h4 className="font-bold text-white">{group.name} <span className="ml-1 font-normal text-sky-200">{group.matches.length} near both points</span></h4>
    {group.matches.length?group.matches.slice(0,4).map(r=><p key={r.routeId} className="mt-1">{r.routeCode} · A {metres(r.originDistanceMetres)} / destination {metres(r.destinationDistanceMetres)} from mapped shape</p>):<p className="mt-1">No common mapped shape within {report.radiusMetres} m.</p>}
   </section>)}
   <p className="text-slate-400">PUTCO has zones and published fares but no mapped passenger route geometry. Gautrain feeder buses have official route maps without extracted route/stop coordinates. Metrorail, Harambee and Ekurhuleni bus still need normalized usable sources.</p>
   <p className="text-slate-400">Local developer-only tool. City GIS reuse rights remain under review.</p>
  </div>
 </details>;
};
