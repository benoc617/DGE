import { GoogleGenerativeAI } from "@google/generative-ai";
import { PLANET_CONFIG, UNIT_COST } from "@/lib/game-constants";
import * as rng from "@/lib/rng";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

/** Max wait for `generateContent`; on expiry the SDK aborts and we use `localFallback`. */
const DEFAULT_GEMINI_TIMEOUT_MS = 60_000;
const MAX_GEMINI_TIMEOUT_MS = 300_000;

/**
 * Milliseconds for each Gemini API call (`generateContent` request timeout).
 * Override with `GEMINI_TIMEOUT_MS` (min 1000, max 300000; invalid values → default 60000).
 */
export function getGeminiRequestTimeoutMs(): number {
  const raw = process.env.GEMINI_TIMEOUT_MS;
  if (raw === undefined || raw === "") return DEFAULT_GEMINI_TIMEOUT_MS;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_GEMINI_TIMEOUT_MS;
  return Math.min(MAX_GEMINI_TIMEOUT_MS, Math.max(1000, Math.floor(n)));
}

/** DB `SystemSettings` overrides env (`GEMINI_API_KEY` / `GEMINI_MODEL`). */
export async function resolveGeminiConfig(): Promise<{ apiKey: string | null; model: string }> {
  const { prisma } = await import("@/lib/prisma");
  const row = await prisma.systemSettings.findUnique({ where: { id: "default" } });
  const key = row?.geminiApiKey?.trim() || process.env.GEMINI_API_KEY || null;
  const model = row?.geminiModel?.trim() || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  return { apiKey: key, model };
}


export const AI_PERSONAS: Record<string, string> = {
  economist: `You are "The Economist" - a shrewd galactic banker who prioritizes wealth above all.
Strategy: Focus on ore/tourism/urban planets for income. Maintain low taxes (20-35%). 
Sell excess resources aggressively. Avoid military confrontation. Build defense stations only.
Buy bonds to protect credits. Only attack pirates for extra income.
Key: Maximize credits and net worth through trade and production.`,

  warlord: `You are "The Warlord" - a ruthless military commander who respects only strength.
Strategy: Rush soldiers and fighters early. Buy light cruisers for cost-efficient fleet power (950cr each).
Buy government planets for generals. Build heavy cruisers for space dominance when rich.
Attack rival empires frequently via conventional invasion when you have the advantage.
Keep effectiveness high by winning battles. Moderate tax rate (40-50%).
Key: Build the largest army and conquer neighboring empires.`,

  spymaster: `You are "The Spy Master" - a shadowy manipulator who weakens foes before striking.
Strategy: Prioritize government planets for covert agent capacity.
Run insurgent aid and demoralize ops against rival empires (never yourself).
Only attack conventionally when target is at civil status 4+.
Maintain moderate economy to fund operations.
Key: Covert operations to weaken enemies, then strike when they're vulnerable.`,

  diplomat: `You are "The Diplomat" - a silver-tongued negotiator who builds alliances.
Strategy: Propose treaties with all neighbors. Form coalitions early.
Focus on urban and education planets for population growth.
Only attack isolated empires with no treaties. Trade extensively.
Low taxes (20-30%) for maximum population growth.
Key: Build alliances and grow through peaceful expansion.`,

  turtle: `You are "The Turtle" - a patient defender who waits for the perfect moment.
Strategy: Maximum defense stations, light cruisers, and fighters. Never attack first.
Light cruisers (950cr) are cost-efficient fleet defenders. Build anti-pollution planets.
Research military upgrades early. Buy bonds to store wealth safely.
Only counter-attack after being attacked. High tax tolerance (50-60%).
Key: Impenetrable defense, counter-attack only when enemies are weakened.`,
};

interface EmpireState {
  credits: number;
  food: number;
  ore: number;
  fuel: number;
  population: number;
  taxRate: number;
  civilStatus: number;
  turnsPlayed: number;
  turnsLeft: number;
  netWorth: number;
  isProtected: boolean;
  protectionTurns: number;
  foodSellRate: number;
  oreSellRate: number;
  petroleumSellRate: number;
  planets: { type: string; shortTermProduction: number }[];
  army: {
    soldiers: number;
    generals: number;
    fighters: number;
    defenseStations: number;
    lightCruisers: number;
    heavyCruisers: number;
    carriers: number;
    covertAgents: number;
    commandShipStrength: number;
    effectiveness: number;
    covertPoints: number;
  };
  research?: {
    accumulatedPoints: number;
    unlockedTechIds: string[];
  };
}

