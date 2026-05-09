"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { cn } from "@/lib/utils";

type MarkdownDocProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  /** Rendered next to Edit/Preview in the toolbar */
  toolbarActions?: React.ReactNode;
  readOnly?: boolean;
};

export function MarkdownDoc({
  value,
  onChange,
  placeholder = "Write markdown...",
  className,
  minHeight = "min-h-[200px]",
  toolbarActions,
  readOnly,
}: MarkdownDocProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback((el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, []);

  useEffect(() => {
    if (readOnly && isEditing) setIsEditing(false);
  }, [readOnly, isEditing]);

  useEffect(() => {
    if (!isEditing) setLocalValue(value);
  }, [value, isEditing]);

  // Auto-resize on entering edit mode or when value changes while editing
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      autoResize(textareaRef.current);
    }
  }, [isEditing, localValue, autoResize]);

  const handleBlur = useCallback(() => {
    onChange(localValue);
    setIsEditing(false);
  }, [localValue, onChange]);

  const handleToggle = useCallback(() => {
    if (isEditing) {
      onChange(localValue);
    } else {
      setLocalValue(value);
    }
    setIsEditing((prev) => !prev);
  }, [isEditing, localValue, onChange, value]);

  if (isEditing) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <div className="flex items-center justify-end gap-2">
          {toolbarActions}
          <button
            type="button"
            onClick={handleToggle}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Preview
          </button>
        </div>
        <textarea
          ref={textareaRef}
          value={localValue}
          onChange={(e) => {
            setLocalValue(e.target.value);
            autoResize(e.target);
          }}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            minHeight,
            "resize-none overflow-hidden",
          )}
          spellCheck={false}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-end gap-2">
        {toolbarActions}
        {!readOnly && <button
          type="button"
          onClick={handleToggle}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          aria-label="Edit"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
          Edit
        </button>}
      </div>
      <div
        className={cn(
          "prose prose-sm dark:prose-invert max-w-none rounded-md border border-input bg-background px-4 py-3",
          minHeight,
        )}
      >
        {value.trim() ? (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeSanitize]}
            components={{
              table: ({ children, ...props }) => (
                <div className="my-2 overflow-x-auto">
                  <table {...props}>{children}</table>
                </div>
              ),
            }}
          >
            {value}
          </ReactMarkdown>
        ) : (
          <p className="text-muted-foreground">{placeholder}</p>
        )}
      </div>
    </div>
  );
}
