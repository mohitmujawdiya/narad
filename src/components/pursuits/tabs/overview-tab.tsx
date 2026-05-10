"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Pencil, X } from "lucide-react";
import type { PursuitWithDecodedJson } from "@/server/types/pursuit";

type ContactDraft = {
  contactName: string;
  contactRole: string;
  contactEmail: string;
  contactLinkedinUrl: string;
  contactTwitterUrl: string;
};

function toDraft(p: PursuitWithDecodedJson): ContactDraft {
  return {
    contactName: p.contactName ?? "",
    contactRole: p.contactRole ?? "",
    contactEmail: p.contactEmail ?? "",
    contactLinkedinUrl: p.contactLinkedinUrl ?? "",
    contactTwitterUrl: p.contactTwitterUrl ?? "",
  };
}

export function OverviewTab({ pursuit }: { pursuit: PursuitWithDecodedJson }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ContactDraft>(toDraft(pursuit));
  const utils = trpc.useUtils();

  const update = trpc.pursuits.update.useMutation({
    onSuccess: () => {
      toast.success("Saved");
      setEditing(false);
      void utils.pursuits.byId.invalidate({ id: pursuit.id });
    },
    onError: (e) => toast.error(e.message),
  });

  function startEdit() {
    setDraft(toDraft(pursuit));
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(toDraft(pursuit));
    setEditing(false);
  }

  function save() {
    update.mutate({
      id: pursuit.id,
      data: {
        // Empty string means "clear it" — we send empty so the server stores
        // empty string. The schema permits any string. Using `undefined` here
        // would skip the field instead of clearing it.
        contactName: draft.contactName,
        contactRole: draft.contactRole,
        contactEmail: draft.contactEmail,
        contactLinkedinUrl: draft.contactLinkedinUrl,
        contactTwitterUrl: draft.contactTwitterUrl,
      },
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pursuit</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <Row label="Company" value={pursuit.companyName} />
          <Row label="Domain" value={pursuit.companyDomain ?? "—"} />
          <Row
            label="Source"
            value={
              pursuit.pastedUrl ? (
                <a
                  href={pursuit.pastedUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-primary hover:underline inline-flex items-center gap-1 break-all"
                >
                  {pursuit.pastedUrl}
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              ) : (
                "—"
              )
            }
          />
          <Row label="Type" value={pursuit.type === "job" ? "Job" : "Company"} />
          <Row label="Status" value={pursuit.status} />
          <Row
            label="Fit"
            value={
              pursuit.fitScore != null
                ? `${pursuit.fitScore}/10${pursuit.fitReason ? ` — ${pursuit.fitReason}` : ""}`
                : "—"
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Contact</CardTitle>
          {!editing ? (
            <Button size="sm" variant="ghost" onClick={startEdit}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={cancelEdit}>
              <X className="size-3.5" />
              Cancel
            </Button>
          )}
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          {editing ? (
            <>
              <Field label="Name">
                <Input
                  value={draft.contactName}
                  onChange={(e) => setDraft({ ...draft, contactName: e.target.value })}
                />
              </Field>
              <Field label="Role">
                <Input
                  value={draft.contactRole}
                  onChange={(e) => setDraft({ ...draft, contactRole: e.target.value })}
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={draft.contactEmail}
                  onChange={(e) => setDraft({ ...draft, contactEmail: e.target.value })}
                />
              </Field>
              <Field label="LinkedIn URL">
                <Input
                  value={draft.contactLinkedinUrl}
                  onChange={(e) =>
                    setDraft({ ...draft, contactLinkedinUrl: e.target.value })
                  }
                />
              </Field>
              <Field label="Twitter URL">
                <Input
                  value={draft.contactTwitterUrl}
                  onChange={(e) =>
                    setDraft({ ...draft, contactTwitterUrl: e.target.value })
                  }
                />
              </Field>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={save} disabled={update.isPending}>
                  {update.isPending ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelEdit}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <Row label="Name" value={pursuit.contactName ?? "—"} />
              <Row label="Role" value={pursuit.contactRole ?? "—"} />
              <Row label="Email" value={pursuit.contactEmail ?? "—"} />
              <Row
                label="LinkedIn"
                value={
                  pursuit.contactLinkedinUrl ? (
                    <a
                      href={pursuit.contactLinkedinUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-primary hover:underline break-all"
                    >
                      {pursuit.contactLinkedinUrl}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <Row
                label="Twitter"
                value={
                  pursuit.contactTwitterUrl ? (
                    <a
                      href={pursuit.contactTwitterUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-primary hover:underline break-all"
                    >
                      {pursuit.contactTwitterUrl}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="font-medium min-w-[80px] shrink-0">{label}:</span>
      <span className="min-w-0 flex-1 break-words">{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
