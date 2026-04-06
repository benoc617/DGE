# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation Sync Rule

**Whenever you make a change to game mechanics, constants, UI, data model, or project structure — especially before a commit — you MUST update all affected documentation files:**

- **`README.md`** — Project overview, setup, tech stack, structure. Update if you add dependencies, change commands, add files, or change the project description.
- **`HOWTOPLAY.md`** — Player-facing game guide. Update if you change game mechanics, add/remove actions, change costs, alter strategies, or modify UI controls.
- **`GAME-SPEC.md`** — Complete technical specification. Update if you change ANY game formula, constant, data model field, action type, tech tree entry, combat mechanic, or turn tick step. This is the authoritative spec — it must always match the code.
- **`CLAUDE.md`** — This file. Update if you change commands, architecture, key file roles, or add new conventions.

**Before every commit, verify that all four markdown files reflect the current state of the codebase.** If a change only affects code style or non-functional refactoring, docs may not need updating — use judgment.

## Test Sync Rule

**Every code change MUST include corresponding test updates.** This is non-negotiable — treat tests as part of the definition of done, not a follow-up task.

### Procedure for every change:

1. **Before writing code**, identify which existing tests cover the area you're about to modify. Run them to confirm they pass.
2. **While implementing**, update or add tests in lockstep with the code:
   - **New feature / new action type / new API field** → add unit tests for the logic AND E2E tests for the API surface.
   - **Changed behavior / formula / constant** → update existing tests to match the new expected values. Failing to update is as bad as not having tests.
   - **Bug fix** → write a regression test that would have caught the bug before applying the fix.
   - **Schema change** → update any E2E tests that depend on the affected model fields or API responses.
   - **Refactor (no behavior change)** → run the full suite (`npm test`) and confirm nothing breaks. If tests need adjusting for import paths or renamed functions, do it in the same change.
3. **After implementing**, run `npm test` (unit) and, when you touch HTTP routes or multiplayer flows, `npm run test:all` (unit + E2E). Confirm tests pass before considering the change complete. Do not move on to documentation or commit prep with failing tests.
4. **Never delete or skip a failing test** to make the suite green. Fix the code or fix the test — skipping masks regressions.

### Where tests live:

- **Unit tests** → `tests/unit/` — pure logic (game constants, RNG, research tree, formulas, turn-order logic). No server or DB.
- **E2E tests** → `tests/e2e/` — full API integration (registration, actions, turn enforcement, multiplayer, lobbies). Use helpers in `tests/e2e/helpers.ts`.
- If a new lib file is added under `src/lib/`, it should get a corresponding `tests/unit/<name>.test.ts`.
- If a new API route is added under `src/app/api/`, it should be exercised by at least one E2E test.

## Next.js dev server (Docker only)

**Default workflow:** run the app with **`npm run docker:up`** or **`docker compose up --build`**. Next.js runs **inside the `app` container** (bind-mounted source, `DATABASE_URL` to the Compose Postgres service). **Do not** use `npm run dev` / `npm start` on the host for normal development.

**Agents (Claude Code, Cursor, etc.):** do **not** launch `next dev`, `npm run dev`, or `npm start` on the host unless the user **explicitly** asks for a host-only run. Starting the dev server outside Docker conflicts with the intended setup and can bind port 3000 while pointing at the wrong `DATABASE_URL`.

For Prisma CLI on the host against the Compose database, use **`DATABASE_URL`** with **`localhost:5433`** (see README). For migrations inside the stack, use **`docker compose exec app npx prisma migrate deploy`** (or `migrate dev`).

## Commands

