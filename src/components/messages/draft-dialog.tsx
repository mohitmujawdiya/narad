"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageEditor, type DraftValue } from "./message-editor";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function DraftDialog({ contactId, defaultChannel = "email" }: { contactId: string; defaultChannel?: "email" | "linkedin" }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftValue>({
    channel: defaultChannel,
    templateId: null,
    subject: null,
    body: "",
  });

  const draftTp = trpc.touchpoints.draft.useMutation({
    onSuccess: () => {
      toast.success("Draft saved");
      setOpen(false);
      void utils.touchpoints.listQueue.invalidate();
      router.push("/queue");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Draft message</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Draft outreach</DialogTitle>
        </DialogHeader>
        <MessageEditor value={draft} onChange={setDraft} />
        <DialogFooter>
          <Button
            disabled={draftTp.isPending || !draft.body.trim()}
            onClick={() =>
              draftTp.mutate({
                contactId,
                channel: draft.channel,
                templateId: draft.templateId ?? undefined,
                subject: draft.subject ?? undefined,
                body: draft.body,
              })
            }
          >
            {draftTp.isPending ? "Saving…" : "Save to queue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
