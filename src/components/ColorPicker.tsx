"use client";

import { useEffect, useRef, useState } from "react";
import { HexAlphaColorPicker } from "react-colorful";

const SWATCHES = ["#ffffffff", "#f7f7fbff", "#dcf3e9ff", "#fbe4ecff", "#e6e3f5ff", "#fdecd0ff", "#dbe9fbff", "#17172aff"];

const HEX8_RE = /^#([0-9a-fA-F]{8})$/;
const HEX6_RE = /^#([0-9a-fA-F]{6})$/;

function normalizeToHex8(hex: string): string {
  if (HEX8_RE.test(hex)) return hex;
  if (HEX6_RE.test(hex)) return `${hex}ff`;
  return "#ffffffff";
}

export function ColorPicker({ value, onChange, label }: { value: string; onChange: (hex: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  if (value !== lastValue) {
    setLastValue(value);
    setText(value);
  }

  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [open]);

  function commitText(v: string) {
    setText(v);
    if (HEX8_RE.test(v) || HEX6_RE.test(v)) onChange(normalizeToHex8(v));
  }

  const swatch = normalizeToHex8(value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-xs text-ink-secondary hover:border-accent"
      >
        <span
          className="h-4 w-4 shrink-0 rounded-full border border-hairline"
          style={{
            backgroundColor: swatch,
            backgroundImage:
              "linear-gradient(45deg, #e3e2e8 25%, transparent 25%, transparent 75%, #e3e2e8 75%), linear-gradient(45deg, #e3e2e8 25%, transparent 25%, transparent 75%, #e3e2e8 75%)",
            backgroundSize: "6px 6px, 6px 6px",
            backgroundPosition: "0 0, 3px 3px",
          }}
        />
        {label}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-56 space-y-3 rounded-xl border border-hairline bg-surface p-3 shadow-lg">
          <div className="kanva-color-picker">
            <HexAlphaColorPicker color={swatch} onChange={(hex) => onChange(hex)} />
          </div>
          <div className="grid grid-cols-8 gap-1.5">
            {SWATCHES.map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => {
                  onChange(hex);
                  setText(hex);
                }}
                className="h-6 w-6 rounded-full border border-hairline"
                style={{ background: hex }}
                aria-label={hex}
              />
            ))}
          </div>
          <input
            type="text"
            value={text}
            onChange={(e) => commitText(e.target.value)}
            placeholder="#ffffffff"
            className="tabular w-full rounded-lg border border-hairline bg-page px-2 py-1.5 text-xs text-ink outline-none"
          />
        </div>
      )}
    </div>
  );
}
