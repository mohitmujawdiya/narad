"use client";

import { useState } from "react";
import { MessageCircleQuestion, Check, Send, Sparkles, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FollowUpOption = {
  label: string;
  description?: string;
};

export type FollowUpQuestion = {
  question: string;
  header?: string;
  options: FollowUpOption[];
  multiSelect?: boolean;
};

export type FollowUpAnswer = {
  header: string;
  answer: string;
};

type FollowUpCardProps = {
  questions: FollowUpQuestion[];
  onSubmit: (answers: FollowUpAnswer[]) => void;
  disabled?: boolean;
  selectedAnswers?: FollowUpAnswer[];
};

const RECOMMENDED_RE = /\s*\(Recommended\)\s*$/i;
function isRecommended(label: string): boolean {
  return RECOMMENDED_RE.test(label);
}
function stripRecommended(label: string): string {
  return label.replace(RECOMMENDED_RE, "").trim();
}

type QState = {
  selected: Set<string>;
  otherText: string;
  useOther: boolean;
};

function makeBlankState(): QState {
  return { selected: new Set<string>(), otherText: "", useOther: false };
}

export function FollowUpCard({
  questions,
  onSubmit,
  disabled = false,
  selectedAnswers,
}: FollowUpCardProps) {
  // Map-keyed state survives `questions[]` growing during streaming. Array-keyed
  // state initialized at length 1 stays length 1 even when q2 streams in,
  // making q2's clicks silently no-op.
  const [stateMap, setStateMap] = useState<Map<number, QState>>(new Map());

  const getQState = (i: number): QState => stateMap.get(i) ?? makeBlankState();

  const requireExplicitSubmit =
    questions.length > 1 || questions.some((q) => q.multiSelect);

  function updateQState(qIdx: number, updater: (s: QState) => QState) {
    setStateMap((prev) => {
      const next = new Map(prev);
      next.set(qIdx, updater(prev.get(qIdx) ?? makeBlankState()));
      return next;
    });
  }

  function selectOption(qIdx: number, optionLabel: string) {
    if (disabled) return;
    const q = questions[qIdx];

    // Auto-submit only for the simplest case: single question, single-select,
    // and not currently selected (so a click never traps the user).
    if (
      !q.multiSelect &&
      questions.length === 1 &&
      !getQState(qIdx).selected.has(optionLabel)
    ) {
      onSubmit([{ header: q.header ?? "", answer: stripRecommended(optionLabel) }]);
      return;
    }

    updateQState(qIdx, (s) => {
      if (q.multiSelect) {
        // Multi-select: toggle membership
        const sel = new Set(s.selected);
        if (sel.has(optionLabel)) sel.delete(optionLabel);
        else sel.add(optionLabel);
        return { ...s, selected: sel, useOther: false };
      }
      // Single-select: clicking selected option deselects it (toggle); otherwise
      // replaces selection.
      if (s.selected.has(optionLabel) && s.selected.size === 1) {
        return { ...s, selected: new Set(), useOther: false };
      }
      return { ...s, selected: new Set([optionLabel]), useOther: false };
    });
  }

  function setOtherText(qIdx: number, text: string) {
    updateQState(qIdx, (s) => ({
      ...s,
      otherText: text,
      // Treat any non-empty text as "use other"; clear option picks.
      useOther: text.length > 0,
      selected: text.length > 0 ? new Set() : s.selected,
    }));
  }

  function answerForQuestion(qIdx: number): string {
    const s = getQState(qIdx);
    if (s.useOther && s.otherText.trim()) return s.otherText.trim();
    if (s.selected.size > 0) {
      return Array.from(s.selected).map(stripRecommended).join(", ");
    }
    return "";
  }

  function handleSubmit() {
    if (disabled) return;
    const answers: FollowUpAnswer[] = questions.map((q, i) => ({
      header: q.header ?? "",
      answer: answerForQuestion(i),
    }));
    if (answers.some((a) => !a.answer)) return;
    onSubmit(answers);
  }

  const allAnswered = questions.every((_, i) => {
    const s = getQState(i);
    if (s.useOther) return s.otherText.trim().length > 0;
    return s.selected.size > 0;
  });

  function disabledAnswerLabels(qIdx: number): Set<string> {
    if (!disabled || !selectedAnswers) return new Set();
    const raw = selectedAnswers[qIdx]?.answer ?? "";
    if (!raw) return new Set();
    return new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
  }

  return (
    <div className="rounded-lg border border-border/50 bg-muted/40 p-3 my-1 space-y-3">
      {questions.map((q, qIdx) => {
        const qState = getQState(qIdx);
        const disabledLabels = disabledAnswerLabels(qIdx);
        const disabledAnswerStr = disabled
          ? selectedAnswers?.[qIdx]?.answer ?? ""
          : "";
        const disabledHasCustom =
          disabled &&
          disabledAnswerStr.length > 0 &&
          !q.options.some((o) => {
            const stripped = stripRecommended(o.label);
            return disabledLabels.has(stripped) || disabledLabels.has(o.label);
          });

        return (
          <div
            key={qIdx}
            className={cn(
              "space-y-2",
              qIdx > 0 && "pt-3 border-t border-border/30",
            )}
          >
            {/* Header chip + question */}
            <div className="flex items-start gap-2">
              <MessageCircleQuestion className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1 space-y-1">
                {q.header && (
                  <span className="inline-block rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                    {q.header}
                  </span>
                )}
                <div className="text-sm font-medium leading-snug">
                  {q.question}
                </div>
                {q.multiSelect && !disabled && (
                  <div className="text-[10px] text-muted-foreground">
                    Pick all that apply
                  </div>
                )}
              </div>
            </div>

            {/* Options */}
            <div className="space-y-1.5">
              {q.options.map((option, oIdx) => {
                const stripped = stripRecommended(option.label);
                const recommended = isRecommended(option.label);
                const isLiveSelected = qState.selected.has(option.label);
                const isDisabledSelected =
                  disabled &&
                  (disabledLabels.has(stripped) || disabledLabels.has(option.label));
                const showSelected = disabled ? isDisabledSelected : isLiveSelected;

                return (
                  <button
                    key={`${oIdx}-${option.label}`}
                    type="button"
                    className={cn(
                      "w-full text-left rounded-md border px-3 py-2 text-sm transition-colors",
                      showSelected
                        ? "border-primary bg-primary/15 text-foreground ring-1 ring-primary/20"
                        : disabled
                          ? "border-transparent bg-transparent text-muted-foreground/50 cursor-default"
                          : "border-border/50 bg-background/50 hover:border-primary/40 hover:bg-primary/5 cursor-pointer",
                    )}
                    onClick={() => selectOption(qIdx, option.label)}
                    disabled={disabled}
                  >
                    <div className="flex items-start gap-2">
                      {q.multiSelect ? (
                        <span
                          className={cn(
                            "mt-0.5 h-3.5 w-3.5 rounded border shrink-0 flex items-center justify-center",
                            showSelected
                              ? "bg-primary border-primary"
                              : "border-border/60",
                          )}
                        >
                          {showSelected && (
                            <Check className="h-2.5 w-2.5 text-primary-foreground" />
                          )}
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "mt-0.5 h-3.5 w-3.5 rounded-full border shrink-0 flex items-center justify-center",
                            showSelected
                              ? "border-primary bg-primary/20"
                              : "border-border/60",
                          )}
                        >
                          {showSelected && (
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                          )}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div
                          className={cn(
                            "font-medium flex items-center gap-1.5 flex-wrap",
                            showSelected && "text-primary",
                          )}
                        >
                          <span>{stripped}</span>
                          {recommended && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-primary/15 text-primary px-1 py-0 text-[9px] font-semibold uppercase tracking-wide">
                              <Sparkles className="h-2.5 w-2.5" />
                              Recommended
                            </span>
                          )}
                        </div>
                        {option.description && (!disabled || showSelected) && (
                          <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            {option.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* "Or type your own" — always-visible co-equal alternative */}
            {!disabled && (
              <div
                className={cn(
                  "rounded-md border px-3 py-2 text-sm transition-colors flex items-start gap-2",
                  qState.useOther
                    ? "border-primary bg-primary/15 ring-1 ring-primary/20"
                    : "border-border/50 bg-background/30 hover:border-primary/40",
                )}
              >
                <Pencil
                  className={cn(
                    "mt-1 h-3.5 w-3.5 shrink-0",
                    qState.useOther ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <input
                  type="text"
                  placeholder="Or type your own answer…"
                  value={qState.otherText}
                  onChange={(e) => setOtherText(qIdx, e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !requireExplicitSubmit &&
                      qState.otherText.trim()
                    ) {
                      e.preventDefault();
                      onSubmit([
                        {
                          header: q.header ?? "",
                          answer: qState.otherText.trim(),
                        },
                      ]);
                    }
                  }}
                  className={cn(
                    "flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground/60",
                    qState.useOther && "text-primary font-medium",
                  )}
                />
              </div>
            )}

            {/* Custom restored answer (didn't match any option) */}
            {disabledHasCustom && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm">
                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-primary font-medium">
                  {disabledAnswerStr}
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* Submit button (multi-question or any multi-select) */}
      {!disabled && requireExplicitSubmit && (
        <Button
          size="sm"
          variant="default"
          className="w-full h-8 text-xs"
          onClick={handleSubmit}
          disabled={!allAnswered}
        >
          <Send className="h-3 w-3 mr-1" />
          {questions.length > 1
            ? `Submit ${questions.length} answers`
            : "Submit"}
        </Button>
      )}
    </div>
  );
}
