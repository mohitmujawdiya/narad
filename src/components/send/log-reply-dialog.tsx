"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export function LogReplyDialog({
  pursuitId,
  pursuitName,
}: {
  pursuitId: string;
  pursuitName: string;
}) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const log = trpc.pursuits.logReply.useMutation({
    onSuccess: () => {
      toast.success(`Logged reply from ${pursuitName}`);
      setOpen(false);
      void utils.pursuits.listAwaitingReply.invalidate();
      void utils.pursuits.listReplied.invalidate();
      void utils.pursuits.list.invalidate();
      void utils.pursuits.byId.invalidate({ id: pursuitId });
    },
    onError: (err) => toast.error(err.message ?? "Failed to log reply"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Log reply
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log reply from {pursuitName}</DialogTitle>
          <DialogDescription>
            Marks the reply as received and moves the pursuit to the Replied stage.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={log.isPending}>
            Cancel
          </Button>
          <Button onClick={() => log.mutate({ id: pursuitId })} disabled={log.isPending}>
            {log.isPending ? "Logging…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
