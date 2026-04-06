# Solar Realms Extreme (SRX)

A turn-based galactic empire management game — a modern reimagining of the BBS-era classic [Solar Realms Elite](https://breakintochat.com/wiki/Solar_Realms_Elite). Built with Next.js, Prisma, and PostgreSQL, styled with a monochrome terminal/BBS aesthetic.

## Quick Start

### Option A — Docker Compose (recommended)

Runs **PostgreSQL** and the **Next.js dev server** in containers. Source code is bind-mounted so edits hot-reload (with polling enabled for Docker Desktop on macOS/Windows).

```bash
# Optional: API keys and admin overrides (DATABASE_URL is set inside Compose for the app)
cat > .env <<EOF
GEMINI_API_KEY="your-key-here"
GEMINI_MODEL="gemini-2.5-flash"
# NEXT_DISABLE_DEV_INDICATOR="true"   # hide Next.js bottom-left dev indicator (restart required)
# ADMIN_USERNAME="admin"
# INITIAL_ADMIN_PASSWORD="srxpass"
# ADMIN_SESSION_SECRET="..."
EOF

docker compose up --build
# or: npm run docker:up
```

- **App:** [http://localhost:3000](http://localhost:3000) — Operators: [http://localhost:3000/admin](http://localhost:3000/admin) · [http://localhost:3000/admin/users](http://localhost:3000/admin/users) (accounts)
- **Postgres on the host:** `localhost:5433` (user `postgres`, password `postgres`, database `srx`) — use this in `DATABASE_URL` if you run **Prisma CLI on the host** (`migrate dev`, `studio`) against the same database.
- On startup the **app** container runs `prisma migrate deploy` (apply committed migrations). For new migrations from the host, run `npx prisma migrate dev` with `DATABASE_URL` pointing at port **5433**, or `docker compose exec app npx prisma migrate dev` (interactive).
- To seed **SystemSettings** from your `.env` into the DB (for `/admin` overrides): `DATABASE_URL="postgresql://postgres:postgres@localhost:5433/srx" npm run seed:system-settings`

Stop: `docker compose down` · Logs: `npm run docker:logs`

### Option B — Node on the host

```bash
docker run -d --name srx-postgres \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=srx \
  -p 5432:5432 postgres:16-alpine

cat > .env <<EOF
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/srx"
GEMINI_API_KEY="your-key-here"
GEMINI_MODEL="gemini-2.5-flash"
# NEXT_DISABLE_DEV_INDICATOR="true"
EOF

npm install
npx prisma migrate dev
npm run seed:system-settings   # copies GEMINI_* from .env into SystemSettings (optional; app reads env first)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to play. Operators can open [http://localhost:3000/admin](http://localhost:3000/admin) (link on the login screen) to list galaxies and create **pre-staged** lobbies that wait for the first human player before turns begin. **`/admin/users`** lists `UserAccount` rows (last login, game counts) and allows password resets and account deletion.

## Documentation

| Document | Description |
|----------|-------------|
| [HOWTOPLAY.md](HOWTOPLAY.md) | Player-facing game guide — strategies, controls, how everything works |
| [GAME-SPEC.md](GAME-SPEC.md) | Complete technical specification — every formula, constant, and data model. Enough to rebuild the game from scratch. |
| [CLAUDE.md](CLAUDE.md) | AI assistant guidance — commands, architecture, conventions |

## What Is This Game?

You manage an interstellar empire across **100 turns**. Each turn you take one action — buy planets, recruit military, attack rivals, conduct espionage, trade on the market, research technology, or adjust your economy — then your empire ticks forward: resources are produced and consumed, population grows or shrinks, maintenance is paid, and random events may occur. The player with the highest **net worth** at the end wins.

### Core Systems

- **10 planet types** — Food, Ore, Tourism, Petroleum, Urban, Education, Government, Supply, Research, Anti-Pollution
- **Population dynamics** — births, deaths, immigration, emigration driven by urban capacity, education, tax rate, pollution, and civil unrest
- **Superlinear maintenance** — planet upkeep grows quadratically with empire size; unchecked expansion is self-punishing
- **9 military unit types** (all purchasable, including light cruisers) across 3 upgrade tiers with a 3-front sequential combat system
- **6 attack types** — conventional invasion, guerrilla, nuclear, chemical, psionic, pirate raids (PvE)
- **10 covert operations** — spy, insurgent aid, dissension, demoralize, bombing, hostages, sabotage, and more
- **22 technologies** across 5 research categories
- **Global market** with supply/demand pricing, Solar Bank (loans, bonds, lottery)
- **5 AI opponents** powered by Google Gemini (configurable model, default `gemini-2.5-flash`) with distinct strategic personas — chosen during game setup. Works offline with a built-in rule-based fallback when no API key is set.

### UI & Controls

Single-page app with 3-column layout (3-5-4 grid): compact stat-box empire panel (left), 7-tabbed action panel (center), event log (right). **Header bar** shows whose turn it is (including a **lobby** line for admin-pre-staged galaxies awaiting the first human), countdown timer when a turn is active, credits, turn counter, and commander name. **Lobby system**: create named galaxies (public or private), share invite codes, browse and join public games, or resume existing games. New games require a commander name and password. Finished games are not resumable. **Strict turn order**: players act one at a time in a fixed sequence. AI opponents run in the background after your action; the UI polls so you see each AI's turn. If the next player is human, you wait until they go. **Turn start**: a situation report modal (income, events, critical alerts for starvation, fuel deficit, unrest, etc.) appears when your turn begins, before you choose an action. "Skip Turn" at top of command center. **Galactic Powers** leaderboard lists rivals with a **Prt** column for new-empire protection; click a rival to target them. Planet colonizer with card-style descriptions per type. Game Over screen with final standings, high scores, and game log export. CFG tab shows invite code for private games (click-to-copy), visibility toggle, turn timer setting (creator), and full turn order. Full keyboard shortcut support — `1`–`7` switch tabs, letter keys trigger actions, `Enter` skips turn. **Operators**: `/admin` (optional `ADMIN_USERNAME` / `INITIAL_ADMIN_PASSWORD` in `.env`) lists galaxies and creates empty or AI-filled pre-staged sessions; **`/admin/users`** manages registered accounts (stats, force password, delete).

## Simulation & Balance Testing

SRX includes a deterministic simulation engine for rapid balance iteration. All game randomness uses a seedable PRNG, so identical seeds produce identical games.

```bash
npm run sim:quick       # 30 turns, 3 players, seed 42, DB reset
npm run sim:full        # 100 turns, 5 players, per-turn logging
npm run sim:stress      # 10 repeated runs with aggregate win-rate report
npm run sim:csv         # Full run with CSV export
npm run sim -- --turns 200 --players 5 --seed 42 --strategies balanced,military_rush,turtle
```

5 built-in strategies: `balanced`, `economy_rush`, `military_rush`, `turtle`, `random`.

## Tech Stack

| Technology | Role |
|------------|------|
| Next.js 16 (App Router) | UI and API routes |
| Prisma 7 + `@prisma/adapter-pg` | PostgreSQL ORM |
| Google Gemini (2.5 Flash default) | AI opponent decisions |
| TypeScript | Entire codebase |
| Tailwind CSS | Terminal/BBS aesthetic |
| Vitest | Unit + E2E test suite |
| tsx | Simulation CLI runner |

## Project Structure

```
src/
  app/
    page.tsx                        # Main game UI + TurnSummaryModal + TurnTimer
    admin/page.tsx                  # Operator admin UI (/admin): galaxies list + create pre-staged lobbies
    admin/users/page.tsx            # Operator user accounts (/admin/users): list, force password, delete
    api/auth/                       # signup, login (UserAccount + Command Center)
    api/game/                       # action, tick, status, register, join, lobbies, session, messages, leaderboard, gameover, highscores, log
    api/ai/                         # setup, run-all, turn
    api/admin/                      # login, logout, me, password, settings, galaxies, users (cookie auth)
  components/
    ActionPanel.tsx                  # 7-tabbed action panel + turn order display
    EmpirePanel.tsx                  # Empire status with collapsible planet details
    EventLog.tsx                     # Color-coded turn report and event log
    Leaderboard.tsx                  # Galactic Powers (Rk, Commander, Prt, Worth, …) + click-to-target
  lib/
    game-engine.ts                   # Core: 19-step turn tick + 30 action types; blocks attacks/covert vs protected rivals
    empire-prisma.ts                 # Prisma-safe empire partial updates (scalar lists)
    game-constants.ts                # All balance values (single source of truth)
    turn-order.ts                    # Sequential turns; lobby = no active turn until first human (admin-staged galaxies)
    admin-auth.ts                    # Admin login + requireAdmin for /api/admin/*
    create-ai-players.ts             # Shared AI creation (register AI setup + admin-staged galaxies)
    ai-builtin-config.ts             # Fixed AI commander names / persona keys
    ai-runner.ts                     # Sequential AI turn execution
    ai-process-move.ts               # AI action + end_turn when invalid (skip parity with humans)
    combat.ts                        # Combat system (6 attack types, unit tiers)
    combat-loss-format.ts            # Human-readable unit-loss strings for reports & API messages
    espionage.ts                     # 10 covert operations
    research.ts                      # Tech tree (22 techs, 5 categories)
    gemini.ts                        # AI prompts (neutral rival targeting) + local fallback
    rng.ts                           # Seedable PRNG (mulberry32)
    simulation.ts                    # Headless simulation engine
    prisma.ts                        # Database client
    critical-events.ts               # Situation-report event tiers (critical / warning / info)
tests/
  unit/                              # Pure logic (rng, constants, research, combat, espionage, empire-prisma, turn-order lobby, gemini pickRival, …)
  e2e/                               # HTTP API: game flow, multiplayer, lobbies, auth accounts, aux routes (log, gameover, ai), admin (+ users), …
  vitest.e2e.config.ts               # E2E config: sequential files, `tests/e2e` only
scripts/
  simulate.ts                        # CLI runner for simulations
  fix-tsc-bin.js                     # postinstall: repair broken node_modules/.bin/tsc symlink
  docker-entrypoint-dev.sh           # Compose app entry: prisma generate, migrate deploy, next dev
prisma/
  schema.prisma                      # Database schema
Dockerfile.dev                       # Dev image: Node + deps + prisma generate
docker-compose.yml                   # Postgres + Next dev (bind mount, named volumes for node_modules/.next)
.dockerignore                        # Build context exclusions
```

## Development

```bash
npm run dev              # Dev server on localhost:3000 (host Node; needs DATABASE_URL in .env)
npm run docker:up        # Compose: Postgres + dev server in Docker (see Quick Start)
npm run docker:down      # Stop Compose stack
npm run docker:logs      # Follow `app` container logs
npm run build            # Production build
npm run lint             # ESLint
npm run typecheck        # TypeScript (uses typescript/lib/tsc.js; postinstall repairs broken npx tsc shim)
npx prisma studio        # Database GUI (use DATABASE_URL with port 5433 if DB is from Compose)
npx prisma migrate dev   # Create/apply migrations (host CLI → use :5433 when Compose owns Postgres)
```

### Testing

```bash
npm test                 # Unit tests only (default `vitest run` — fast, no DB server)
npm run test:unit        # Same as `npm test`
npm run test:e2e         # Starts Next.js on port 3005, runs E2E (needs PostgreSQL; see note below)
npm run test:e2e:only    # E2E against an already-running server — set `TEST_BASE_URL` if not :3000
npm run test:all         # Unit + `test:e2e`
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage report
```

**E2E:** `test:e2e` uses [start-server-and-test](https://github.com/bahmutov/start-server-and-test) to boot `next dev` on **127.0.0.1:3005** (with `TEST_BASE_URL` set for Vitest). Next.js only allows **one** `next dev` per project directory — **stop Docker Compose `app`** (or any other `next dev` in this repo) before running `test:e2e`, or use `test:e2e:only` with `TEST_BASE_URL=http://127.0.0.1:3000` while **`docker compose up`** is serving the app (same DB as Compose). Apply migrations so the schema matches the Prisma client.

All game balance values live in `src/lib/game-constants.ts` — the single source of truth referenced by game logic, UI labels, and simulation strategies. Changing a constant there automatically updates everything.
