/**
 * SRX in-game help content.
 *
 * Served by GET /api/game/help?game=srx.
 * Kept as a TypeScript string so it ships with the game bundle,
 * requiring no filesystem reads at runtime.
 */

export const SRX_HELP_TITLE = "Solar Realms Extreme — Help";

export const SRX_HELP_CONTENT = `
## The Goal

Rule a galactic empire for **100 turns**. Each turn you take one action — buy planets, build armies, attack rivals, trade, research, or spy. The player with the highest **net worth** at the end wins.

---

## Starting a Game

### Create a New Galaxy
From the Command Center choose **Create New Galaxy**. Set max players (2–128), optional name, public/private, turn timer, and optional AI opponents. Click **CREATE GALAXY** to start immediately.

### Join an Existing Galaxy
Choose **Join Existing Galaxy**, enter an invite code, or pick from the public list.

### AI Opponents
Add 0–5 AI rivals using the −/+ buttons. Each AI gets a randomly assigned strategy: Economy, Military, Research, Stealth, Turtle, Diplomatic, or Optimal (MCTS). You won't know which strategy until their play style reveals it.

---

## Your First Turns

You start with: 10,000 credits · 25,000 population · 7 planets (2F 2O 2U 1G) · 100 soldiers · 2 generals · 10 fighters · 15 turns protection.

**Recommended opening:**
1. **Set sell rates** — 50–80% for ore/petroleum is solid passive income every turn.
2. **Lower tax rate** — 20–30% lets population grow. Population = tax revenue.
3. **Buy Food planets** — without food everyone starves.
4. **Buy Urban planets** — each supports 20,000 population.
5. **Build soldiers** — start military even during protection.

---

## The Header Bar

- **Turn status** — \`▸ YOUR TURN\` (cyan) or \`▸ [NAME]'S TURN\` (yellow); door-game shows \`D3 · 2/5 full turns\`
- **Turn timer** — countdown; turns red under 1 hour
- **Credits** — your balance in yellow
- **Turn counter** — e.g., \`T5 (95 left)\`
- **Protection** — \`[P15]\` while new-empire protection is active
- **Commander name**

---

## The 7 Action Tabs

### 1. ECON — Economy

- **Colonize Planet** — each type is a card with cost and description:
  | Type | Role |
  |------|------|
  | Food | Feeds population and soldiers — essential |
  | Ore | Feeds mechanical units; sellable |
  | Tourism | High credit income; fragile in wartime |
  | Petroleum | Fuel + credits; generates pollution (offset with Anti-Pollution) |
  | Urban | Supports 20K pop and urban tax; needed for growth |
  | Education | +700 immigrants/planet/turn |
  | Government | Reduces maintenance; needed for generals (50/planet) and agents (300/planet) |
  | Supply | Auto-produces military units each turn; passive output |
  | Research | 750 RP/turn + light cruisers; half maintenance |
  | Anti-Pollution | Each neutralizes ~2 petroleum planets of pollution |

- **Set Tax Rate** — 20–35% = growth; 40–60% = income; >60% = people flee
- **Set Sell Rates** — auto-sell % of food/ore/petroleum each turn

⚠ Planet maintenance grows **quadratically** — each new planet costs more than the last. Government planets help offset this.

### 2. MIL — Military

| Unit | Cost | Role |
|------|------|------|
| Soldier | 280 cr | Ground; pirate raids |
| General | 780 cr | Required for attacks (50 per gov. planet) |
| Fighter | 380 cr | Orbital + pirate |
| Defense Station | 598 cr | Static defense; can't attack |
| Light Cruiser | 950 cr | Space + orbital; also from Research planets |
| Heavy Cruiser | 1,900 cr | Space superiority |
| Carrier | 1,430 cr | Fleet support |
| Covert Agent | 2,000 cr | Espionage (300 per gov. planet) |
| Command Ship | 20,000 cr | Unique flagship; boosts heavy cruisers |

**Effectiveness** starts at 100% and drops when you lose battles. Recovers +2%/turn.

### 3. WAR — Warfare

Select a target from the dropdown (or click a rival in Galactic Powers to auto-select).

| Attack | Description |
|--------|-------------|
| Conventional | 3-front (space → orbital → ground). Win all 3 to capture planets. Needs ≥1 general. |
| Guerrilla | Soldiers-only. Defenders get 4× bonus — use for harassment only. |
| Nuclear | 500M/nuke. Radiates planets, kills population. Devastating and expensive. |
| Chemical | Kills pop on 3 planets. 85% chance Galactic Coordinator retaliates against YOU. |
| Psionic Bomb | Wrecks target's civil status and military effectiveness. No direct damage. |
| Pirate Raid | Fight NPC pirates for loot. Scales with your military. Low risk, decent reward. |

**Tips:** Defenders get 1.5× bonus — only attack when you outgun them. Research unit tier upgrades for huge combat multipliers.

### 4. OPS — Covert Operations

Requires covert agents and covert points (regenerate +5/turn, max 50).

| Operation | Pts | Effect |
|-----------|-----|--------|
| Spy | 0 | Reveal target's resources, army, planets |
| Insurgent Aid | 1 | Worsen civil status |
| Support Dissension | 1 | 10% of soldiers desert |
| Demoralize Troops | 1 | Reduce effectiveness |
| Bombing Operations | 1 | Destroy 30% of food |
| Relations Spying | 0 | Reveal treaties |
| Take Hostages | 1 | Steal 10% of credits |
| Carrier Sabotage | 1 | Destroy 10% of carriers |
| Communications Spying | 1 | Reveal last 5 actions |
| Setup Coup | 2 | Civil +2 AND effectiveness −15% |

### 5. MKT — Galactic Market

- **Buy/Sell** food, ore, fuel at dynamic prices
- Base prices: Food 80 cr · Ore 120 cr · Fuel 300 cr
- Selling is at a discount (÷1.2); prices shift with supply/demand

### 6. RES — Research

Research planets generate 750 RP/turn. Five tech trees:

| Category | Range | Highlights |
|----------|-------|------------|
| Agriculture | 8K–25K RP | Boost food production |
| Industry | 10K–35K RP | Ore/petroleum, maintenance, tourism |
| Military | 20K–120K RP | Unit tier upgrades — massive combat multipliers |
| Society | 8K–20K RP | Population growth, stability, income |
| Deep Space | 35K–120K RP | Light cruiser upgrades, research speed +25% |

**Priority:** Military tier upgrades (Tier 2 soldier = 2× ground strength). With 1 research planet you accumulate ~37,500 RP over 50 turns — enough for 3–4 entry-level techs.

### 7. CFG — Settings

- **Tax Rate / Sell Rates** — quick adjustments
- **Game Session** — invite code (click to copy), visibility toggle (creator only)
- **Turn Order** — full player list, current player highlighted, \`[AI]\` tags

---

## Simultaneous (Door-Game) Turns

When enabled, play uses **calendar rounds**. Each round you get up to **5 full turns** (shown as \`D3 · 2/5 full turns\` in the header):

- **Full turn** = economy tick (situation report) + **one action** (or Skip)
- **Skip Turn** button: burns a full-turn slot without acting
- You **do not wait for AI** — everyone plays in parallel; AIs run in the background
- **Round timer**: when it expires, unused slots are skipped and each skipped slot consumes a \`turns left\`

---

## Turn Report & Alerts

After each action a **Turn Summary popup** appears:
- **Income vs Expenses** — tax, maintenance, market sales
- **Population** — births, deaths, immigration, emigration
- **Resources** — food/ore/fuel produced vs consumed
- **Combat Results** — front-by-front for attacks, spoils, unit losses
- **Events** — random events, deficit warnings, defender alerts

**Failed commands** show a red **FAILED** banner under the header. Click × or wait 12s to dismiss.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| \`1\`–\`7\` | Switch tabs (ECON, MIL, WAR, OPS, MKT, RES, CFG) |
| \`Enter\` | Skip turn |
| Letter keys | Trigger labeled action in current tab |

---

## Winning

**Net worth formula:**
- Planets × 2 each
- Population × 0.0002 per person
- Credits × 0.000015 per credit
- Military units (type-weighted)

A balanced empire (many planets + large population + solid finances + capable military) wins. The **Game Over screen** shows final standings, your empire summary, all-time high scores, and a JSON game log export.
`.trim();

/**
 * Help content registry — maps game type to { title, content }.
 * Add entries here when new games are added.
 */
export const HELP_REGISTRY: Record<string, { title: string; content: string }> = {
  srx: {
    title: SRX_HELP_TITLE,
    content: SRX_HELP_CONTENT,
  },
};
