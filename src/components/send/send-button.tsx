"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Send, ChevronDown } from "lucide-react";
import { toast } from "sonner";

const ADAPTERS = [
  { id: "mailto" as const, label: "Email (mailto)" },
  { id: "clipboard" as const, label: "LinkedIn (copy + open)" },
  { id: "plain-log" as const, label: "Already sent (just log)" },
];

export function SendButton({
  touchpointId,
  defaultAdapter = "mailto",
  onAfterSend,
}: {
  touchpointId: string;
  defaultAdapter?: "mailto" | "clipboard" | "plain-log";
  onAfterSend?: () => void;
}) {
  const utils = trpc.useUtils();
  const [pending, setPending] = useState<string | null>(null);

  const dispatch = trpc.send.dispatch.useMutation();
  const confirm = trpc.send.confirmManualSend.useMutation();

  async function send(adapterId: typeof defaultAdapter) {
    setPending(adapterId);
    try {
      const result = await dispatch.mutateAsync({ touchpointId, adapterId });
      switch (result.kind) {
        case "logged":
          toast.success("Logged as sent");
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
            await confirm.mutateAsync({ touchpointId });
            toast.success("Marked as sent");
          } else {
            toast.info("Left as Drafted — confirm later");
          }
          break;
        case "sent":
          toast.success("Sent");
          break;
        case "failed":
          toast.error(result.error);
          break;
      }
      utils.touchpoints.listQueue.invalidate();
      utils.touchpoints.byId.invalidate({ id: touchpointId });
      onAfterSend?.();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="inline-flex">
      <Button onClick={() => send(defaultAdapter)} disabled={pending !== null}>
        <Send className="size-4" />
        {pending === defaultAdapter ? "Sending…" : "Send"}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" disabled={pending !== null}>
            <ChevronDown className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {ADAPTERS.map((a) => (
            <DropdownMenuItem key={a.id} onClick={() => send(a.id)} disabled={pending !== null}>
              {a.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
