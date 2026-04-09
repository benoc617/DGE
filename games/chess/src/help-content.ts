export const CHESS_HELP_TITLE = "Chess";

export const CHESS_HELP_CONTENT = `
# Chess

Standard chess against an AI opponent powered by Monte Carlo Tree Search (MCTS).

## How to Play

- **Click a piece** to select it. Legal destination squares will highlight.
- **Click a highlighted square** to complete the move.
- Once you click a piece, you must move it (click another of your pieces to switch).
- **Pawn promotion**: when a pawn reaches the back rank, you'll be prompted to choose a piece.

## Rules

Standard FIDE chess rules apply:
- Castling (kingside and queenside) when neither king nor rook has moved and no squares are attacked.
- En passant capture.
- Fifty-move draw rule (100 half-moves without a pawn move or capture).
- Threefold repetition draw.
- Insufficient material draw (K vs K, K+B vs K, K+N vs K, same-color bishops).

## Controls

- **Resign**: Click the Resign button to concede the game.
- The board shows captured pieces for both sides.
- Check and checkmate are automatically detected.

## AI Opponent

The AI uses MCTS (Monte Carlo Tree Search) with a 3-second time budget per move.
It does not use any external API — all computation is local.
`;

export const HELP_REGISTRY: Record<string, { title: string; content: string }> = {
  chess: { title: CHESS_HELP_TITLE, content: CHESS_HELP_CONTENT },
};
