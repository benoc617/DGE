# Solar Realms Extreme (SRX)

A turn-based galactic empire management game — a modern reimagining of the BBS-era classic [Solar Realms Elite](https://breakintochat.com/wiki/Solar_Realms_Elite). Implemented on the [Door Game Engine (DGE)](../../README.md).

## The Game

You manage an interstellar empire across **100 turns**. Each turn you take one action — buy planets, recruit military, attack rivals, conduct espionage, trade on the market, research technology, or adjust your economy — then your empire ticks forward: resources are produced and consumed, population grows or shrinks, maintenance is paid, and random events may occur. The player with the highest **net worth** at the end wins.

**Optional simultaneous-turn (door-game) mode:** up to **five full turns per calendar day**. Each full turn is tick → one action, auto-closed on the server; use **Skip** to end without acting. Each full turn consumes one of your 100 `turnsLeft`. Humans and AIs all play within the round; a round timer skips unused slots when it expires (each skipped slot also consumes `turnsLeft`). The default remains sequential one-player-at-a-time turns.

## Documentation

| Document | Description |
|----------|-------------|
| [docs/HOWTOPLAY.md](docs/HOWTOPLAY.md) | Player-facing guide — strategies, controls, all game systems |
| [docs/GAME-SPEC.md](docs/GAME-SPEC.md) | Complete technical specification — every formula, constant, and data model |

## Core Systems

- **10 planet types** — Food, Ore, Tourism, Petroleum, Urban, Education, Government, Supply, Research, Anti-Pollution
- **Population dynamics** — births, deaths, immigration, emigration driven by urban capacity, education, tax rate, pollution, and civil unrest
- **Superlinear maintenance** — planet upkeep grows quadratically with empire size; unchecked expansion is self-punishing
- **9 military unit types** across 3 upgrade tiers with a 3-front sequential combat system
- **6 attack types** — conventional invasion, guerrilla, nuclear, chemical, psionic, pirate raids (PvE)
- **10 covert operations** — spy, insurgent aid, dissension, demoralize, bombing, hostages, sabotage, and more
- **22 technologies** across 5 research categories
- **Global market** with supply/demand pricing, Solar Bank (loans, bonds, lottery)
- **Up to 5 AI opponents** powered by Google Gemini (configurable model, default `gemini-2.5-flash`) with 7 distinct strategic personas — randomly assigned at galaxy creation. The **Optimal** AI uses built-in Monte Carlo Tree Search and never calls Gemini. Works offline with a rule-based fallback when no API key is set.

## UI & Controls

Single-page app with 3-column layout (3-5-4 grid): compact stat-box empire panel (left), 7-tabbed action panel (center), event log (right).

- **Header bar** — whose turn it is (including a lobby line for admin-pre-staged galaxies), countdown timer, credits, turn counter, commander name
- **Turn start** — situation report modal (income, events, critical alerts for starvation, fuel deficit, unrest) before you choose an action
- **Galactic Powers leaderboard** — rivals with Prt column for new-empire protection; click a rival to target them
- **CFG tab** — invite code (click-to-copy), visibility toggle, turn timer, full turn order
- **Game Over screen** — final standings, high scores, game log export
- **Keyboard shortcuts** — `1`–`7` switch tabs, letter keys trigger actions, `Enter` skips turn

## Simulation & Balance Testing

SRX includes a deterministic simulation engine for rapid balance iteration. All randomness uses a seedable PRNG.

```bash
# Run inside the app container (Compose must be up)
docker compose exec app npm run sim:quick
docker compose exec app npm run sim:full
docker compose exec app npm run sim:stress
docker compose exec app npm run sim:csv

# Custom runs
docker compose exec app npm run sim -- --turns 200 --players 8 --seed 42 \
  --strategies balanced,military_rush,turtle,research_rush

# Session sims (run real GameSession code paths)
docker compose exec app npm run sim -- --session sequential --turns 50 --players 3 --seed 1
docker compose exec app npm run sim -- --session simultaneous --apd 1 --turns 50 --players 3 --seed 1
```

**Orphan sim** (no `--session`): strategy bots with no `GameSession` — fast, no turn-order or door-game API.

**Session sim** (`--session sequential` or `simultaneous`): creates a real `GameSession`, runs the same code paths as the HTTP game. The temp galaxy is deleted after the report.

Preset strategies: `balanced`, `economy_rush`, `military_rush`, `turtle`, `random`, `research_rush`, `credit_leverage`, `growth_focus`, `mcts`. Use `--players 9` to run all presets in one sim.

## Source Layout

```
games/srx/
  src/
    definition.ts      # SrxGameDefinition implements GameDefinition<SrxWorldState>
    help-content.ts    # In-game help text (served by GET /api/game/help?game=srx)
    types.ts           # SrxWorldState, SrxEmpireSlice
    index.ts           # Barrel export
  docs/
    GAME-SPEC.md       # Complete technical specification
    HOWTOPLAY.md       # Player-facing guide
  package.json         # @dge/srx workspace package

# SRX-specific app-layer code (src/ at repo root)
src/lib/
  game-engine.ts       # 19-step turn tick + 35 action types
  game-constants.ts    # All balance values — single source of truth
  combat.ts            # 6 attack types, unit tiers, 3-front system
  espionage.ts         # 10 covert operations
  research.ts          # Tech tree (22 techs, 5 categories)
  simulation.ts        # Headless simulation engine (9 preset strategies)
  simulation-harness.ts  # Full session simulation runner
  sim-state.ts         # Pure in-memory empire state + evalState heuristic
  search-opponent.ts   # MCTS and MaxN for the Optimal AI
  gemini.ts            # AI prompts + 7 personas + local fallback
src/components/
  ActionPanel.tsx      # 7-tabbed action panel
  EmpirePanel.tsx      # Empire status + planet details
  EventLog.tsx         # Color-coded turn report ("COMM CHANNEL")
  Leaderboard.tsx      # Galactic Powers panel
```

All SRX balance values live in `src/lib/game-constants.ts` — changing a constant there updates game logic, UI labels, and simulation strategies simultaneously.
