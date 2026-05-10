"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, ChevronDown, Pencil, X } from "lucide-react";
import type { PursuitWithDecodedJson } from "@/server/types/pursuit";

type AdapterId = "mailto" | "clipboard" | "plain-log";
const ADAPTERS: { id: AdapterId; label: string }[] = [
  { id: "mailto", label: "Email (mailto)" },
  { id: "clipboard", label: "LinkedIn (copy + open)" },
  { id: "plain-log", label: "Already sent (just log)" },
];

export function OutreachTab({ pursuit }: { pursuit: PursuitWithDecodedJson }) {
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [goal, setGoal] = useState("");
  const [channel, setChannel] = useState<"email" | "linkedin">(
    pursuit.outreachChannel === "linkedin" ? "linkedin" : "email",
  );
  const [pendingAdapter, setPendingAdapter] = useState<AdapterId | null>(null);

  const draft = trpc.pursuits.draftOutreach.useMutation({
    onSuccess: () => {
      toast.success("Draft generated");
      void utils.pursuits.byId.invalidate({ id: pursuit.id });
    },
    onError: (e) => toast.error(e.message),
  });

  const save = trpc.pursuits.saveOutreachDraft.useMutation({
    onSuccess: () => {
      toast.success("Saved");
      setEditing(false);
      void utils.pursuits.byId.invalidate({ id: pursuit.id });
    },
    onError: (e) => toast.error(e.message),
  });

  const dispatch = trpc.pursuits.dispatchSend.useMutation();
  const confirmManual = trpc.pursuits.confirmManualSend.useMutation();
  const markSent = trpc.pursuits.markOutreachSent.useMutation({
    onSuccess: () => {
      toast.success("Marked as sent");
      void utils.pursuits.byId.invalidate({ id: pursuit.id });
    },
    onError: (e) => toast.error(e.message),
  });
  const logReply = trpc.pursuits.logReply.useMutation({
    onSuccess: () => {
      toast.success("Reply logged");
      void utils.pursuits.byId.invalidate({ id: pursuit.id });
    },
    onError: (e) => toast.error(e.message),
  });

  const hasDraft = pursuit.outreachBody !== null && pursuit.outreachBody !== "";
  const isSent = pursuit.outreachSentAt !== null;

  function startEdit() {
    setDraftSubject(pursuit.outreachSubject ?? "");
    setDraftBody(pursuit.outreachBody ?? "");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  function saveEdit() {
    save.mutate({
      id: pursuit.id,
      subject: draftSubject || null,
      body: draftBody,
      channel: (pursuit.outreachChannel as "email" | "linkedin") ?? "email",
      // Preserve existing meta — we only update text here.
      confidence: pursuit.outreachConfidence ?? undefined,
      reasoning: pursuit.outreachReasoning ?? undefined,
      hookUsed: pursuit.outreachHookUsed ?? undefined,
    });
  }

  async function send(adapterId: AdapterId) {
    setPendingAdapter(adapterId);
    try {
      const result = await dispatch.mutateAsync({ id: pursuit.id, adapterId });
      switch (result.kind) {
        case "logged":
          toast.success("Logged as sent");
          break;
        case "sent":
          toast.success("Sent");
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
          if (window.confirm(`${result.instructions}\n\nDid you send it? Click OK to mark as Sent.`)) {
            await confirmManual.mutateAsync({ id: pursuit.id });
            toast.success("Marked as sent");
          } else {
            toast.info("Left as drafted — confirm later");
          }
          break;
        case "failed":
          toast.error(result.error);
          break;
      }
      void utils.pursuits.byId.invalidate({ id: pursuit.id });
    } finally {
      setPendingAdapter(null);
    }
  }

  // No draft yet — show the prompt-and-generate UI.
  if (!hasDraft) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Draft outreach</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-dashed border-border p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              No outreach draft yet. (The full AI-draft dialog with template
              selection lands in Task 22 — for now, generate inline below.)
            </p>
            <div className="grid gap-2">
              <Label htmlFor="goal" className="text-xs">
                Goal (optional)
              </Label>
              <Textarea
                id="goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={2}
                placeholder="e.g. land a 20-min intro call about their AI infra hiring."
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 text-xs">
                {(["email", "linkedin"] as const).map((c) => (
                  <Button
                    key={c}
                    size="sm"
                    variant={channel === c ? "default" : "outline"}
                    onClick={() => setChannel(c)}
                  >
                    {c}
                  </Button>
                ))}
              </div>
              <Button
                onClick={() =>
                  draft.mutate({
                    id: pursuit.id,
                    channel,
                    goal: goal.trim() || undefined,
                  })
                }
                disabled={draft.isPending}
              >
                <Sparkles className="size-4" />
                {draft.isPending ? "Drafting…" : "Draft outreach"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Draft exists — show the editable view + meta + send controls.
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base">Outreach draft</CardTitle>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <Badge variant="outline">
                {pursuit.outreachChannel ?? "email"}
              </Badge>
              {pursuit.outreachConfidence != null && (
                <Badge variant="secondary">
                  Confidence: {pursuit.outreachConfidence}/100
                </Badge>
              )}
              {isSent && (
                <Badge>
                  Sent {new Date(pursuit.outreachSentAt!).toLocaleString()}
                </Badge>
              )}
              {pursuit.outreachRepliedAt && (
                <Badge>
                  Replied{" "}
                  {new Date(pursuit.outreachRepliedAt).toLocaleString()}
                </Badge>
              )}
            </div>
          </div>
          {!editing && !isSent && (
            <Button size="sm" variant="ghost" onClick={startEdit}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
          )}
          {editing && (
            <Button size="sm" variant="ghost" onClick={cancelEdit}>
              <X className="size-3.5" />
              Cancel
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {editing ? (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Subject</Label>
                <Input
                  value={draftSubject}
                  onChange={(e) => setDraftSubject(e.target.value)}
                  placeholder="(optional)"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Body</Label>
                <Textarea
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  rows={12}
                  className="font-sans text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveEdit} disabled={save.isPending}>
                  {save.isPending ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              {pursuit.outreachSubject && (
                <p className="text-sm">
                  <span className="font-medium">Subject:</span>{" "}
                  {pursuit.outreachSubject}
                </p>
              )}
              <pre className="whitespace-pre-wrap font-sans text-sm bg-muted/40 rounded-md p-3">
                {pursuit.outreachBody}
              </pre>
              {(pursuit.outreachReasoning || pursuit.outreachHookUsed) && (
                <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1 text-xs">
                  {pursuit.outreachHookUsed && (
                    <p>
                      <span className="font-medium">Hook:</span>{" "}
                      {pursuit.outreachHookUsed}
                    </p>
                  )}
                  {pursuit.outreachReasoning && (
                    <p className="italic text-muted-foreground">
                      {pursuit.outreachReasoning}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {!editing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Send</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            {!isSent && (
              <>
                <div className="inline-flex">
                  <Button
                    onClick={() =>
                      send(pursuit.outreachChannel === "linkedin" ? "clipboard" : "mailto")
                    }
                    disabled={pendingAdapter !== null}
                  >
                    <Send className="size-4" />
                    {pendingAdapter !== null ? "Sending…" : "Send"}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={pendingAdapter !== null}
                      >
                        <ChevronDown className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {ADAPTERS.map((a) => (
                        <DropdownMenuItem
                          key={a.id}
                          onClick={() => send(a.id)}
                          disabled={pendingAdapter !== null}
                        >
                          {a.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markSent.mutate({ id: pursuit.id })}
                  disabled={markSent.isPending}
                >
                  Mark as sent
                </Button>
              </>
            )}
            {isSent && !pursuit.outreachRepliedAt && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => logReply.mutate({ id: pursuit.id })}
                disabled={logReply.isPending}
              >
                Log reply
              </Button>
            )}
            {!isSent && (
              <Button
                size="sm"
                variant="ghost"
                disabled={draft.isPending}
                onClick={() => {
                  if (confirm("Regenerate outreach? This replaces the current draft."))
                    draft.mutate({
                      id: pursuit.id,
                      channel:
                        pursuit.outreachChannel === "linkedin" ? "linkedin" : "email",
                    });
                }}
              >
                <Sparkles className="size-3.5" />
                Re-draft
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
