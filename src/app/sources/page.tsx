"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import Link from "next/link";

export default function SourcesPage() {
  const [input, setInput] = useState("");

  const detect = trpc.sources.detectFormat.useQuery(
    { input },
    { enabled: input.trim().length >= 5 },
  );

  const importMutation = trpc.sources.parseAndImport.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Imported ${result.inserted}/${result.parsed} (${result.duplicates} duplicates) from ${result.format}`,
      );
      setInput("");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <Topbar
        title="Sources"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/companies">View companies</Link>
          </Button>
        }
      />
      <div className="p-6 max-w-3xl space-y-4">
        <p className="text-sm text-muted-foreground">
          Paste any of:
          <span className="font-mono"> YC batch URL</span> ·
          <span className="font-mono"> Wellfound search URL</span> ·
          <span className="font-mono"> CSV (name,domain,...)</span> ·
          <span className="font-mono"> URL list (one per line)</span> ·
          <span className="font-mono"> single URL</span>.
          We detect the format, parse, and import as <em>Discovered</em>.
        </p>

        <div className="space-y-1">
          <Label htmlFor="paste">Paste source</Label>
          <Textarea
            id="paste"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={10}
            placeholder="https://www.ycombinator.com/companies?batch=W26"
            className="font-mono text-sm"
          />
          {detect.data && (
            <p className="text-xs text-muted-foreground">
              Detected format: <strong>{detect.data}</strong>
            </p>
          )}
          {input.trim().length >= 5 && detect.isFetched && !detect.data && (
            <p className="text-xs text-destructive">No matching format detected.</p>
          )}
        </div>

        <Button
          disabled={importMutation.isPending || !detect.data}
          onClick={() => importMutation.mutate({ input })}
        >
          {importMutation.isPending ? "Importing…" : "Parse & import"}
        </Button>

        {importMutation.data && (
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            <p>
              <strong>{importMutation.data.inserted}</strong> imported · {importMutation.data.duplicates} duplicates
              · {importMutation.data.parsed} parsed total
            </p>
            {importMutation.data.companyIds.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                <Link href="/companies" className="underline">View in kanban →</Link>
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
