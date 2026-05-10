"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Markdown } from "@/components/ui/markdown";
import { Sparkles, RefreshCw } from "lucide-react";
import type { PursuitWithDecodedJson } from "@/server/types/pursuit";

type CoverLetter = {
  subject: string;
  body: string;
};

function parseCoverLetter(raw: string | null): CoverLetter | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CoverLetter>;
    if (typeof parsed.body !== "string") return null;
    return {
      subject: typeof parsed.subject === "string" ? parsed.subject : "",
      body: parsed.body,
    };
  } catch {
    return null;
  }
}

export function CoverLetterTab({ pursuit }: { pursuit: PursuitWithDecodedJson }) {
  const utils = trpc.useUtils();
  const [hiringManager, setHiringManager] = useState("");

  const generate = trpc.pursuits.generateCoverLetter.useMutation({
    onSuccess: () => {
      toast.success("Cover letter generated");
      void utils.pursuits.byId.invalidate({ id: pursuit.id });
    },
    onError: (e) => toast.error(e.message),
  });

  const letter = parseCoverLetter(pursuit.coverLetter);
  const hasLetter = letter !== null;

  function runGenerate() {
    generate.mutate({
      id: pursuit.id,
      hiringManagerName: hiringManager.trim() || undefined,
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Cover letter</CardTitle>
        {hasLetter ? (
          <Button
            size="sm"
            variant="outline"
            disabled={generate.isPending}
            onClick={() => {
              if (confirm("Regenerate cover letter? This replaces the current draft."))
                runGenerate();
            }}
          >
            <RefreshCw
              className={generate.isPending ? "size-4 animate-spin" : "size-4"}
            />
            {generate.isPending ? "Regenerating…" : "Regenerate"}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 max-w-md">
          <Label htmlFor="hiring-manager" className="text-xs">
            Hiring manager name (optional)
          </Label>
          <Input
            id="hiring-manager"
            value={hiringManager}
            onChange={(e) => setHiringManager(e.target.value)}
            placeholder="e.g. Aditi Sharma"
          />
        </div>

        {!hasLetter && (
          <Button onClick={runGenerate} disabled={generate.isPending}>
            <Sparkles className="size-4" />
            {generate.isPending ? "Generating…" : "Generate cover letter"}
          </Button>
        )}

        {hasLetter && (
          <div className="space-y-3">
            {letter!.subject && (
              <p className="text-sm">
                <span className="font-medium">Subject:</span> {letter!.subject}
              </p>
            )}
            <div className="rounded-md border border-border bg-card p-4">
              <Markdown>{letter!.body}</Markdown>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