```bash
npm run docker:up    # Docker Compose: Postgres + Next dev — primary way to run the app
npm run docker:down  # Stop Compose stack
npm run docker:logs  # Follow app container logs
npm run dev          # Host-only Next dev — NOT the default; use Docker for the app
npm run build        # Production build (uses next build)
npm run lint         # ESLint
npm run typecheck    # TypeScript --noEmit (uses typescript/lib/tsc.js; see postinstall)

# Database
npx prisma migrate dev --name <migration_name>   # Create and apply a migration
npx prisma studio                                 # GUI to inspect the database
npx prisma generate                               # Regenerate Prisma client after schema changes
npm run seed:system-settings                      # Copy GEMINI_* from .env into SystemSettings (requires DB reachable)

# Simulation (balance testing)
npm run sim             # Custom: npx tsx scripts/simulate.ts [options]
npm run sim:quick       # 30 turns, 3 players, seed 42, DB reset
npm run sim:full        # 100 turns, 5 players, per-turn logging, seed 42
npm run sim:stress      # 10 repeated runs, aggregate win-rate report
npm run sim:csv         # Full run with CSV export to sim_output.csv
```

### Simulation CLI options

```
--turns N         Turns per player (default: 50)
--players N       Number of players (default: 3)
--seed N          RNG seed for reproducibility (default: random)
--verbosity N     0=silent 1=summary 2=per-turn 3=verbose (default: 1)
--csv FILE        Export snapshots to CSV
--strategies S    Comma-separated: balanced,economy_rush,military_rush,turtle,random
--reset           Reset DB before simulation
--repeat N        Run N simulations with incrementing seeds
```

### Testing

```bash
npm test                    # Unit tests only (default; fast, no PostgreSQL required)
npm run test:unit           # Same as `npm test`
npm run test:e2e            # Starts Next on :3005 via start-server-and-test, then runs E2E (needs DB)
npm run test:e2e:only       # E2E only — server must already be running (`TEST_BASE_URL`, default :3000)
npm run test:all            # `test:unit` + `test:e2e`
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report
```

- **Unit tests** (`tests/unit/`): pure logic — RNG, constants, research, combat, espionage, `empire-prisma`, critical-events, `auth` helpers, `system-settings`, `ui-tooltips`, turn-order lobby rules, `gemini` rival pick, etc. No database or server needed. Large orchestration (`game-engine`, `ai-runner`, `simulation`, DB-backed `player-auth`) is covered by **E2E** and **`npm run sim:*`**, not duplicated as thin unit shells — add **unit** tests when you extract pure functions worth testing in isolation.
- **E2E tests** (`tests/e2e/`, needs PostgreSQL): HTTP integration. Files run **sequentially** (`fileParallelism: false` in `vitest.e2e.config.ts`) to avoid DB cross-talk; each suite uses unique names/galaxies. Uses `tests/e2e/helpers.ts` (includes `clearNewEmpireProtectionForPlayers` where tests need to strike a rival).

| File | Covers |
|------|--------|
| `game-flow.test.ts` | Register/login, tick/action split, inline tick, AI setup + background AI turn (poll), turn order |
| `multiplayer.test.ts` | Multi-human sessions, turn order enforcement |
| `lobby.test.ts` | Public list, join, invite, galaxy name collision, session patch |
| `admin.test.ts` | Admin login, galaxies CRUD, settings, password, **users list / force password / delete** |
| `auth-account.test.ts` | `POST /api/auth/signup`, `POST /api/auth/login`, register links `UserAccount` |
| `api-routes.test.ts` | `log`, `leaderboard`, `highscores`, `messages`, **gameover**, **`ai/run-all`**, **`ai/turn` (error path)** |
| `protection.test.ts` | Attacks vs protected rival blocked |
| `combat-reporting.test.ts` | `message` + `actionDetails.combatResult` (pirate, guerrilla) |
| `defender-alerts.test.ts` | Defender alert queue / ALERT lines |

The **game-flow** AI test uses **one** AI opponent and a long timeout for Gemini when the key is set; local fallback still exercises the path.
- **Next.js dev lock:** only one `next dev` per repo directory. Prefer **`npm run test:e2e:only`** with **`TEST_BASE_URL=http://127.0.0.1:3000`** while **Compose** serves the app, or stop the containerized dev server before **`npm run test:e2e`** (which boots its own Next on :3005).
- Framework: Vitest. Unit config: `vitest.config.ts` (include `tests/unit/**` only). E2E config: `vitest.e2e.config.ts`.
- The simulation harness (`npm run sim:*`) is still available for balance/regression testing.

