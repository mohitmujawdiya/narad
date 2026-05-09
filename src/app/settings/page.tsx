"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function SettingsPage() {
  const profile = trpc.profile.get.useQuery();
  const update = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Settings saved");
      profile.refetch();
    },
  });
  const sync = trpc.profile.syncCareerOps.useMutation();

  const [careerOpsPath, setCareerOpsPath] = useState("");
  const [signature, setSignature] = useState("");
  const [visaPolicy, setVisaPolicy] = useState<"never-proactive" | "signal-on-positive-reply" | "disclose-upfront">("never-proactive");
  const [narrative, setNarrative] = useState("");
  const [confidenceThreshold, setConfidenceThreshold] = useState(75);

  useEffect(() => {
    if (profile.data) {
      setCareerOpsPath(profile.data.careerOpsPath ?? "");
      setSignature(profile.data.signature ?? "");
      setVisaPolicy(profile.data.visaDisclosurePolicy as typeof visaPolicy);
      setNarrative(profile.data.narrative ?? "");
      const sd = (profile.data.sendDefaults as { confidenceThreshold?: number } | null) ?? null;
      setConfidenceThreshold(sd?.confidenceThreshold ?? 75);
    }
  }, [profile.data]);

  if (profile.isLoading) return null;

  return (
    <>
      <Topbar title="Settings" />
      <div className="max-w-2xl p-6 space-y-8">
        <section className="space-y-3">
          <h2 className="font-medium">CareerOps integration</h2>
          <Label htmlFor="careerOpsPath">Path to CareerOps directory</Label>
          <Input
            id="careerOpsPath"
            value={careerOpsPath}
            onChange={(e) => setCareerOpsPath(e.target.value)}
            placeholder="/Users/you/path/to/career-ops"
          />
          <p className="text-xs text-muted-foreground">
            Narad will watch <code>cv.md</code>, <code>config/profile.yml</code>, and <code>data/applications.md</code>.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              sync.mutate(undefined, {
                onSuccess: () => toast.success("CareerOps profile synced"),
                onError: (e) => toast.error(e.message),
              });
            }}
            disabled={sync.isPending || !careerOpsPath}
          >
            {sync.isPending ? "Syncing…" : "Sync CV + profile.yml from CareerOps"}
          </Button>
        </section>

        <section className="space-y-3">
          <h2 className="font-medium">Visa disclosure policy</h2>
          <Select value={visaPolicy} onValueChange={(v) => setVisaPolicy(v as typeof visaPolicy)}>
            <SelectTrigger className="w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="never-proactive">Never proactive (default)</SelectItem>
              <SelectItem value="signal-on-positive-reply">Signal on positive reply</SelectItem>
              <SelectItem value="disclose-upfront">Disclose upfront</SelectItem>
            </SelectContent>
          </Select>
        </section>

        <section className="space-y-3">
          <h2 className="font-medium">Signature</h2>
          <Textarea
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            rows={3}
            placeholder="Mohit Mujawdiya · mohit@example.com · linkedin.com/in/…"
          />
        </section>

        <section className="space-y-3">
          <h2 className="font-medium">Narrative (one paragraph about you)</h2>
          <Textarea
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            rows={5}
            placeholder="Mechanical engineer building production AI products…"
          />
        </section>

        <section className="space-y-3">
          <h2 className="font-medium">AI draft confidence threshold</h2>
          <p className="text-xs text-muted-foreground">
            Drafts at or above this score are bulk-approvable; below it are flagged for individual review. Default 75/100.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={50}
              max={95}
              step={5}
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
              className="flex-1 max-w-xs"
            />
            <span className="text-sm tabular-nums w-12 text-right">{confidenceThreshold}/100</span>
          </div>
        </section>

        <Button
          onClick={() =>
            update.mutate({
              careerOpsPath,
              signature,
              visaDisclosurePolicy: visaPolicy,
              narrative,
              sendDefaults: { confidenceThreshold },
            })
          }
          disabled={update.isPending}
        >
          {update.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </>
  );
}
