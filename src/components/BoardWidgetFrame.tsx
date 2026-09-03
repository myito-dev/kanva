"use client";

import { useRef, type ReactNode } from "react";
import { motion } from "motion/react";

const MIN_W = 200;
const MIN_H = 120;

function snap(v: number, step?: number) {
  return step ? Math.round(v / step) * step : v;
}

interface BoardWidgetFrameProps {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  variant: "card" | "plain";
  background?: string;
  selected: boolean;
  snapStep?: number;
  onSelect: () => void;
  onChange: (next: { x: number; y: number; w: number; h: number }) => void;
  onRemove: () => void;
  children: ReactNode;
}

export function BoardWidgetFrame({
  x,
  y,
  w,
  h,
  title,
  variant,
  background,
  selected,
  snapStep,
  onSelect,
  onChange,
  onRemove,
  children,
}: BoardWidgetFrameProps) {
  const start = useRef({ pointerX: 0, pointerY: 0, x, y, w, h });

  function beginDrag(e: React.PointerEvent) {
    e.preventDefault();
    onSelect();
    start.current = { pointerX: e.clientX, pointerY: e.clientY, x, y, w, h };

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - start.current.pointerX;
      const dy = ev.clientY - start.current.pointerY;
      onChange({
        x: snap(Math.max(0, start.current.x + dx), snapStep),
        y: snap(Math.max(0, start.current.y + dy), snapStep),
        w: start.current.w,
        h: start.current.h,
      });
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function beginResize(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    start.current = { pointerX: e.clientX, pointerY: e.clientY, x, y, w, h };

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - start.current.pointerX;
      const dy = ev.clientY - start.current.pointerY;
      onChange({
        x: start.current.x,
        y: start.current.y,
        w: snap(Math.max(MIN_W, start.current.w + dx), snapStep),
        h: snap(Math.max(MIN_H, start.current.h + dy), snapStep),
      });
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const isCard = variant === "card";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15 }}
      onPointerDown={onSelect}
      className={`group absolute flex flex-col overflow-hidden rounded-2xl ${isCard ? "card" : ""} ${
        selected ? "ring-2 ring-accent" : isCard ? "" : "ring-1 ring-transparent hover:ring-hairline"
      }`}
      style={{ left: x, top: y, width: w, height: h, touchAction: "none", background: background ?? (isCard ? undefined : "transparent") }}
    >
      <div
        onPointerDown={beginDrag}
        className={`flex shrink-0 cursor-grab items-center justify-between gap-2 px-2 py-1.5 transition-opacity active:cursor-grabbing ${
          isCard ? "border-b border-hairline" : `${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`
        }`}
      >
        {isCard ? (
          <span className="truncate text-xs font-medium text-ink-secondary">{title}</span>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" className="text-ink-muted">
            <circle cx="9" cy="6" r="1.4" fill="currentColor" />
            <circle cx="15" cy="6" r="1.4" fill="currentColor" />
            <circle cx="9" cy="12" r="1.4" fill="currentColor" />
            <circle cx="15" cy="12" r="1.4" fill="currentColor" />
            <circle cx="9" cy="18" r="1.4" fill="currentColor" />
            <circle cx="15" cy="18" r="1.4" fill="currentColor" />
          </svg>
        )}
        <button
          onClick={onRemove}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Quitar widget"
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-page hover:text-negative"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="5" y1="5" x2="19" y2="19" />
            <line x1="19" y1="5" x2="5" y2="19" />
          </svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-3 pt-1">{children}</div>
      <div onPointerDown={beginResize} className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize" aria-hidden>
        <svg width="14" height="14" viewBox="0 0 24 24" className="absolute bottom-0.5 right-0.5 text-ink-muted">
          <path d="M20 20L4 20M20 20L20 4M20 14L14 20M20 8L8 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </motion.div>
  );
}