## Docker (local development)

This is the **canonical** environment for running **Next.js** in this repo (see **Next.js dev server (Docker only)** above).

- **`docker-compose.yml`** + **`Dockerfile.dev`**: PostgreSQL + `next dev` with the repo bind-mounted, `node_modules` and `.next` in named volumes, polling enabled for file watchers on macOS/Windows. The named `node_modules` volume can hide image-built deps; **`scripts/docker-entrypoint-dev.sh`** runs `npm ci` when the Linux `lightningcss-*` optional package is missing (e.g. after a host-only `npm install` polluted the volume). **`next.config.mjs`** sets **`turbopack.root`** to the config directory so Turbopack does not infer `src/app` as the project root (which breaks Tailwind/postcss/lightningcss in Docker). If dev fails with stale chunks referencing removed files, clear the cache: `docker compose run --rm --no-deps --entrypoint "" app sh -c "find /app/.next -mindepth 1 -delete"`.
- Postgres is published on **host port 5433** (avoids clashing with a local Postgres on 5432). Inside Compose, the app uses `DATABASE_URL=...@postgres:5432/srx`.
- **`scripts/docker-entrypoint-dev.sh`**: `prisma generate`, `migrate deploy`, then `next dev --hostname 0.0.0.0`.
- Optional **`.env`** is merged via `env_file` (`required: false`) for `GEMINI_*`, admin vars, etc.; `DATABASE_URL` in compose overrides for the app container.

## Environment

Requires a `.env` file (not committed) with:
```
# Host Node + local Postgres on default port:
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/srx"
# If Postgres is only the Compose service on host port 5433:
# DATABASE_URL="postgresql://postgres:postgres@localhost:5433/srx"
GEMINI_API_KEY="..."          # or set in shell env; shell takes precedence
GEMINI_MODEL="gemini-2.5-flash"  # optional, defaults to gemini-2.5-flash
GEMINI_TIMEOUT_MS="60000"     # optional; max wait per AI Gemini call (ms), default 60000, clamped 1000–300000; then localFallback
# NEXT_DISABLE_DEV_INDICATOR="true"  # optional; hides the Next.js dev route indicator (restart dev server)
# Admin UI (/admin) — optional overrides (defaults admin / srxpass)
ADMIN_USERNAME="admin"
INITIAL_ADMIN_PASSWORD="srxpass"
# ADMIN_SESSION_SECRET="..."  # optional; defaults align with INITIAL_ADMIN_PASSWORD
```

PostgreSQL runs via Docker: `docker run -d --name srx-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=srx -p 5432:5432 postgres:16-alpine`

Prisma 7 uses `prisma.config.ts` for datasource config (NOT in schema.prisma). The `PrismaClient` requires `@prisma/adapter-pg`.

## Inspecting game state and logs (agents / debugging)

Use this when you need to verify what happened in a live or test DB (e.g. from Cursor with terminal + `DATABASE_URL` loaded from `.env`).

### API (HTTP)

- **`GET /api/game/status?id=<playerId>`** or **`?player=<name>`** — current empire, session, turn order, `isYourTurn`, etc. Requires the app running (Compose is default; host `npm run dev` only if you started it explicitly).
- **`GET /api/game/session?id=<sessionId>`** — invite code, galaxy name, visibility (creator flows).
- **`GET /api/game/log?player=<name>`** — dumps **all** `TurnLog` and **all** `GameEvent` rows in the database (not scoped to one session). Prefer Prisma queries below for “this galaxy only.”

### Database (recommended for session-scoped history)

