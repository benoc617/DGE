# Chess

Standard chess against an AI opponent powered by Monte Carlo Tree Search (MCTS). Implemented on the [Door Game Engine (DGE)](../../README.md).

## The Game

Play a full game of chess against a computer opponent. The AI uses MCTS with a 3-second time budget per move — no external API calls (no Gemini). All standard FIDE rules are implemented: castling, en passant, pawn promotion, check/checkmate, stalemate, 50-move draw, threefold repetition, and insufficient material draw.

## Documentation

| Document | Description |
|----------|-------------|
| [docs/GAME-SPEC.md](docs/GAME-SPEC.md) | Complete technical specification — state model, rules, AI, API, UI |

## How to Play

1. From the lobby, select **Chess** and create a game
2. The AI opponent ("Stockfish Jr") is automatically created — you play white
3. **Click a piece** to select it — legal destination squares highlight in green
4. **Click a highlighted square** to complete the move
5. The AI responds in ~3 seconds via MCTS search
6. **Resign** at any time using the Resign button

## Features

- Interactive graphical board with Unicode chess pieces
- Point-and-click move selection with legal move highlighting
- Pawn promotion dialog (Queen, Rook, Bishop, Knight)
- Captured pieces display for both sides
- Check/checkmate/stalemate/draw detection
- Game state persisted in `GameSession.log` (no additional DB tables)

## Source Layout

```
games/chess/
  src/
    types.ts            # ChessState, Board, Piece, ChessMove, GameStatus
    rules.ts            # Pure chess rules engine
    definition.ts       # GameDefinition<ChessState> + MCTS AI
    help-content.ts     # In-game help text
    index.ts            # Barrel export
  docs/
    GAME-SPEC.md        # Technical specification
  package.json          # @dge/chess workspace package
```
