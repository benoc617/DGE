import { SESSION } from "@/lib/game-constants";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeUsername(s: string): string {
  return s.trim().toLowerCase();
}

export function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(normalizeEmail(email));
}

export function clampMaxPlayers(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return SESSION.MAX_PLAYERS_DEFAULT;
  return Math.min(SESSION.MAX_PLAYERS_CAP, Math.max(SESSION.MIN_PLAYERS, Math.floor(n)));
}