1. Load env: `cd` to repo root and `set -a && [ -f .env ] && . ./.env && set +a` (or rely on the shell’s existing `DATABASE_URL`).
2. **`npx prisma studio`** — browse tables visually.
3. **Ad-hoc script** — `npx tsx -e '...'` with `PrismaClient` + `@prisma/adapter-pg` + `pg` `Pool` (same pattern as `src/lib/prisma.ts`). Example: `GameSession.findFirst({ where: { galaxyName: "..." } })`, then `TurnLog.findMany({ where: { player: { gameSessionId: sid } }, orderBy: { createdAt: "asc" } })`.
4. **Raw SQL** — `psql "$DATABASE_URL"` if `psql` is installed.

### What the logs mean

- **`TurnLog`** — one row per completed action; `details` JSON includes `params`, `actionMsg`, and either **`report`** (economy snapshot) or **`tickReportDeferred: true`** when the tick already ran earlier in the turn (`POST /api/game/tick` or AI `runAndPersistTick`). Rows with `tickReportDeferred` are **not** missing economy data — the real numbers were applied when the tick ran; omitting the duplicate avoids storing an all-zero stub.
- **`GameEvent`** — `gameSessionId` is set for new events from in-game actions and AI turns (per-session). `type: ai_turn` rows include `details.llmSource` (`gemini` | `fallback`); the `message` field is prefixed `[gemini]` or `[fallback]` for quick scanning. Legacy rows may have null `gameSessionId`.

### Known pitfalls (investigated)

- **AI “self-attack”** — Gemini (or bad JSON) could emit `target` equal to the acting commander’s name. **`processAction` now rejects** targeting your own `playerId` for attacks, covert ops, and treaty proposals. The Gemini prompt also forbids self-targets.
- **TurnLog `report.income` all zeros** — seen when actions ran **after** the tick was already persisted; previously the full `details` stored a zeroed stub `report`. Now **`tickReportDeferred: true`** is stored instead of that stub when applicable.

## Architecture

Solar Realms Extreme is a turn-based galactic empire management game (BBS-era Solar Realms Elite remake with modern improvements). See `GAME-SPEC.md` for the complete technical specification of all game mechanics and formulas.

### Data flow for a human turn
1. When `isYourTurn` becomes true, UI calls `POST /api/game/tick` — `runAndPersistTick()` runs the turn tick, persists, sets `Empire.tickProcessed`, returns `turnReport`. Shows **TurnSummaryModal** (situation report) with critical-event highlighting (`src/lib/critical-events.ts`).
2. Player chooses an action; UI calls `POST /api/game/action`
3. Route (`src/app/api/game/action/route.ts`) verifies turn via `getCurrentTurn`, then `processAction()` — skips tick if already processed, executes action only, resets `tickProcessed`
4. On success, `advanceTurn` and fire-and-forget `runAISequence` (AI turns do not block the HTTP response)
5. UI polls `GET /api/game/status?id=<playerId>` every ~2s while waiting for AI or other humans

### Turn order enforcement
- `Player.turnOrder` (Int) assigns each player a fixed position in the session (0 = creator, 1+ = subsequent players/AIs in join order).
- `GameSession.currentTurnPlayerId` stores the ID of the player whose turn it is. This is immune to player list changes (joins, eliminations) — no index drift.
- Only the player matching `currentTurnPlayerId` can act. `POST /api/game/action` returns 409 for anyone else.
- After a successful action, `currentTurnPlayerId` advances to the next active player by `turnOrder`. If the next player(s) are AI, `runAISequence` runs in the background; the client observes progress via polling.
- New players joining mid-game get the next `turnOrder` value and slot into the rotation at the end. Their first turn comes after all existing players finish the current cycle.
- If `currentTurnPlayerId` is null or points to an eliminated player, it auto-resolves to the first active player by `turnOrder`.
- `GET /api/game/status` returns `isYourTurn` (boolean), `currentTurnPlayer` (name), `turnDeadline` (ISO string), and `turnOrder` (ordered list of player names + isAI).
- If the current turn belongs to another human player, the UI polls about every 2 seconds until it becomes this player's turn.
- **Turn timer**: `GameSession.turnStartedAt` resets each time the turn advances. `turnTimeoutSecs` is configurable (default 86400 = 24h). `getCurrentTurn()` auto-skips timed-out human players (`runAndPersistTick` if needed, then `end_turn`). The UI header shows a live countdown (`TurnTimer` component); it turns red under 1 hour.
- Core logic lives in `src/lib/turn-order.ts` (`getCurrentTurn`, `advanceTurn`) and `src/lib/ai-runner.ts` (`runAISequence`).

