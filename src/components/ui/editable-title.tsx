"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

type EditableTitleProps = {
  value: string;
  onSave: (title: string) => void;
  disabled?: boolean;
  /** Compact variant for card grid titles */
  size?: "default" | "sm";
  className?: string;
};

export function EditableTitle({ value, onSave, disabled, size = "default", className }: EditableTitleProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      if (isSmall) {
        const ta = textareaRef.current;
        if (ta) {
          autoResize(ta);
          ta.select();
        }
      } else {
        inputRef.current?.select();
      }
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    } else {
      setDraft(value);
    }
  };

  const isSmall = size === "sm";

  const autoResize = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = "0";
    el.style.height = el.scrollHeight + "px";
  }, []);

  if (editing && isSmall) {
    return (
      <textarea
        ref={textareaRef}
        rows={1}
        className={cn(
          "bg-transparent outline-none border border-border rounded-md w-full min-w-0 resize-none overflow-hidden",
          "text-sm font-medium px-1.5 py-0.5 leading-tight",
          className,
        )}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          autoResize(e.target);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={cn(
          "bg-transparent outline-none border border-border rounded-md w-full min-w-0",
          "text-base font-semibold px-2 py-0.5",
          className,
        )}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <span
      className={cn(
        "rounded-md min-w-0",
        isSmall
          ? "text-sm font-medium leading-tight line-clamp-2"
          : "text-base font-semibold truncate",
        !disabled && "cursor-pointer hover:ring-1 hover:ring-border",
        !disabled && !isSmall && "px-2 py-0.5 -mx-2 -my-0.5 mr-2",
        className,
      )}
      onClick={(e) => {
        if (disabled) return;
        e.stopPropagation();
        setEditing(true);
      }}
      title={disabled ? value : "Click to rename"}
    >
      {value}
    </span>
  );
}
