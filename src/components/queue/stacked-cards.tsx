"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SendButton } from "@/components/send/send-button";
import { MessageEditor, type DraftValue } from "@/components/messages/message-editor";
import { useKeyboardShortcut } from "@/lib/keyboard";
import { toast } from "sonner";
import { ConfidenceBadge } from "@/components/messages/confidence-badge";

export function StackedCards() {
  const queue = trpc.touchpoints.listQueue.useQuery();
  const utils = trpc.useUtils();
  const profile = trpc.profile.get.useQuery();
  const threshold = ((profile.data?.sendDefaults as { confidenceThreshold?: number } | null)?.confidenceThreshold) ?? 75;
  const updateMessage = trpc.touchpoints.updateMessage.useMutation();
  const skip = trpc.touchpoints.skip.useMutation({
    onSuccess: () => utils.touchpoints.listQueue.invalidate(),
  });

  const [index, setIndex] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editorValue, setEditorValue] = useState<DraftValue | null>(null);

  const items = queue.data ?? [];
  const current = items[index];

  useKeyboardShortcut("ArrowRight", () => {
    if (!current) return;
    document.getElementById("queue-send-btn-wrap")?.querySelector("button")?.click();
  });
  useKeyboardShortcut("ArrowLeft", () => {
    if (!current) return;
    skip.mutate({ id: current.id }, { onSuccess: () => setIndex((i) => i) });
  });
  useKeyboardShortcut("ArrowUp", () => {
    if (!current?.message) return;
    if (editing) return;
    setEditorValue({
      channel: current.channel as "email" | "linkedin",
      templateId: current.message.templateId,
      subject: current.message.subject,
      body: current.message.body,
    });
    setEditing(true);
  });

  if (queue.isLoading || queue.isPending) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-3">
        <div className="h-4 w-32 bg-muted rounded animate-pulse" />
        <div className="h-48 w-full bg-muted/60 rounded animate-pulse" />
      </div>
    );
  }
  if (items.length === 0) {
    return <div className="p-12 text-center text-muted-foreground">Queue is empty. Draft messages from a contact page.</div>;
  }
  if (!current) {
    return <div className="p-12 text-center text-muted-foreground">All caught up. ({items.length} processed.)</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{index + 1} of {items.length}</p>
        <p className="text-xs text-muted-foreground">↑ edit · → send · ← skip</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{current.contact.name}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {current.contact.role ?? "—"} · {current.contact.company.name}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Channel: {current.channel}</span>
            <span>·</span>
            <span>Status: {current.status}</span>
            <span>·</span>
            <ConfidenceBadge score={current.message?.draftConfidence ?? null} threshold={threshold} />
            {current.message?.reasoning && (
              <>
                <span>·</span>
                <span className="italic">{current.message.reasoning}</span>
              </>
            )}
          </div>

          {editing && editorValue ? (
            <>
              <MessageEditor value={editorValue} onChange={setEditorValue} />
              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    await updateMessage.mutateAsync({
                      touchpointId: current.id,
                      body: editorValue.body,
                      subject: editorValue.subject ?? undefined,
                    });
                    toast.success("Saved");
                    setEditing(false);
                    utils.touchpoints.listQueue.invalidate();
                  }}
                >
                  Save
                </Button>
                <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </>
          ) : (
            <>
              {current.message?.subject && (
                <p className="font-medium text-sm">Subject: {current.message.subject}</p>
              )}
              <pre className="whitespace-pre-wrap font-sans text-sm bg-muted/40 rounded-md p-3">
                {current.message?.body}
              </pre>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 justify-end mt-4">
        <Button variant="ghost" onClick={() => skip.mutate({ id: current.id })}>
          Skip
        </Button>
        <Button variant="outline" onClick={() => {
          if (current.message) {
            setEditorValue({
              channel: current.channel as "email" | "linkedin",
              templateId: current.message.templateId,
              subject: current.message.subject,
              body: current.message.body,
            });
            setEditing(true);
          }
        }}>
          Edit
        </Button>
        <span id="queue-send-btn-wrap">
          <SendButton
            touchpointId={current.id}
            defaultAdapter={current.channel === "linkedin" ? "clipboard" : "mailto"}
            onAfterSend={() => {
              setEditing(false);
              setIndex((i) => i + 1);
            }}
          />
        </span>
      </div>
    </div>
  );
}
