"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useKeyboardShortcut } from "@/lib/keyboard";
import { toast } from "sonner";
import { Send, Pencil, X, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inline confidence badge — was previously in components/messages/confidence-badge.tsx.
 * Tiers: <50 red, 50-74 amber, >=75 green. Null score → muted "Manual" pill.
 */
function ConfidenceBadge({ score }: { score: number | null }) {
  if (score == null) {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground border border-border">
        Manual
      </span>
    );
  }
  const tier =
    score >= 75 ? "high" : score >= 50 ? "mid" : "low";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide font-medium border",
        tier === "high" &&
          "bg-primary/10 text-primary border-primary/30",
        tier === "mid" &&
          "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
        tier === "low" &&
          "bg-destructive/10 text-destructive border-destructive/30",
      )}
    >
      {tier === "high" ? "High" : tier === "mid" ? "Flagged" : "Low"} · {score}
    </span>
  );
}

/**
 * Default send adapter for queue review.
 * Choosing "clipboard" over "mailto": clipboard is the safest option — never
 * accidentally fires a real email client. The user always pastes manually,
 * which means they always get one final eyes-on review before hitting send
 * in their actual mail/LinkedIn client.
 */
const DEFAULT_ADAPTER = "clipboard" as const;

export function StackedCards() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const queue = trpc.pursuits.queueList.useQuery();

  const dispatch = trpc.pursuits.dispatchSend.useMutation();
  const confirmManual = trpc.pursuits.confirmManualSend.useMutation();
  const setStatus = trpc.pursuits.setStatus.useMutation();

  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState(false);

  const items = useMemo(() => queue.data ?? [], [queue.data]);
  const current = items[index];

  const removeFromCacheOptimistic = useCallback(
    (id: string) => {
      utils.pursuits.queueList.setData(undefined, (old) =>
        old ? old.filter((p) => p.id !== id) : old,
      );
      // Keep the index pointing at the next card; clamp if we just removed the last one.
      setIndex((i) => {
        const nextLen = (queue.data?.length ?? 1) - 1;
        if (nextLen <= 0) return 0;
        return Math.min(i, nextLen - 1);
      });
    },
    [utils, queue.data],
  );

  const handleSend = useCallback(async () => {
    if (!current || pending) return;
    setPending(true);
    try {
      const result = await dispatch.mutateAsync({
        id: current.id,
        adapterId: DEFAULT_ADAPTER,
      });
      switch (result.kind) {
        case "logged":
          toast.success("Logged as sent");
          removeFromCacheOptimistic(current.id);
          break;
        case "sent":
          toast.success("Sent");
          removeFromCacheOptimistic(current.id);
          break;
        case "queued-for-manual":
          if (result.copyToClipboard) {
            await navigator.clipboard.writeText(result.copyToClipboard);
          }
          if (result.openUrl) {
            window.open(result.openUrl, "_blank");
          }
          if (result.mailtoUrl) {
            window.location.href = result.mailtoUrl;
          }
          if (
            window.confirm(
              `${result.instructions}\n\nDid you send it? Click OK to mark as Sent.`,
            )
          ) {
            await confirmManual.mutateAsync({ id: current.id });
            toast.success("Marked as sent");
            removeFromCacheOptimistic(current.id);
          } else {
            toast.info("Left as drafted — confirm later");
          }
          break;
        case "failed":
          toast.error(result.error);
          break;
      }
      void utils.pursuits.queueList.invalidate();
      void utils.pursuits.byId.invalidate({ id: current.id });
    } finally {
      setPending(false);
    }
  }, [current, pending, dispatch, confirmManual, removeFromCacheOptimistic, utils]);

  const handleDiscard = useCallback(() => {
    if (!current || pending) return;
    const id = current.id;
    removeFromCacheOptimistic(id);
    setStatus.mutate(
      { id, status: "Discarded" },
      {
        onSuccess: () => {
          toast.success("Discarded");
          void utils.pursuits.queueList.invalidate();
        },
        onError: (e) => {
          toast.error(e.message);
          void utils.pursuits.queueList.invalidate();
        },
      },
    );
  }, [current, pending, removeFromCacheOptimistic, setStatus, utils]);

  const handleNext = useCallback(() => {
    setIndex((i) => Math.min(i + 1, items.length - 1));
  }, [items.length]);

  const handlePrev = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  const handleEdit = useCallback(() => {
    if (!current) return;
    router.push(`/pursuits/${current.id}?tab=outreach`);
  }, [current, router]);

  useKeyboardShortcut("Enter", handleSend);
  useKeyboardShortcut("s", handleSend);
  useKeyboardShortcut("S", handleSend);
  useKeyboardShortcut("j", handleNext);
  useKeyboardShortcut("J", handleNext);
  useKeyboardShortcut("ArrowDown", handleNext);
  useKeyboardShortcut("k", handlePrev);
  useKeyboardShortcut("K", handlePrev);
  useKeyboardShortcut("ArrowUp", handlePrev);
  useKeyboardShortcut("d", handleDiscard);
  useKeyboardShortcut("D", handleDiscard);
  useKeyboardShortcut("e", handleEdit);
  useKeyboardShortcut("E", handleEdit);

  if (queue.isLoading || queue.isPending) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-3">
        <div className="h-4 w-32 bg-muted rounded animate-pulse" />
        <div className="h-48 w-full bg-muted/60 rounded animate-pulse" />
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        Queue is empty. Draft outreach from a pursuit page.
      </div>
    );
  }
  if (!current) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        All caught up.
      </div>
    );
  }

  // The stack visualisation: top card is fully visible, the next two
  // peek out below as a literal stack.
  const stackPreview = items.slice(index + 1, index + 3);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {index + 1} of {items.length}
        </p>
        <p className="text-xs text-muted-foreground">
          Enter / S send · J/K navigate · D discard · E edit
        </p>
      </div>

      <div className="relative">
        {/* Stack preview — peek cards behind the top one */}
        {stackPreview.map((p, i) => (
          <div
            key={p.id}
            aria-hidden
            className="absolute inset-x-0 -z-10 rounded-xl border border-border bg-card/60"
            style={{
              top: `${(i + 1) * 8}px`,
              height: "100%",
              transform: `scale(${1 - (i + 1) * 0.02})`,
              opacity: 1 - (i + 1) * 0.25,
            }}
          />
        ))}

        <Card className="relative">
          <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold leading-tight">
                {current.companyName}
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {current.contactName && (
                  <span className="font-medium text-foreground">
                    {current.contactName}
                  </span>
                )}
                {current.contactRole && <span>· {current.contactRole}</span>}
                <Badge variant="outline" className="ml-1">
                  {current.outreachChannel ?? "email"}
                </Badge>
                <ConfidenceBadge score={current.outreachConfidence} />
              </div>
            </div>
            <Link
              href={`/pursuits/${current.id}?tab=outreach`}
              className="inline-flex"
            >
              <Button size="sm" variant="ghost">
                <Pencil className="size-3.5" />
                Edit
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {current.outreachSubject && (
              <p className="text-sm">
                <span className="font-medium">Subject:</span>{" "}
                {current.outreachSubject}
              </p>
            )}
            {current.outreachChannel === "email" && current.contactEmail && (
              <p className="text-xs text-muted-foreground">
                To: {current.contactEmail}
              </p>
            )}
            {current.outreachChannel === "linkedin" &&
              current.contactLinkedinUrl && (
                <p className="text-xs text-muted-foreground break-all">
                  LinkedIn: {current.contactLinkedinUrl}
                </p>
              )}
            <pre className="whitespace-pre-wrap font-sans text-sm bg-muted/40 rounded-md p-3 max-h-96 overflow-y-auto">
              {current.outreachBody}
            </pre>
            {(current.outreachReasoning || current.outreachHookUsed) && (
              <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1 text-xs">
                {current.outreachHookUsed && (
                  <p>
                    <span className="font-medium">Hook:</span>{" "}
                    {current.outreachHookUsed}
                  </p>
                )}
                {current.outreachReasoning && (
                  <p className="italic text-muted-foreground">
                    {current.outreachReasoning}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-2 mt-4">
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrev}
            disabled={index === 0}
            aria-label="Previous"
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNext}
            disabled={index >= items.length - 1}
            aria-label="Next"
          >
            <ChevronDown className="size-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={handleDiscard}
            disabled={pending || setStatus.isPending}
          >
            <X className="size-4" />
            Discard
          </Button>
          <Link href={`/pursuits/${current.id}?tab=outreach`}>
            <Button variant="outline">
              <Pencil className="size-4" />
              Edit
            </Button>
          </Link>
          <Button onClick={handleSend} disabled={pending}>
            <Send className="size-4" />
            {pending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