### AI NPC turn flow
1. Player selects AI opponents during game setup (name selection screen after registration)
2. `POST /api/ai/setup` creates AI players — accepts optional `names` array to create specific opponents
3. After a human acts, `runAISequence` runs in the background; each AI calls `runAndPersistTick` then `processAiMoveOrSkip()` (`processAction` for the chosen move; on failure, `end_turn` so the slot still logs and advances like a human skip)
4. `POST /api/ai/run-all` can also be called directly to advance AI turns.

### Key lib files
- `src/lib/game-engine.ts` — core game loop. `runAndPersistTick(playerId)` persists the turn tick; `processAction(playerId, action, params)` runs tick (if not yet processed) + action. ~30 action types supported. Player-targeting attacks (not pirates) and **covert_op** are rejected when the target still has **new-empire protection**.
- `src/lib/empire-prisma.ts` — `toEmpireUpdateData()` maps `Partial<Empire>` to `Prisma.EmpireUpdateInput` so scalar list fields (e.g. `pendingDefenderAlerts`) use `{ set: [...] }` instead of invalid raw `[]` in `prisma.empire.update`.
- `src/lib/critical-events.ts` — regex classification for critical vs warning vs info lines in the turn summary modal.
- `src/lib/game-constants.ts` — **all** balance values, planet config, costs, formulas, starting state, finance constants. The single source of truth for game numbers — UI labels reference these directly.
- `src/lib/ui-tooltips.ts` — Tooltip copy for Galactic Powers, Empire Status (resources + military unit stats), and Command Center tabs / military purchases.
- `src/components/Tooltip.tsx` — Hover/focus tooltips rendered via **`createPortal`** + `position: fixed` (reliable vs native `title`, which is delayed and often broken in embedded browsers; avoids clipping under `overflow-y-auto`).
- `src/lib/combat.ts` — 3-front sequential combat, guerrilla, nuclear, chemical, psionic, pirate raids (scaling rewards). Unit tier multiplier tables. Nuclear/chemical results include **`planetCasualties`** for per-planet population killed.
- `src/lib/combat-loss-format.ts` — `formatUnitLosses` / `formatUnitLossesOrNone` for consistent loss lines in `processAction` messages, `GameEvent` text, defender alerts, and UI-adjacent payloads.
- `src/lib/espionage.ts` — 10 covert operation types with probabilistic success/detection.
- `src/lib/research.ts` — tech tree with 5 categories (22 techs), permanent/temporary bonuses, unit tier upgrades. Random event definitions.
- `src/lib/gemini.ts` — Gemini prompt construction with 5 AI persona types, **neutral rival commander list** (uniform `pickRivalOpponent`), and full action awareness. **`resolveGeminiConfig()`** reads **`SystemSettings`** first, then `GEMINI_API_KEY` / `GEMINI_MODEL` env. Each `generateContent` uses **`GEMINI_TIMEOUT_MS`** (default 60s, clamped 1s–5m) via the SDK request `timeout` so hung API calls do not block `advanceTurn`. **`localFallback`** runs when no API key, timeout, invalid JSON, or invalid action — it includes **attacks, covert ops, and pirates**. `getAIMove` returns `llmSource: 'gemini' | 'fallback'` (stored in `TurnLog` / `GameEvent`).
- `src/lib/rng.ts` — seedable PRNG (mulberry32). All randomness goes through this. `setSeed(n)` for deterministic runs, `setSeed(null)` for production randomness.
- `src/lib/simulation.ts` — simulation engine that bypasses HTTP. 5 built-in strategies, per-turn snapshot collection, balance warnings, CSV export.
- `src/lib/turn-order.ts` — strict sequential turn system. `sessionCannotHaveActiveTurn()` encodes lobby / missing timer; `getCurrentTurn(sessionId)` returns **null** when `waitingForHuman` is true or `turnStartedAt` is null (admin lobby); otherwise resolves the current player (with timeout auto-skip). `advanceTurn(sessionId)` no-ops in lobby.
- `src/lib/admin-auth.ts` — async `verifyAdminLogin` / `verifyAdminPassword` (DB `AdminSettings` or env password), `requireAdmin`, httpOnly `admin_session` cookie (`ADMIN_SESSION_SECRET` recommended in production).
- `src/lib/create-ai-players.ts` — `createAIPlayersForSession`; shared AI names/types in `ai-builtin-config.ts`.
- `src/lib/ai-process-move.ts` — `processAiMoveOrSkip`: runs `processAction` for the AI’s chosen action; if `success: false`, runs `end_turn` with `skippedAfterInvalid` in `logMeta` (parity with human failed attempt + skip).
- `src/lib/ai-runner.ts` — `runAISequence(sessionId)` walks through consecutive AI turns in order, stopping when a human is reached. Called by the action route after each player turn.
- `src/lib/prisma.ts` — Prisma 7 client with `@prisma/adapter-pg` (`DATABASE_URL` from env only).
- `src/lib/system-settings.ts` — masked Gemini key preview for admin settings API (never return raw secrets).
- `scripts/simulate.ts` — CLI runner for the simulation engine.