/** Uniform random rival for attacks/covert (exported for unit tests). */
export function pickRivalOpponent(rivalNames: string[]): string {
  if (rivalNames.length === 0) throw new Error("pickRivalOpponent: empty rivalNames");
  return rivalNames[rng.randomInt(0, rivalNames.length - 1)]!;
}

const VALID_ACTIONS = new Set([
  "buy_planet",
  "set_tax_rate",
  "set_sell_rates",
  "set_supply_rates",
  "buy_soldiers",
  "buy_generals",
  "buy_fighters",
  "buy_stations",
  "buy_light_cruisers",
  "buy_heavy_cruisers",
  "buy_carriers",
  "buy_covert_agents",
  "buy_command_ship",
  "attack_conventional",
  "attack_guerrilla",
  "attack_nuclear",
  "attack_chemical",
  "attack_psionic",
  "attack_pirates",
  "covert_op",
  "propose_treaty",
  "accept_treaty",
  "break_treaty",
  "create_coalition",
  "join_coalition",
  "leave_coalition",
  "market_buy",
  "market_sell",
  "bank_loan",
  "bank_repay",
  "buy_bond",
  "buy_lottery_ticket",
  "discover_tech",
  "send_message",
  "end_turn",
]);

export type AIMoveContext = {
  /** This AI player's commander name (never a valid attack target). */
  commanderName: string;
  /** Other players in the same session (human + AI), excluding self. */
  rivalNames: string[];
};

export type AIMoveResult = {
  action: string;
  target?: string;
  amount?: number;
  reasoning: string;
  /** Whether the Gemini API produced the move or local rule-based fallback ran. */
  llmSource: "gemini" | "fallback";
  [key: string]: unknown;
};

function sanitizeAIMove(
  move: Record<string, unknown>,
  ctx: AIMoveContext,
  llmSource: "gemini" | "fallback",
): AIMoveResult {
  const action = typeof move.action === "string" && VALID_ACTIONS.has(move.action) ? move.action : "end_turn";
  const commanderName = ctx.commanderName;
  const rivalNames = ctx.rivalNames.filter((n) => n !== commanderName);

  let target = typeof move.target === "string" ? move.target : undefined;
  const needsTarget =
    action === "attack_conventional" ||
    action === "attack_guerrilla" ||
    action === "attack_nuclear" ||
    action === "attack_chemical" ||
    action === "attack_psionic" ||
    action === "covert_op" ||
    action === "propose_treaty";

  if (needsTarget) {
    if (rivalNames.length === 0) {
      return {
        action: "end_turn",
        reasoning: typeof move.reasoning === "string" ? move.reasoning : "No rivals in session",
        llmSource,
      };
    }
    if (!target || !rivalNames.includes(target) || target === commanderName) {
      target = pickRivalOpponent(rivalNames);
    }
  }

  const reasoning = typeof move.reasoning === "string" ? move.reasoning : "—";

  const out: AIMoveResult = {
    ...move,
    action,
    reasoning,
    llmSource,
  };
  if (target !== undefined) out.target = target;
  return out;
}

