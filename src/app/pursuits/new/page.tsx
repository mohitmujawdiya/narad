"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { Topbar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const FORMAT_LABELS: Record<string, string> = {
  "yc-batch": "YC batch URL",
  "wellfound-search": "Wellfound search URL",
  csv: "CSV (name,domain,…)",
  "url-list": "URL list (one per line)",
  "single-url": "Single company URL",
  "jd-url": "Job posting URL",
};

const PLACEHOLDER = `Paste any of:
  • Single URL (company or careers page)
  • Job posting URL (JD)
  • CSV (name,domain,…)
  • URL list (one per line)
  • YC batch URL (e.g. https://www.ycombinator.com/companies?batch=W26)
  • Wellfound search URL`;

export default function NewPursuitPage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [debounced, setDebounced] = useState("");

  // Debounce input -> 300ms before format detection fires.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(input), 300);
    return () => clearTimeout(id);
  }, [input]);

  const trimmedDebounced = debounced.trim();
  const detect = trpc.sources.detect.useQuery(
    { raw: trimmedDebounced },
    { enabled: trimmedDebounced.length >= 5 },
  );

  const importMutation = trpc.sources.parseAndImport.useMutation({
    onSuccess: (result) => {
      if (result.inserted > 0) {
        toast.success(
          `Imported ${result.inserted}/${result.parsed} from ${result.format}`,
        );
      } else if (result.errors.length > 0) {
        toast.error(`Import failed: ${result.errors[0]}`);
      } else {
        toast(`Nothing imported (${result.format})`);
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const result = importMutation.data;
  const trimmed = input.trim();
  const canSubmit =
    !importMutation.isPending && trimmed.length >= 5 && !!detect.data?.format;

  const detectedLabel = useMemo(() => {
    if (!detect.data) return null;
    return FORMAT_LABELS[detect.data.format] ?? detect.data.format;
  }, [detect.data]);

  function handleSubmit() {
    if (!canSubmit) return;
    importMutation.mutate({ raw: input });
  }

  return (
    <>
      <Topbar
        title="New pursuit"
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/pursuits">Back to pursuits</Link>
          </Button>
        }
      />
      <div className="p-6">
        <div className="mx-auto w-full max-w-[700px] space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add pursuit</CardTitle>
              <CardDescription>
                Paste a URL, a CSV, or a list. Narad detects the format, parses
                it, and imports each result as a discovered pursuit.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="paste">Paste source</Label>
                <Textarea
                  id="paste"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={10}
                  placeholder={PLACEHOLDER}
                  className="font-mono text-sm"
                />
                <div className="min-h-5 text-xs">
                  {trimmed.length === 0 ? (
                    <span className="text-muted-foreground">
                      Format will be detected as you type.
                    </span>
                  ) : trimmed.length < 5 ? (
                    <span className="text-muted-foreground">
                      Keep typing…
                    </span>
                  ) : detect.isFetching && !detect.data ? (
                    <span className="text-muted-foreground">Detecting…</span>
                  ) : detectedLabel ? (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      Detected:
                      <Badge variant="secondary">{detectedLabel}</Badge>
                    </span>
                  ) : detect.isFetched ? (
                    <span className="text-destructive">
                      No matching format detected.
                    </span>
                  ) : (
                    <span className="text-muted-foreground">&nbsp;</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={handleSubmit} disabled={!canSubmit}>
                  {importMutation.isPending ? "Importing…" : "Import"}
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/pursuits">Cancel</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {result && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Import summary</CardTitle>
                <CardDescription>
                  Detected format:{" "}
                  <Badge variant="secondary">
                    {FORMAT_LABELS[result.format] ?? result.format}
                  </Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Parsed: {result.parsed}</Badge>
                  <Badge variant="outline">Inserted: {result.inserted}</Badge>
                  {result.errors.length > 0 && (
                    <Badge variant="destructive">
                      Errors: {result.errors.length}
                    </Badge>
                  )}
                </div>

                {result.errors.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Errors
                    </p>
                    <ul className="list-disc pl-5 text-xs text-destructive space-y-0.5">
                      {result.errors.map((err, i) => (
                        <li key={i} className="font-mono">
                          {err}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => router.push("/pursuits")}
                  >
                    Done
                  </Button>
                  {result.inserted > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setInput("");
                        importMutation.reset();
                      }}
                    >
                      Import more
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