### Authentication & Lobby System
- **`UserAccount`** (`username` unique lowercase, `fullName`, `email` unique, bcrypt password, optional **`lastLoginAt`**): created via `POST /api/auth/signup` (min **8** char password). `POST /api/auth/login` returns `{ user, games }` for the Command Center hub and sets **`lastLoginAt`**; resume via `POST /api/game/status` also updates it when the player is linked.
- **`POST /api/game/register`** and **`POST /api/game/join`** use `src/lib/player-auth.ts` (`resolvePlayerCredentials`): if a `UserAccount` exists for the normalized username, the password must match the account (min length for legacy-only players without an account remains **3**). New `Player` rows store `userId` when linked.
- Resume: UI tries **`POST /api/auth/login`** first; **404** falls back to **`POST /api/game/status`** with `{ name, password }` (legacy commanders without a `UserAccount`). Verifies bcrypt on `Player.passwordHash`. Legacy players without a hash are allowed through.
- Finished games (`turnsLeft <= 0`) return HTTP 410 on resume attempt — they are not resumable.
- AI players have no password and cannot be resumed.
- Once in-game, the UI uses `GET /api/game/status?id=<playerId>` (preferred) or `?player=name` for refreshes.
- **Galaxy creation**: `POST /api/game/register` accepts optional `galaxyName`, `isPublic`, `turnTimeoutSecs`, **`maxPlayers`** (2–128, default 50). An 8-char invite code is auto-generated for every session.
- **Join existing**: `POST /api/game/join` accepts `inviteCode` or `sessionId` (for public games). Creates a new player in the existing session.
- **Public lobbies**: `GET /api/game/lobbies` returns active public games. `PATCH /api/game/session` toggles `isPublic` (creator-only); **`maxPlayers`** patch allowed **2–128**.
- **Session info**: `GET /api/game/session?id=` returns session details including invite code.
- **UI flow**: Login → **Command Center** (active games + Create / Join / Log out) **or** legacy login straight into game; **Create Galaxy** one screen (max players, name, visibility, timer, optional AI toggles; session password from login) → Play; Join → Play.
- **Admin** (`/admin` + **`/admin/users`**, link on login): `POST /api/admin/login` | `logout` | `GET /api/admin/me` | `POST /api/admin/password` (change password → `AdminSettings` bcrypt) | `GET/PATCH /api/admin/settings` (Gemini in `SystemSettings` only; `DATABASE_URL` env-only) | `GET/POST/DELETE /api/admin/galaxies` (DELETE body `{ ids }` removes sessions via `src/lib/delete-game-session.ts`) | **`GET/PATCH/DELETE /api/admin/users`** (list accounts + stats, force user password syncs `UserAccount` + linked `Player` hashes, delete account clears `Player.userId`) — httpOnly cookie auth (`src/lib/admin-auth.ts`: async `verifyAdminLogin` / `verifyAdminPassword`, `requireAdmin`, `verifyAdminCookie`). Username only from `ADMIN_USERNAME`; password from DB row or `INITIAL_ADMIN_PASSWORD` env. Pre-staged galaxies use `waitingForHuman` until first human `POST /api/game/join`.

