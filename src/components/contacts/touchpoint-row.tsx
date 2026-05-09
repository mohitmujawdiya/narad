"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronDown, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MessageEditor, type DraftValue } from "@/components/messages/message-editor";
import { SendButton } from "@/components/send/send-button";
import { ConfidenceBadge } from "@/components/messages/confidence-badge";
import { LogReplyDialog } from "@/components/send/log-reply-dialog";

type Touchpoint = {
  id: string;
  channel: string;
  direction: string;
  status: string;
  sentAt: Date | null;
  repliedAt: Date | null;
  message: {
    id: string;
    subject: string | null;
    body: string;
    draftConfidence: number | null;
    draftedBy: string | null;
    reasoning: string | null;
    templateId: string | null;
  } | null;
};

const STATUS_COLOR: Record<string, string> = {
  Drafted: "bg-muted text-muted-foreground",
  Queued: "bg-primary/15 text-primary",
  Sent: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  Replied: "bg-green-500/15 text-green-600 dark:text-green-400",
  Bounced: "bg-destructive/15 text-destructive",
  NoReply: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  Skipped: "bg-muted text-muted-foreground line-through",
};

export function TouchpointRow({
  touchpoint,
  contactId,
  threshold,
}: {
  touchpoint: Touchpoint;
  contactId: string;
  threshold: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState<DraftValue | null>(null);

  const utils = trpc.useUtils();
  const invalidate = () => {
    void utils.contacts.byId.invalidate({ id: contactId });
    void utils.touchpoints.listQueue.invalidate();
    void utils.touchpoints.listAwaitingReply.invalidate();
    void utils.touchpoints.listReplied.invalidate();
  };

  const updateMessage = trpc.touchpoints.updateMessage.useMutation({
    onSuccess: () => {
      toast.success("Saved");
      setEditing(false);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const queue = trpc.touchpoints.queue.useMutation({
    onSuccess: () => { toast.success("Queued"); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const unqueue = trpc.touchpoints.unqueue.useMutation({
    onSuccess: () => { toast.success("Moved to Drafted"); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const skip = trpc.touchpoints.skip.useMutation({
    onSuccess: () => { toast.success("Skipped"); invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.touchpoints.remove.useMutation({
    onSuccess: () => { toast.success("Removed"); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  function startEdit() {
    if (!touchpoint.message) return;
    setEditValue({
      channel: (touchpoint.channel === "linkedin" ? "linkedin" : "email") as "email" | "linkedin",
      templateId: touchpoint.message.templateId,
      subject: touchpoint.message.subject,
      body: touchpoint.message.body,
    });
    setEditing(true);
  }

  function saveEdit() {
    if (!editValue) return;
    updateMessage.mutate({
      touchpointId: touchpoint.id,
      body: editValue.body,
      subject: editValue.subject ?? undefined,
    });
  }

  function cancelEdit() {
    setEditing(false);
    setEditValue(null);
  }

  const status = touchpoint.status;
  const showEdit = ["Drafted", "Queued", "Skipped", "Bounced", "NoReply"].includes(status);
  const showQueue = ["Drafted", "Skipped", "Bounced", "NoReply"].includes(status);
  const showUnqueue = status === "Queued";
  const showSend = status === "Queued" || status === "Drafted";
  const showSkip = ["Drafted", "Queued"].includes(status);
  const showLogReply = status === "Sent";
  const showRedraft = ["Bounced", "NoReply"].includes(status);

  const statusClass = STATUS_COLOR[status] ?? "bg-muted text-muted-foreground";

  return (
    <li className="border-b last:border-b-0">
      <button
        type="button"
        className="w-full px-3 py-2 flex items-start gap-2 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{touchpoint.channel}</span>
            <span className={cn("text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 font-medium", statusClass)}>
              {status}
            </span>
            {touchpoint.message?.draftedBy && (
              <ConfidenceBadge
                score={touchpoint.message.draftConfidence ?? null}
                threshold={threshold}
              />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {touchpoint.sentAt
              ? `Sent ${new Date(touchpoint.sentAt).toLocaleString()}`
              : touchpoint.repliedAt
              ? `Replied ${new Date(touchpoint.repliedAt).toLocaleString()}`
              : "Draft"}
          </p>
          {!expanded && touchpoint.message && (
            <p className="text-sm mt-1 line-clamp-2 text-muted-foreground">
              {touchpoint.message.body}
            </p>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-0 pl-9 space-y-3">
          {editing && editValue ? (
            <>
              <MessageEditor value={editValue} onChange={setEditValue} />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveEdit} disabled={updateMessage.isPending}>
                  {updateMessage.isPending ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              {touchpoint.message?.subject && (
                <p className="text-sm">
                  <span className="font-medium">Subject:</span> {touchpoint.message.subject}
                </p>
              )}
              {touchpoint.message && (
                <pre className="whitespace-pre-wrap font-sans text-sm bg-muted/40 rounded-md p-3">
                  {touchpoint.message.body}
                </pre>
              )}
              {touchpoint.message?.reasoning && (
                <p className="text-xs italic text-muted-foreground">
                  Why this hook: {touchpoint.message.reasoning}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {showEdit && (
                  <Button size="sm" variant="outline" onClick={startEdit}>Edit</Button>
                )}
                {showQueue && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => queue.mutate({ id: touchpoint.id })}
                    disabled={queue.isPending}
                  >
                    {status === "Skipped" ? "Re-queue" : "Queue"}
                  </Button>
                )}
                {showUnqueue && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => unqueue.mutate({ id: touchpoint.id })}
                    disabled={unqueue.isPending}
                  >
                    Unqueue
                  </Button>
                )}
                {showRedraft && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => unqueue.mutate({ id: touchpoint.id })}
                    disabled={unqueue.isPending}
                  >
                    Re-draft
                  </Button>
                )}
                {showSend && (
                  <SendButton
                    touchpointId={touchpoint.id}
                    defaultAdapter={touchpoint.channel === "linkedin" ? "clipboard" : "mailto"}
                    onAfterSend={invalidate}
                  />
                )}
                {showSkip && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => skip.mutate({ id: touchpoint.id })}
                    disabled={skip.isPending}
                  >
                    Skip
                  </Button>
                )}
                {showLogReply && <LogReplyDialog touchpointId={touchpoint.id} />}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive ml-auto"
                  onClick={() => {
                    if (confirm("Delete this touchpoint?")) remove.mutate({ id: touchpoint.id });
                  }}
                  disabled={remove.isPending}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </li>
  );
}
