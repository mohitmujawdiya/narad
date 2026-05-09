"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Generic undo/redo history. Caller is responsible for capturing and restoring
 * snapshots — this hook just manages the stacks.
 *
 * Usage:
 *   const { pushUndo, undo, redo, canUndo, canRedo } = useUndoRedo<State>();
 *
 *   // Before each user action that mutates state:
 *   pushUndo(currentState);
 *   applyMutation(newState);
 *
 *   // On Cmd+Z:
 *   const prev = undo(currentState);
 *   if (prev) applyState(prev);
 *
 *   // On Cmd+Shift+Z:
 *   const next = redo(currentState);
 *   if (next) applyState(next);
 */
export function useUndoRedo<T>(maxHistory = 50) {
  const undoStack = useRef<T[]>([]);
  const redoStack = useRef<T[]>([]);
  const [revision, setRevision] = useState(0);

  const pushUndo = useCallback(
    (snapshot: T) => {
      undoStack.current = [
        ...undoStack.current.slice(-(maxHistory - 1)),
        snapshot,
      ];
      redoStack.current = [];
      setRevision((r) => r + 1);
    },
    [maxHistory],
  );

  const undo = useCallback((current: T): T | null => {
    if (undoStack.current.length === 0) return null;
    const prev = undoStack.current.pop()!;
    redoStack.current.push(current);
    setRevision((r) => r + 1);
    return prev;
  }, []);

  const redo = useCallback((current: T): T | null => {
    if (redoStack.current.length === 0) return null;
    const next = redoStack.current.pop()!;
    undoStack.current.push(current);
    setRevision((r) => r + 1);
    return next;
  }, []);

  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;

  // revision is read to ensure re-render when stacks change
  void revision;

  return { pushUndo, undo, redo, canUndo, canRedo };
}
