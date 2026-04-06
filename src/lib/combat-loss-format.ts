/**
 * Human-readable formatting for combat/casualty records (army keys → labels).
 */

const UNIT_LABELS: Record<string, string> = {
  soldiers: "soldiers",
  generals: "generals",
  fighters: "fighters",
  defenseStations: "defense stations",
  lightCruisers: "light cruisers",
  heavyCruisers: "heavy cruisers",
  carriers: "carriers",
  covertAgents: "covert agents",
  commandShipStrength: "command ship strength",
};

/**
 * Comma-separated list of non-zero losses, e.g. "1,200 soldiers, 5 fighters".
 * Returns empty string if nothing was lost.
 */
export function formatUnitLosses(losses: Record<string, number> | undefined | null): string {
  if (!losses) return "";
  const parts = Object.entries(losses)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${v.toLocaleString()} ${UNIT_LABELS[k] ?? k.replace(/([A-Z])/g, " $1").trim().toLowerCase()}`);
  return parts.join(", ");
}

/**
 * Same as formatUnitLosses but returns a fallback when empty (e.g. "none").
 */
export function formatUnitLossesOrNone(losses: Record<string, number> | undefined | null, noneLabel = "none"): string {
  const s = formatUnitLosses(losses);
  return s || noneLabel;
}
