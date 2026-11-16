"use client";

import { useSyncExternalStore } from "react";
import type { AnalyzeResult } from "./types";

// The analysis lives only in memory: it survives client-side navigation
// between Análisis and Tablero, but a page reload starts over at the upload
// screen. Earlier versions persisted it under this key, so drop any leftover.
const LEGACY_STORAGE_KEY = "kanva:dataset";
const listeners = new Set<() => void>();

let current: AnalyzeResult | null = null;

if (typeof window !== "undefined") {
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Storage unavailable; nothing to clean up.
  }
}

function readSnapshot(): AnalyzeResult | null {
  return current;
}

function readServerSnapshot(): AnalyzeResult | null {
  return null;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function setDatasetResult(next: AnalyzeResult | null) {
  current = next;
  for (const listener of listeners) listener();
}

export function useDataset() {
  const result = useSyncExternalStore(subscribe, readSnapshot, readServerSnapshot);
  return { result, setResult: setDatasetResult };
}
