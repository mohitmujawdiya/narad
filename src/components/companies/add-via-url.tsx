"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function AddViaUrl() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");

  const create = trpc.companies.createFromUrl.useMutation({
    onSuccess: (company) => {
      toast.success(`${company.name} added`);
      router.push(`/companies/${company.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate({ url, notes: notes || undefined });
      }}
      className="space-y-4 max-w-xl"
    >
      <div className="space-y-2">
        <Label htmlFor="url">Company URL</Label>
        <Input
          id="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://stripe.com or stripe.com"
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          Paste a homepage, LinkedIn company URL, or Crunchbase page. We extract the domain.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Why this company is interesting…"
        />
      </div>
      <Button type="submit" disabled={create.isPending || !url}>
        {create.isPending ? "Adding…" : "Add company"}
      </Button>
    </form>
  );
}
