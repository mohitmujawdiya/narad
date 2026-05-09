"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

export function AiDraftDialog({ contactId, defaultChannel = "email" }: { contactId: string; defaultChannel?: "email" | "linkedin" }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<"email" | "linkedin">(defaultChannel);
  const [templateId, setTemplateId] = useState<string | null>(null);

  const templates = trpc.templates.list.useQuery({ channel });
  const aiDraft = trpc.drafting.aiDraft.useMutation({
    onSuccess: () => {
      toast.success("AI draft saved to queue");
      setOpen(false);
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
              className="border rounded-md h-9 px-2 w-full"
              value={channel}
              onChange={(e) => {
                setChannel(e.target.value as "email" | "linkedin");
                setTemplateId(null);
              }}
            >
              <option value="email">Email</option>
              <option value="linkedin">LinkedIn</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label>Template</Label>
            <Select value={templateId ?? ""} onValueChange={(v) => setTemplateId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.data?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} · {t.contactType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            Claude Opus drafts the message using your profile, the company research, and this template.
            You'll see + edit it in the queue. Takes ~5–15s.
          </p>
        </div>

        <DialogFooter>
          <Button
            disabled={!templateId || aiDraft.isPending}
            onClick={() => templateId && aiDraft.mutate({ contactId, templateId })}
          >
            {aiDraft.isPending ? "Drafting…" : "Generate draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
