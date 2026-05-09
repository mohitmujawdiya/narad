"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc";
import { Topbar } from "@/components/layout/topbar";
import Link from "next/link";

export default function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const contact = trpc.contacts.byId.useQuery({ id });

  if (contact.isLoading) return null;
  if (!contact.data) return <div className="p-6">Not found.</div>;

  const c = contact.data;

  return (
    <>
      <Topbar title={c.name} />
      <div className="p-6 max-w-3xl space-y-4">
        <div className="rounded-md border p-4 space-y-1">
          <p className="text-sm">
            <strong>Company:</strong>{" "}
            <Link href={`/companies/${c.companyId}`} className="underline">{c.company.name}</Link>
          </p>
          <p className="text-sm"><strong>Role:</strong> {c.role ?? "—"}</p>
          <p className="text-sm"><strong>Email:</strong> {c.email ?? "—"} {c.emailConfidence && <em className="text-xs text-muted-foreground">({c.emailConfidence})</em>}</p>
          <p className="text-sm"><strong>LinkedIn:</strong> {c.linkedinUrl ? <a href={c.linkedinUrl} className="underline">{c.linkedinUrl}</a> : "—"}</p>
          <p className="text-sm"><strong>Twitter:</strong> {c.twitterUrl ? <a href={c.twitterUrl} className="underline">{c.twitterUrl}</a> : "—"}</p>
          <p className="text-sm"><strong>Notes:</strong> {c.notes || "—"}</p>
        </div>

        <section>
          <h2 className="font-medium mb-2">Touchpoints</h2>
          {c.touchpoints.length === 0 ? (
            <p className="text-sm text-muted-foreground">No touchpoints yet. Draft one from the queue or here (coming in Task 23).</p>
          ) : (
            <ul className="divide-y border rounded-md">
              {c.touchpoints.map((tp) => (
                <li key={tp.id} className="px-3 py-2">
                  <p className="text-sm font-medium">{tp.channel} · {tp.status}</p>
                  <p className="text-xs text-muted-foreground">{tp.sentAt ? `Sent ${new Date(tp.sentAt).toLocaleString()}` : "Draft"}</p>
                  {tp.message && <p className="text-sm mt-1 line-clamp-2">{tp.message.body}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