export async function getAIMove(
  persona: string,
  empireState: unknown,
  gameEvents: string[],
  ctx: AIMoveContext,
): Promise<AIMoveResult> {
  const state = empireState as EmpireState;

  const planetSummary: Record<string, number> = {};
  if (state?.planets) {
    for (const p of state.planets) {
      planetSummary[p.type] = (planetSummary[p.type] || 0) + 1;
    }
  }

  const rivalBlock =
    ctx.rivalNames.length > 0
      ? `RIVAL COMMANDERS (your \`target\` for attacks/covert/treaty must be EXACTLY one of these names, never yourself):
${ctx.rivalNames.map((n) => `- ${n}`).join("\n")}
YOUR NAME (never use as target): ${ctx.commanderName}`
    : `NO OTHER EMPIRES IN SESSION — use economy/military buildup or end_turn only (no attack/covert targets).`;

  const prompt = `You are an AI commander in Solar Realms Extreme, a turn-based galactic strategy game.

YOUR PERSONA:
${persona}

${rivalBlock}

YOUR EMPIRE STATE:
- Credits: ${state?.credits ?? 0} | Food: ${state?.food ?? 0} | Ore: ${state?.ore ?? 0} | Fuel: ${state?.fuel ?? 0}
- Population: ${state?.population ?? 0} | Tax Rate: ${state?.taxRate ?? 30}% | Civil Status: ${state?.civilStatus ?? 0}/7
- Turns Played: ${state?.turnsPlayed ?? 0} | Turns Left: ${state?.turnsLeft ?? 0} | Net Worth: ${state?.netWorth ?? 0}
- Protected: ${state?.isProtected ? `Yes (${state.protectionTurns} turns)` : "No"}
- Sell Rates: Food ${state?.foodSellRate ?? 0}% | Ore ${state?.oreSellRate ?? 50}% | Petro ${state?.petroleumSellRate ?? 50}%
- Planets: ${JSON.stringify(planetSummary)} (${state?.planets?.length ?? 0} total)
- Army: Soldiers=${state?.army?.soldiers ?? 0} Generals=${state?.army?.generals ?? 0} Fighters=${state?.army?.fighters ?? 0} Stations=${state?.army?.defenseStations ?? 0} LightCruisers=${state?.army?.lightCruisers ?? 0} HeavyCruisers=${state?.army?.heavyCruisers ?? 0} Carriers=${state?.army?.carriers ?? 0} Covert=${state?.army?.covertAgents ?? 0}
- Effectiveness: ${state?.army?.effectiveness ?? 100}% | Covert Points: ${state?.army?.covertPoints ?? 0}
- Research Points: ${state?.research?.accumulatedPoints ?? 0} | Techs Unlocked: ${state?.research?.unlockedTechIds?.length ?? 0}

RECENT EVENTS (this galaxy only):
${gameEvents.slice(0, 12).join("\n") || "None"}

AVAILABLE ACTIONS (choose one):
Economy: buy_planet (type: FOOD|ORE|TOURISM|PETROLEUM|URBAN|EDUCATION|GOVERNMENT|SUPPLY|RESEARCH|ANTI_POLLUTION)
Economy: set_tax_rate (rate: 0-100), set_sell_rates (foodSellRate/oreSellRate/petroleumSellRate: 0-100)
Military: buy_soldiers, buy_generals, buy_fighters, buy_stations, buy_light_cruisers, buy_heavy_cruisers, buy_carriers, buy_covert_agents (amount: N)
Combat: attack_conventional (target: name), attack_guerrilla (target: name), attack_pirates
Market: market_buy (resource: food|ore|fuel, amount: N), market_sell (resource, amount)
Finance: bank_loan (amount: N), buy_bond (amount: N), buy_lottery_ticket (amount: 1-100)
Covert: covert_op (target: name, opType: 0-9)
Research: discover_tech (techId: string) -- if you have enough research points
Other: end_turn (just collect income)

COST REFERENCE: Soldier=280cr, General=780cr, Fighter=380cr, Station=520cr, LightCruiser=950cr, HeavyCruiser=1900cr, Carrier=1430cr, CovertAgent=4090cr
PLANET COSTS: Food=8000, Ore=6000, Tourism=8000, Petroleum=11500, Urban=8000, Education=8000, Gov=7500, Supply=11500, Research=23000, AntiPollution=10500

CRITICAL RULES:
- \`target\` must be one of the RIVAL COMMANDERS listed above — NEVER "${ctx.commanderName}" (yourself).
- Each action costs 1 turn. Choose the SINGLE BEST action for this turn.
- If food is low, buy food planets or buy food from market.
- If population is high relative to urban planets (1 urban = 20k capacity), buy urban planets.
- Government planets are needed for generals (50/planet cap) and covert agents (300/planet cap).
- Early game: focus on economy (planets, sell rates) before military — unless persona demands aggression.
- You need generals to attack. Buy government planets first.
- Light cruisers (950cr) are cost-efficient space/orbital units. Research planets also produce them for free.
- Heavy cruisers (1900cr) dominate the space front but cost double. Mix both for a balanced fleet.

Respond ONLY with valid JSON:
{"action": "action_name", "type": "value_if_buy_planet", "target": "name_if_attack", "amount": number_if_applicable, "opType": number_if_covert, "rate": number_if_set_tax, "techId": "id_if_discover", "reasoning": "brief tactical reasoning"}`;

  const runFallback = (): AIMoveResult => {
    const raw = localFallback(state, persona, ctx);
    return sanitizeAIMove(raw as Record<string, unknown>, ctx, "fallback");
  };

  const geminiCfg = await resolveGeminiConfig();
  if (!geminiCfg.apiKey || geminiCfg.apiKey.startsWith("your-")) {
    return runFallback();
  }

  try {
    const model = new GoogleGenerativeAI(geminiCfg.apiKey).getGenerativeModel({ model: geminiCfg.model });
    const result = await model.generateContent(prompt, {
      timeout: getGeminiRequestTimeoutMs(),
    });
    const text = result.response.text().trim();
    const json = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(json) as Record<string, unknown>;
    if (typeof parsed.action !== "string" || !VALID_ACTIONS.has(parsed.action)) {
      return runFallback();
    }
    return sanitizeAIMove(parsed, ctx, "gemini");
  } catch {
    return runFallback();
  }
}

