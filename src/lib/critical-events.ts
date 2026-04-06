/** Patterns for events that should surface as critical in the turn summary modal. */
export const CRITICAL_EVENT_PATTERNS: RegExp[] = [
  /STARVATION/i,
  /FUEL DEFICIT/i,
  /ORE DEFICIT/i,
  /BANKRUPTCY/i,
  /COLLAPSED/i,
  /deserted.*civil unrest/i,
  /Internal conflicts/i,
  /Protection.*ended/i,
  /^ALERT:/,
];

export function classifyTurnEvents(events: string[]): { critical: string[]; warnings: string[]; info: string[] } {
  const critical: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];

  for (const ev of events) {
    if (CRITICAL_EVENT_PATTERNS.some((re) => re.test(ev))) critical.push(ev);
    else if (/RANDOM EVENT/i.test(ev) || /produced/i.test(ev) || /matured/i.test(ev) || /improving/i.test(ev)) info.push(ev);
    else warnings.push(ev);
  }
  return { critical, warnings, info };
}
