"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export function AiDraftDialog({
  pursuitId,
  defaultChannel = "email",
  open,
  onOpenChange,
}: {
  pursuitId: string;
  defaultChannel?: "email" | "linkedin";
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const utils = trpc.useUtils();
  const [channel, setChannel] = useState<"email" | "linkedin">(defaultChannel);
  const [goal, setGoal] = useState("");

  const draft = trpc.pursuits.draftOutreach.useMutation({
    onSuccess: () => {
      void utils.pursuits.byId.invalidate({ id: pursuitId });
      onOpenChange(false);
      setGoal("");
      toast.success("Draft generated");
    },
    onError: (err) => toast.error(err.message ?? "Draft failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Draft outreach with AI</DialogTitle>
          <DialogDescription>
            Generates a personalized message from this pursuit&apos;s research and your CV.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="channel">Channel</Label>
            <Select
              value={channel}
              onValueChange={(v) => setChannel(v as "email" | "linkedin")}
            >
              <SelectTrigger id="channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="goal">Goal (optional)</Label>
            <Textarea
              id="goal"
              placeholder="e.g. introduce yourself, mention X project, ask for a 15-min chat about the founding-engineer role"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {goal.length}/500 — leave blank to let the AI default to a peer-to-peer
              opener grounded in the most concrete signal from research.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            The model uses your profile, the contact&apos;s role, the pursuit&apos;s
            research (with citations), and your goal — and decides the register, hook,
            length, and ask. Takes ~5–15s.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={draft.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() =>
              draft.mutate({
                id: pursuitId,
                channel,
                goal: goal.trim() || undefined,
              })
            }
            disabled={draft.isPending}
          >
            <Sparkles className="size-4 mr-1.5" />
            {draft.isPending ? "Drafting…" : "Draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