function localFallback(
  state: EmpireState,
  persona: string,
  ctx: AIMoveContext,
): { action: string; target?: string; amount?: number; reasoning: string; opType?: number; [key: string]: unknown } {
  const s = state;
  const planets = s?.planets ?? [];
  const army = s?.army;
  const credits = s?.credits ?? 0;
  const food = s?.food ?? 0;
  const population = s?.population ?? 0;
  const turnsPlayed = s?.turnsPlayed ?? 0;

  const rivalNames = ctx.rivalNames.filter((n) => n !== ctx.commanderName);

  const PC = PLANET_CONFIG;
  const UC = UNIT_COST;

  const pCount: Record<string, number> = {};
  for (const p of planets) pCount[p.type] = (pCount[p.type] || 0) + 1;
  const totalPlanets = planets.length;
  const foodPlanets = pCount["FOOD"] ?? 0;
  const orePlanets = pCount["ORE"] ?? 0;
  const urbanPlanets = pCount["URBAN"] ?? 0;
  const govPlanets = pCount["GOVERNMENT"] ?? 0;
  const supplyPlanets = pCount["SUPPLY"] ?? 0;

  const isWarlord = persona.includes("Warlord");
  const isTurtle = persona.includes("Turtle");
  const isEcon = persona.includes("Economist");
  const isSpy = persona.includes("Spy");

  if (turnsPlayed === 0 && s.foodSellRate === 0) {
    return { action: "set_sell_rates", foodSellRate: 0, oreSellRate: 60, petroleumSellRate: 80, reasoning: "Set initial sell rates" };
  }

  if (food < 50 && credits >= PC.FOOD.baseCost) {
    return { action: "buy_planet", type: "FOOD", reasoning: "Critical: food low" };
  }
  if (food < 0 && credits >= 100 * 80) {
    return { action: "market_buy", resource: "food", amount: 100, reasoning: "Emergency food buy" };
  }

  // Early aggression (Warlord / Spy) when rivals exist
  if (rivalNames.length > 0 && !s.isProtected && army) {
    if (isWarlord && turnsPlayed >= 6 && (army.generals ?? 0) >= 1 && rng.random() < 0.2) {
      return {
        action: "attack_conventional",
        target: pickRivalOpponent(rivalNames),
        reasoning: "Press rival empires",
      };
    }
    if (isSpy && turnsPlayed >= 8 && (army.covertAgents ?? 0) >= 1 && rng.random() < 0.25) {
      return {
        action: "covert_op",
        target: pickRivalOpponent(rivalNames),
        opType: rng.random() < 0.5 ? 0 : 1,
        reasoning: "Covert ops vs rival",
      };
    }
    if (isWarlord && turnsPlayed >= 5 && rng.random() < 0.14) {
      return { action: "attack_pirates", reasoning: "Raid pirates for income" };
    }
  }

  if (turnsPlayed < 20) {
    if (foodPlanets < 3 && credits >= PC.FOOD.baseCost) return { action: "buy_planet", type: "FOOD", reasoning: "Need more food early" };
    if (urbanPlanets < 3 && credits >= PC.URBAN.baseCost) return { action: "buy_planet", type: "URBAN", reasoning: "Grow population capacity" };
    if (orePlanets < 3 && credits >= PC.ORE.baseCost) return { action: "buy_planet", type: "ORE", reasoning: "Need ore for units" };
    if (govPlanets < 2 && credits >= PC.GOVERNMENT.baseCost) return { action: "buy_planet", type: "GOVERNMENT", reasoning: "Need government for generals" };
    if (isEcon && credits >= PC.TOURISM.baseCost) return { action: "buy_planet", type: "TOURISM", reasoning: "Tourism income" };
    if (credits >= UC.SOLDIER * 10) {
      const amt = Math.min(Math.floor(credits * 0.4 / UC.SOLDIER), 50);
      if (amt > 0) return { action: "buy_soldiers", amount: amt, reasoning: "Build early defense" };
    }
    return { action: "end_turn", reasoning: "Saving credits" };
  }

  if (population > urbanPlanets * 18000 && credits >= PC.URBAN.baseCost) {
    return { action: "buy_planet", type: "URBAN", reasoning: "Population nearing cap" };
  }

  if (isWarlord) {
    if (rivalNames.length > 0 && !s.isProtected && army && (army.generals ?? 0) >= 1) {
      if (rng.random() < 0.38) {
        return {
          action: "attack_conventional",
          target: pickRivalOpponent(rivalNames),
          reasoning: "Conventional invasion",
        };
      }
      if (rng.random() < 0.14) {
        return {
          action: "attack_guerrilla",
          target: pickRivalOpponent(rivalNames),
          reasoning: "Guerrilla harassment",
        };
      }
      if (rng.random() < 0.12) {
        return { action: "attack_pirates", reasoning: "Pirate raid" };
      }
    }
    if (govPlanets < 2 && credits >= PC.GOVERNMENT.baseCost) return { action: "buy_planet", type: "GOVERNMENT", reasoning: "Need generals" };
    if (army && army.generals < 2 && govPlanets > 0 && credits >= UC.GENERAL * 2) return { action: "buy_generals", amount: 2, reasoning: "Need generals to attack" };
    if (army && army.soldiers < 200 && credits >= UC.SOLDIER * 30) return { action: "buy_soldiers", amount: Math.min(30, Math.floor(credits / UC.SOLDIER)), reasoning: "Build army" };
    if (army && army.fighters < 50 && credits >= UC.FIGHTER * 15) return { action: "buy_fighters", amount: Math.min(15, Math.floor(credits / UC.FIGHTER)), reasoning: "Build fighters" };
    if (credits >= UC.LIGHT_CRUISER * 10) return { action: "buy_light_cruisers", amount: Math.min(10, Math.floor(credits / UC.LIGHT_CRUISER)), reasoning: "Light cruisers for fleet" };
    if (credits >= UC.HEAVY_CRUISER * 5) return { action: "buy_heavy_cruisers", amount: Math.min(5, Math.floor(credits / UC.HEAVY_CRUISER)), reasoning: "Heavy cruisers for space" };
    if (supplyPlanets < 1 && credits >= PC.SUPPLY.baseCost) return { action: "buy_planet", type: "SUPPLY", reasoning: "Auto-produce military" };
    if (foodPlanets < totalPlanets * 0.2 && credits >= PC.FOOD.baseCost) return { action: "buy_planet", type: "FOOD", reasoning: "Need food for army" };
    return { action: "buy_soldiers", amount: Math.max(1, Math.min(20, Math.floor(credits / UC.SOLDIER))), reasoning: "More soldiers" };
  }

  if (isTurtle) {
    if (credits >= UC.DEFENSE_STATION * 10 && army && army.defenseStations < 80) return { action: "buy_stations", amount: Math.min(10, Math.floor(credits / UC.DEFENSE_STATION)), reasoning: "Fortify defenses" };
    if (credits >= UC.FIGHTER * 10 && army && army.fighters < 60) return { action: "buy_fighters", amount: Math.min(10, Math.floor(credits / UC.FIGHTER)), reasoning: "Defensive fleet" };
    if (credits >= UC.LIGHT_CRUISER * 5) return { action: "buy_light_cruisers", amount: Math.min(5, Math.floor(credits / UC.LIGHT_CRUISER)), reasoning: "Light cruiser defense" };
    if (foodPlanets < totalPlanets * 0.25 && credits >= PC.FOOD.baseCost) return { action: "buy_planet", type: "FOOD", reasoning: "Secure food supply" };
    if (credits >= PC.ORE.baseCost) return { action: "buy_planet", type: "ORE", reasoning: "Feed the military machine" };
    return { action: "end_turn", reasoning: "Holding steady" };
  }

  if (isSpy) {
    if (rivalNames.length > 0 && army && (army.covertAgents ?? 0) >= 1 && rng.random() < 0.32) {
      return {
        action: "covert_op",
        target: pickRivalOpponent(rivalNames),
        opType: rng.randomInt(0, 4),
        reasoning: "Sustained covert pressure",
      };
    }
    if (rivalNames.length > 0 && !s.isProtected && army && (army.generals ?? 0) >= 1 && (army.soldiers ?? 0) >= 120 && rng.random() < 0.2) {
      return {
        action: "attack_conventional",
        target: pickRivalOpponent(rivalNames),
        reasoning: "Strike after intelligence",
      };
    }
    if (govPlanets < 3 && credits >= PC.GOVERNMENT.baseCost) return { action: "buy_planet", type: "GOVERNMENT", reasoning: "House covert agents" };
    if (army && army.covertAgents < govPlanets * 200 && credits >= UC.COVERT_AGENT * 3) return { action: "buy_covert_agents", amount: Math.min(3, Math.floor(credits / UC.COVERT_AGENT)), reasoning: "Expand spy network" };
    if (credits >= UC.SOLDIER * 20 && army && army.soldiers < 150) return { action: "buy_soldiers", amount: Math.min(20, Math.floor(credits / UC.SOLDIER)), reasoning: "Need ground troops" };
    if (foodPlanets < 3 && credits >= PC.FOOD.baseCost) return { action: "buy_planet", type: "FOOD", reasoning: "Feed empire" };
    if (credits >= PC.URBAN.baseCost) return { action: "buy_planet", type: "URBAN", reasoning: "Grow population" };
    return { action: "end_turn", reasoning: "Planning operations" };
  }

  // Economist / diplomat / default
  if (totalPlanets < 15) {
    const needs: [boolean, string][] = [
      [foodPlanets < totalPlanets * 0.2, "FOOD"],
      [urbanPlanets < 4, "URBAN"],
      [orePlanets < 3, "ORE"],
      [!pCount["TOURISM"], "TOURISM"],
      [(pCount["PETROLEUM"] ?? 0) < 2, "PETROLEUM"],
    ];
    const need = needs.find(([flag]) => flag);
    if (need) {
      const cost = PC[need[1] as keyof typeof PC]?.baseCost ?? 14000;
      if (credits >= cost) return { action: "buy_planet", type: need[1], reasoning: `Expand: need ${need[1]}` };
    }
    if (credits >= PC.TOURISM.baseCost) return { action: "buy_planet", type: "TOURISM", reasoning: "More tourism income" };
  }

  if (army && army.soldiers < 100 && credits >= UC.SOLDIER * 15) {
    return { action: "buy_soldiers", amount: Math.min(15, Math.floor(credits / UC.SOLDIER)), reasoning: "Minimum defense" };
  }
  if (army && army.fighters < 30 && credits >= UC.FIGHTER * 10) {
    return { action: "buy_fighters", amount: Math.min(10, Math.floor(credits / UC.FIGHTER)), reasoning: "Fleet defense" };
  }

  if (credits >= 50000) return { action: "buy_bond", amount: Math.min(credits - 10000, 50000), reasoning: "Invest surplus" };
  return { action: "end_turn", reasoning: "Conserving resources" };
}
