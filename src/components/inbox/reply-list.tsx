"use client";

import { trpc } from "@/lib/trpc";
import { LogReplyDialog } from "@/components/send/log-reply-dialog";
import Link from "next/link";

export function ReplyList() {
  const awaiting = trpc.touchpoints.listAwaitingReply.useQuery();
  const replied = trpc.touchpoints.listReplied.useQuery();

  return (
    <div className="p-6 max-w-4xl space-y-8">
      <section>
        <h2 className="font-medium mb-2">Awaiting reply</h2>
        {awaiting.data?.length ? (
          <ul className="divide-y border rounded-md">
            {awaiting.data.map((tp) => (
              <li key={tp.id} className="px-3 py-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    <Link href={`/contacts/${tp.contact.id}`} className="hover:underline">{tp.contact.name}</Link>
                    <span className="text-muted-foreground"> · {tp.contact.company.name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tp.channel} · sent {tp.sentAt ? new Date(tp.sentAt).toLocaleString() : "—"}
                  </p>
                </div>
                <LogReplyDialog touchpointId={tp.id} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing awaiting reply.</p>
        )}
      </section>

      <section>
        <h2 className="font-medium mb-2">Recently replied</h2>
        {replied.data?.length ? (
          <ul className="divide-y border rounded-md">
            {replied.data.map((tp) => (
              <li key={tp.id} className="px-3 py-2">
                <p className="text-sm font-medium">
                  <Link href={`/contacts/${tp.contact.id}`} className="hover:underline">{tp.contact.name}</Link>
                  <span className="text-muted-foreground"> · {tp.contact.company.name}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Replied {tp.repliedAt ? new Date(tp.repliedAt).toLocaleString() : "—"}
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
