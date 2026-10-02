import { useState } from "react";
import fareData from "../../data/transit/gauteng/reavaya/fares.json";
import {
  PUTCO_SOWETO_2026_NOTICE,
  PUTCO_ZONE_GUIDE,
  REAVAYA_SOURCE,
  reaVayaPeakAndOffPeak,
} from "../../services/publishedFareCatalog";

const rand = (n: number): string => "R" + n.toFixed(2);

export function PublishedFaresPanel({ operator }: { operator: string }) {
  const [distanceText, setDistanceText] = useState("");
  if (operator === "Rea Vaya") {
    const km = Number(distanceText);
    const quote = distanceText.trim() && Number.isFinite(km) && km > 0
      ? reaVayaPeakAndOffPeak(km) : null;

    return <div className="space-y-3 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.035] p-3">
      <h4 className="text-sm font-bold text-white">Published Rea Vaya fares</h4>
      <p className="text-xs text-white/65">
        1 July 2026 – 30 June 2027. The fare is based on the Rea Vaya journey distance
        between boarding and exit, not your road driving distance.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-white/75">
          <thead><tr className="border-b border-white/10 text-white/45">
            <th className="py-2">Distance</th>
            <th className="py-2">Peak</th>
            <th className="py-2">Off-peak</th>
          </tr></thead>
          <tbody>{fareData.fareModel.bands.map(row =>
            <tr key={row.id} className="border-b border-white/[0.055]">
              <td className="py-2">{row.upperBoundKm === null ? "Over 45 km" :
                row.lowerBoundKm === 0 ? "0–5 km" : row.lowerBoundKm + "–" + row.upperBoundKm + " km"}</td>
              <td className="py-2">{rand(row.peakFare)}</td>
              <td className="py-2">{rand(row.offPeakFare)}</td>
            </tr>)}</tbody>
        </table>
      </div>
      <label htmlFor="pulse-rv-fare-km" className="block text-xs font-semibold text-white/75">
        Check a known Rea Vaya travel distance (km)
      </label>
      <input id="pulse-rv-fare-km" type="number" min="0.1" max="500" step="0.1"
        inputMode="decimal" value={distanceText} onChange={event => setDistanceText(event.target.value)}
        placeholder="e.g. 12" className="h-11 w-full rounded-xl border border-white/15 bg-[#122331] px-3 text-sm text-white outline-none focus:border-cyan-300" />
      {quote && <div className="rounded-xl bg-emerald-300/10 px-3 py-3 text-sm text-emerald-100">
        <span className="font-bold">{km} km:</span> Peak {rand(quote.peak.amount)} · Off-peak {rand(quote.offPeak.amount)}
      </div>}
      <p className="text-[11px] leading-relaxed text-white/50">
        These are the operator's published tariff values. Enter the on-network distance,
        not a straight-line or taxi distance. Rea Vaya-to-Rea Vaya transfers may continue
        as one paid journey when the operator's tap rules are followed.
      </p>
      <a href={REAVAYA_SOURCE} target="_blank" rel="noopener noreferrer"
        className="inline-block py-2 text-xs font-bold text-cyan-200 underline underline-offset-4">
        View official Rea Vaya fares ↗
      </a>
    </div>;
  }

  if (operator === "Putco") {
    return <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <h4 className="text-sm font-bold text-white">PUTCO fares by zone</h4>
      <p className="text-xs leading-relaxed text-white/65">
        PUTCO uses ticket codes and zone pairs. The fare depends on the selected
        Soweto zone, destination zone and ticket product—not just kilometres.
        Its announced increase took effect 1 June 2026.
      </p>
      <a href={PUTCO_SOWETO_2026_NOTICE} target="_blank" rel="noopener noreferrer"
        className="block min-h-9 py-2 text-xs font-bold text-cyan-200 underline underline-offset-4">
        View official 2026 Soweto fare notice ↗
      </a>
      <a href={PUTCO_ZONE_GUIDE} target="_blank" rel="noopener noreferrer"
        className="block min-h-9 py-2 text-xs font-bold text-cyan-200 underline underline-offset-4">
        Find your official PUTCO zone ↗
      </a>
      <p className="text-[11px] text-white/50">
        The exact Soweto zone and ticket must match before Pulse can show a specific price.
      </p>
    </div>;
  }
  return null;
}
