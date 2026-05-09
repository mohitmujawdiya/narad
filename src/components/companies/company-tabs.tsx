"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { type RouterOutputs } from "@/lib/trpc-types";
import Link from "next/link";
import { AddContactDialog } from "@/components/contacts/add-contact-dialog";
import { ResearchTab } from "./research-tab";
import { Markdown } from "@/components/ui/markdown";

type Company = RouterOutputs["companies"]["byId"];

export function CompanyTabs({ company }: { company: Company }) {
  const utils = trpc.useUtils();
  const setStatus = trpc.companies.setStatus.useMutation({
    onMutate: async ({ id, status }) => {
      // Optimistic — flip the status in the byId cache so the active button
      // highlights instantly. Also flip in the kanban list cache so when the
      // user navigates back to /companies the new status is already shown.
      await Promise.all([
        utils.companies.byId.cancel({ id }),
        utils.companies.list.cancel(),
      ]);
      const previousById = utils.companies.byId.getData({ id });
      const previousList = utils.companies.list.getData();
      if (previousById) {
        utils.companies.byId.setData({ id }, { ...previousById, status });
      }
      utils.companies.list.setData(undefined, (old) =>
        old?.map((c) => (c.id === id ? { ...c, status } : c)),
      );
      return { previousById, previousList };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previousById) utils.companies.byId.setData({ id: company.id }, ctx.previousById);
      if (ctx?.previousList) utils.companies.list.setData(undefined, ctx.previousList);
      toast.error(err.message);
    },
    onSettled: () => {
      // Re-sync with server truth in the background.
      void utils.companies.byId.invalidate({ id: company.id });
      void utils.companies.list.invalidate();
    },
  });
  const remove = trpc.companies.remove.useMutation({
    onMutate: async ({ id }) => {
      await utils.companies.list.cancel();
      const previousList = utils.companies.list.getData();
      utils.companies.list.setData(undefined, (old) => old?.filter((c) => c.id !== id));
      return { previousList };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previousList) utils.companies.list.setData(undefined, ctx.previousList);
      toast.error(err.message);
    },
    onSuccess: () => {
      toast.success("Company removed");
      window.location.href = "/companies";
    },
  });

  return (
    <div className="space-y-4 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{company.name}</h2>
          <p className="text-sm text-muted-foreground">
            {company.domain ?? "no domain"}{company.sector && ` · ${company.sector}`}
            {company.stage && ` · ${company.stage}`}
          </p>
        </div>
        <div className="flex gap-2">
          {(["Targeting", "Active", "Paused", "Disqualified"] as const).map((s) => (
            <Button
              key={s}
              variant={company.status === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatus.mutate({ id: company.id, status: s })}
            >
              {s}
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            disabled={remove.isPending}
            onClick={() => confirm("Remove?") && remove.mutate({ id: company.id })}
          >
            {remove.isPending ? "Removing…" : "Remove"}
          </Button>
        </div>
      </header>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="research">Research</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({company.contacts.length})</TabsTrigger>
          <TabsTrigger value="outreach">Outreach</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-2">
          <p className="text-sm">
            <strong>Source:</strong>{" "}
            {company.sourceUrl ? (
              <a href={company.sourceUrl} className="underline">
                {company.sourceUrl}
              </a>
            ) : (
              "—"
            )}
          </p>
          <p className="text-sm">
            <strong>Headcount:</strong> {company.headcount ?? "—"}
          </p>
          <p className="text-sm">
            <strong>Fit score:</strong> {company.fitScore ?? "—"}
          </p>
        </TabsContent>

        <TabsContent value="research" className="space-y-2">
          <ResearchTab companyId={company.id} />
        </TabsContent>

        <TabsContent value="contacts" className="space-y-3">
          <AddContactDialog companyId={company.id} />
          {company.contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contacts yet.</p>
          ) : (
            <ul className="divide-y border rounded-md">
              {company.contacts.map((c) => (
                <li key={c.id} className="px-3 py-2 flex items-center justify-between">
                  <div>
                    <Link href={`/contacts/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                    <p className="text-xs text-muted-foreground">{c.role ?? "—"}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{c.touchpoints?.length ?? 0} touchpoint{(c.touchpoints?.length ?? 0) === 1 ? "" : "s"}</span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="outreach" className="space-y-2">
          {/* Lists touchpoints; populated in later tasks */}
          <p className="text-sm text-muted-foreground">Outreach feed lands in Task 21+.</p>
        </TabsContent>

        <TabsContent value="notes" className="space-y-2">
          {company.notes ? <Markdown>{company.notes}</Markdown> : <p className="text-sm text-muted-foreground">No notes.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
