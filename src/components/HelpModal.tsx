"use client";

import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

interface HelpModalProps {
  title: string;
  /** Markdown-flavored text. Rendered as formatted text — not raw HTML. */
  content: string;
  onClose: () => void;
}

/**
 * HelpModal — displays per-game help content in a scrollable BBS-aesthetic overlay.
 *
 * Renders the content string with lightweight markdown-like formatting:
 * - `## Heading` and `### Sub-heading` → bold green headers
 * - `---` → horizontal rule
 * - `| col |` table rows → monospace table
 * - `**bold**` → bold yellow
 * - `` `code` `` → inline code
 * - Bare lines → paragraph text
 *
 * Closes on Escape, Enter, or click outside the panel.
 */
export function HelpModal({ title, content, onClose }: HelpModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  function handleBackdropClick(e: React.MouseEvent) {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      onClose();
    }
  }

  const lines = content.split("\n");

  function renderLine(line: string, idx: number): React.ReactNode {
    // H2
    if (/^## /.test(line)) {
      return (
        <h2 key={idx} className="text-yellow-400 font-bold text-sm mt-4 mb-1 tracking-wider">
          {line.replace(/^## /, "")}
        </h2>
      );
    }
    // H3
    if (/^### /.test(line)) {
      return (
        <h3 key={idx} className="text-cyan-400 font-bold text-xs mt-3 mb-0.5 tracking-wide">
          {line.replace(/^### /, "")}
        </h3>
      );
    }
    // HR
    if (/^---+$/.test(line.trim())) {
      return <hr key={idx} className="border-green-900 my-3" />;
    }
    // Table header separator
    if (/^\|[-| ]+\|$/.test(line.trim())) {
      return null;
    }
    // Table row
    if (/^\|/.test(line.trim())) {
      const cells = line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());
      const isHeader = idx < lines.length - 1 && /^\|[-| ]+\|$/.test((lines[idx + 1] ?? "").trim());
      return (
        <div key={idx} className={`flex gap-0 text-xs font-mono ${isHeader ? "text-green-400 font-bold" : "text-green-600"}`}>
          {cells.map((cell, ci) => (
            <span key={ci} className="px-1 min-w-[80px] border-r border-green-900 last:border-r-0">
              {renderInline(cell)}
            </span>
          ))}
        </div>
      );
    }
    // Bullet / numbered list
    if (/^[-*] /.test(line) || /^\d+\. /.test(line)) {
      const text = line.replace(/^[-*\d.] /, "");
      return (
        <div key={idx} className="flex gap-1 text-xs text-green-500 ml-2">
          <span className="text-green-700 shrink-0">{/^\d+\. /.test(line) ? line.match(/^\d+/)![0] + "." : "·"}</span>
          <span>{renderInline(text)}</span>
        </div>
      );
    }
    // Empty line
    if (line.trim() === "") {
      return <div key={idx} className="h-1" />;
    }
    // Default paragraph
    return (
      <p key={idx} className="text-xs text-green-500 leading-relaxed">
        {renderInline(line)}
      </p>
    );
  }

  function renderInline(text: string): React.ReactNode {
    // Split on **bold**, `code`, and ⚠
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      const boldIdx = remaining.indexOf("**");
      const codeIdx = remaining.indexOf("`");
      const first = Math.min(
        boldIdx === -1 ? Infinity : boldIdx,
        codeIdx === -1 ? Infinity : codeIdx,
      );
      if (first === Infinity) {
        parts.push(<span key={key++}>{remaining}</span>);
        break;
      }
      if (first > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, first)}</span>);
        remaining = remaining.slice(first);
      }
      if (remaining.startsWith("**")) {
        const end = remaining.indexOf("**", 2);
        if (end === -1) {
          parts.push(<span key={key++}>{remaining}</span>);
          break;
        }
        parts.push(
          <strong key={key++} className="text-yellow-400">
            {remaining.slice(2, end)}
          </strong>,
        );
        remaining = remaining.slice(end + 2);
      } else if (remaining.startsWith("`")) {
        const end = remaining.indexOf("`", 1);
        if (end === -1) {
          parts.push(<span key={key++}>{remaining}</span>);
          break;
        }
        parts.push(
          <code key={key++} className="bg-green-950/60 text-cyan-300 px-0.5 rounded text-[10px]">
            {remaining.slice(1, end)}
          </code>,
        );
        remaining = remaining.slice(end + 1);
      }
    }
    return parts;
  }

  const modal = (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        className="bg-black border border-green-700 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl shadow-green-900/30"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-green-800 px-4 py-2 shrink-0">
          <h1 className="text-yellow-400 font-bold tracking-widest text-sm">{title}</h1>
          <button
            type="button"
            onClick={onClose}
            className="text-green-700 hover:text-green-400 text-xs border border-green-900 px-2 py-0.5"
          >
            × CLOSE
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-0.5">
          {lines.map((line, idx) => renderLine(line, idx))}
        </div>

        {/* Footer */}
        <div className="border-t border-green-900 px-4 py-1.5 text-green-800 text-[10px] shrink-0">
          Press Esc or Enter to close
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
