"use client";

import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Markdown } from "@/components/ui/markdown";
import { ExternalLink, Sparkles, RefreshCw } from "lucide-react";
import type { PursuitWithDecodedJson } from "@/server/types/pursuit";

export function JdTab({ pursuit }: { pursuit: PursuitWithDecodedJson }) {
  const utils = trpc.useUtils();
  const generate = trpc.pursuits.generateJdEvaluation.useMutation({
    onSuccess: () => {
      toast.success("Evaluation generated");
      void utils.pursuits.byId.invalidate({ id: pursuit.id });
    },
    onError: (e) => toast.error(e.message),
  });

  const hasEval = pursuit.jdEvaluation !== null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="text-base truncate">
              {pursuit.jdTitle ?? "Job description"}
            </CardTitle>
            {pursuit.jdUrl && (
              <a
                href={pursuit.jdUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1 break-all"
              >
                Open JD URL
                <ExternalLink className="size-3 shrink-0" />
              </a>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {pursuit.jdMarkdown ? (
            <Markdown>{pursuit.jdMarkdown}</Markdown>
          ) : (
            <p className="text-sm text-muted-foreground">No JD body captured.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">JD evaluation (A–G)</CardTitle>
          {hasEval ? (
            <Button
              size="sm"
              variant="outline"
              disabled={generate.isPending}
              onClick={() => {
                if (confirm("Regenerate evaluation? This replaces the current report."))
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
              disabled={generate.isPending}
            >
              <Sparkles className="size-4" />
              {generate.isPending ? "Generating…" : "Generate evaluation"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {hasEval ? (
            <Markdown>{pursuit.jdEvaluation!}</Markdown>
          ) : (
            <p className="text-sm text-muted-foreground">
              No evaluation yet. Generates an A–G report covering fit, blockers,
              tradeoffs, etc.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
