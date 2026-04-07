import { AUTH, SESSION } from "@/lib/game-constants";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate password complexity. Returns null if valid, or an error message string.
 * Requirements: minimum length, at least one uppercase, one lowercase, one digit,
 * and one special character (punctuation or space).
 */
export function validatePasswordStrength(password: string, minLength: number = AUTH.PASSWORD_MIN_SIGNUP): string | null {
  if (password.length < minLength) {
    return `Password must be at least ${minLength} characters`;
  }
  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number";
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    return "Password must contain at least one special character (e.g. !@#$%^&* or space)";
  }
  return null;
}

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
