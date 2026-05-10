"use client";

import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { LogReplyDialog } from "@/components/send/log-reply-dialog";

function relativeTime(date: Date | null): string {
  if (!date) return "—";
  const ms = Date.now() - new Date(date).getTime();
  const sec = Math.round(ms / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 14) return `${day}d ago`;
  return new Date(date).toLocaleDateString();
}

export function ReplyList() {
  const awaiting = trpc.pursuits.listAwaitingReply.useQuery();
  const replied = trpc.pursuits.listReplied.useQuery({ limit: 20 });

  return (
    <div className="p-6 max-w-4xl space-y-8">
      <section>
        <h2 className="font-medium mb-2">Awaiting reply</h2>
        {awaiting.isLoading ? (
          <div className="h-16 rounded-md border bg-muted/30 animate-pulse" />
        ) : awaiting.data?.length ? (
          <ul className="divide-y border rounded-md">
            {awaiting.data.map((p) => (
              <li key={p.id} className="px-3 py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    <Link href={`/pursuits/${p.id}`} className="hover:underline">
                      {p.companyName}
                    </Link>
                    {p.contactName && (
                      <span className="text-muted-foreground"> · {p.contactName}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.outreachChannel ?? "email"} · sent {relativeTime(p.outreachSentAt)}
                  </p>
                </div>
                <LogReplyDialog pursuitId={p.id} pursuitName={p.companyName} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing awaiting reply.</p>
        )}
      </section>

      <section>
        <h2 className="font-medium mb-2">Recently replied</h2>
        {replied.isLoading ? (
          <div className="h-16 rounded-md border bg-muted/30 animate-pulse" />
        ) : replied.data?.length ? (
          <ul className="divide-y border rounded-md">
            {replied.data.map((p) => (
              <li key={p.id} className="px-3 py-2">
                <p className="text-sm font-medium">
                  <Link href={`/pursuits/${p.id}`} className="hover:underline">
                    {p.companyName}
                  </Link>
                  {p.contactName && (
                    <span className="text-muted-foreground"> · {p.contactName}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Replied {relativeTime(p.outreachRepliedAt)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No replies yet.</p>
        )}
      </section>
    </div>
  );
}
