# Chess — Technical Specification

This document specifies the chess game implementation on the Door Game Engine (DGE).

---

## 1. Overview

Standard chess for two players (one human, one AI). The AI uses Monte Carlo Tree Search (MCTS) — no Gemini or external API calls. All rules follow FIDE standard chess.

---

## 2. Game State (`ChessState`)

All game state is stored as JSON in `GameSession.log` (no separate Prisma models).

```typescript
interface ChessState {
  board: (Piece | null)[][];     // 8×8, [rank][file], rank 0 = white's back rank
  turn: "white" | "black";
  castling: CastlingRights;       // four booleans: whiteKingside, whiteQueenside, blackKingside, blackQueenside
  enPassant: [number, number] | null;  // target square for en passant capture
  halfMoveClock: number;          // moves since last pawn move or capture (50-move rule)
  fullMoveNumber: number;         // increments after black's move
  status: GameStatus;             // "playing" | "checkmate" | "stalemate" | "draw_50move" | "draw_repetition" | "draw_insufficient" | "resigned"
  winner: "white" | "black" | null;
  whitePlayerId: string;          // Player.id of the white player (human, turnOrder 0)
  blackPlayerId: string;          // Player.id of the black player (AI, turnOrder 1)
  moveHistory: string[];          // algebraic notation strings (e.g. "e2e4", "g8f6", "e1g1")
  capturedByWhite: PieceType[];   // pieces captured by white
  capturedByBlack: PieceType[];   // pieces captured by black
  positionHistory: string[];      // board position hashes for threefold repetition detection
  inCheck: boolean;               // whether the current player's king is in check
}
```

### Piece types

`"K"` (King), `"Q"` (Queen), `"R"` (Rook), `"B"` (Bishop), `"N"` (Knight), `"P"` (Pawn).

---

## 3. Rules Implemented

All rules are implemented as pure synchronous functions in `games/chess/src/rules.ts`.

### 3.1 Move Generation

`getLegalMoves(state)` returns all legal moves for the current player, accounting for:
- Standard piece movement (sliding, jumping, pawn single/double advance)
- Captures (including en passant)
- Castling (kingside and queenside) — requires: neither king nor rook has moved, no pieces between them, king not in check, king does not pass through or land on an attacked square
- Pawn promotion (to Q, R, B, or N)
- Pin detection — moves that would leave the king in check are filtered out

### 3.2 Check and Checkmate

- `isInCheck(state)` — tests whether the current player's king is attacked
- Checkmate — detected when `getLegalMoves` returns empty and king is in check
- Stalemate — detected when `getLegalMoves` returns empty and king is not in check

### 3.3 Draw Conditions

- **50-move rule** — `halfMoveClock >= 100` (100 half-moves = 50 full moves) without a pawn move or capture
- **Threefold repetition** — same board position (piece placement + turn + castling rights + en passant square) appears 3 times in `positionHistory`
- **Insufficient material** — K vs K, K+B vs K, K+N vs K, K+B vs K+B with same-color bishops

### 3.4 Move Notation

Moves are encoded as 4-character strings: `{fromFile}{fromRank}{toFile}{toRank}` with an optional 5th character for promotion piece. Files are `a`–`h`, ranks are `1`–`8`.

Examples: `"e2e4"`, `"g1f3"`, `"e7e8q"` (promotion to queen), `"e1g1"` (kingside castling).

---

## 4. Actions

Chess supports two actions via `POST /api/game/action`:

### `move`

Parameters: `{ move: string }` — algebraic notation (e.g. `"e2e4"`).

Validates the move is legal, applies it, checks for checkmate/stalemate/draw, updates state. Returns `success: false` with `"Illegal move."` if the move is not in the legal moves list.

### `resign`

No parameters. Sets `status: "resigned"` and `winner` to the opponent's color.

### `end_turn`

Not used during normal play. When the turn timer fires, the `processEndTurn` hook in `chess-registration.ts` treats a timeout as a resignation.

---

## 5. AI (MCTS)

The AI uses the engine's generic MCTS search (`@dge/engine/search`) via `chessSearchFunctions`.

### 5.1 Search Configuration

| Parameter | Value |
|-----------|-------|
| `iterations` | 2,000 max |
| `timeLimitMs` | 3,000 ms (3 seconds) |
| `rolloutDepth` | 40 half-moves |
| `explorationC` | √2 (UCB1 constant) |
| `branchFactor` | 60 (max moves considered per node) |

### 5.2 Evaluation

`chessEval` returns:
- `+10000` / `-10000` for checkmate (win/loss)
- `0` for any draw
- `evaluateMaterial(board)` for ongoing games — piece values: P=1, N=3, B=3, R=5, Q=9, K=0

### 5.3 Rollout Strategy

During MCTS rollouts, `pickRolloutMove` selects uniformly at random from candidate moves.

### 5.4 AI Turn Flow

`runAiSequence(sessionId)` loops while the current player is AI:
1. Load state from `GameSession.log`
2. If game is over, stop
3. If current player is not AI, stop
4. Run `getChessAIMove` (MCTS search, 3s budget)
5. Apply the chosen move, save state
6. Call `advanceTurn` to pass back to the human
7. Repeat (guard: max 200 iterations)

