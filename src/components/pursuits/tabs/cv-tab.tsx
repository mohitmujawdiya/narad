"use client";

import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Markdown } from "@/components/ui/markdown";
import { Sparkles, RefreshCw } from "lucide-react";
import type { PursuitWithDecodedJson } from "@/server/types/pursuit";

type CvEdit = {
  section: string;
  current: string;
  proposed: string;
  rationale: string;
};

type CvVariant = {
  edits: CvEdit[];
  summary: string;
};

function parseCvVariant(raw: string | null): CvVariant | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CvVariant>;
    return {
      edits: Array.isArray(parsed.edits) ? parsed.edits : [],
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
    };
  } catch {
    return null;
  }
}

export function CvTab({ pursuit }: { pursuit: PursuitWithDecodedJson }) {
  const utils = trpc.useUtils();
  const profile = trpc.profile.get.useQuery();

  const generate = trpc.pursuits.generateCvVariant.useMutation({
    onSuccess: () => {
      toast.success("CV variant generated");
      void utils.pursuits.byId.invalidate({ id: pursuit.id });
    },
    onError: (e) => toast.error(e.message),
  });

  const variant = parseCvVariant(pursuit.cvVariant);
  const hasVariant = variant !== null;
  const cvMissing = !profile.data?.cvMarkdown;

  return (
    <div className="space-y-4">
      {cvMissing && (
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-700 dark:text-yellow-400">
          No base CV in your profile yet. Add one in{" "}
          <a href="/settings" className="underline">
            Settings
          </a>{" "}
          (or sync CareerOps) before generating a variant.
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">CV variant</CardTitle>
          {hasVariant ? (
            <Button
              size="sm"
              variant="outline"
              disabled={generate.isPending || cvMissing}
              onClick={() => {
                if (confirm("Regenerate CV variant? This replaces the current edits."))
                  generate.mutate({ id: pursuit.id });
              }}
            >
              <RefreshCw
                className={generate.isPending ? "size-4 animate-spin" : "size-4"}
              />
              {generate.isPending ? "Regenerating…" : "Regenerate"}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => generate.mutate({ id: pursuit.id })}
              disabled={generate.isPending || cvMissing}
              title={cvMissing ? "Add a base CV in Settings first" : undefined}
            >
              <Sparkles className="size-4" />
              {generate.isPending ? "Generating…" : "Generate CV variant"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {hasVariant ? (
            <>
              {variant!.summary && (
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Summary
                  </p>
                  <Markdown>{variant!.summary}</Markdown>
                </div>
              )}
              {variant!.edits.length === 0 ? (
                <p className="text-sm text-muted-foreground">No edits proposed.</p>
              ) : (
                <ul className="space-y-3">
                  {variant!.edits.map((edit, i) => (
                    <li
                      key={i}
                      className="rounded-md border border-border bg-card p-3 space-y-2"
                    >
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {edit.section || `Edit ${i + 1}`}
                      </p>
                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Current
                          </p>
                          <pre className="whitespace-pre-wrap font-sans text-sm bg-muted/40 rounded p-2">
                            {edit.current || "—"}
                          </pre>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] uppercase tracking-wide text-primary">
                            Proposed
                          </p>
                          <pre className="whitespace-pre-wrap font-sans text-sm bg-primary/5 border border-primary/20 rounded p-2">
                            {edit.proposed || "—"}
                          </pre>
                        </div>
                      </div>
                      {edit.rationale && (
                        <p className="text-xs italic text-muted-foreground">
                          Why: {edit.rationale}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No CV variant yet. Generates a tailored set of edits against your
              base CV based on the JD.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
