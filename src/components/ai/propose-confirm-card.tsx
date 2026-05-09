"use client";

import { useState } from "react";
import { Lightbulb, Check, Pencil, Repeat, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ProposeConfirmDecision = "confirm" | "refine" | "replace";

export type ProposeConfirmAnswer = {
  decision: ProposeConfirmDecision;
  note?: string;
};

type ProposeConfirmCardProps = {
  header?: string;
  summary: string;
  reasoning: string;
  implications: string[];
  onSubmit: (answer: ProposeConfirmAnswer) => void;
  disabled?: boolean;
  selectedAnswer?: ProposeConfirmAnswer;
};

const DECISION_LABELS: Record<ProposeConfirmDecision, string> = {
  confirm: "Confirmed",
  refine: "Refined",
  replace: "Replaced",
};

export function ProposeConfirmCard({
  header,
  summary,
  reasoning,
  implications,
  onSubmit,
  disabled = false,
  selectedAnswer,
}: ProposeConfirmCardProps) {
  const [pendingDecision, setPendingDecision] = useState<
    "refine" | "replace" | null
  >(null);
  const [note, setNote] = useState("");

  function commit(decision: ProposeConfirmDecision, noteText?: string) {
    if (disabled) return;
    onSubmit({ decision, note: noteText?.trim() || undefined });
  }

  function handleNoteSubmit() {
    if (!pendingDecision) return;
    const trimmed = note.trim();
    if (!trimmed) return;
    commit(pendingDecision, trimmed);
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 my-1 space-y-2.5">
      {/* Header chip + Lightbulb icon */}
      <div className="flex items-start gap-2">
        <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            {header && (
              <span className="inline-block rounded-full bg-primary/15 text-primary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                {header}
              </span>
            )}
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
              Proposal
            </span>
          </div>
          <div className="text-sm font-medium leading-snug">{summary}</div>
        </div>
      </div>

      {/* Reasoning */}
      <div className="text-xs text-muted-foreground leading-relaxed pl-6">
        {reasoning}
      </div>

      {/* Implications */}
      {implications.length > 0 && (
        <div className="pl-6 space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
            What this means for the artifact:
          </div>
          <ul className="space-y-0.5">
            {implications.map((imp, i) => (
              <li
                key={i}
                className="text-xs text-foreground/80 leading-relaxed flex gap-1.5"
              >
                <span className="text-primary/60 shrink-0">→</span>
                <span>{imp}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Disabled (restored) state — show user's decision */}
      {disabled && selectedAnswer ? (
        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-background/50 px-3 py-2 text-sm">
          <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="text-primary font-medium">
              {DECISION_LABELS[selectedAnswer.decision]}
            </span>
            {selectedAnswer.note && (
              <div className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">
                {selectedAnswer.note}
              </div>
            )}
          </div>
        </div>
      ) : !pendingDecision ? (
        // Action buttons
        <div className="flex items-center gap-1.5 pt-1">
          <Button
            size="sm"
            variant="default"
            className="h-7 text-xs flex-1"
            onClick={() => commit("confirm")}
          >
            <Check className="h-3 w-3 mr-1" />
            Confirm
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setPendingDecision("refine")}
          >
            <Pencil className="h-3 w-3 mr-1" />
            Refine
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setPendingDecision("replace")}
          >
            <Repeat className="h-3 w-3 mr-1" />
            Replace
          </Button>
        </div>
      ) : (
        // Note input for refine/replace
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
            <span>
              {pendingDecision === "refine"
                ? "What to refine"
                : "What to replace it with"}
            </span>
            <button
              type="button"
              onClick={() => {
                setPendingDecision(null);
                setNote("");
              }}
              className="hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && note.trim()) {
                e.preventDefault();
                handleNoteSubmit();
              }
            }}
            placeholder={
              pendingDecision === "refine"
                ? "What part of this is off, and how should I adjust?"
                : "What's the right framing instead?"
            }
            rows={2}
            className={cn(
              "w-full rounded-md border px-2.5 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-y min-h-[50px]",
              "border-primary/30 bg-background/50",
            )}
            autoFocus
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="default"
              className="h-7 text-xs"
              onClick={handleNoteSubmit}
              disabled={!note.trim()}
            >
              <Send className="h-3 w-3 mr-1" />
              {pendingDecision === "refine" ? "Send refinement" : "Send replacement"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