### Database schema highlights (`prisma/schema.prisma`)
- `UserAccount` — optional global login (`username`, `fullName`, `email`, `passwordHash`, `lastLoginAt`); `Player.userId` links when the commander is registered
- `Player` → `Empire` is 1:1; `Player.passwordHash` stores bcrypt hash (nullable for AI/legacy); `Player.gameSessionId` links to a `GameSession`
- `Empire` → `Planet[]` is 1:many (individual planet rows with name, sector, type, production, radiation); `Empire.tickProcessed` tracks whether the current turn's tick has been persisted (split tick vs action)
- `Empire` → `Army` is 1:1 (9 unit types, 5 tier levels, effectiveness, covert points)
- `Empire` → `SupplyRates` is 1:1 (supply planet production allocation)
- `Empire` → `Research` is 1:1 (accumulated points, unlocked tech IDs)
- `Market` is a global singleton (supply/demand, coordinator pool, lottery pool)
- `Treaty` tracks inter-empire agreements (6 types, binding duration)
- `Coalition` groups up to 5 empires
- `Loan` / `Bond` for Solar Bank
- `Convoy` / `Message` for multiplayer features
- `TurnLog` records every action; `GameEvent` is broadcast log
- `HighScore` persists final scores across games
- `AdminSettings` singleton (`id = "admin"`) stores bcrypt admin password when set from `/admin`; if absent, `INITIAL_ADMIN_PASSWORD` env is used
- `SystemSettings` singleton (`id = "default"`) stores optional `geminiApiKey`, `geminiModel`; `DATABASE_URL` stays in the environment only.
- `GameSession` tracks game sessions with `galaxyName` (unique), `createdBy`, `isPublic`, `inviteCode` (unique, auto-generated 8-char hex), `maxPlayers` (default **50**, max **128**), `currentTurnPlayerId` (whose turn it is, by player ID; null in admin lobby until first human), `turnStartedAt` (**nullable** — null in lobby, no timer), **`waitingForHuman`** (pre-staged admin galaxies until first human joins), `turnTimeoutSecs` (default 86400), player list, status, and outcome. Players are linked via `Player.gameSessionId` and ordered by `Player.turnOrder`.

### Action types (all handled in game-engine.ts)
- Economy: `buy_planet`, `set_tax_rate`, `set_sell_rates`, `set_supply_rates`
- Military: `buy_soldiers`, `buy_generals`, `buy_fighters`, `buy_stations`, `buy_light_cruisers`, `buy_heavy_cruisers`, `buy_carriers`, `buy_covert_agents`, `buy_command_ship`
- Combat: `attack_conventional`, `attack_guerrilla`, `attack_nuclear`, `attack_chemical`, `attack_psionic`, `attack_pirates`
- Covert: `covert_op` (with opType 0-9)
- Diplomacy: `propose_treaty`, `accept_treaty`, `break_treaty`, `create_coalition`, `join_coalition`, `leave_coalition`
- Market: `market_buy`, `market_sell`
- Finance: `bank_loan`, `bank_repay`, `buy_bond`, `buy_lottery_ticket`
- Research: `discover_tech`
- Social: `send_message`
- Other: `end_turn`

## Repository

- GitHub repo: https://github.com/benoc617/solar-realms-extreme
- GitHub account: `benoc617` (use this account for all repo operations)
- The `GITHUB_TOKEN` env var in `.zshrc` points to a different account (`boconnor_axoncorp`) and will override `gh` account switching if set — unset it before running `gh` commands: `unset GITHUB_TOKEN && gh ...`

