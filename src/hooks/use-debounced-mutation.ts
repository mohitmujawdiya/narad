"use client";

import { useRef, useCallback, useState } from "react";

export type SavingState = "idle" | "saving" | "saved" | "error";

/**
 * Wraps a mutation function with debouncing.
 * Resets the timer on each call; fires after `delayMs` of inactivity.
 */
export function useDebouncedMutation<TInput>(
  mutationFn: (input: TInput) => Promise<unknown>,
  delayMs = 800,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<TInput | null>(null);
  const [savingState, setSavingState] = useState<SavingState>("idle");

  const debouncedFn = useCallback(
    (input: TInput) => {
      latestRef.current = input;

      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(async () => {
        const value = latestRef.current;
        if (value === null) return;

        setSavingState("saving");
        try {
          await mutationFn(value);
          setSavingState("saved");
          // Reset to idle after a brief "Saved" display
          setTimeout(() => setSavingState("idle"), 1500);
        } catch {
          setSavingState("error");
          setTimeout(() => setSavingState("idle"), 3000);
        }
      }, delayMs);
    },
    [mutationFn, delayMs],
  );

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    latestRef.current = null;
  }, []);

  return { debouncedFn, cancel, savingState };
}
