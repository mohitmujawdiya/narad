"use client";

import { useState } from "react";
import { MessageCircleQuestion, Send, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type OpenQuestionCardProps = {
  question: string;
  header?: string;
  placeholder?: string;
  context?: string;
  onSubmit: (answer: string) => void;
  disabled?: boolean;
  selectedAnswer?: string;
};

export function OpenQuestionCard({
  question,
  header,
  placeholder,
  context,
  onSubmit,
  disabled = false,
  selectedAnswer,
}: OpenQuestionCardProps) {
  const [text, setText] = useState("");

  function handleSubmit() {
    if (disabled) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <div className="rounded-lg border border-border/50 bg-muted/40 p-3 my-1 space-y-2.5">
      {/* Header chip + question */}
      <div className="flex items-start gap-2">
        <MessageCircleQuestion className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1 space-y-1">
          {header && (
            <span className="inline-block rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
              {header}
            </span>
          )}
          <div className="text-sm font-medium leading-snug">{question}</div>
          {context && !disabled && (
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              {context}
            </div>
          )}
        </div>
      </div>

      {/* Disabled (restored) state — show user's answer */}
      {disabled ? (
        selectedAnswer && (
          <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <span className="text-primary font-medium whitespace-pre-wrap">
              {selectedAnswer}
            </span>
          </div>
        )
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={placeholder ?? "Type your response..."}
            rows={3}
            className="w-full rounded-md border border-border/50 bg-background/50 px-2.5 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-y min-h-[60px]"
            autoFocus
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground">
              ⌘+Enter to send
            </span>
            <Button
              size="sm"
              variant="default"
              className={cn("h-7 text-xs")}
              onClick={handleSubmit}
              disabled={!text.trim()}
            >
              <Send className="h-3 w-3 mr-1" />
              Send
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
