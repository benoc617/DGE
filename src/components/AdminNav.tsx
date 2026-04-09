/**
 * AdminNav — shared navigation bar for all admin pages.
 *
 * Shows all nav items in a consistent row. The current page's box is
 * grayed out (not clickable). "Refresh" is grayed when onRefresh is null.
 */

"use client";

import Link from "next/link";

interface AdminNavProps {
  /** Which admin section is currently active — grays out that nav item. */
  current: "admin" | "game-sessions" | "users";
  /**
   * Called when the Refresh button is clicked.
   * Pass null to gray out the Refresh button (pages without a list to reload).
   */
  onRefresh?: (() => void) | null;
  /** Called when Log Out is clicked. */
  onLogout: () => void;
}

interface NavBoxProps {
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}

function NavBox({ label, href, onClick, disabled }: NavBoxProps) {
  const base =
    "px-2 py-0.5 border text-xs font-mono tracking-wide transition-colors";

  if (disabled) {
    return (
      <span className={`${base} border-green-900 text-green-800 cursor-default`}>
        {label}
      </span>
    );
  }

  if (href) {
    return (
      <Link href={href} className={`${base} border-green-700 text-green-500 hover:border-green-400 hover:text-green-300`}>
        {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} border-green-700 text-green-500 hover:border-green-400 hover:text-green-300`}
    >
      {label}
    </button>
  );
}

export function AdminNav({ current, onRefresh, onLogout }: AdminNavProps) {
  return (
    <div className="flex flex-wrap gap-1.5 items-center border-b border-green-900 pb-2 mb-4">
      <NavBox
        label="ADMIN"
        href={current === "admin" ? undefined : "/admin"}
        disabled={current === "admin"}
      />
      <NavBox
        label="GAME SESSIONS"
        href={current === "game-sessions" ? undefined : "/admin/game-sessions"}
        disabled={current === "game-sessions"}
      />
      <NavBox
        label="USERS"
        href={current === "users" ? undefined : "/admin/users"}
        disabled={current === "users"}
      />
      <NavBox
        label="REFRESH"
        onClick={onRefresh ?? undefined}
        disabled={!onRefresh}
      />
      <NavBox
        label="LOG OUT"
        onClick={onLogout}
      />
      <NavBox
        label="GAME"
        href="/"
      />
    </div>
  );
}
