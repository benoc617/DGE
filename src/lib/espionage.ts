import { prisma } from "./prisma";
import { alterNumber } from "./game-constants";
import * as rng from "./rng";

export interface CovertOpResult {
  success: boolean;
  detected: boolean;
  agentsLost: number;
  messages: string[];
  effects: Record<string, unknown>;
}

function getSuccessChance(attackerAgents: number, defenderAgents: number): number {
  if (attackerAgents === 0) return 0;
  const ratio = attackerAgents / Math.max(1, defenderAgents);
  return Math.min(95, Math.max(5, ratio * 50));
}

function getDetectionChance(attackerAgents: number, defenderAgents: number): number {
  const ratio = defenderAgents / Math.max(1, attackerAgents);
  return Math.min(80, Math.max(10, ratio * 40));
}

export async function executeCovertOp(
  attackerEmpireId: string,
  defenderEmpireId: string,
  opType: number,
  attackerAgents: number,
  attackerCovertPoints: number,
): Promise<CovertOpResult> {
  const defenderEmpire = await prisma.empire.findUnique({
    where: { id: defenderEmpireId },
    include: { army: true, planets: true },
  });

  if (!defenderEmpire?.army) {
    return { success: false, detected: false, agentsLost: 0, messages: ["Target not found."], effects: {} };
  }

  const defenderAgents = defenderEmpire.army.covertAgents;
  const successChance = getSuccessChance(attackerAgents, defenderAgents);
  const detectionChance = getDetectionChance(attackerAgents, defenderAgents);

  const COVERT_OPS: Record<number, { name: string; cost: number }> = {
    0: { name: "Spy", cost: 0 },
    1: { name: "Insurgent Aid", cost: 1 },
    2: { name: "Support Dissension", cost: 1 },
    3: { name: "Demoralize Troops", cost: 1 },
    4: { name: "Bombing Operations", cost: 1 },
    5: { name: "Relations Spying", cost: 0 },
    6: { name: "Take Hostages", cost: 1 },
    7: { name: "Carrier Sabotage", cost: 1 },
    8: { name: "Communications Spying", cost: 1 },
    9: { name: "Setup Coup", cost: 2 },
  };

  const op = COVERT_OPS[opType];
  if (!op) return { success: false, detected: false, agentsLost: 0, messages: ["Invalid operation."], effects: {} };

  if (attackerCovertPoints < op.cost) {
    return { success: false, detected: false, agentsLost: 0, messages: [`Need ${op.cost} covert points for ${op.name}.`], effects: {} };
  }

  const succeeded = rng.random() * 100 < successChance;
  const detected = rng.random() * 100 < detectionChance;
  const agentsLost = detected ? Math.max(1, Math.ceil(attackerAgents * 0.02)) : 0;

  const messages: string[] = [];
  const effects: Record<string, unknown> = { pointsCost: op.cost };

  if (!succeeded) {
    messages.push(`${op.name} operation failed.`);
    if (detected) messages.push(`Your agents were detected! Lost ${agentsLost} agents.`);
    return { success: false, detected, agentsLost, messages, effects };
  }

  switch (opType) {
    case 0: { // Spy
      messages.push(`Intelligence report on target:`);
      messages.push(`Credits: ~${alterNumber(defenderEmpire.credits, 15).toLocaleString()}, Pop: ~${alterNumber(defenderEmpire.population, 15).toLocaleString()}`);
      messages.push(`Planets: ${defenderEmpire.planets.length}, Civil Status: ${defenderEmpire.civilStatus}`);
      messages.push(`Soldiers: ~${alterNumber(defenderEmpire.army.soldiers, 15)}, Fighters: ~${alterNumber(defenderEmpire.army.fighters, 15)}`);
      effects.intel = true;
      break;
    }
    case 1: { // Insurgent Aid
      await prisma.empire.update({
        where: { id: defenderEmpireId },
        data: { civilStatus: Math.min(7, defenderEmpire.civilStatus + 1) },
      });
      messages.push(`Insurgent Aid: Target civil status worsened by 1 level.`);
      effects.civilStatusChange = 1;
      break;
    }
    case 2: { // Support Dissension
      const deserters = Math.floor(defenderEmpire.army.soldiers * 0.05);
      await prisma.army.update({
        where: { id: defenderEmpire.army.id },
        data: { soldiers: { decrement: deserters } },
      });
      messages.push(`Support Dissension: ${deserters} enemy soldiers deserted.`);
      effects.soldiersLost = deserters;
      break;
    }
    case 3: { // Demoralize Troops
      const effLoss = 5 + Math.floor(rng.random() * 10);
      await prisma.army.update({
        where: { id: defenderEmpire.army.id },
        data: { effectiveness: Math.max(0, defenderEmpire.army.effectiveness - effLoss) },
      });
      messages.push(`Demoralize Troops: Target effectiveness reduced by ${effLoss}%.`);
      effects.effectivenessLoss = effLoss;
      break;
    }
    case 4: { // Bombing Operations
      const foodDestroyed = Math.floor(defenderEmpire.food * 0.20);
      await prisma.empire.update({
        where: { id: defenderEmpireId },
        data: { food: { decrement: foodDestroyed } },
      });
      messages.push(`Bombing Operations: Destroyed ${foodDestroyed} food supply.`);
      effects.foodDestroyed = foodDestroyed;
      break;
    }
    case 5: { // Relations Spying
      const treaties = await prisma.treaty.findMany({
        where: {
          OR: [{ fromEmpireId: defenderEmpireId }, { toEmpireId: defenderEmpireId }],
          status: "ACTIVE",
        },
      });
      messages.push(`Relations report: ${treaties.length} active treaties.`);
      for (const t of treaties) {
        const otherId = t.fromEmpireId === defenderEmpireId ? t.toEmpireId : t.fromEmpireId;
        messages.push(`  ${t.type} with empire ${otherId.slice(0, 8)}... (${t.turnsRemaining} turns)`);
      }
      effects.treatyCount = treaties.length;
      break;
    }
    case 6: { // Take Hostages
      const ransom = Math.floor(defenderEmpire.credits * 0.05);
      await prisma.empire.update({ where: { id: defenderEmpireId }, data: { credits: { decrement: ransom } } });
      messages.push(`Take Hostages: Ransomed ${ransom.toLocaleString()} credits from target.`);
      effects.creditsStolen = ransom;
      break;
    }
    case 7: { // Carrier Sabotage
      const carriersDestroyed = Math.max(1, Math.floor(defenderEmpire.army.carriers * 0.10));
      await prisma.army.update({
        where: { id: defenderEmpire.army.id },
        data: { carriers: { decrement: carriersDestroyed } },
      });
      messages.push(`Carrier Sabotage: ${carriersDestroyed} enemy carriers destroyed.`);
      effects.carriersDestroyed = carriersDestroyed;
      break;
    }
    case 8: { // Communications Spying
      const recentLogs = await prisma.turnLog.findMany({
        where: { player: { empire: { id: defenderEmpireId } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      messages.push(`Intercepted ${recentLogs.length} recent communications:`);
      for (const log of recentLogs) {
        messages.push(`  Action: ${log.action}`);
      }
      effects.logsIntercepted = recentLogs.length;
      break;
    }
    case 9: { // Setup Coup
      await prisma.empire.update({
        where: { id: defenderEmpireId },
        data: { civilStatus: Math.min(7, defenderEmpire.civilStatus + 2) },
      });
      const effLoss2 = 15;
      await prisma.army.update({
        where: { id: defenderEmpire.army.id },
        data: { effectiveness: Math.max(0, defenderEmpire.army.effectiveness - effLoss2) },
      });
      messages.push(`Setup Coup: Target civil status +2, effectiveness -${effLoss2}%.`);
      effects.civilStatusChange = 2;
      effects.effectivenessLoss = effLoss2;
      break;
    }
  }

  if (detected) messages.push(`Your agents were detected! Lost ${agentsLost} agents.`);

  return { success: true, detected, agentsLost, messages, effects };
}

/** Defender-facing line for the next turn situation report; null if the defender would not learn of the op. */
export function defenderCovertAlertMessage(
  attackerName: string,
  opType: number,
  result: CovertOpResult,
): string | null {
  if (!result.success) {
    return result.detected
      ? `Hostile covert activity from ${attackerName} was detected; the operation failed.`
      : null;
  }
  switch (opType) {
    case 0:
      return result.detected
        ? `Your intelligence detected ${attackerName}'s spy operation (intel may have leaked).`
        : null;
    case 1:
      return `Insurgent activity backed by ${attackerName} worsened your civil stability.`;
    case 2: {
      const n = (result.effects.soldiersLost as number) ?? 0;
      return `Dissension stirred by ${attackerName}: ${n} soldiers deserted.`;
    }
    case 3: {
      const n = (result.effects.effectivenessLoss as number) ?? 0;
      return `Enemy morale operations by ${attackerName} cut your army effectiveness by ${n}%.`;
    }
    case 4: {
      const n = (result.effects.foodDestroyed as number) ?? 0;
      return `Bombing operations by ${attackerName} destroyed ${n} food stores.`;
    }
    case 5:
      return result.detected
        ? `Your intelligence detected ${attackerName}'s spy operation on your diplomatic relations.`
        : null;
    case 6: {
      const n = (result.effects.creditsStolen as number) ?? 0;
      return `Hostage-taking by ${attackerName}: you lost ${n.toLocaleString()} credits in ransom.`;
    }
    case 7: {
      const n = (result.effects.carriersDestroyed as number) ?? 0;
      return `Carrier sabotage by ${attackerName}: ${n} carriers destroyed.`;
    }
    case 8:
      return result.detected
        ? `Your intelligence detected ${attackerName}'s communications intercept attempt.`
        : null;
    case 9: {
      const eff = (result.effects.effectivenessLoss as number) ?? 15;
      return `Coup attempt by ${attackerName}: civil unrest surged and army effectiveness dropped ${eff}%.`;
    }
    default:
      return null;
  }
}
