"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function LogReplyDialog({ touchpointId }: { touchpointId: string }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [snippet, setSnippet] = useState("");
  const log = trpc.touchpoints.logReply.useMutation({
    onSuccess: () => {
      toast.success("Reply logged");
      setOpen(false);
      utils.touchpoints.listAwaitingReply.invalidate();
      utils.touchpoints.listReplied.invalidate();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Log reply</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log reply</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Reply snippet (optional)</Label>
          <Textarea rows={3} value={snippet} onChange={(e) => setSnippet(e.target.value)} placeholder="First line of their reply…" />
        </div>
        <DialogFooter>
          <Button onClick={() => log.mutate({ id: touchpointId, replySnippet: snippet || undefined })} disabled={log.isPending}>
            {log.isPending ? "Logging…" : "Log as replied"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
