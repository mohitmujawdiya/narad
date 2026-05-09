"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export function AiDraftDialog({ contactId, defaultChannel = "email" }: { contactId: string; defaultChannel?: "email" | "linkedin" }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<"email" | "linkedin">(defaultChannel);
  const [goal, setGoal] = useState("");

  const aiDraft = trpc.drafting.aiDraft.useMutation({
    onSuccess: () => {
      toast.success("AI draft saved to queue");
      setOpen(false);
      setGoal("");
      void utils.touchpoints.listQueue.invalidate();
      router.push("/queue");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">
          <Sparkles className="size-4" />
          AI draft
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>AI draft</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Channel</Label>
            <select
              className="border rounded-md h-9 px-2 w-full bg-background"
              value={channel}
              onChange={(e) => setChannel(e.target.value as "email" | "linkedin")}
            >
              <option value="email">Email</option>
              <option value="linkedin">LinkedIn</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="ai-draft-goal">Goal (optional)</Label>
            <Textarea
              id="ai-draft-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
              placeholder='e.g., applying for the VA role; want 15-min call to discuss their AI thesis'
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              One sentence. Leave blank to let the AI default to a peer-to-peer conversation grounded in the most concrete signal from research.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            The model uses your profile, the contact's role, the company's research (with citations), and your goal — and decides the register, hook, length, and ask. Takes ~5–15s.
          </p>
        </div>

        <DialogFooter>
          <Button
            disabled={aiDraft.isPending}
            onClick={() => aiDraft.mutate({ contactId, channel, goal: goal.trim() || undefined })}
          >
            {aiDraft.isPending ? "Drafting…" : "Generate draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