## UI structure
- Single-page app in `src/app/page.tsx` with 3-column layout (3-5-4 grid on lg screens)
- **Screens flow**: Login (**Login** / **Sign up**) → Sign up form (username, full name, email, password ×2) → Login → **Command Center** (your games + Create Galaxy / Join Galaxy / Log out) → **Create Galaxy** (single screen: settings + optional AI rivals) → Main Game; OR Command Center → Join (invite code or public list; session password) → Main Game. Legacy login (no `UserAccount`) goes straight into the game when a matching active player exists.
- **Login screen** (username + password) → **Login** or **Sign up**; link to **`/admin`**
- Top: `Leaderboard` — Galactic Powers panel with column headers (Rk, Commander, **Prt** on sm+, Worth, Pop, Plt, Mil). **Prt** shows `[PN]` when that rival has new-empire protection. Click a rival to auto-select them as target in the WAR/OPS dropdowns.
- Left (3 cols): `EmpirePanel` — **compact stat-box grid layout** with Net Worth + Civil Status boxes at top, resource grid (4-col), population/tax row, sell rates inline, military mini-stat grid, planet badges, and collapsible planet details.
- Center (5 cols): `ActionPanel` — **Skip Turn** button at top (always visible, disabled when not your turn with "WAITING — [NAME]'S TURN" message), then 7 tabbed sections (ECON, MIL, WAR, OPS, MKT, RES, CFG). ECON tab shows planet cards with descriptions + cost + owned count. MIL tab includes `buy_light_cruisers` (950 cr). Target fields use `<select>` dropdowns. CFG tab includes **GAME SESSION** (galaxy name, invite code click-to-copy, visibility toggle for creator) and **TURN ORDER** (numbered list of all players, current player highlighted, `[AI]` tags).
- Right (4 cols): `EventLog` — color-coded turn reports with income/expense/population breakdowns, event highlights.
- **Header bar**: galaxy name, then: **whose turn** — `▸ LOBBY — GALAXY NOT STARTED` (cyan) when `waitingForGameStart`, else `▸ YOUR TURN` (cyan) or `▸ [NAME]'S TURN` (yellow); **turn timer** (countdown to deadline, red under 1h; hidden in lobby); **credits** (yellow), **turn counter** (`T5 (95 left)`), **protection badge** (`[P20]`), **commander name**.
- **Turn Summary Popup** (`TurnSummaryModal`) — at **turn start**, shows situation report from `POST /api/game/tick` (critical alerts for starvation, fuel deficit, unrest, etc.); after **attacks**, shows combat summary from `actionDetails.combatResult` (your losses, target losses, planet casualties for nuclear/chemical, psionic effects). Dismissible via Enter/Space/Escape or clicking outside.
- **Game Over Screen** (`GameOverScreen`) — appears when turnsLeft reaches 0. Shows final standings, player empire summary, all-time high scores, game log export button, and new game button.
- Styling: monochrome terminal/BBS aesthetic (black background, green-400 text, yellow-400 accents)
- Keyboard shortcuts: `1`-`7` switch tabs, letter keys trigger actions per tab, `Enter` skips turn. All labels reference `game-constants.ts` — no hardcoded numbers in UI.
- "Skip Turn" (not "End Turn") — since every other action already uses a turn, skipping is what happens when you take no action.

## TODO / backlog

- **Treaty diplomacy in the UI** — `game-engine.ts` already implements `propose_treaty`, `accept_treaty`, and `break_treaty` (`POST /api/game/action` with `target` / `treatyType` / `treatyId`). The web UI does not expose these: players cannot pick treaty type, see pending proposals, or accept without knowing a DB `treatyId`. Implement a diplomacy surface (e.g. new tab or CFG subsection), extend `GET /api/game/status` (or a small `GET /api/game/treaties`) to return pending/active treaties for the session, wire `onAction` calls, keyboard shortcuts if desired, and add E2E coverage.