If MCTS returns no move, the AI resigns.

---

## 6. Persistence

Chess uses `GameSession.log` (a Prisma `Json` field) to store the entire `ChessState`. No additional database tables are needed.

- `loadChessState(sessionId)` — reads `GameSession.log` and casts to `ChessState`
- `saveChessState(sessionId, state)` — writes `GameSession.log` via `JSON.parse(JSON.stringify(state))`; sets `GameSession.status = "complete"` when the game ends

---

## 7. Session Setup

When a chess game is created via `POST /api/game/register` with `game: "chess"`:

1. The register route creates the `GameSession` and the human `Player` (turnOrder 0)
2. `onSessionCreated` (in `chess-http-adapter.ts`) creates the AI `Player` (turnOrder 1, `isAI: true`, name "Stockfish Jr")
3. Creates the initial `ChessState` (standard starting position) with `whitePlayerId` = human, `blackPlayerId` = AI
4. Saves the state to `GameSession.log`
5. Sets `currentTurnPlayerId` to the human player (white moves first)

### Session Defaults

| Setting | Value |
|---------|-------|
| `defaultTotalTurns` | 500 (generous upper bound; games end by checkmate/stalemate/draw/resign) |
| `defaultActionsPerDay` | 1 |
| `playerRange` | [2, 2] |
| `supportsJoin` | false |
| `autoCreateAI` | true |
| `turnMode` | sequential |

---

## 8. API Endpoints

### `GET /api/game/status?id=<playerId>`

Returns chess-specific status via `buildStatus` in `chess-http-adapter.ts`:

```json
{
  "playerId": "...",
  "playerName": "...",
  "game": "chess",
  "gameSessionId": "...",
  "isYourTurn": true,
  "myColor": "white",
  "board": [[...], ...],
  "turn": "white",
  "gameStatus": "playing",
  "winner": null,
  "moveHistory": ["e2e4", "e7e5"],
  "capturedByWhite": [],
  "capturedByBlack": [],
  "inCheck": false
}
```

### `GET /api/game/chess/moves?id=<playerId>`

Returns legal moves for the current position:

```json
{
  "moves": [
    { "from": "e2", "to": "e4" },
    { "from": "d2", "to": "d4" },
    ...
  ]
}
```

### `POST /api/game/action`

Standard engine action route. Body: `{ playerName, action: "move"|"resign", move?: "e2e4" }`.

---

## 9. UI (`ChessGameScreen.tsx`)

Interactive graphical board rendered in `src/components/ChessGameScreen.tsx`:

- **Board rendering** — 8×8 grid with alternating light/dark squares, Unicode chess pieces (♔♕♖♗♘♙♚♛♜♝♞♟)
- **Move selection** — click a piece to select it (highlighted), legal destination squares show green dots, click a destination to complete the move
- **Piece switching** — clicking another of your pieces switches selection (you don't have to move the first piece you click)
- **Promotion dialog** — when a pawn reaches the back rank, a modal prompts for the promotion piece (Q/R/B/N)
- **Resign button** — concedes the game
- **Status display** — shows check/checkmate/stalemate/draw/resigned status
- **Captured pieces** — displayed for both sides
- **AI polling** — after making a move, polls `GET /api/game/status` every second until it's the human's turn again (AI uses ~3s MCTS)
- **Game over** — displays winner and final status; action returns 410 after game ends

---

## 10. Tests

| File | Tests | Coverage |
|------|-------|----------|
| `tests/unit/chess-rules.test.ts` | 25 | Initial board, move gen, captures, en passant, castling (both sides), check, checkmate, stalemate, resign, clone, notation, material eval, position key, 50-move rule |
| `tests/unit/chess-mcts.test.ts` | 10 | `chessSearchFunctions` (applyTick, applyAction, evalState, generateCandidateMoves, isTerminal, getPlayerCount, cloneState), MCTS integration (valid move from initial position, mate-in-1 detection) |
| `tests/e2e/chess.test.ts` | 8 | Register chess game, status with board, legal moves endpoint, play a move, AI response polling, illegal move rejection, resign, 410 after game over |

---

## 11. Source Layout

```
games/chess/
  src/
    types.ts            # ChessState, Board, Piece, ChessMove, GameStatus
    rules.ts            # Pure chess rules engine (500+ lines)
    definition.ts       # GameDefinition<ChessState>, MCTS search adapter, AI move
    help-content.ts     # In-game help text
    index.ts            # Barrel export
  docs/
    GAME-SPEC.md        # This file
  package.json          # @dge/chess workspace package

# App-layer wiring (src/ at repo root)
src/lib/chess-http-adapter.ts   # GameHttpAdapter for chess
src/lib/chess-registration.ts   # registerGame("chess", ...) side-effect module
src/components/ChessGameScreen.tsx  # Full in-game UI
src/app/api/game/chess/moves/route.ts  # Legal moves API endpoint
```
