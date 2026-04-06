"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactElement,
  type ReactNode,
  type Ref,
  type MouseEvent,
  type FocusEvent,
} from "react";
import { createPortal } from "react-dom";

function mergeRefs<T>(...refs: (Ref<T> | null | undefined)[]) {
  return (value: T | null) => {
    for (const ref of refs) {
      if (ref == null) continue;
      if (typeof ref === "function") ref(value);
      else (ref as React.MutableRefObject<T | null>).current = value;
    }
  };
}

/**
 * Hover/focus tooltip via portal — no wrapper DOM node (uses cloneElement on the single child)
 * so flex/grid layouts stay tight. Native `title` is avoided (slow / unreliable in embedded UIs).
 */
export default function Tooltip({ tip, children, className }: { tip: string; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const elRef = useRef<HTMLElement | null>(null);

  const updatePos = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 6;
    const estH = 120;
    let top = r.bottom + margin;
    if (top + estH > window.innerHeight - 8) {
      top = Math.max(8, r.top - margin - estH);
    }
    setPos({ top, left: r.left + r.width / 2 });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const onScrollOrResize = () => updatePos();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePos]);

  let child: ReactNode;
  try {
    child = Children.only(children);
  } catch {
    return children;
  }

  if (!isValidElement(child)) {
    return child;
  }

  const ch = child as ReactElement<Record<string, unknown>>;
  const p = ch.props as Record<string, unknown>;
  const existingRef = (ch as ReactElement & { ref?: Ref<HTMLElement> }).ref;

  const mergedClass = [className, p.className].filter(Boolean).join(" ").trim() || undefined;

  const merged = cloneElement(ch, {
    ref: mergeRefs(elRef, existingRef),
    className: mergedClass,
    onMouseEnter: (e: MouseEvent) => {
      (p.onMouseEnter as ((ev: MouseEvent) => void) | undefined)?.(e);
      updatePos();
      setOpen(true);
    },
    onMouseLeave: (e: MouseEvent) => {
      (p.onMouseLeave as ((ev: MouseEvent) => void) | undefined)?.(e);
      setOpen(false);
    },
    onFocus: (e: FocusEvent) => {
      (p.onFocus as ((ev: FocusEvent) => void) | undefined)?.(e);
      updatePos();
      setOpen(true);
    },
    onBlur: (e: FocusEvent) => {
      (p.onBlur as ((ev: FocusEvent) => void) | undefined)?.(e);
      setOpen(false);
    },
  } as never);

  return (
    <>
      {merged}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[9999] max-w-[min(20rem,calc(100vw-1rem))] max-h-[40vh] overflow-y-auto px-2 py-1.5 text-[10px] leading-snug rounded border border-green-600 bg-black text-green-300 shadow-[0_4px_20px_rgba(0,0,0,0.85)] pointer-events-none"
            style={{ top: pos.top, left: pos.left, transform: "translateX(-50%)" }}
            role="tooltip"
          >
            {tip}
          </div>,
          document.body,
        )}
    </>
  );
}
