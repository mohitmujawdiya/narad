"use client";

import { ExternalLink } from "lucide-react";

type Citation = { title: string; url: string; snippet?: string };

export function CitationList({ citations }: { citations: Citation[] }) {
  if (!citations || citations.length === 0) {
    return <p className="text-xs text-muted-foreground">No citations.</p>;
  }
  return (
    <ul className="text-xs space-y-1">
      {citations.map((c, i) => (
        <li key={`${c.url}-${i}`} className="flex items-start gap-1.5">
          <span className="text-muted-foreground">{i + 1}.</span>
          <a
            href={c.url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary hover:underline inline-flex items-center gap-1 break-all"
          >
            {c.title || c.url}
            <ExternalLink className="size-3 shrink-0" />
          </a>
        </li>
      ))}
    </ul>
  );
}
