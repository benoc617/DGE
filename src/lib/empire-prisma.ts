import type { Prisma, Empire } from "@prisma/client";

/** Prisma scalar list fields cannot use a raw `[]` in `update` — use `{ set: [...] }` or `{ push: x }`. */
export function toEmpireUpdateData(empire: Partial<Empire>): Prisma.EmpireUpdateInput {
  const { pendingDefenderAlerts, ...rest } = empire;
  const out: Prisma.EmpireUpdateInput = { ...rest };
  if (pendingDefenderAlerts !== undefined) {
    out.pendingDefenderAlerts = { set: pendingDefenderAlerts };
  }
  return out;
}
