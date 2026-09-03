"use client";

import { useSyncExternalStore } from "react";
import type { AnalyzeResult } from "./types";

const STORAGE_KEY = "kanva:dataset";
const listeners = new Set<() => void>();

let cachedRaw: string | null | undefined;
let cachedValue: AnalyzeResult | null = null;

function readSnapshot(): AnalyzeResult | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedValue = raw ? (JSON.parse(raw) as AnalyzeResult) : null;
    } catch {
      cachedValue = null;
    }
  }
  return cachedValue;
}

function readServerSnapshot(): AnalyzeResult | null {
  return null;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function emitChange() {
  for (const listener of listeners) listener();
}

export function setDatasetResult(next: AnalyzeResult | null) {
  if (next) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  emitChange();
}

export function useDataset() {
  const result = useSyncExternalStore(subscribe, readSnapshot, readServerSnapshot);
  return { result, setResult: setDatasetResult };
}
