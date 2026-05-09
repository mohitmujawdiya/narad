"use client";

import { use } from "react";
import { trpc } from "@/lib/trpc";
import { Topbar } from "@/components/layout/topbar";
import Link from "next/link";
import { DraftDialog } from "@/components/messages/draft-dialog";
import { AiDraftDialog } from "@/components/messages/ai-draft-dialog";
import { Markdown } from "@/components/ui/markdown";
import { TouchpointRow } from "@/components/contacts/touchpoint-row";

export default function Page(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const contact = trpc.contacts.byId.useQuery({ id });
  const profile = trpc.profile.get.useQuery();
  const threshold = ((profile.data?.sendDefaults as { confidenceThreshold?: number } | null)?.confidenceThreshold) ?? 75;

  if (contact.isLoading || contact.isPending) {
    return (
      <>
        <Topbar title="Loading…" />
        <div className="p-6 max-w-3xl space-y-3">
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
          <div className="h-32 w-full bg-muted/60 rounded animate-pulse" />
        </div>
      </>
    );
  }
  if (contact.error || !contact.data) {
    return (
      <>
        <Topbar title="Not found" />
        <div className="p-6 text-sm text-muted-foreground">
          {contact.error?.message ?? "Contact not found."}
        </div>
      </>
    );
  }

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
          <div className="text-sm space-y-1">
            <strong>Notes:</strong>
            {c.notes ? (
              <Markdown className="text-sm">{c.notes}</Markdown>
            ) : (
              <p className="text-muted-foreground inline">—</p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <AiDraftDialog contactId={c.id} />
          <DraftDialog contactId={c.id} />
        </div>

        <section>
          <h2 className="font-medium mb-2">Touchpoints</h2>
          {c.touchpoints.length === 0 ? (
            <p className="text-sm text-muted-foreground">No touchpoints yet. Draft one from the queue or here (coming in Task 23).</p>
          ) : (
            <ul className="divide-y border rounded-md overflow-hidden">
              {c.touchpoints.map((tp) => (
                <TouchpointRow
                  key={tp.id}
                  touchpoint={tp}
                  contactId={c.id}
                  threshold={threshold}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
