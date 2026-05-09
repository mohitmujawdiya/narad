"use client";
import { useEffect } from "react";

export function useKeyboardShortcut(key: string, handler: () => void) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.matches?.("input, textarea, select, [contenteditable]")) return;
      if (e.key === key) {
        e.preventDefault();
        handler();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key, handler]);
}
