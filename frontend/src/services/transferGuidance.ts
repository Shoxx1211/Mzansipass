import type { TransportRecommendation } from "../types";

export type TransferHint = {
  title: string;
  detail: string;
};

/**
 * Show where an evidence-backed connection may occur without converting
 * shared-stop geometry into a guaranteed exit, direction or walking path.
 */
export function getTransferGuidance(rec: TransportRecommendation): TransferHint[] {
  if (rec.transferDetails?.length) {
    return rec.transferDetails.map(edge => ({
      title: edge.sharedStopLabels.length
        ? `Possible interchange: ${edge.sharedStopLabels.join(" / ")}`
        : "Interchange stop not yet confirmed",
      detail: `Change between ${edge.fromRoute} and ${edge.toRoute}. Published shared-stop evidence only; check the route direction, station entrance and connecting service before getting off.`,
    }));
  }

  const paidLegs = (rec.journeyLegs ?? []).filter(leg => leg.mode !== "walk");
  if (paidLegs.length > 1) {
    return paidLegs.slice(0, -1).map((leg, index) => {
      const next = paidLegs[index + 1];
      const leaving = leg.to?.trim();
      const boarding = next.from?.trim();
      return {
        title: leaving ? `Possible change at ${leaving}` : "Transfer place to confirm",
        detail: `Next: ${next.label}${boarding ? ` from ${boarding}` : " (boarding stop to confirm)"}. Verify the actual stopping pattern and walking connection; these are mapped journey legs, not live departure instructions.`,
      };
    });
  }

  const labels = [...new Set((rec.transferStops ?? [])
    .map(label => label.trim()).filter(Boolean))];
  if (rec.direct === false && labels.length) {
    return [{
      title: `Possible transfer place: ${labels.join(" / ")}`,
      detail: "The mapped connection needs confirmation of the stop, service direction and walking route before travel.",
    }];
  }

  return [];
}
